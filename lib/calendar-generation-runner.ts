import { getProject } from "@/lib/db/projects";
import { getStoredProjectArticleDefaults } from "@/lib/db/article-defaults";
import { hasConfiguredDefaultLLM } from "@/lib/db/settings";
import {
  addCalendarGenerationJobLog,
  claimPendingCalendarGenerationJob,
  completeCalendarGenerationJob,
  failCalendarGenerationJob,
  getCalendarGenerationJob,
  setCalendarGenerationJobStage,
  startCalendarGenerationJob,
  updateCalendarGenerationJobProgress,
} from "@/lib/db/calendar-generation-jobs";
import {
  createCalendarItems,
  deleteCalendarItemsByProject,
  listCalendarItems,
} from "@/lib/db/calendar";
import { getDb } from "@/lib/db";
import { getLatestCrawlResults } from "@/lib/db/crawl-jobs";
import { listManualUrls } from "@/lib/db/manual-urls";
import { getLatestProjectSEOInsight, parseSEOInsight } from "@/lib/db/seo-insights";
import { buildContentCalendarPrompt } from "@/lib/prompts";
import { getStructuredPromptInstruction } from "@/lib/prompts/toon";
import { chat } from "@/lib/llm";
import { sendNotification } from "@/lib/notifications";
import type { CalendarItem } from "@/lib/app-types";
import type { CalendarGenerationJob } from "@/lib/db";
import { parseCalendarItemsFromLlmContent } from "@/lib/calendar-generation-parser";

const TOTAL_STEPS = 6;

type RunnerEventName = "log" | "progress" | "done";

interface RunnerHooks {
  onEvent?: (event: RunnerEventName, data: unknown) => void;
}

type CalendarUniquenessItem = {
  title?: string;
  primaryKeyword?: string;
  targetUrl?: string;
};

function listProjectInternalLinks(projectId: string) {
  const db = getDb();
  return db
    .prepare("SELECT url, title FROM project_internal_links WHERE project_id = ? ORDER BY created_at DESC")
    .all(projectId) as Array<{ url: string; title: string | null }>;
}

function sanitizeInternalLinkTargets(
  value: CalendarItem["internalLinkTargets"] | undefined,
  allowedLinks: Array<{ url: string; title: string | null }>
) {
  const allowedByUrl = new Map(
    allowedLinks.map((link) => [link.url.trim().toLowerCase(), { url: link.url, title: link.title ?? link.url }])
  );
  return (value ?? [])
    .map((entry) => {
      const url = typeof entry === "string" ? entry : entry?.url;
      if (!url) return null;
      const allowed = allowedByUrl.get(url.trim().toLowerCase());
      if (!allowed) return null;
      return {
        url: allowed.url,
        title:
          typeof entry !== "string" && entry?.title?.trim()
            ? entry.title.trim()
            : allowed.title,
        reason:
          typeof entry !== "string" && entry?.reason?.trim()
            ? entry.reason.trim()
            : "Relevant internal page provided in project settings.",
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);
}

export async function processCalendarGenerationJob(jobId: string, hooks: RunnerHooks = {}) {
  const startingJob = getCalendarGenerationJob(jobId);
  if (!startingJob) {
    throw new Error("Calendar generation job not found");
  }

  const project = getProject(startingJob.project_id);
  if (!project) {
    const message = "Project not found";
    addRunnerLog(jobId, hooks, "error", message, "failed");
    failCalendarGenerationJob(jobId, message);
    hooks.onEvent?.("done", { status: "failed", job: getCalendarGenerationJob(jobId), error: message });
    return getCalendarGenerationJob(jobId);
  }

  if (!hasConfiguredDefaultLLM()) {
    const message =
      "AI provider not configured. Add at least one API key provider and model in App Settings before scheduling article ideas.";
    addRunnerLog(jobId, hooks, "error", message, "failed");
    failCalendarGenerationJob(jobId, message);
    hooks.onEvent?.("done", { status: "failed", job: getCalendarGenerationJob(jobId), error: message });
    return getCalendarGenerationJob(jobId);
  }

  const claimedJob =
    startingJob.status === "pending"
      ? claimPendingCalendarGenerationJob(jobId)
      : getCalendarGenerationJob(jobId);
  const activeJob = claimedJob ?? getCalendarGenerationJob(jobId);
  if (!activeJob) {
    throw new Error("Calendar generation job unavailable");
  }

  if (startingJob.status === "pending" && !claimedJob) {
    return activeJob;
  }

  startCalendarGenerationJob(jobId);
  addRunnerLog(
    jobId,
    hooks,
    "info",
    `Starting calendar generation for project ${project.name}`,
    "loading",
    {
      startDate: activeJob.start_date,
      endDate: activeJob.end_date,
      replaceExisting: !!activeJob.replace_existing,
      appendExisting: !!activeJob.append_existing,
      wholeMonth: !!activeJob.whole_month,
    }
  );

  try {
    const today = new Date();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    const nextMonthStart = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    const nextMonthEnd = new Date(today.getFullYear(), today.getMonth() + 2, 0);
    const resolvedStart =
      activeJob.start_date ??
      (activeJob.append_existing
        ? nextMonthStart.toISOString().split("T")[0]
        : monthStart.toISOString().split("T")[0]);
    const resolvedEnd =
      activeJob.end_date ??
      (activeJob.append_existing
        ? nextMonthEnd.toISOString().split("T")[0]
        : monthEnd.toISOString().split("T")[0]);
    const effectiveCount = activeJob.whole_month
      ? Math.min(
          Math.ceil(
            (new Date(resolvedEnd).getTime() - new Date(resolvedStart).getTime()) /
              (24 * 60 * 60 * 1000)
          ) + 1,
          31
        )
      : activeJob.suggestion_count ?? 12;

    updateStep(jobId, hooks, 1, TOTAL_STEPS, "loading", "Loading crawl pages and scheduling inputs", {
      etaSeconds: 25,
      totalItems: effectiveCount,
    });

    const crawlPages = getLatestCrawlResults(project.id);
    const manualUrls = listManualUrls(project.id);
    const manualPages = manualUrls.map((u) => ({ url: u.url, title: u.title ?? u.url }));
    const existingPages = crawlPages.length > 0 ? crawlPages : manualPages;
    const internalLinks = listProjectInternalLinks(project.id);
    if (existingPages.length === 0) {
      throw new Error("No pages found. Run a crawl or add manual URLs first.");
    }
    addRunnerLog(jobId, hooks, "info", "Loaded source pages for scheduling", "loading", {
      crawlPages: crawlPages.length,
      manualPages: manualPages.length,
      sourcePagesUsed: existingPages.length,
      internalLinks: internalLinks.length,
    });

    updateStep(jobId, hooks, 2, TOTAL_STEPS, "loading", "Loading keywords, SEO research, and uniqueness checks", {
      etaSeconds: 20,
      totalItems: effectiveCount,
    });

    const db = getDb();
    const keywords = db
      .prepare(
        `SELECT keyword FROM project_keywords WHERE project_id = ? ORDER BY created_at DESC LIMIT 150`
      )
      .all(project.id) as { keyword: string }[];
    const extractedKeywords = keywords.map((row) => row.keyword);
    const seoInsight = parseSEOInsight(getLatestProjectSEOInsight(project.id));
    const currentCalendarItems = listCalendarItems(project.id);
    const existingItems = activeJob.append_existing || activeJob.feedback ? currentCalendarItems : [];
    const existingForPrompt = existingItems.map((item) => {
      const secondary = item.secondary_keywords
        ? (typeof item.secondary_keywords === "string"
            ? (JSON.parse(item.secondary_keywords) as string[])
            : item.secondary_keywords)
        : [];
      return {
        targetUrl: item.target_url ?? undefined,
        primaryKeyword: item.primary_keyword,
        secondaryKeywords: Array.isArray(secondary) ? secondary : [],
        title: item.title,
      };
    });
    const publishedForPrompt = listPublishedArticleUniquenessItems(project.id);

    addRunnerLog(jobId, hooks, "info", "Loaded project research context", "loading", {
      extractedKeywords: extractedKeywords.length,
      existingScheduledItems: existingForPrompt.length,
      publishedArticles: publishedForPrompt.length,
      seoTopics: seoInsight?.topics.length ?? 0,
      seoKeywords: seoInsight?.keywords.length ?? 0,
    });

    updateStep(jobId, hooks, 3, TOTAL_STEPS, "preparing", "Building structured prompt for AI scheduling", {
      etaSeconds: 15,
      totalItems: effectiveCount,
    });

    const homepageUrl = project.homepage_url ?? existingPages[0]?.url ?? "";
    const internalLinksAsPages: { url: string; title: string }[] = internalLinks.map((l) => ({
      url: l.url,
      title: l.title ?? l.url,
    }));
    const projectDefaults = getStoredProjectArticleDefaults(project.id);
    const prompt = buildContentCalendarPrompt({
      homepageUrl,
      existingPages,
      internalLinks: internalLinksAsPages,
      usedSitemap: false,
      suggestionCount: effectiveCount,
      publishingFrequency: "2 per week",
      extractedKeywords: extractedKeywords.length > 0 ? extractedKeywords : undefined,
      contentIdeaCustomInstructions: projectDefaults?.contentIdeaCustomInstructions?.trim() || undefined,
      domainKnowledge: projectDefaults?.domainKnowledge?.trim() || undefined,
      seoReference: seoInsight
        ? {
            summary: seoInsight.summary,
            topics: seoInsight.topics,
            questions: seoInsight.reference.questions,
            painPoints: seoInsight.reference.painPoints,
            contentAngles: seoInsight.reference.contentAngles,
            productsServices: seoInsight.reference.productsServices,
          }
        : undefined,
      wholeMonth: !!activeJob.whole_month,
      startDate: resolvedStart,
      endDate: resolvedEnd,
      userFeedback: activeJob.feedback ?? undefined,
      existingItems: existingForPrompt.length > 0 ? existingForPrompt : undefined,
      publishedItems: publishedForPrompt.length > 0 ? publishedForPrompt : undefined,
    });
    addRunnerLog(jobId, hooks, "info", "Built scheduling prompt", "preparing", {
      promptLength: prompt.length,
      promptPreview: prompt.slice(0, 600),
      sourcePages: existingPages.length,
      existingItemsForPrompt: existingForPrompt.length,
      publishedItemsForPrompt: publishedForPrompt.length,
    });

    setCalendarGenerationJobStage(jobId, "generating", {
      message: "Requesting scheduled article ideas from AI",
      etaSeconds: 12,
      totalItems: effectiveCount,
    });
    emitProgress(jobId, hooks);
    addRunnerLog(jobId, hooks, "info", "Sending scheduling request to AI", "generating", {
      requestedIdeas: effectiveCount,
      startDate: resolvedStart,
      endDate: resolvedEnd,
      replaceExisting: !!activeJob.replace_existing,
      appendExisting: !!activeJob.append_existing,
    });

    const result = await chat(
      [
        {
          role: "system",
          content:
            `You are a senior content strategist. Follow the prompt exactly, stay commercially relevant, avoid duplicates, and return only a bare JSON array. Never return an error object or explanatory note. ${getStructuredPromptInstruction()}`,
        },
        { role: "user", content: prompt },
      ],
      undefined,
      {
        projectId: project.id,
        requestLabel: "content-calendar",
        temperature: 0.2,
        maxOutputTokens: null,
        responseFormat: "text",
      }
    );
    const content = result.content?.trim() ?? "[]";
    addRunnerLog(jobId, hooks, "info", "Received AI response for scheduled article ideas", "generating", {
      responseLength: content.length,
      responsePreview: content.slice(0, 600),
    });

    updateStep(jobId, hooks, 4, TOTAL_STEPS, "parsing", "Validating and deduplicating AI suggestions", {
      etaSeconds: 6,
      totalItems: effectiveCount,
    });

    let items: CalendarItem[];
    let rawCandidateCount = 0;
    try {
      const parsedResult = parseCalendarItemsFromLlmContent(content);
      rawCandidateCount = parsedResult.meta.candidateCount;
      items = parsedResult.items;
      addRunnerLog(jobId, hooks, "info", "Parsed AI scheduling response", "parsing", {
        rootType: parsedResult.meta.rootType,
        candidateCount: parsedResult.meta.candidateCount,
        objectKeys: parsedResult.meta.objectKeys,
      });
      items = items.map((item) => ({
        ...item,
        targetUrl: undefined,
        internalLinkTargets: sanitizeInternalLinkTargets(item.internalLinkTargets, internalLinks),
      }));
      addRunnerLog(jobId, hooks, "info", "Normalized parsed scheduling items before deduplication", "parsing", {
        normalizedItems: items.length,
        sampleTitles: items.slice(0, 5).map((item) => item.title),
      });
      items = filterUniqueCalendarItems(items, [...existingForPrompt, ...publishedForPrompt]);
    } catch {
      throw new Error("Failed to parse AI response as JSON");
    }

    if (items.length === 0) {
      addRunnerLog(jobId, hooks, "warn", "No unique items remained after parsing and deduplication", "parsing", {
        rawCandidateCount,
        existingScheduledItems: existingForPrompt.length,
        publishedArticles: publishedForPrompt.length,
        responsePreview: content.slice(0, 800),
      });
      addRunnerLog(jobId, hooks, "warn", "Falling back to smaller date-scoped scheduling batches", "parsing", {
        requestedIdeas: effectiveCount,
        startDate: resolvedStart,
        endDate: resolvedEnd,
      });
      items = await generateCalendarItemsIncrementally({
        jobId,
        hooks,
        projectId: project.id,
        homepageUrl,
        existingPages,
        extractedKeywords,
        seoInsight,
        existingForPrompt,
        publishedForPrompt,
        feedback: activeJob.feedback ?? undefined,
        startDate: resolvedStart,
        endDate: resolvedEnd,
        count: effectiveCount,
        internalLinks,
      });
    }

    if (items.length === 0) {
      throw new Error("AI returned no unique calendar items to schedule.");
    }

    addRunnerLog(jobId, hooks, "info", "Validated scheduled article ideas", "parsing", {
      uniqueIdeas: items.length,
      requestedIdeas: effectiveCount,
    });

    updateStep(jobId, hooks, 5, TOTAL_STEPS, "saving", "Saving scheduled article ideas to the calendar", {
      etaSeconds: 2,
      totalItems: items.length,
      generatedItems: 0,
    });

    if (activeJob.replace_existing && !activeJob.append_existing) {
      deleteCalendarItemsByProject(project.id);
      addRunnerLog(jobId, hooks, "warn", "Cleared existing scheduled ideas before saving new ones", "saving");
    }

    const created = createCalendarItems(project.id, null, items);
    addRunnerLog(jobId, hooks, "info", "Saved scheduled article ideas to database", "saving", {
      createdItems: created.length,
      sampleTitles: created.slice(0, 5).map((item) => item.title),
      startDate: resolvedStart,
      endDate: resolvedEnd,
    });
    updateCalendarGenerationJobProgress(jobId, TOTAL_STEPS, TOTAL_STEPS, {
      stage: "saving",
      message: `Saved ${created.length} scheduled article ideas`,
      etaSeconds: 0,
      generatedItems: created.length,
      totalItems: items.length,
    });
    emitProgress(jobId, hooks);

    sendNotification(
      "calendar_generated",
      "Content calendar generated",
      `Generated ${created.length} article suggestions for your project.`,
      project.name
    ).catch(() => {});

    completeCalendarGenerationJob(
      jobId,
      created.length,
      items.length,
      `Generated ${created.length} scheduled article ideas`
    );
    addRunnerLog(jobId, hooks, "info", "Calendar generation completed successfully", "completed", {
      createdItems: created.length,
      requestedIdeas: effectiveCount,
    });
    const completedJob = getCalendarGenerationJob(jobId);
    hooks.onEvent?.("done", {
      status: "completed",
      job: completedJob,
      items: created,
    });
    return completedJob;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Calendar generation failed";
    addRunnerLog(jobId, hooks, "error", message, "failed");
    failCalendarGenerationJob(jobId, message);
    const failedJob = getCalendarGenerationJob(jobId);
    hooks.onEvent?.("done", { status: "failed", job: failedJob, error: message });
    return failedJob;
  }
}

function updateStep(
  jobId: string,
  hooks: RunnerHooks,
  step: number,
  totalSteps: number,
  stage: "loading" | "preparing" | "parsing" | "saving",
  message: string,
  updates?: {
    etaSeconds?: number | null;
    generatedItems?: number;
    totalItems?: number;
  }
) {
  updateCalendarGenerationJobProgress(jobId, step, totalSteps, {
    stage,
    message,
    etaSeconds: updates?.etaSeconds ?? null,
    generatedItems: updates?.generatedItems,
    totalItems: updates?.totalItems,
  });
  emitProgress(jobId, hooks);
}

function emitProgress(jobId: string, hooks: RunnerHooks) {
  const job = getCalendarGenerationJob(jobId);
  if (!job) return;
  hooks.onEvent?.("progress", serializeJob(job));
}

function serializeJob(job: CalendarGenerationJob) {
  return {
    id: job.id,
    status: job.status,
    progress: job.progress,
    totalSteps: job.total_steps,
    generatedItems: job.generated_items,
    totalItems: job.total_items,
    stage: job.current_stage,
    message: job.current_message,
    etaSeconds: job.eta_seconds,
    errorMessage: job.error_message,
    startDate: job.start_date,
    endDate: job.end_date,
    replaceExisting: !!job.replace_existing,
    appendExisting: !!job.append_existing,
    wholeMonth: !!job.whole_month,
  };
}

function addRunnerLog(
  jobId: string,
  hooks: RunnerHooks,
  level: "info" | "warn" | "error",
  message: string,
  stage: string,
  details?: Record<string, unknown>
) {
  addCalendarGenerationJobLog(jobId, level, message, {
    stage,
    details: details ?? null,
  });
  if (process.env.NODE_ENV !== "test") {
    const payload = details ? ` ${JSON.stringify(details)}` : "";
    const formatted = `[CalendarJob ${jobId}] [${level.toUpperCase()}] [${stage}] ${message}${payload}`;
    if (level === "error") {
      console.error(formatted);
    } else if (level === "warn") {
      console.warn(formatted);
    } else {
      console.log(formatted);
    }
  }
  hooks.onEvent?.("log", { level, message, stage, details });
}

async function generateCalendarItemsIncrementally(params: {
  jobId: string;
  hooks: RunnerHooks;
  projectId: string;
  homepageUrl: string;
  existingPages: { url: string; title: string }[];
  internalLinks: Array<{ url: string; title: string | null }>;
  extractedKeywords: string[];
  seoInsight: ReturnType<typeof parseSEOInsight>;
  existingForPrompt: Array<{
    targetUrl?: string;
    primaryKeyword?: string;
    secondaryKeywords: string[];
    title?: string;
  }>;
  publishedForPrompt: CalendarUniquenessItem[];
  feedback?: string;
  startDate: string;
  endDate: string;
  count: number;
}) {
  const scheduledDates = buildScheduledDates(params.startDate, params.endDate, params.count);
  const generated: CalendarItem[] = [];

  for (let index = 0; index < scheduledDates.length; index += 1) {
    const scheduledDate = scheduledDates[index];
    addRunnerLog(
      params.jobId,
      params.hooks,
      "info",
      "Starting fallback single-date scheduling attempt",
      "generating",
      {
        attempt: index + 1,
        totalAttempts: scheduledDates.length,
        scheduledDate,
        generatedSoFar: generated.length,
      }
    );

    const internalLinksAsPages: { url: string; title: string }[] = params.internalLinks.map((l) => ({
      url: l.url,
      title: l.title ?? l.url,
    }));
    const prompt = buildContentCalendarPrompt({
      homepageUrl: params.homepageUrl,
      existingPages: params.existingPages,
      internalLinks: internalLinksAsPages,
      usedSitemap: false,
      suggestionCount: 1,
      publishingFrequency: "1 for the selected date",
      extractedKeywords: params.extractedKeywords.length > 0 ? params.extractedKeywords : undefined,
      seoReference: params.seoInsight
        ? {
            summary: params.seoInsight.summary,
            topics: params.seoInsight.topics,
            questions: params.seoInsight.reference.questions,
            painPoints: params.seoInsight.reference.painPoints,
            contentAngles: params.seoInsight.reference.contentAngles,
            productsServices: params.seoInsight.reference.productsServices,
          }
        : undefined,
      wholeMonth: false,
      startDate: scheduledDate,
      endDate: scheduledDate,
      userFeedback: [
        params.feedback,
        `Generate exactly 1 article idea for ${scheduledDate}. Return a bare JSON array with exactly 1 object.`,
      ]
        .filter(Boolean)
        .join("\n\n"),
      existingItems:
        [...params.existingForPrompt, ...generated.map((item) => ({
          title: item.title,
          targetUrl: item.targetUrl,
          primaryKeyword: item.primaryKeyword,
          secondaryKeywords: item.secondaryKeywords ?? [],
        }))].length > 0
          ? [...params.existingForPrompt, ...generated.map((item) => ({
              title: item.title,
              targetUrl: item.targetUrl,
              primaryKeyword: item.primaryKeyword,
              secondaryKeywords: item.secondaryKeywords ?? [],
            }))]
          : undefined,
      publishedItems: params.publishedForPrompt.length > 0 ? params.publishedForPrompt : undefined,
    });

    try {
      const result = await chat(
        [
          {
            role: "system",
            content:
              `You are a senior content strategist. Generate exactly 1 suggestion and return only a bare JSON array with 1 object. Never return an error object or explanatory note. ${getStructuredPromptInstruction()}`,
          },
          { role: "user", content: prompt },
        ],
        undefined,
        {
          projectId: params.projectId,
          requestLabel: "content-calendar-fallback",
          temperature: 0.2,
          maxOutputTokens: null,
          responseFormat: "text",
        }
      );

      const content = result.content?.trim() ?? "[]";
      const parsedResult = parseCalendarItemsFromLlmContent(content);
      const normalized = parsedResult.items.map((item) => ({
        ...item,
        targetUrl: undefined,
        internalLinkTargets: sanitizeInternalLinkTargets(item.internalLinkTargets, params.internalLinks),
        suggestedDate: scheduledDate,
      }));

      const unique = filterUniqueCalendarItems(normalized, [
        ...params.existingForPrompt,
        ...params.publishedForPrompt,
        ...generated.map((item) => ({
          title: item.title,
          targetUrl: item.targetUrl,
          primaryKeyword: item.primaryKeyword,
        })),
      ]);

      const nextItem = unique[0];
      if (!nextItem) {
        addRunnerLog(
          params.jobId,
          params.hooks,
          "warn",
          "Fallback single-date attempt produced no unique item",
          "parsing",
          {
            attempt: index + 1,
            scheduledDate,
            rootType: parsedResult.meta.rootType,
            candidateCount: parsedResult.meta.candidateCount,
            objectKeys: parsedResult.meta.objectKeys,
            responsePreview: content.slice(0, 500),
          }
        );
        continue;
      }

      generated.push(nextItem);
      updateCalendarGenerationJobProgress(params.jobId, 4, TOTAL_STEPS, {
        stage: "parsing",
        message: `Fallback scheduling generated ${generated.length} of ${scheduledDates.length} ideas`,
        generatedItems: generated.length,
        totalItems: scheduledDates.length,
      });
      emitProgress(params.jobId, params.hooks);
      addRunnerLog(
        params.jobId,
        params.hooks,
        "info",
        "Fallback single-date attempt succeeded",
        "parsing",
        {
          attempt: index + 1,
          scheduledDate,
          title: nextItem.title,
          primaryKeyword: nextItem.primaryKeyword,
        }
      );
    } catch (error) {
      addRunnerLog(
        params.jobId,
        params.hooks,
        "warn",
        "Fallback single-date attempt failed",
        "failed",
        {
          attempt: index + 1,
          scheduledDate,
          error: error instanceof Error ? error.message : String(error),
        }
      );
    }
  }

  return generated;
}

function buildScheduledDates(startDate: string, endDate: string, count: number) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const totalDays =
    Math.max(
      0,
      Math.floor((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000))
    ) + 1;
  const dates: string[] = [];
  if (count <= 0) return dates;
  if (totalDays <= 1) {
    return Array.from({ length: count }, () => startDate);
  }

  for (let index = 0; index < count; index += 1) {
    const dayOffset = Math.round((index * (totalDays - 1)) / Math.max(1, count - 1));
    const next = new Date(start);
    next.setDate(start.getDate() + dayOffset);
    dates.push(next.toISOString().split("T")[0]);
  }

  return dates;
}

function listPublishedArticleUniquenessItems(projectId: string): CalendarUniquenessItem[] {
  const db = getDb();
  const rows = db.prepare(
    `SELECT a.title, c.primary_keyword, c.target_url
     FROM articles a
     LEFT JOIN calendar_items c ON a.calendar_item_id = c.id
     WHERE a.project_id = ? AND a.status = 'published'`
  ).all(projectId) as Array<{
    title: string | null;
    primary_keyword: string | null;
    target_url: string | null;
  }>;

  return rows.map((row) => ({
    title: row.title ?? undefined,
    primaryKeyword: row.primary_keyword ?? undefined,
    targetUrl: row.target_url ?? undefined,
  }));
}

function filterUniqueCalendarItems(
  items: CalendarItem[],
  existingItems: CalendarUniquenessItem[]
): CalendarItem[] {
  const seenTitles = new Set(existingItems.map((item) => normalizeTitle(item.title)).filter(Boolean));
  const seenKeywords = new Set(existingItems.map((item) => normalizeKeyword(item.primaryKeyword)).filter(Boolean));
  const seenTargetKeywordPairs = new Set(
    existingItems
      .map((item) => buildTargetKeywordKey(item.targetUrl, item.primaryKeyword))
      .filter(Boolean)
  );

  const uniqueItems: CalendarItem[] = [];
  for (const item of items) {
    const normalizedTitle = normalizeTitle(item.title);
    const normalizedKeyword = normalizeKeyword(item.primaryKeyword);
    const targetKeywordKey = buildTargetKeywordKey(item.targetUrl, item.primaryKeyword);

    if (
      (normalizedTitle && seenTitles.has(normalizedTitle)) ||
      (normalizedKeyword && seenKeywords.has(normalizedKeyword)) ||
      (targetKeywordKey && seenTargetKeywordPairs.has(targetKeywordKey))
    ) {
      continue;
    }

    uniqueItems.push(item);
    if (normalizedTitle) seenTitles.add(normalizedTitle);
    if (normalizedKeyword) seenKeywords.add(normalizedKeyword);
    if (targetKeywordKey) seenTargetKeywordPairs.add(targetKeywordKey);
  }

  return uniqueItems;
}

function normalizeTitle(value?: string | null) {
  return value?.trim().toLowerCase() ?? "";
}

function normalizeKeyword(value?: string | null) {
  return value?.trim().toLowerCase() ?? "";
}

function buildTargetKeywordKey(targetUrl?: string | null, keyword?: string | null) {
  const normalizedTarget = targetUrl?.trim().toLowerCase();
  const normalizedKeyword = normalizeKeyword(keyword);
  if (!normalizedTarget || !normalizedKeyword) return "";
  return `${normalizedTarget}::${normalizedKeyword}`;
}
