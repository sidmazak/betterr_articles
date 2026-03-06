/**
 * In-app cron worker. Polls every 60 seconds for pending crawl jobs
 * and processes them using the same logic as /api/cron/process-jobs.
 * Runs when the app starts via instrumentation.ts.
 */

import { getProject } from "@/lib/db/projects";
import {
  getPendingCrawlJobs,
  startCrawlJob,
  completeCrawlJob,
  failCrawlJob,
  saveCrawlResults,
  addCrawlLog,
} from "@/lib/db/crawl-jobs";
import { crawlWebsite } from "@/lib/crawler";

const POLL_INTERVAL_MS = 60_000;

let intervalId: ReturnType<typeof setInterval> | null = null;

async function processPendingJobs(): Promise<void> {
  try {
    const pending = getPendingCrawlJobs();
    if (pending.length === 0) return;

    const job = pending[0];
    const project = getProject(job.project_id);
    if (!project || !project.homepage_url) {
      addCrawlLog(job.id, "error", "Project or homepage URL missing");
      failCrawlJob(job.id, "Project or homepage URL missing");
      return;
    }

    startCrawlJob(job.id);
    addCrawlLog(job.id, "info", `Starting crawl of ${project.homepage_url}`);
    try {
      const result = await crawlWebsite(project.homepage_url);
      saveCrawlResults(job.id, job.project_id, result.pages);
      addCrawlLog(
        job.id,
        "info",
        `Crawl completed: found ${result.totalFound} pages (sitemap: ${result.usedSitemap})`
      );
      completeCrawlJob(job.id, result.totalFound, result.usedSitemap);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Crawl failed";
      addCrawlLog(job.id, "error", msg);
      failCrawlJob(job.id, msg);
    }
  } catch {
    // Silently ignore - will retry on next poll
  }
}

export function startCronWorker(): void {
  if (intervalId) return;
  processPendingJobs(); // Run immediately
  intervalId = setInterval(processPendingJobs, POLL_INTERVAL_MS);
}

export function stopCronWorker(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}
