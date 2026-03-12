import { v4 as uuid } from "uuid";
import {
  getDb,
  type CrawlJob,
  type CrawlJobSource,
  type CrawlJobStage,
  type CrawlJobLogLevel,
  type CrawlResultPageRow,
  type CrawlJobLogRow,
} from "./index";
import type { ExistingPage } from "@/lib/prompts/types";
import type { CrawlPageResult } from "@/lib/crawler";
import type { SEOReference } from "@/lib/db/seo-insights";

export interface CrawlResultPageSEOData {
  topics: string[];
  keywords: string[];
  summary: string;
  reference: SEOReference;
}

export function createCrawlJob(
  projectId: string,
  source: CrawlJobSource = "auto",
  maxPages = 10
): CrawlJob {
  const db = getDb();
  const id = uuid();
  const now = new Date().toISOString();
  try {
    db.prepare(
      `INSERT INTO crawl_jobs
       (id, project_id, status, source, max_pages, current_stage, created_at)
       VALUES (?, ?, 'pending', ?, ?, 'queued', ?)`
    ).run(id, projectId, source, maxPages, now);
  } catch {
    db.prepare(
      `INSERT INTO crawl_jobs
       (id, project_id, status, source, current_stage, created_at)
       VALUES (?, ?, 'pending', ?, 'queued', ?)`
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
  totalPages: number,
  updates?: {
    currentUrl?: string | null;
    stage?: CrawlJobStage;
    etaSeconds?: number | null;
    avgStepMs?: number | null;
    totalBatches?: number;
    completedBatches?: number;
  }
): void {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE crawl_jobs
     SET progress = ?,
         total_pages = ?,
         current_url = COALESCE(?, current_url),
         current_stage = COALESCE(?, current_stage),
         eta_seconds = ?,
         avg_step_ms = ?,
         total_batches = COALESCE(?, total_batches),
         completed_batches = COALESCE(?, completed_batches),
         last_heartbeat_at = ?
     WHERE id = ?`
  ).run(
    progress,
    totalPages,
    updates?.currentUrl ?? null,
    updates?.stage ?? null,
    updates?.etaSeconds ?? null,
    updates?.avgStepMs ?? null,
    updates?.totalBatches ?? null,
    updates?.completedBatches ?? null,
    now,
    id
  );
}

export function claimPendingCrawlJob(id: string): CrawlJob | null {
  const db = getDb();
  const now = new Date().toISOString();
  const claimed = db.prepare(
    `UPDATE crawl_jobs
     SET status = 'running',
         current_stage = CASE WHEN current_stage = 'paused' THEN 'crawling' ELSE current_stage END,
         started_at = COALESCE(started_at, ?),
         paused_at = NULL,
         last_heartbeat_at = ?,
         error_message = NULL
     WHERE id = ? AND status = 'pending'`
  ).run(now, now, id);
  return claimed.changes > 0 ? getCrawlJob(id) : null;
}

export function startCrawlJob(id: string): void {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE crawl_jobs
     SET status = 'running',
         current_stage = CASE WHEN current_stage = 'queued' THEN 'discovering' ELSE current_stage END,
         started_at = COALESCE(started_at, ?),
         paused_at = NULL,
         last_heartbeat_at = ?,
         error_message = NULL
     WHERE id = ?`
  ).run(now, now, id);
}

export function setCrawlJobStage(
  id: string,
  stage: CrawlJobStage,
  updates?: { currentUrl?: string | null; etaSeconds?: number | null; totalBatches?: number; completedBatches?: number }
): void {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE crawl_jobs
     SET current_stage = ?,
         current_url = ?,
         eta_seconds = ?,
         total_batches = COALESCE(?, total_batches),
         completed_batches = COALESCE(?, completed_batches),
         last_heartbeat_at = ?
     WHERE id = ?`
  ).run(
    stage,
    updates?.currentUrl ?? null,
    updates?.etaSeconds ?? null,
    updates?.totalBatches ?? null,
    updates?.completedBatches ?? null,
    now,
    id
  );
}

export function pauseCrawlJob(id: string): void {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE crawl_jobs
     SET status = 'paused',
         current_stage = 'paused',
         paused_at = ?,
         last_heartbeat_at = ?
     WHERE id = ? AND status IN ('pending', 'running')`
  ).run(now, now, id);
}

export function resumeCrawlJob(id: string): void {
  const db = getDb();
  db.prepare(
    `UPDATE crawl_jobs
     SET status = 'pending',
         current_stage = CASE
           WHEN progress > 0 THEN 'crawling'
           ELSE 'queued'
         END,
         paused_at = NULL,
         error_message = NULL
     WHERE id = ? AND status = 'paused'`
  ).run(id);
}

export function cancelCrawlJob(id: string, message = "Crawl cancelled by user"): void {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE crawl_jobs
     SET status = 'cancelled',
         current_stage = 'cancelled',
         error_message = ?,
         eta_seconds = 0,
         completed_at = COALESCE(completed_at, ?),
         cancelled_at = ?,
         last_heartbeat_at = ?
     WHERE id = ? AND status NOT IN ('completed', 'failed', 'cancelled')`
  ).run(message, now, now, now, id);
}

export function completeCrawlJob(
  id: string,
  totalFound: number,
  usedSitemap: boolean
): void {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE crawl_jobs
     SET status = 'completed',
         current_stage = 'completed',
         progress = CASE WHEN total_pages > 0 THEN total_pages ELSE progress END,
         total_found = ?,
         used_sitemap = ?,
         eta_seconds = 0,
         current_url = NULL,
         completed_at = ?,
         last_heartbeat_at = ?
     WHERE id = ?`
  ).run(totalFound, usedSitemap ? 1 : 0, now, now, id);
}

export function failCrawlJob(id: string, errorMessage: string): void {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE crawl_jobs
     SET status = 'failed',
         current_stage = 'failed',
         error_message = ?,
         eta_seconds = 0,
         completed_at = ?,
         last_heartbeat_at = ?
     WHERE id = ?`
  ).run(errorMessage, now, now, id);
}

export function touchCrawlJob(id: string): void {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare("UPDATE crawl_jobs SET last_heartbeat_at = ? WHERE id = ?").run(now, id);
}

export function saveCrawlResults(
  jobId: string,
  projectId: string,
  pages: CrawlPageResult[]
): void {
  const db = getDb();
  const now = new Date().toISOString();
  const pagesStmt = db.prepare(
    `INSERT INTO crawl_result_pages (id, crawl_job_id, project_id, url, title, meta_description, content_preview, status_code, seo_reference_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
        null,
        now
      );
      legacyStmt.run(uuid(), jobId, projectId, p.url, p.title, now);
    }
  })();
}

export function saveOrUpdateCrawlResultPage(
  jobId: string,
  projectId: string,
  page: CrawlPageResult
): CrawlResultPageRow {
  const db = getDb();
  const now = new Date().toISOString();
  const existing = db
    .prepare("SELECT id FROM crawl_result_pages WHERE crawl_job_id = ? AND url = ?")
    .get(jobId, page.url) as { id: string } | undefined;

  if (existing) {
    db.prepare(
      `UPDATE crawl_result_pages
       SET title = ?, meta_description = ?, content_preview = ?, status_code = ?
       WHERE id = ?`
    ).run(
      page.title,
      page.meta_description ?? null,
      page.content_preview ?? null,
      page.status_code ?? null,
      existing.id
    );
    return db.prepare("SELECT * FROM crawl_result_pages WHERE id = ?").get(existing.id) as CrawlResultPageRow;
  }

  const rowId = uuid();
  db.prepare(
    `INSERT INTO crawl_result_pages
     (id, crawl_job_id, project_id, url, title, meta_description, content_preview, status_code, seo_reference_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    rowId,
    jobId,
    projectId,
    page.url,
    page.title,
    page.meta_description ?? null,
    page.content_preview ?? null,
    page.status_code ?? null,
    null,
    now
  );
  db.prepare(
    `INSERT OR IGNORE INTO crawl_results (id, crawl_job_id, project_id, url, title, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(uuid(), jobId, projectId, page.url, page.title, now);
  return db.prepare("SELECT * FROM crawl_result_pages WHERE id = ?").get(rowId) as CrawlResultPageRow;
}

export function addCrawlLog(
  jobId: string,
  level: CrawlJobLogLevel,
  message: string,
  options?: { stage?: CrawlJobStage | string | null; details?: Record<string, unknown> | null }
): void {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO crawl_job_logs (id, crawl_job_id, level, message, stage, details, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    uuid(),
    jobId,
    level,
    message,
    options?.stage ?? null,
    options?.details ? JSON.stringify(options.details) : null,
    now
  );
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
    `INSERT INTO crawl_result_pages (id, crawl_job_id, project_id, url, title, meta_description, content_preview, status_code, seo_reference_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    jobId,
    projectId,
    page.url,
    page.title ?? null,
    page.meta_description ?? null,
    page.content_preview ?? null,
    null,
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
  updates: { url?: string; title?: string; meta_description?: string; content_preview?: string }
): CrawlResultPageRow | null {
  const db = getDb();
  const existing = db.prepare("SELECT * FROM crawl_result_pages WHERE id = ?").get(pageId) as CrawlResultPageRow | undefined;
  if (!existing) return null;
  const cols: string[] = [];
  const vals: unknown[] = [];
  if (updates.url !== undefined) {
    cols.push("url = ?");
    vals.push(updates.url);
  }
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

export function updateCrawlResultPageSEOReference(
  jobId: string,
  url: string,
  seoData: CrawlResultPageSEOData | null
): CrawlResultPageRow | null {
  const db = getDb();
  const existing = db
    .prepare("SELECT id FROM crawl_result_pages WHERE crawl_job_id = ? AND url = ?")
    .get(jobId, url) as { id: string } | undefined;
  if (!existing) return null;

  db.prepare("UPDATE crawl_result_pages SET seo_reference_json = ? WHERE id = ?").run(
    seoData ? JSON.stringify(seoData) : null,
    existing.id
  );
  return db.prepare("SELECT * FROM crawl_result_pages WHERE id = ?").get(existing.id) as CrawlResultPageRow;
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
    seo_reference_json: null,
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

export function getLatestCompletedCrawlJob(projectId: string): CrawlJob | null {
  const db = getDb();
  return db
    .prepare(
      `SELECT * FROM crawl_jobs WHERE project_id = ? AND status = 'completed'
       ORDER BY completed_at DESC LIMIT 1`
    )
    .get(projectId) as CrawlJob | null;
}

export function getPendingCrawlJobs(): CrawlJob[] {
  const db = getDb();
  return db
    .prepare("SELECT * FROM crawl_jobs WHERE status = 'pending' ORDER BY created_at ASC")
    .all() as CrawlJob[];
}

export function getActiveCrawlJob(projectId: string): CrawlJob | null {
  const db = getDb();
  return db
    .prepare(
      `SELECT * FROM crawl_jobs WHERE project_id = ? AND status IN ('pending', 'running', 'paused')
       ORDER BY created_at DESC LIMIT 1`
    )
    .get(projectId) as CrawlJob | null;
}

export function hasCompletedCrawl(projectId: string): boolean {
  const db = getDb();
  const row = db
    .prepare(
      "SELECT 1 FROM crawl_jobs WHERE project_id = ? AND status = 'completed' LIMIT 1"
    )
    .get(projectId) as { "1": number } | undefined;
  return !!row;
}
