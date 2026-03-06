import { NextRequest, NextResponse } from "next/server";
import { getProject } from "@/lib/db/projects";
import { getProjectPublishing, saveProjectPublishing } from "@/lib/db/settings";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const project = getProject(projectId);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    const config = getProjectPublishing(projectId);
    return NextResponse.json(config ?? {});
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to get publishing config";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const project = getProject(projectId);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const body = await request.json();
    const { platform, config } = body;

    if (!platform || !config) {
      return NextResponse.json(
        { error: "platform and config are required" },
        { status: 400 }
      );
    }

    const saved = saveProjectPublishing(projectId, platform, config);
    return NextResponse.json(saved);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to save publishing config";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
