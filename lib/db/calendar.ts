import { v4 as uuid } from "uuid";
import { getDb, type CalendarItemRow } from "./index";
import type { CalendarItem } from "@/lib/app-types";

export function createCalendarItems(projectId: string, crawlJobId: string | null, items: CalendarItem[]): CalendarItemRow[] {
  const db = getDb();
  const now = new Date().toISOString();
  const stmt = db.prepare(
    `INSERT INTO calendar_items (
      id, project_id, crawl_job_id, target_url, title, primary_keyword, secondary_keywords,
      content_gap_rationale, internal_link_targets, infographic_concepts,
      ranking_potential, ranking_justification, suggested_date, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'suggested', ?, ?)`
  );
  const created: CalendarItemRow[] = [];
  const run = db.transaction(() => {
    for (const item of items) {
      const id = uuid();
      stmt.run(
        id,
        projectId,
        crawlJobId,
        (item as { targetUrl?: string }).targetUrl ?? null,
        item.title,
        item.primaryKeyword,
        JSON.stringify(item.secondaryKeywords ?? []),
        item.contentGapRationale ?? null,
        JSON.stringify(item.internalLinkTargets ?? []),
        JSON.stringify(item.infographicConcepts ?? []),
        item.rankingPotential ?? null,
        item.rankingJustification ?? null,
        item.suggestedDate ?? null,
        now,
        now
      );
      created.push(getCalendarItem(id)!);
    }
  });
  run();
  return created;
}

export function getCalendarItem(id: string): CalendarItemRow | null {
  const db = getDb();
  return db.prepare("SELECT * FROM calendar_items WHERE id = ?").get(id) as CalendarItemRow | null;
}

export function listCalendarItems(projectId: string): CalendarItemRow[] {
  const db = getDb();
  return db
    .prepare("SELECT * FROM calendar_items WHERE project_id = ? ORDER BY suggested_date, created_at")
    .all(projectId) as CalendarItemRow[];
}

export function updateCalendarItemStatus(id: string, status: string): void {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare("UPDATE calendar_items SET status = ?, updated_at = ? WHERE id = ?").run(
    status,
    now,
    id
  );
}

export function deleteCalendarItemsByProject(projectId: string): void {
  const db = getDb();
  db.prepare("DELETE FROM calendar_items WHERE project_id = ?").run(projectId);
}

export function deleteCalendarItem(id: string): boolean {
  const db = getDb();
  const r = db.prepare("DELETE FROM calendar_items WHERE id = ?").run(id);
  return r.changes > 0;
}
