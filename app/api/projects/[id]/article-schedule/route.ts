import { NextRequest, NextResponse } from "next/server";
import { getProject } from "@/lib/db/projects";
import { getDb } from "@/lib/db";

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
    const row = db
      .prepare(
        `SELECT schedule_articles_enabled, schedule_articles_hour, last_schedule_run
         FROM project_site_settings WHERE project_id = ?`
      )
      .get(projectId) as { schedule_articles_enabled: number | null; schedule_articles_hour: number | null; last_schedule_run: string | null } | undefined;

    return NextResponse.json({
      enabled: row ? !!(row.schedule_articles_enabled ?? 0) : true,
      hour: row?.schedule_articles_hour ?? 9,
      lastRun: row?.last_schedule_run ?? null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to get schedule";
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
    const body = await request.json();
    const { enabled, hour } = body as { enabled?: boolean; hour?: number };
    const db = getDb();
    const now = new Date().toISOString();

    const existing = db
      .prepare("SELECT project_id FROM project_site_settings WHERE project_id = ?")
      .get(projectId);

    if (existing) {
      db.prepare(
        `UPDATE project_site_settings SET
          schedule_articles_enabled = COALESCE(?, schedule_articles_enabled),
          schedule_articles_hour = COALESCE(?, schedule_articles_hour),
          updated_at = ?
         WHERE project_id = ?`
      ).run(enabled !== undefined ? (enabled ? 1 : 0) : null, hour ?? null, now, projectId);
    } else {
      db.prepare(
        `INSERT INTO project_site_settings (project_id, auto_publish, auto_internal_links, auto_external_links, auto_infographics, auto_images, eeat_optimization, schedule_articles_enabled, schedule_articles_hour, updated_at)
         VALUES (?, 0, 1, 1, 1, 0, 1, ?, ?, ?)`
      ).run(projectId, enabled !== undefined ? (enabled ? 1 : 0) : 1, hour ?? 9, now);
    }

    return NextResponse.json({
      enabled: enabled !== undefined ? enabled : true,
      hour: hour ?? 9,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to save schedule";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
