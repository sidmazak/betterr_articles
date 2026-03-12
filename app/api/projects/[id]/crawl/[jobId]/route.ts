import { NextRequest, NextResponse } from "next/server";
import { getProject } from "@/lib/db/projects";
import {
  cancelCrawlJob,
  getCrawlJob,
  getCrawlResultPages,
  getCrawlJobLogs,
  pauseCrawlJob,
  resumeCrawlJob,
} from "@/lib/db/crawl-jobs";
import { getLatestProjectSEOInsight, parseSEOInsight } from "@/lib/db/seo-insights";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; jobId: string }> }
) {
  try {
    const { id: projectId, jobId } = await params;
    const project = getProject(projectId);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const job = getCrawlJob(jobId);
    if (!job || job.project_id !== projectId) {
      return NextResponse.json({ error: "Crawl job not found" }, { status: 404 });
    }

    const pages = getCrawlResultPages(jobId);
    const logs = getCrawlJobLogs(jobId);
    const insight = parseSEOInsight(getLatestProjectSEOInsight(projectId));

    return NextResponse.json({
      ...job,
      pages,
      logs,
      insight: insight
        ? {
            topics: insight.topics,
            keywords: insight.keywords,
            summary: insight.summary,
            reference: insight.reference,
            updated_at: insight.updated_at,
          }
        : null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to get crawl job";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; jobId: string }> }
) {
  try {
    const { id: projectId, jobId } = await params;
    const project = getProject(projectId);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const job = getCrawlJob(jobId);
    if (!job || job.project_id !== projectId) {
      return NextResponse.json({ error: "Crawl job not found" }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const action = body?.action;

    if (action === "pause") {
      pauseCrawlJob(jobId);
    } else if (action === "resume") {
      resumeCrawlJob(jobId);
    } else if (action === "cancel") {
      cancelCrawlJob(jobId);
    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    return NextResponse.json(getCrawlJob(jobId));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update crawl job";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
