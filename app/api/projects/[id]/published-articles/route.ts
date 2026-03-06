import { NextRequest, NextResponse } from "next/server";
import { getProject } from "@/lib/db/projects";
import { listPublishedArticles } from "@/lib/db/articles";

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
    const articles = listPublishedArticles(projectId);
    return NextResponse.json({ articles });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to list published articles";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
