import { NextRequest, NextResponse } from "next/server";
import { getProject } from "@/lib/db/projects";
import {
  getProjectArticleDefaults,
  resolveProjectArticleDefaultsResponse,
  setProjectArticleDefaults,
  type ArticleDefaultsConfig,
} from "@/lib/db/article-defaults";

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
    const config = await resolveProjectArticleDefaultsResponse(projectId);
    return NextResponse.json(config ?? {});
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to get article defaults";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const project = getProject(projectId);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    const body = (await request.json()) as ArticleDefaultsConfig;
    setProjectArticleDefaults(projectId, body);
    return NextResponse.json((await resolveProjectArticleDefaultsResponse(projectId)) ?? getProjectArticleDefaults(projectId) ?? {});
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to save article defaults";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
