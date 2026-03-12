import { NextRequest, NextResponse } from "next/server";
import { getProject } from "@/lib/db/projects";
import {
  cancelArticleGenerationJob,
  cleanupOrphanedArticleFromJob,
  getArticleGenerationJob,
  getArticleGenerationJobLogs,
} from "@/lib/db/article-generation-jobs";

function serializeLogs(jobId: string) {
  return getArticleGenerationJobLogs(jobId).map((log) => ({
    level: log.level,
    message: log.message,
    extra: log.details,
    timestamp: log.created_at,
  }));
}

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

    const job = getArticleGenerationJob(jobId);
    if (!job || job.project_id !== projectId) {
      return NextResponse.json({ error: "Article generation job not found" }, { status: 404 });
    }

    return NextResponse.json({
      ...job,
      logs: serializeLogs(jobId),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load article generation job";
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

    const job = getArticleGenerationJob(jobId);
    if (!job || job.project_id !== projectId) {
      return NextResponse.json({ error: "Article generation job not found" }, { status: 404 });
    }

    const body = await request.json();
    const action = body?.action;
    if (action === "cancel") {
      cancelArticleGenerationJob(jobId);
      cleanupOrphanedArticleFromJob(job);
      return NextResponse.json({
        ...getArticleGenerationJob(jobId),
        logs: serializeLogs(jobId),
      });
    }

    if (action === "cleanup") {
      cleanupOrphanedArticleFromJob(job);
      return NextResponse.json({
        ...getArticleGenerationJob(jobId),
        logs: serializeLogs(jobId),
      });
    }

    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update article generation job";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
