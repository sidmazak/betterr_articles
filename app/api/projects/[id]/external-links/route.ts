import { NextRequest, NextResponse } from "next/server";
import { getProject } from "@/lib/db/projects";
import { getDb } from "@/lib/db";
import { v4 as uuid } from "uuid";

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
    const db = getDb();
    const rows = db
      .prepare(
        `SELECT id, url, title, created_at FROM project_external_links
         WHERE project_id = ? ORDER BY created_at DESC`
      )
      .all(projectId) as { id: string; url: string; title: string | null; created_at: string }[];
    return NextResponse.json(rows);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to list external links";
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
    const { url, title } = body;
    if (!url || typeof url !== "string" || !url.trim().startsWith("http")) {
      return NextResponse.json({ error: "Valid URL required" }, { status: 400 });
    }
    const db = getDb();
    const id = uuid();
    const now = new Date().toISOString();
    db.prepare(
      `INSERT OR IGNORE INTO project_external_links (id, project_id, url, title, created_at)
       VALUES (?, ?, ?, ?, ?)`
    ).run(id, projectId, url.trim(), title?.trim() || null, now);
    const row = db.prepare("SELECT * FROM project_external_links WHERE id = ?").get(id) as
      | { id: string; url: string; title: string | null }
      | undefined;
    if (!row) {
      return NextResponse.json({ error: "URL already exists" }, { status: 409 });
    }
    return NextResponse.json(row);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to add external link";
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
    const linkId = searchParams.get("linkId");
    if (!linkId) {
      return NextResponse.json({ error: "linkId required" }, { status: 400 });
    }
    const db = getDb();
    const r = db
      .prepare("DELETE FROM project_external_links WHERE id = ? AND project_id = ?")
      .run(linkId, projectId);
    if (r.changes === 0) {
      return NextResponse.json({ error: "Link not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to delete";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
