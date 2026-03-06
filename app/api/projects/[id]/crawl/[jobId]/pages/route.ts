import { NextRequest, NextResponse } from "next/server";
import { getProject } from "@/lib/db/projects";
import { getCrawlJob, addCrawlResultPage } from "@/lib/db/crawl-jobs";

export async function POST(
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

    const body = await request.json();
    const { url, title, meta_description, content_preview } = body;
    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    const page = addCrawlResultPage(jobId, projectId, {
      url: url.trim(),
      title: typeof title === "string" ? title : undefined,
      meta_description: typeof meta_description === "string" ? meta_description : undefined,
      content_preview: typeof content_preview === "string" ? content_preview : undefined,
    });

    return NextResponse.json(page);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to add page";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
