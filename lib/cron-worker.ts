/**
 * In-app cron worker. Polls every 60 seconds for pending crawl jobs
 * and article schedules. Runs when the app starts via instrumentation.ts.
 * All operations and logs are persisted in the database.
 */

import { getProject } from "@/lib/db/projects";
import {
  getPendingCrawlJobs,
  failCrawlJob,
  addCrawlLog,
} from "@/lib/db/crawl-jobs";
import { getDueCalendarItems } from "@/lib/db/calendar";
import { getProjectsDueForArticleSchedule, markScheduleRun } from "@/lib/db/article-schedule";
import { addCronLog } from "@/lib/db/cron-logs";
import { generateArticleForCalendarItem } from "@/lib/article-generator";
import { processCrawlJob } from "@/lib/crawl-job-runner";

const POLL_INTERVAL_MS = 60_000;

let intervalId: ReturnType<typeof setInterval> | null = null;

async function processArticleSchedules(): Promise<void> {
  try {
    const projects = getProjectsDueForArticleSchedule();
    for (const p of projects) {
      const dueItems = getDueCalendarItems(p.project_id);
      if (dueItems.length === 0) {
        markScheduleRun(p.project_id);
        addCronLog("article_schedule", "No due articles to generate", {
          projectId: p.project_id,
          status: "info",
        });
        continue;
      }

      addCronLog("article_schedule", `Processing ${dueItems.length} due article(s)`, {
        projectId: p.project_id,
        status: "info",
        details: { count: dueItems.length },
      });

      let succeeded = 0;
      let failed = 0;
      for (const item of dueItems) {
        const result = await generateArticleForCalendarItem(p.project_id, item.id, item);
        if (result.success) {
          succeeded++;
          addCronLog("article_schedule", `Generated: ${item.title}`, {
            projectId: p.project_id,
            jobId: result.jobId ?? item.id,
            status: "success",
          });
        } else {
          failed++;
          addCronLog("article_schedule", `Failed: ${item.title} - ${result.error}`, {
            projectId: p.project_id,
            jobId: result.jobId ?? item.id,
            status: "error",
            details: { error: result.error },
          });
        }
      }

      markScheduleRun(p.project_id);
      addCronLog("article_schedule", `Schedule run complete: ${succeeded} succeeded, ${failed} failed`, {
        projectId: p.project_id,
        status: succeeded > 0 ? "success" : failed > 0 ? "warning" : "info",
        details: { succeeded, failed, total: dueItems.length },
      });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Article schedule failed";
    addCronLog("article_schedule", msg, { status: "error", details: { error: String(err) } });
  }
}

async function processPendingJobs(): Promise<void> {
  try {
    const pending = getPendingCrawlJobs();
    if (pending.length === 0) return;

    const job = pending[0];
    const project = getProject(job.project_id);
    if (!project || !project.homepage_url) {
      addCrawlLog(job.id, "error", "Project or homepage URL missing");
      addCronLog("crawl", "Crawl failed: Project or homepage URL missing", {
        projectId: job.project_id,
        jobId: job.id,
        status: "error",
      });
      failCrawlJob(job.id, "Project or homepage URL missing");
      return;
    }

    addCronLog("crawl", `Starting crawl: ${project.homepage_url}`, {
      projectId: job.project_id,
      jobId: job.id,
      status: "info",
    });

    try {
      const result = await processCrawlJob(job.id);
      addCronLog("crawl", `Crawl completed: ${result?.total_found ?? 0} pages found`, {
        projectId: job.project_id,
        jobId: job.id,
        status: "success",
        details: {
          totalFound: result?.total_found ?? 0,
          status: result?.status ?? "completed",
          stage: result?.current_stage ?? "completed",
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Crawl failed";
      addCrawlLog(job.id, "error", msg);
      addCronLog("crawl", `Crawl failed: ${msg}`, {
        projectId: job.project_id,
        jobId: job.id,
        status: "error",
        details: { error: String(err) },
      });
      failCrawlJob(job.id, msg);
    }
  } catch {
    // Silently ignore - will retry on next poll
  }
}

async function runCronCycle(): Promise<void> {
  await processPendingJobs();
  await processArticleSchedules();
}

export function startCronWorker(): void {
  if (intervalId) return;
  runCronCycle(); // Run immediately
  intervalId = setInterval(runCronCycle, POLL_INTERVAL_MS);
}

export function stopCronWorker(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}
