import { v4 as uuid } from "uuid";
import {
  getDb,
  type CrawlJob,
  type CrawlJobSource,
  type CrawlJobLogLevel,
  type CrawlResultPageRow,
  type CrawlJobLogRow,
} from "./index";
import type { ExistingPage } from "@/lib/prompts/types";
import type { CrawlPageResult } from "@/lib/crawler";

export function createCrawlJob(
  projectId: string,
  source: CrawlJobSource = "auto",
  maxPages = 150
): CrawlJob {
  const db = getDb();
  const id = uuid();
  const now = new Date().toISOString();
  try {
    db.prepare(
      `INSERT INTO crawl_jobs (id, project_id, status, source, max_pages, created_at)
       VALUES (?, ?, 'pending', ?, ?, ?)`
    ).run(id, projectId, source, maxPages, now);
  } catch {
    db.prepare(
      `INSERT INTO crawl_jobs (id, project_id, status, source, created_at)
       VALUES (?, ?, 'pending', ?, ?)`
    ).run(id, projectId, source, now);
  }
  return getCrawlJob(id)!;
}

export function getCrawlJob(id: string): CrawlJob | null {
  const db = getDb();
  return db.prepare("SELECT * FROM crawl_jobs WHERE id = ?").get(id) as CrawlJob | null;
}

export function listCrawlJobs(projectId: string): CrawlJob[] {
  const db = getDb();
  return db
    .prepare("SELECT * FROM crawl_jobs WHERE project_id = ? ORDER BY created_at DESC")
    .all(projectId) as CrawlJob[];
}

export function updateCrawlJobProgress(
  id: string,
  progress: number,
  totalPages: number
): void {
  const db = getDb();
  db.prepare(
    "UPDATE crawl_jobs SET progress = ?, total_pages = ? WHERE id = ?"
  ).run(progress, totalPages, id);
}

export function startCrawlJob(id: string): void {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare("UPDATE crawl_jobs SET status = 'running', started_at = ? WHERE id = ?").run(
    now,
    id
  );
}

export function completeCrawlJob(
  id: string,
  totalFound: number,
  usedSitemap: boolean
): void {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE crawl_jobs SET status = 'completed', progress = 100, total_found = ?,
     used_sitemap = ?, completed_at = ? WHERE id = ?`
  ).run(totalFound, usedSitemap ? 1 : 0, now, id);
}

export function failCrawlJob(id: string, errorMessage: string): void {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE crawl_jobs SET status = 'failed', error_message = ?, completed_at = ? WHERE id = ?`
  ).run(errorMessage, now, id);
}

export function saveCrawlResults(
  jobId: string,
  projectId: string,
  pages: CrawlPageResult[]
): void {
  const db = getDb();
  const now = new Date().toISOString();
  const pagesStmt = db.prepare(
    `INSERT INTO crawl_result_pages (id, crawl_job_id, project_id, url, title, meta_description, content_preview, status_code, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const legacyStmt = db.prepare(
    `INSERT INTO crawl_results (id, crawl_job_id, project_id, url, title, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  );
  db.transaction(() => {
    for (const p of pages) {
      pagesStmt.run(
        uuid(),
        jobId,
        projectId,
        p.url,
        p.title,
        p.meta_description ?? null,
        p.content_preview ?? null,
        p.status_code ?? null,
        now
      );
      legacyStmt.run(uuid(), jobId, projectId, p.url, p.title, now);
    }
  })();
}

export function addCrawlLog(
  jobId: string,
  level: CrawlJobLogLevel,
  message: string
): void {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO crawl_job_logs (id, crawl_job_id, level, message, created_at)
     VALUES (?, ?, ?, ?, ?)`
  ).run(uuid(), jobId, level, message, now);
}

export function addCrawlResultPage(
  jobId: string,
  projectId: string,
  page: { url: string; title?: string; meta_description?: string; content_preview?: string }
): CrawlResultPageRow {
  const db = getDb();
  const id = uuid();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO crawl_result_pages (id, crawl_job_id, project_id, url, title, meta_description, content_preview, status_code, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    jobId,
    projectId,
    page.url,
    page.title ?? null,
    page.meta_description ?? null,
    page.content_preview ?? null,
    null,
    now
  );
  db.prepare(
    `INSERT INTO crawl_results (id, crawl_job_id, project_id, url, title, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(uuid(), jobId, projectId, page.url, page.title ?? page.url, now);
  return getDb()
    .prepare("SELECT * FROM crawl_result_pages WHERE id = ?")
    .get(id) as CrawlResultPageRow;
}

export function deleteCrawlResultPage(pageId: string): boolean {
  const db = getDb();
  const r = db.prepare("DELETE FROM crawl_result_pages WHERE id = ?").run(pageId);
  return r.changes > 0;
}

export function updateCrawlResultPage(
  pageId: string,
  updates: { title?: string; meta_description?: string; content_preview?: string }
): CrawlResultPageRow | null {
  const db = getDb();
  const existing = db.prepare("SELECT * FROM crawl_result_pages WHERE id = ?").get(pageId) as CrawlResultPageRow | undefined;
  if (!existing) return null;
  const cols: string[] = [];
  const vals: unknown[] = [];
  if (updates.title !== undefined) {
    cols.push("title = ?");
    vals.push(updates.title);
  }
  if (updates.meta_description !== undefined) {
    cols.push("meta_description = ?");
    vals.push(updates.meta_description);
  }
  if (updates.content_preview !== undefined) {
    cols.push("content_preview = ?");
    vals.push(updates.content_preview);
  }
  if (cols.length === 0) return existing;
  vals.push(pageId);
  db.prepare(`UPDATE crawl_result_pages SET ${cols.join(", ")} WHERE id = ?`).run(...vals);
  return db.prepare("SELECT * FROM crawl_result_pages WHERE id = ?").get(pageId) as CrawlResultPageRow;
}

export function getCrawlJobLogs(jobId: string): CrawlJobLogRow[] {
  const db = getDb();
  return db
    .prepare(
      "SELECT * FROM crawl_job_logs WHERE crawl_job_id = ? ORDER BY created_at ASC"
    )
    .all(jobId) as CrawlJobLogRow[];
}

export function getCrawlResultPages(jobId: string): CrawlResultPageRow[] {
  const db = getDb();
  const rows = db
    .prepare("SELECT * FROM crawl_result_pages WHERE crawl_job_id = ? ORDER BY created_at ASC")
    .all(jobId) as CrawlResultPageRow[];
  if (rows.length > 0) return rows;
  // Fallback to legacy crawl_results
  const legacy = db
    .prepare("SELECT id, crawl_job_id, project_id, url, title, created_at FROM crawl_results WHERE crawl_job_id = ?")
    .all(jobId) as { id: string; crawl_job_id: string; project_id: string; url: string; title: string; created_at: string }[];
  return legacy.map((r) => ({
    ...r,
    meta_description: null,
    content_preview: null,
    status_code: null,
  })) as CrawlResultPageRow[];
}

export function getCrawlResults(jobId: string): ExistingPage[] {
  const pages = getCrawlResultPages(jobId);
  if (pages.length > 0) {
    return pages.map((p) => ({ url: p.url, title: p.title ?? p.url }));
  }
  const db = getDb();
  const rows = db
    .prepare("SELECT url, title FROM crawl_results WHERE crawl_job_id = ?")
    .all(jobId) as { url: string; title: string }[];
  return rows;
}

export function getLatestCrawlResults(projectId: string): ExistingPage[] {
  const db = getDb();
  const job = db
    .prepare(
      `SELECT id FROM crawl_jobs WHERE project_id = ? AND status = 'completed'
       ORDER BY completed_at DESC LIMIT 1`
    )
    .get(projectId) as { id: string } | undefined;
  if (!job) return [];
  return getCrawlResults(job.id);
}

export function getPendingCrawlJobs(): CrawlJob[] {
  const db = getDb();
  return db
    .prepare("SELECT * FROM crawl_jobs WHERE status = 'pending' ORDER BY created_at ASC")
    .all() as CrawlJob[];
}
