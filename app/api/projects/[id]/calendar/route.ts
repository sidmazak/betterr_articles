import { NextRequest, NextResponse } from "next/server";
import { getProject } from "@/lib/db/projects";
import {
  listCalendarItems,
  updateCalendarItem,
  getCalendarItem,
} from "@/lib/db/calendar";
import { createCalendarGenerationJob } from "@/lib/db/calendar-generation-jobs";
import { getDb } from "@/lib/db";
import { getLatestCrawlResults } from "@/lib/db/crawl-jobs";
import { listManualUrls } from "@/lib/db/manual-urls";
import { getLatestProjectSEOInsight, parseSEOInsight } from "@/lib/db/seo-insights";
import { getStructuredPromptInstruction } from "@/lib/prompts/toon";
import type { CalendarItem } from "@/lib/app-types";
import type { CalendarItemRow } from "@/lib/db";
import { parseCalendarItemsFromLlmContent } from "@/lib/calendar-generation-parser";

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

function formatDateOnly(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function logCalendarApi(
  level: "info" | "warn" | "error",
  message: string,
  details?: Record<string, unknown>
) {
  if (process.env.NODE_ENV === "test") return;
  const payload = details ? ` ${JSON.stringify(details)}` : "";
  const formatted = `[CalendarAPI] [${level.toUpperCase()}] ${message}${payload}`;
  if (level === "error") {
    console.error(formatted);
  } else if (level === "warn") {
    console.warn(formatted);
  } else {
    console.log(formatted);
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const project = getProject(projectId);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    const items = listCalendarItems(projectId);
    const db = getDb();
    const articleMap = new Map<string, { id: string; published_url: string | null; status: string }>();
    const rows = db
      .prepare(
        `SELECT a.id, a.calendar_item_id, a.published_url, a.status
         FROM articles a
         WHERE a.project_id = ? AND a.calendar_item_id IS NOT NULL`
      )
      .all(projectId) as { id: string; calendar_item_id: string; published_url: string | null; status: string }[];
    for (const r of rows) {
      articleMap.set(r.calendar_item_id, { id: r.id, published_url: r.published_url, status: r.status });
    }
    const enriched = items.map((item) => {
      const article = articleMap.get(item.id);
      return {
        ...item,
        article_id: article?.id,
        published_url: article?.published_url ?? null,
        article_status: article?.status ?? null,
      };
    });
    return NextResponse.json(enriched);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to list calendar";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const project = getProject(projectId);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const {
      suggestionCount = 12,
      replace = false,
      wholeMonth = false,
      append = false,
      startDate,
      endDate,
      feedback,
      itemId,
    } = body;

    logCalendarApi("info", "Calendar API request received", {
      projectId,
      mode: itemId ? "regenerate-single" : "create-job",
      suggestionCount,
      replace,
      wholeMonth,
      append,
      startDate: startDate ?? null,
      endDate: endDate ?? null,
      hasFeedback: !!feedback,
      itemId: itemId ?? null,
    });

    const today = new Date();
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    const nextMonthEnd = new Date(today.getFullYear(), today.getMonth() + 2, 0);
    const todayValue = formatDateOnly(today);
    const monthEndValue = formatDateOnly(monthEnd);
    const nextMonthEndValue = formatDateOnly(nextMonthEnd);

    const resolvedStart = startDate ?? todayValue;
    const resolvedEnd = endDate ?? (append ? nextMonthEndValue : monthEndValue);

    if (resolvedStart < todayValue || resolvedEnd < todayValue) {
      return NextResponse.json(
        { error: "Article scheduling can only start from today or a future date." },
        { status: 400 }
      );
    }

    if (resolvedStart > resolvedEnd) {
      return NextResponse.json(
        { error: "Start date must be before or equal to the end date." },
        { status: 400 }
      );
    }

    const effectiveCount = wholeMonth
      ? Math.min(
          Math.ceil((new Date(resolvedEnd).getTime() - new Date(resolvedStart).getTime()) / (24 * 60 * 60 * 1000)) + 1,
          31
        )
      : suggestionCount;

    if (itemId) {
      const crawlPages = getLatestCrawlResults(projectId);
      const manualUrls = listManualUrls(projectId);
      const manualPages = manualUrls.map((u) => ({ url: u.url, title: u.title ?? u.url }));
      const existingPages = crawlPages.length > 0 ? crawlPages : manualPages;
      if (existingPages.length === 0) {
        return NextResponse.json(
          { error: "No pages found. Run a crawl or add manual URLs first." },
          { status: 400 }
        );
      }
      const existing = getCalendarItem(itemId);
      if (!existing || existing.project_id !== projectId) {
        logCalendarApi("warn", "Calendar item not found for regeneration", {
          projectId,
          itemId,
        });
        return NextResponse.json({ error: "Calendar item not found" }, { status: 404 });
      }
      logCalendarApi("info", "Starting single calendar item regeneration", {
        projectId,
        itemId,
        title: existing.title,
        primaryKeyword: existing.primary_keyword,
        availablePages: existingPages.length,
      });
      const singleItem = await regenerateSingleItem(projectId, existing, existingPages, feedback);
      if (singleItem) {
        logCalendarApi("info", "Single calendar item regenerated successfully", {
          projectId,
          itemId,
          title: singleItem.title,
          primaryKeyword: singleItem.primary_keyword,
        });
        return NextResponse.json([singleItem]);
      }
      logCalendarApi("warn", "Single calendar item regeneration returned no usable result", {
        projectId,
        itemId,
      });
      return NextResponse.json({ error: "Failed to regenerate item" }, { status: 503 });
    }
    const job = createCalendarGenerationJob(projectId, {
      replaceExisting: append ? false : replace,
      appendExisting: append,
      wholeMonth,
      suggestionCount: wholeMonth ? effectiveCount : suggestionCount,
      startDate: resolvedStart,
      endDate: resolvedEnd,
      feedback: feedback ?? null,
    });

    logCalendarApi("info", "Calendar generation job created", {
      projectId,
      jobId: job.id,
      replaceExisting: !!job.replace_existing,
      appendExisting: !!job.append_existing,
      wholeMonth: !!job.whole_month,
      suggestionCount: job.suggestion_count,
      startDate: job.start_date,
      endDate: job.end_date,
    });

    return NextResponse.json(job, { status: 202 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to generate calendar";
    logCalendarApi("error", "Calendar API request failed", {
      error: message,
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function regenerateSingleItem(
  projectId: string,
  existing: { id: string; title: string; primary_keyword: string; target_url: string | null; secondary_keywords: string | null },
  existingPages: { url: string; title: string }[],
  feedback?: string
): Promise<CalendarItemRow | null> {
  const { chat } = await import("@/lib/llm");
  const { buildContentCalendarPrompt } = await import("@/lib/prompts");
  const db = getDb();
  const internalLinks = listProjectInternalLinks(projectId);
  const keywords = db
    .prepare(`SELECT keyword FROM project_keywords WHERE project_id = ? ORDER BY created_at DESC LIMIT 50`)
    .all(projectId) as { keyword: string }[];
  const seoInsight = parseSEOInsight(getLatestProjectSEOInsight(projectId));
  const homepageUrl = existingPages[0]?.url ?? "";
  const publishedForPrompt = listPublishedArticleUniquenessItems(projectId).filter(
    (item) =>
      normalizeTitle(item.title) !== normalizeTitle(existing.title) &&
      normalizeKeyword(item.primaryKeyword) !== normalizeKeyword(existing.primary_keyword)
  );
  const internalLinksAsPages: { url: string; title: string }[] = internalLinks.map((l) => ({
    url: l.url,
    title: l.title ?? l.url,
  }));
  const prompt = buildContentCalendarPrompt({
    homepageUrl,
    existingPages,
    internalLinks: internalLinksAsPages,
    usedSitemap: false,
    suggestionCount: 1,
    extractedKeywords: keywords.map((row) => row.keyword),
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
    userFeedback: feedback ?? `Regenerate a single replacement for: "${existing.title}" (keyword: ${existing.primary_keyword}). Keep it unique and valuable.`,
    existingItems: [{ title: existing.title, primaryKeyword: existing.primary_keyword }],
    publishedItems: publishedForPrompt.length > 0 ? publishedForPrompt : undefined,
  });
  logCalendarApi("info", "Built single-item regeneration prompt", {
    projectId,
    itemId: existing.id,
    promptLength: prompt.length,
    promptPreview: prompt.slice(0, 500),
    publishedItems: publishedForPrompt.length,
    availablePages: existingPages.length,
    internalLinks: internalLinks.length,
  });
  const result = await chat(
    [
      {
        role: "system",
        content:
          `You are a senior content strategist. Follow the prompt exactly, keep suggestions unique and practical, and return only a bare JSON array. Never return an error object or explanatory note. ${getStructuredPromptInstruction()}`,
      },
      { role: "user", content: prompt },
    ],
    undefined,
    {
      projectId,
      requestLabel: "calendar-regenerate-single",
      temperature: 0.2,
      maxOutputTokens: null,
      responseFormat: "text",
    }
  );
  const content = result.content?.trim() ?? "[]";
  logCalendarApi("info", "Received single-item regeneration response", {
    projectId,
    itemId: existing.id,
    responseLength: content.length,
    responsePreview: content.slice(0, 500),
  });
  let parsed: CalendarItem[];
  try {
    parsed = parseCalendarItemsFromLlmContent(content).items;
    logCalendarApi("info", "Parsed single-item regeneration response", {
      projectId,
      itemId: existing.id,
      parsedItems: parsed.length,
    });
  } catch (error) {
    logCalendarApi("error", "Failed to parse single-item regeneration response", {
      projectId,
      itemId: existing.id,
      error: error instanceof Error ? error.message : String(error),
      responsePreview: content.slice(0, 500),
    });
    return null;
  }
  const item = parsed[0];
  if (!item) return null;
  const filtered = filterUniqueCalendarItems(parsed, [
    { title: existing.title, primaryKeyword: existing.primary_keyword, targetUrl: existing.target_url ?? undefined },
    ...publishedForPrompt,
  ]);
  const uniqueItem = filtered[0];
  if (!uniqueItem) {
    logCalendarApi("warn", "No unique single-item regeneration candidate remained", {
      projectId,
      itemId: existing.id,
      parsedItems: parsed.length,
      publishedItems: publishedForPrompt.length,
    });
    return null;
  }
  const updated = updateCalendarItem(existing.id, {
    title: uniqueItem.title,
    primary_keyword: uniqueItem.primaryKeyword,
    secondary_keywords: uniqueItem.secondaryKeywords ? JSON.stringify(uniqueItem.secondaryKeywords) : null,
    target_url: null,
    content_gap_rationale: uniqueItem.contentGapRationale ?? null,
    internal_link_targets: JSON.stringify(
      sanitizeInternalLinkTargets(uniqueItem.internalLinkTargets, internalLinks)
    ),
    infographic_concepts: uniqueItem.infographicConcepts ? JSON.stringify(uniqueItem.infographicConcepts) : null,
    ranking_potential: uniqueItem.rankingPotential ?? null,
    ranking_justification: uniqueItem.rankingJustification ?? null,
  });
  return updated;
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
