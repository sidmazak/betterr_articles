import { getProject } from "@/lib/db/projects";
import { hasConfiguredDefaultLLM } from "@/lib/db/settings";
import {
  addCrawlLog,
  cancelCrawlJob,
  claimPendingCrawlJob,
  completeCrawlJob,
  failCrawlJob,
  getCrawlJob,
  pauseCrawlJob,
  saveOrUpdateCrawlResultPage,
  setCrawlJobStage,
  startCrawlJob,
  touchCrawlJob,
  updateCrawlResultPageSEOReference,
  updateCrawlJobProgress,
} from "@/lib/db/crawl-jobs";
import { crawlWebsite } from "@/lib/crawler";
import { extractSEOInsights, mergeSEOExtractionResults, persistSEOInsights } from "@/lib/seo-extraction";
import type { CrawlResultPageRow } from "@/lib/db";
import { sendNotification } from "@/lib/notifications";
import { refreshProjectArticleDefaultsFromInsight } from "@/lib/db/article-defaults";

const DEFAULT_CRAWL_MAX_PAGES = 10;

type RunnerEventName = "log" | "progress" | "done" | "page";

interface RunnerHooks {
  onEvent?: (event: RunnerEventName, data: unknown) => void;
}

export async function processCrawlJob(jobId: string, hooks: RunnerHooks = {}) {
  const startingJob = getCrawlJob(jobId);
  if (!startingJob) {
    throw new Error("Crawl job not found");
  }

  const project = getProject(startingJob.project_id);
  if (!project || !project.homepage_url) {
    const message = "Project or homepage URL missing";
    addCrawlLog(jobId, "error", message, { stage: "failed" });
    failCrawlJob(jobId, message);
    hooks.onEvent?.("done", { status: "failed", job: getCrawlJob(jobId), error: message });
    return getCrawlJob(jobId);
  }
  const homepageUrl = project.homepage_url;

  if (!hasConfiguredDefaultLLM()) {
    const message =
      "AI provider not configured. Add at least one API key provider and model in App Settings before creating a site or crawling.";
    addCrawlLog(jobId, "error", message, { stage: "failed" });
    failCrawlJob(jobId, message);
    hooks.onEvent?.("done", { status: "failed", job: getCrawlJob(jobId), error: message });
    return getCrawlJob(jobId);
  }

  const claimedJob =
    startingJob.status === "pending" ? claimPendingCrawlJob(jobId) : getCrawlJob(jobId);
  const activeJob = claimedJob ?? getCrawlJob(jobId);
  if (!activeJob) {
    throw new Error("Crawl job unavailable");
  }

  if (startingJob.status === "pending" && !claimedJob) {
    return activeJob;
  }

  startCrawlJob(jobId);
  addRunnerLog(jobId, hooks, "info", `Starting crawl of ${project.homepage_url}`, "discovering");

  setCrawlJobStage(jobId, "discovering", {
    currentUrl: project.homepage_url,
    totalBatches: activeJob.max_pages ?? DEFAULT_CRAWL_MAX_PAGES,
    completedBatches: activeJob.completed_batches ?? 0,
  });

  const pageDurations: number[] = [];
  let lastTick = Date.now();
  const processedSeoUrls = new Set<string>();
  const extractedPageInsights: Awaited<ReturnType<typeof extractSEOInsights>>[] = [];

  try {
    const result = await crawlWebsite(
      project.homepage_url,
      async (progress, total, url, page) => {
        if (page) {
          const updatedPage = saveOrUpdateCrawlResultPage(jobId, project.id, page);
          hooks.onEvent?.("page", { page: updatedPage });
        }

        const shouldAnalyzePage =
          !!page &&
          page.status_code !== null &&
          !processedSeoUrls.has(page.url) &&
          !!(page.content_preview || page.meta_description || page.title);

        if (shouldAnalyzePage && page) {
          assertJobCanContinue(jobId);
          setCrawlJobStage(jobId, "extracting", {
            currentUrl: page.url,
            totalBatches: Math.max(total, activeJob.max_pages ?? DEFAULT_CRAWL_MAX_PAGES),
            completedBatches: processedSeoUrls.size,
          });
          addRunnerLog(jobId, hooks, "info", `Analyzing page with AI: ${page.url}`, "extracting", {
            url: page.url,
            progress,
            total,
          });

          const pageInsight = await extractSEOInsights(project.id, homepageUrl, [page], {
            crawlJobId: jobId,
            maxKeywords: 20,
            save: false,
            shouldStop: () => getControlState(jobId),
          });
          extractedPageInsights.push(pageInsight);
          processedSeoUrls.add(page.url);
          const updatedPage: CrawlResultPageRow | null = updateCrawlResultPageSEOReference(jobId, page.url, {
            topics: pageInsight.topics,
            keywords: pageInsight.keywords,
            summary: pageInsight.summary,
            reference: pageInsight.reference,
          });

          if (updatedPage) {
            hooks.onEvent?.("page", { page: updatedPage });
          }

          addRunnerLog(
            jobId,
            hooks,
            "info",
            `Captured SEO reference for ${page.url}`,
            "extracting",
            {
              url: page.url,
              topics: pageInsight.topics.slice(0, 6),
              keywords: pageInsight.keywords.slice(0, 8),
              entities: pageInsight.reference.entities.slice(0, 6),
              questions: pageInsight.reference.questions.slice(0, 4),
            }
          );
          assertJobCanContinue(jobId);
        }

        const now = Date.now();
        pageDurations.push(now - lastTick);
        lastTick = now;
        const avgStepMs = average(pageDurations);
        const remainingPages = Math.max(0, total - progress);
        const etaSeconds = Math.ceil((remainingPages * avgStepMs) / 1000);

        updateCrawlJobProgress(jobId, progress, total, {
          currentUrl: url ?? null,
          stage: progress >= total ? "saving" : "crawling",
          etaSeconds,
          avgStepMs,
          totalBatches: Math.max(total, activeJob.max_pages ?? DEFAULT_CRAWL_MAX_PAGES),
          completedBatches: processedSeoUrls.size,
        });
        touchCrawlJob(jobId);

        hooks.onEvent?.("progress", {
          progress,
          total,
          url,
          etaSeconds,
          stage: progress >= total ? "saving" : "crawling",
          completedBatches: processedSeoUrls.size,
          totalBatches: Math.max(total, activeJob.max_pages ?? DEFAULT_CRAWL_MAX_PAGES),
        });
        if (page && page.status_code !== null && url) {
          addRunnerLog(jobId, hooks, "info", `Page ${progress}/${total}: ${url}`, "crawling", {
            progress,
            total,
            url,
            statusCode: page.status_code,
            etaSeconds,
          });
        }
      },
      {
        maxPages: activeJob.max_pages ?? DEFAULT_CRAWL_MAX_PAGES,
        sitemapUrl: (project as { sitemap_url?: string | null }).sitemap_url ?? undefined,
        shouldStop: () => getControlState(jobId),
      }
    );

    assertJobCanContinue(jobId);
    setCrawlJobStage(jobId, "saving", {
      currentUrl: null,
      totalBatches: result.pages.length,
      completedBatches: processedSeoUrls.size,
    });
    addRunnerLog(
      jobId,
      hooks,
      "info",
      "Deduplicating page-level AI research and saving the final SEO reference set...",
      "saving",
      { analyzedPages: processedSeoUrls.size, crawledPages: result.pages.length }
    );

    const insights = mergeSEOExtractionResults(extractedPageInsights);
    persistSEOInsights(project.id, jobId, insights);
    await refreshProjectArticleDefaultsFromInsight(project.id).catch(() => null);

    if (insights.topics.length > 0 || insights.keywords.length > 0) {
      addRunnerLog(
        jobId,
        hooks,
        "info",
        `SEO research complete: ${insights.topics.length} topics and ${insights.keywords.length} keywords saved`,
        "saving",
        {
          topics: insights.topics.slice(0, 8),
          keywords: insights.keywords.slice(0, 12),
          summary: insights.summary,
          entities: insights.reference.entities.slice(0, 8),
          questions: insights.reference.questions.slice(0, 6),
          contentAngles: insights.reference.contentAngles.slice(0, 6),
        }
      );
    }

    assertJobCanContinue(jobId);
    completeCrawlJob(jobId, result.totalFound, result.usedSitemap);
    const completedJob = getCrawlJob(jobId);
    sendNotification(
      "crawl_complete",
      "Crawl finished",
      `Found ${result.totalFound} pages. Used sitemap: ${result.usedSitemap}.`,
      project.name
    ).catch(() => {});
    hooks.onEvent?.("done", {
      status: "completed",
      job: completedJob,
      totalFound: result.totalFound,
      pages: result.pages,
      insights,
    });
    return completedJob;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Crawl failed";
    if (message === "CRAWL_PAUSED") {
      persistPartialInsights(project.id, jobId, extractedPageInsights);
      pauseCrawlJob(jobId);
      addRunnerLog(jobId, hooks, "warn", "Crawl paused. Resume when ready.", "paused");
      const pausedJob = getCrawlJob(jobId);
      hooks.onEvent?.("done", { status: "paused", job: pausedJob });
      return pausedJob;
    }

    if (message === "CRAWL_CANCELLED") {
      persistPartialInsights(project.id, jobId, extractedPageInsights);
      cancelCrawlJob(jobId);
      addRunnerLog(jobId, hooks, "warn", "Crawl cancelled by user.", "cancelled");
      const cancelledJob = getCrawlJob(jobId);
      hooks.onEvent?.("done", { status: "cancelled", job: cancelledJob });
      return cancelledJob;
    }

    addRunnerLog(jobId, hooks, "error", message, "failed");
    failCrawlJob(jobId, message);
    const failedJob = getCrawlJob(jobId);
    hooks.onEvent?.("done", { status: "failed", job: failedJob, error: message });
    return failedJob;
  }
}

function getControlState(jobId: string): "continue" | "pause" | "cancel" {
  const job = getCrawlJob(jobId);
  if (!job) return "cancel";
  if (job.status === "paused") return "pause";
  if (job.status === "cancelled") return "cancel";
  return "continue";
}

function addRunnerLog(
  jobId: string,
  hooks: RunnerHooks,
  level: "info" | "warn" | "error",
  message: string,
  stage: string,
  details?: Record<string, unknown>
) {
  addCrawlLog(jobId, level, message, { stage, details: details ?? null });
  if (process.env.NODE_ENV !== "test") {
    const payload = details ? ` ${JSON.stringify(details)}` : "";
    const formatted = `[CrawlJob ${jobId}] [${level.toUpperCase()}] [${stage}] ${message}${payload}`;
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

function average(values: number[]) {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function assertJobCanContinue(jobId: string) {
  const control = getControlState(jobId);
  if (control === "pause") throw new Error("CRAWL_PAUSED");
  if (control === "cancel") throw new Error("CRAWL_CANCELLED");
}

function persistPartialInsights(
  projectId: string,
  jobId: string,
  extractedPageInsights: Awaited<ReturnType<typeof extractSEOInsights>>[]
) {
  const partialInsights = mergeSEOExtractionResults(extractedPageInsights);
  const hasReferenceData =
    partialInsights.topics.length > 0 ||
    partialInsights.keywords.length > 0 ||
    partialInsights.reference.entities.length > 0 ||
    partialInsights.reference.questions.length > 0;

  if (hasReferenceData) {
    persistSEOInsights(projectId, jobId, partialInsights);
    void refreshProjectArticleDefaultsFromInsight(projectId).catch(() => null);
  }
}
