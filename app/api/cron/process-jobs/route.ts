import { NextRequest, NextResponse } from "next/server";
import { getProject } from "@/lib/db/projects";
import {
  getPendingCrawlJobs,
  failCrawlJob,
  addCrawlLog,
} from "@/lib/db/crawl-jobs";
import { getDueCalendarItems } from "@/lib/db/calendar";
import { getProjectsDueForArticleSchedule, markScheduleRun } from "@/lib/db/article-schedule";
import { generateArticleForCalendarItem } from "@/lib/article-generator";
import { processCrawlJob } from "@/lib/crawl-job-runner";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get("authorization");
    const urlKey = request.nextUrl.searchParams.get("key");
    const valid = authHeader === `Bearer ${cronSecret}` || urlKey === cronSecret;
    if (!valid) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    // 1. Process article schedules (all due calendar items per project)
    const { addCronLog } = await import("@/lib/db/cron-logs");
    const scheduleProjects = getProjectsDueForArticleSchedule();
    for (const p of scheduleProjects) {
      const dueItems = getDueCalendarItems(p.project_id);
      if (dueItems.length === 0) {
        markScheduleRun(p.project_id);
        addCronLog("article_schedule", "No due articles to generate", { projectId: p.project_id });
        continue;
      }
      addCronLog("article_schedule", `Processing ${dueItems.length} due article(s)`, {
        projectId: p.project_id,
        details: { count: dueItems.length },
      });
      let succeeded = 0;
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
          addCronLog("article_schedule", `Failed: ${item.title} - ${result.error}`, {
            projectId: p.project_id,
            jobId: result.jobId ?? item.id,
            status: "error",
            details: { error: result.error },
          });
        }
      }
      markScheduleRun(p.project_id);
      return NextResponse.json({
        processed: dueItems.length,
        type: "article",
        projectId: p.project_id,
        succeeded,
        failed: dueItems.length - succeeded,
        status: "completed",
      });
    }

    // 2. Process pending crawl jobs
    const pending = getPendingCrawlJobs();
    if (pending.length === 0) {
      return NextResponse.json({ processed: 0, message: "No pending jobs" });
    }

    const job = pending[0];
    const project = getProject(job.project_id);
    if (!project || !project.homepage_url) {
      addCrawlLog(job.id, "error", "Project or homepage URL missing");
      failCrawlJob(job.id, "Project or homepage URL missing");
      return NextResponse.json({ processed: 1, jobId: job.id, status: "failed" });
    }

    try {
      const result = await processCrawlJob(job.id);
      return NextResponse.json({
        processed: 1,
        jobId: job.id,
        status: result?.status ?? "completed",
        totalFound: result?.total_found ?? 0,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Crawl failed";
      addCrawlLog(job.id, "error", msg);
      failCrawlJob(job.id, msg);
      return NextResponse.json({
        processed: 1,
        jobId: job.id,
        status: "failed",
        error: msg,
      });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Cron failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
