import { getDb } from "./index";

export function runMigrations() {
  const db = getDb();
  const migrations = [
    () => {
      try {
        db.exec(`ALTER TABLE calendar_items ADD COLUMN language TEXT DEFAULT 'en'`);
      } catch {
        /* column exists */
      }
    },
    () => {
      try {
        db.exec(`ALTER TABLE articles ADD COLUMN language TEXT DEFAULT 'en'`);
      } catch {
        /* column exists */
      }
    },
    () => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS crawl_result_pages (
          id TEXT PRIMARY KEY,
          crawl_job_id TEXT NOT NULL REFERENCES crawl_jobs(id) ON DELETE CASCADE,
          project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
          url TEXT NOT NULL,
          title TEXT,
          meta_description TEXT,
          content_preview TEXT,
          status_code INTEGER,
          created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_crawl_result_pages_job ON crawl_result_pages(crawl_job_id);
        CREATE INDEX IF NOT EXISTS idx_crawl_result_pages_project ON crawl_result_pages(project_id);
      `);
    },
    () => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS crawl_job_logs (
          id TEXT PRIMARY KEY,
          crawl_job_id TEXT NOT NULL REFERENCES crawl_jobs(id) ON DELETE CASCADE,
          level TEXT NOT NULL,
          message TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_crawl_job_logs_job ON crawl_job_logs(crawl_job_id);
      `);
    },
    () => {
      try {
        db.exec(`ALTER TABLE calendar_items ADD COLUMN target_url TEXT`);
      } catch {
        /* column exists */
      }
    },
    () => {
      try {
        db.exec(`ALTER TABLE articles ADD COLUMN published_url TEXT`);
      } catch {
        /* column exists */
      }
    },
    () => {
      try {
        db.exec(`ALTER TABLE crawl_jobs ADD COLUMN max_pages INTEGER DEFAULT 150`);
      } catch {
        /* column exists */
      }
    },
    () => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS project_article_defaults (
          project_id TEXT PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
          config TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `);
    },
  ];
  migrations.forEach((m) => m());
}
