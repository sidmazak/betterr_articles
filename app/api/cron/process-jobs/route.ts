import { NextRequest, NextResponse } from "next/server";
import { getProject } from "@/lib/db/projects";
import {
  getPendingCrawlJobs,
  getCrawlJob,
  startCrawlJob,
  completeCrawlJob,
  failCrawlJob,
  saveCrawlResults,
  addCrawlLog,
} from "@/lib/db/crawl-jobs";
import { crawlWebsite } from "@/lib/crawler";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

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
      return NextResponse.json({
        processed: 1,
        jobId: job.id,
        status: "completed",
        totalFound: result.totalFound,
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
