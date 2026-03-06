import { NextRequest, NextResponse } from "next/server";
import { getProject } from "@/lib/db/projects";
import {
  addManualUrl,
  addManualUrlsBulk,
  listManualUrls,
  deleteManualUrl,
} from "@/lib/db/manual-urls";

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
    const urls = listManualUrls(projectId);
    return NextResponse.json(urls);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to list manual URLs";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const project = getProject(projectId);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const body = await request.json();
    if (Array.isArray(body)) {
      addManualUrlsBulk(
        projectId,
        body.map((u: string | { url: string; title?: string }) =>
          typeof u === "string" ? { url: u } : u
        )
      );
      return NextResponse.json(listManualUrls(projectId));
    }

    const { url, title } = body;
    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }
    const added = addManualUrl(projectId, url, title);
    return NextResponse.json(added);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to add manual URL";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
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
    const urlId = searchParams.get("id");
    if (!urlId) {
      return NextResponse.json({ error: "URL id is required" }, { status: 400 });
    }
    deleteManualUrl(urlId);
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to delete manual URL";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
