import { getDb } from "./index";

export interface ProjectScheduleRow {
  project_id: string;
  schedule_articles_enabled: number;
  schedule_articles_hour: number;
  last_schedule_run: string | null;
}

/** Projects with scheduled article generation enabled (default ON) and due to run now */
export function getProjectsDueForArticleSchedule(): ProjectScheduleRow[] {
  const db = getDb();
  const now = new Date();
  const hour = now.getHours();
  const today = now.toISOString().split("T")[0];

  const rows = db
    .prepare(
      `SELECT p.id as project_id,
              COALESCE(s.schedule_articles_enabled, 1) as schedule_articles_enabled,
              COALESCE(s.schedule_articles_hour, 9) as schedule_articles_hour,
              s.last_schedule_run
       FROM projects p
       LEFT JOIN project_site_settings s ON p.id = s.project_id
       WHERE COALESCE(s.schedule_articles_enabled, 1) = 1
         AND COALESCE(s.schedule_articles_hour, 9) = ?
         AND (s.last_schedule_run IS NULL OR s.last_schedule_run != ?)`
    )
    .all(hour, today) as ProjectScheduleRow[];

  return rows;
}

export function markScheduleRun(projectId: string): void {
  const db = getDb();
  const today = new Date().toISOString().split("T")[0];
  db.prepare(
    `UPDATE project_site_settings SET last_schedule_run = ?, updated_at = ?
     WHERE project_id = ?`
  ).run(today, new Date().toISOString(), projectId);
}
