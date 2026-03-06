import { NextRequest, NextResponse } from "next/server";
import { getProject } from "@/lib/db/projects";
import {
  createCrawlJob,
  startCrawlJob,
  completeCrawlJob,
  failCrawlJob,
  saveCrawlResults,
  getCrawlJob,
  addCrawlLog,
} from "@/lib/db/crawl-jobs";
import { crawlWebsite } from "@/lib/crawler";
import { sendNotification } from "@/lib/notifications";

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
    const { runImmediately = true, maxPages = 150 } = body;

    const job = createCrawlJob(projectId, "auto", maxPages);

    if (runImmediately && project.homepage_url) {
      startCrawlJob(job.id);
      addCrawlLog(job.id, "info", `Starting crawl of ${project.homepage_url}`);
      try {
        const result = await crawlWebsite(
          project.homepage_url,
          (progress, total) => {
            // Progress could be stored for polling - for sync response we skip
          },
          { maxPages }
        );
        saveCrawlResults(job.id, projectId, result.pages);
        addCrawlLog(
          job.id,
          "info",
          `Crawl completed: found ${result.totalFound} pages (sitemap: ${result.usedSitemap})`
        );
        completeCrawlJob(job.id, result.totalFound, result.usedSitemap);
        sendNotification(
          "crawl_complete",
          "Crawl finished",
          `Found ${result.totalFound} pages. Used sitemap: ${result.usedSitemap}.`,
          project.name
        ).catch(() => {});
        return NextResponse.json({
          ...getCrawlJob(job.id),
          pages: result.pages,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Crawl failed";
        addCrawlLog(job.id, "error", msg);
        failCrawlJob(job.id, msg);
        return NextResponse.json({ error: msg, jobId: job.id }, { status: 500 });
      }
    }

    return NextResponse.json(job);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to start crawl";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
