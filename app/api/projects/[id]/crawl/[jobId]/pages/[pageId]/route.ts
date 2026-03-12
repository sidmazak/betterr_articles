import { NextRequest, NextResponse } from "next/server";
import { getProject } from "@/lib/db/projects";
import {
  getCrawlJob,
  getCrawlResultPages,
  updateCrawlResultPage,
  deleteCrawlResultPage,
} from "@/lib/db/crawl-jobs";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; jobId: string; pageId: string }> }
) {
  try {
    const { id: projectId, jobId, pageId } = await params;
    const project = getProject(projectId);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const job = getCrawlJob(jobId);
    if (!job || job.project_id !== projectId) {
      return NextResponse.json({ error: "Crawl job not found" }, { status: 404 });
    }

    const pages = getCrawlResultPages(jobId);
    const page = pages.find((p) => p.id === pageId);
    if (!page) {
      return NextResponse.json({ error: "Page not found" }, { status: 404 });
    }

    const body = await request.json();
    const updates: { url?: string; title?: string; meta_description?: string; content_preview?: string } = {};
    if (typeof body.url === "string") updates.url = body.url.trim();
    if (typeof body.title === "string") updates.title = body.title;
    if (typeof body.meta_description === "string") updates.meta_description = body.meta_description;
    if (typeof body.content_preview === "string") updates.content_preview = body.content_preview;

    const updated = updateCrawlResultPage(pageId, updates);
    if (!updated) {
      return NextResponse.json({ error: "Page not found or not editable" }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update page";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; jobId: string; pageId: string }> }
) {
  try {
    const { id: projectId, jobId, pageId } = await params;
    const project = getProject(projectId);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const job = getCrawlJob(jobId);
    if (!job || job.project_id !== projectId) {
      return NextResponse.json({ error: "Crawl job not found" }, { status: 404 });
    }

    const deleted = deleteCrawlResultPage(pageId);
    if (!deleted) {
      return NextResponse.json({ error: "Page not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to delete page";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
