import { NextRequest, NextResponse } from "next/server";
import { getProject } from "@/lib/db/projects";
import { listCrawlJobs } from "@/lib/db/crawl-jobs";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const project = getProject(projectId);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const jobs = listCrawlJobs(projectId);
    return NextResponse.json(jobs);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to list crawl jobs";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
