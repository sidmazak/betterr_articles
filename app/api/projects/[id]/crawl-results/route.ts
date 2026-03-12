import { NextRequest, NextResponse } from "next/server";
import { getProject } from "@/lib/db/projects";
import {
  getLatestCompletedCrawlJob,
  getLatestCrawlResults,
  getCrawlResults,
  getCrawlResultPages,
} from "@/lib/db/crawl-jobs";
import { listManualUrls } from "@/lib/db/manual-urls";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const project = getProject(projectId);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get("jobId");

    let pages: { url: string; title: string }[];
    let detailedPages: Array<{ id: string; crawl_job_id: string; url: string; title: string | null }> = [];
    if (jobId) {
      pages = getCrawlResults(jobId);
      detailedPages = getCrawlResultPages(jobId).map((page) => ({
        id: page.id,
        crawl_job_id: page.crawl_job_id,
        url: page.url,
        title: page.title,
      }));
    } else {
      pages = getLatestCrawlResults(projectId);
      const latestJob = getLatestCompletedCrawlJob(projectId);
      if (latestJob) {
        detailedPages = getCrawlResultPages(latestJob.id).map((page) => ({
          id: page.id,
          crawl_job_id: page.crawl_job_id,
          url: page.url,
          title: page.title,
        }));
      }
    }

    const manualUrls = listManualUrls(projectId);
    const manualPages = manualUrls.map((u) => ({ url: u.url, title: u.title ?? u.url }));

    const allPages =
      pages.length > 0 ? pages : manualPages.length > 0 ? manualPages : [];

    return NextResponse.json({
      pages: allPages,
      detailedPages,
      source: pages.length > 0 ? "crawl" : manualPages.length > 0 ? "manual" : "none",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to get crawl results";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
