import { NextRequest, NextResponse } from "next/server";
import { getProject } from "@/lib/db/projects";
import { getDb } from "@/lib/db";

const DEFAULTS = {
  auto_publish: 0,
  auto_internal_links: 1,
  auto_external_links: 1,
  auto_infographics: 1,
  auto_images: 0,
  eeat_optimization: 1,
  infographic_watermark: 1,
};

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
      .prepare("SELECT * FROM project_site_settings WHERE project_id = ?")
      .get(projectId) as { project_id: string; auto_publish: number; auto_internal_links: number; auto_external_links: number; auto_infographics: number; auto_images: number; eeat_optimization: number; infographic_watermark?: number } | undefined;
    if (!row) {
      return NextResponse.json(DEFAULTS);
    }
    return NextResponse.json({
      auto_publish: row.auto_publish ?? DEFAULTS.auto_publish,
      auto_internal_links: row.auto_internal_links ?? DEFAULTS.auto_internal_links,
      auto_external_links: row.auto_external_links ?? DEFAULTS.auto_external_links,
      auto_infographics: row.auto_infographics ?? DEFAULTS.auto_infographics,
      auto_images: row.auto_images ?? DEFAULTS.auto_images,
      eeat_optimization: row.eeat_optimization ?? DEFAULTS.eeat_optimization,
      infographic_watermark: row.infographic_watermark ?? DEFAULTS.infographic_watermark,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to get settings";
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
    const { auto_publish, auto_internal_links, auto_external_links, auto_infographics, auto_images, eeat_optimization, infographic_watermark } = body;
    const db = getDb();
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO project_site_settings (project_id, auto_publish, auto_internal_links, auto_external_links, auto_infographics, auto_images, eeat_optimization, infographic_watermark, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(project_id) DO UPDATE SET
         auto_publish = excluded.auto_publish,
         auto_internal_links = excluded.auto_internal_links,
         auto_external_links = excluded.auto_external_links,
         auto_infographics = excluded.auto_infographics,
         auto_images = excluded.auto_images,
         eeat_optimization = excluded.eeat_optimization,
         infographic_watermark = excluded.infographic_watermark,
         updated_at = excluded.updated_at`
    ).run(
      projectId,
      auto_publish ?? DEFAULTS.auto_publish,
      auto_internal_links ?? DEFAULTS.auto_internal_links,
      auto_external_links ?? DEFAULTS.auto_external_links,
      auto_infographics ?? DEFAULTS.auto_infographics,
      auto_images ?? DEFAULTS.auto_images,
      eeat_optimization ?? DEFAULTS.eeat_optimization,
      infographic_watermark ?? DEFAULTS.infographic_watermark,
      now
    );
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to save";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
