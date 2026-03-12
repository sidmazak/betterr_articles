import { v4 as uuid } from "uuid";
import { getDb, type Project } from "./index";

export function createProject(name: string, homepageUrl?: string): Project {
  const db = getDb();
  const id = uuid();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO projects (id, name, homepage_url, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)`
  ).run(id, name, homepageUrl ?? null, now, now);
  return getProject(id)!;
}

export function getProject(id: string): Project | null {
  const db = getDb();
  return db.prepare("SELECT * FROM projects WHERE id = ?").get(id) as Project | null;
}

export function listProjects(): Project[] {
  const db = getDb();
  return db.prepare("SELECT * FROM projects ORDER BY updated_at DESC").all() as Project[];
}

export type ProjectStats = {
  crawl_jobs_count: number;
  calendar_items_count: number;
  pages_count: number;
  keywords_count: number;
  articles_count: number;
};

export function getProjectStats(projectId: string): ProjectStats {
  const db = getDb();
  const crawlJobs = db.prepare("SELECT COUNT(*) as c FROM crawl_jobs WHERE project_id = ?").get(projectId) as { c: number };
  const calendarItems = db.prepare("SELECT COUNT(*) as c FROM calendar_items WHERE project_id = ?").get(projectId) as { c: number };
  const pages = db.prepare(
    "SELECT COUNT(*) as c FROM crawl_result_pages WHERE project_id = ?"
  ).get(projectId) as { c: number };
  const keywords = db.prepare("SELECT COUNT(*) as c FROM project_keywords WHERE project_id = ?").get(projectId) as { c: number };
  const articles = db.prepare("SELECT COUNT(*) as c FROM articles WHERE project_id = ?").get(projectId) as { c: number };
  return {
    crawl_jobs_count: crawlJobs?.c ?? 0,
    calendar_items_count: calendarItems?.c ?? 0,
    pages_count: pages?.c ?? 0,
    keywords_count: keywords?.c ?? 0,
    articles_count: articles?.c ?? 0,
  };
}

export function updateProject(
  id: string,
  updates: { name?: string; homepage_url?: string; sitemap_url?: string }
): void {
  const db = getDb();
  const now = new Date().toISOString();
  if (updates.name !== undefined) {
    db.prepare("UPDATE projects SET name = ?, updated_at = ? WHERE id = ?").run(updates.name, now, id);
  }
  if (updates.homepage_url !== undefined) {
    db.prepare("UPDATE projects SET homepage_url = ?, updated_at = ? WHERE id = ?").run(
      updates.homepage_url,
      now,
      id
    );
  }
  if (updates.sitemap_url !== undefined) {
    db.prepare("UPDATE projects SET sitemap_url = ?, updated_at = ? WHERE id = ?").run(
      updates.sitemap_url,
      now,
      id
    );
  }
}

export function deleteProject(id: string): void {
  const db = getDb();
  db.prepare("DELETE FROM projects WHERE id = ?").run(id);
}
