import { v4 as uuid } from "uuid";
import { getDb } from "./index";

export interface ManualUrl {
  id: string;
  project_id: string;
  url: string;
  title: string | null;
  created_at: string;
}

export function addManualUrl(projectId: string, url: string, title?: string): ManualUrl {
  const db = getDb();
  const id = uuid();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT OR REPLACE INTO project_manual_urls (id, project_id, url, title, created_at)
     VALUES (?, ?, ?, ?, ?)`
  ).run(id, projectId, url, title ?? null, now);
  return db.prepare("SELECT * FROM project_manual_urls WHERE id = ?").get(id) as ManualUrl;
}

export function addManualUrlsBulk(
  projectId: string,
  urls: { url: string; title?: string }[]
): void {
  const db = getDb();
  const now = new Date().toISOString();
  const stmt = db.prepare(
    `INSERT OR REPLACE INTO project_manual_urls (id, project_id, url, title, created_at)
     VALUES (?, ?, ?, ?, ?)`
  );
  const run = db.transaction(() => {
    for (const { url, title } of urls) {
      stmt.run(uuid(), projectId, url, title ?? null, now);
    }
  });
  run();
}

export function listManualUrls(projectId: string): ManualUrl[] {
  const db = getDb();
  return db
    .prepare("SELECT * FROM project_manual_urls WHERE project_id = ? ORDER BY created_at")
    .all(projectId) as ManualUrl[];
}

export function deleteManualUrl(id: string): void {
  const db = getDb();
  db.prepare("DELETE FROM project_manual_urls WHERE id = ?").run(id);
}
