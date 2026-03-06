import { NextRequest, NextResponse } from "next/server";
import { getProject } from "@/lib/db/projects";
import {
  getCrawlJob,
  getCrawlResultPages,
  getCrawlJobLogs,
} from "@/lib/db/crawl-jobs";

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

    return NextResponse.json({ ...job, pages, logs });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to get crawl job";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
