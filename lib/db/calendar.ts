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

/** Calendar items due for generation: suggested_date <= today, status='suggested', no article yet */
export function getDueCalendarItems(projectId: string): CalendarItemRow[] {
  const db = getDb();
  const today = new Date().toISOString().split("T")[0];
  const rows = db
    .prepare(
      `SELECT c.* FROM calendar_items c
       LEFT JOIN articles a ON a.calendar_item_id = c.id
       WHERE c.project_id = ? AND c.status = 'suggested' AND c.suggested_date IS NOT NULL
         AND c.suggested_date <= ? AND a.id IS NULL
       ORDER BY c.suggested_date ASC LIMIT 20`
    )
    .all(projectId, today) as CalendarItemRow[];
  return rows;
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

export function updateCalendarItem(
  id: string,
  updates: Partial<{
    title: string;
    primary_keyword: string;
    secondary_keywords: string | null;
    suggested_date: string | null;
    target_url: string | null;
    content_gap_rationale: string | null;
    internal_link_targets: string | null;
    infographic_concepts: string | null;
    ranking_potential: string | null;
    ranking_justification: string | null;
  }>
): CalendarItemRow | null {
  const db = getDb();
  const item = getCalendarItem(id);
  if (!item) return null;
  const now = new Date().toISOString();
  const cols: string[] = ["updated_at = ?"];
  const vals: unknown[] = [now];
  if (updates.title !== undefined) {
    cols.push("title = ?");
    vals.push(updates.title);
  }
  if (updates.primary_keyword !== undefined) {
    cols.push("primary_keyword = ?");
    vals.push(updates.primary_keyword);
  }
  if (updates.secondary_keywords !== undefined) {
    cols.push("secondary_keywords = ?");
    vals.push(updates.secondary_keywords);
  }
  if (updates.suggested_date !== undefined) {
    cols.push("suggested_date = ?");
    vals.push(updates.suggested_date);
  }
  if (updates.target_url !== undefined) {
    cols.push("target_url = ?");
    vals.push(updates.target_url);
  }
  if (updates.content_gap_rationale !== undefined) {
    cols.push("content_gap_rationale = ?");
    vals.push(updates.content_gap_rationale);
  }
  if (updates.internal_link_targets !== undefined) {
    cols.push("internal_link_targets = ?");
    vals.push(updates.internal_link_targets);
  }
  if (updates.infographic_concepts !== undefined) {
    cols.push("infographic_concepts = ?");
    vals.push(updates.infographic_concepts);
  }
  if (updates.ranking_potential !== undefined) {
    cols.push("ranking_potential = ?");
    vals.push(updates.ranking_potential);
  }
  if (updates.ranking_justification !== undefined) {
    cols.push("ranking_justification = ?");
    vals.push(updates.ranking_justification);
  }
  if (cols.length > 1) {
    vals.push(id);
    db.prepare(`UPDATE calendar_items SET ${cols.join(", ")} WHERE id = ?`).run(...vals);
  }
  return getCalendarItem(id);
}
