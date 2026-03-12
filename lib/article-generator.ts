import { resolveProjectArticleDefaults } from "@/lib/db/article-defaults";
import { getLatestCrawlResults } from "@/lib/db/crawl-jobs";
import { listManualUrls } from "@/lib/db/manual-urls";
import { listPublishedArticles } from "@/lib/db/articles";
import { getDb } from "@/lib/db";
import type { ArticlePipelineInput, ExistingPage } from "@/lib/prompts/types";
import type { CalendarItemRow } from "@/lib/db";
import {
  createArticleGenerationJob,
  getActiveArticleGenerationJob,
  getArticleGenerationJob,
} from "@/lib/db/article-generation-jobs";
import { processArticleGenerationJob } from "@/lib/article-generation-runner";

function getExistingPages(projectId: string): ExistingPage[] {
  const crawlPages = getLatestCrawlResults(projectId);
  if (crawlPages.length > 0) return crawlPages;
  const manual = listManualUrls(projectId);
  return manual.map((u) => ({ url: u.url, title: u.title ?? u.url }));
}

function getInternalLinksAsPages(projectId: string): ExistingPage[] {
  const db = getDb();
  const rows = db
    .prepare("SELECT url, title FROM project_internal_links WHERE project_id = ?")
    .all(projectId) as { url: string; title: string | null }[];
  return rows.map((l) => ({ url: l.url, title: l.title ?? l.url }));
}

export async function buildArticleInputForCalendarItem(
  projectId: string,
  calendarItem: CalendarItemRow
): Promise<ArticlePipelineInput> {
  const defaults = (await resolveProjectArticleDefaults(projectId)) ?? {};
  const existingPages = getExistingPages(projectId);
  const publishedArticles = listPublishedArticles(projectId);
  const internalLinks = getInternalLinksAsPages(projectId);

  const secondaryKeywords = safeParseStringArray(calendarItem.secondary_keywords);
  const input: ArticlePipelineInput = {
    keyword: calendarItem.primary_keyword,
    category: defaults.category ?? "General",
    targetAudience: defaults.targetAudience ?? "General audience",
    title: calendarItem.title,
    length: defaults.length ?? "Long",
    style: defaults.style ?? "Informative",
    tone: defaults.tone ?? "Professional",
    readingLevel: defaults.readingLevel ?? "Intermediate",
    contentIntent: defaults.contentIntent ?? "inform",
    internalLinking: defaults.internalLinking ?? true,
    useCrawledUrlsAsInternalLinks: defaults.useCrawledUrlsAsInternalLinks ?? true,
    requireInfographics: defaults.requireInfographics ?? true,
    existingPages,
    publishedArticles,
    internalLinks,
    secondaryKeywords,
    externalLinking: defaults.externalLinking ?? false,
    language: defaults.language ?? "en",
    ...(defaults.articleType ? { articleType: defaults.articleType } : {}),
    ...(defaults.articleFormat ? { articleFormat: defaults.articleFormat } : {}),
    ...(defaults.pointOfView ? { pointOfView: defaults.pointOfView } : {}),
    ...(defaults.citationStyle ? { citationStyle: defaults.citationStyle } : {}),
    ...(defaults.contentFreshness ? { contentFreshness: defaults.contentFreshness } : {}),
    ...(defaults.includeSubtopics !== undefined
      ? { includeSubtopics: defaults.includeSubtopics }
      : {}),
    ...(defaults.socialMediaOptimization !== undefined
      ? { socialMediaOptimization: defaults.socialMediaOptimization }
      : {}),
    ...(defaults.geoFocus ? { geoFocus: defaults.geoFocus } : {}),
    ...(defaults.customInstructions ? { customInstructions: defaults.customInstructions } : {}),
    ...(defaults.domainKnowledge ? { domainKnowledge: defaults.domainKnowledge } : {}),
  };

  if (calendarItem.infographic_concepts) {
    try {
      const concepts = JSON.parse(calendarItem.infographic_concepts) as string[];
      const conceptsStr = Array.isArray(concepts) ? concepts.join(", ") : calendarItem.infographic_concepts;
      const parts = [input.customInstructions, `Infographic concepts from calendar: ${conceptsStr}`].filter(Boolean);
      input.customInstructions = parts.join("\n\n");
    } catch {
      const parts = [input.customInstructions, `Infographic concepts: ${calendarItem.infographic_concepts}`].filter(Boolean);
      input.customInstructions = parts.join("\n\n");
    }
  }

  return input;
}

export async function generateArticleForCalendarItem(
  projectId: string,
  calendarItemId: string,
  calendarItem: CalendarItemRow
): Promise<{ success: boolean; error?: string; jobId?: string }> {
  try {
    const activeJob = getActiveArticleGenerationJob(projectId, calendarItemId);
    if (activeJob?.status === "running") {
      return { success: true, jobId: activeJob.id };
    }

    const input = await buildArticleInputForCalendarItem(projectId, calendarItem);
    const job =
      activeJob ??
      createArticleGenerationJob({
        projectId,
        calendarItemId,
        source: "schedule",
        input,
      });

    await processArticleGenerationJob(job.id);
    const finalJob = getArticleGenerationJob(job.id);
    if (finalJob?.status === "completed") {
      return { success: true, jobId: job.id };
    }
    if (finalJob?.status === "cancelled") {
      return { success: false, error: finalJob.error_message ?? "Article generation cancelled", jobId: job.id };
    }
    return {
      success: false,
      error: finalJob?.error_message ?? "Article generation failed",
      jobId: job.id,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Article generation failed";
    return { success: false, error: msg };
  }
}

function safeParseStringArray(value: string | null) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      : [];
  } catch {
    return [];
  }
}
