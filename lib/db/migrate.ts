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
          seo_reference_json TEXT,
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
      db.exec(`
        CREATE TABLE IF NOT EXISTS calendar_generation_jobs (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
          status TEXT NOT NULL DEFAULT 'pending',
          progress INTEGER DEFAULT 0,
          total_steps INTEGER DEFAULT 0,
          generated_items INTEGER DEFAULT 0,
          total_items INTEGER DEFAULT 0,
          current_stage TEXT DEFAULT 'queued',
          current_message TEXT,
          eta_seconds INTEGER,
          error_message TEXT,
          replace_existing INTEGER DEFAULT 0,
          append_existing INTEGER DEFAULT 0,
          whole_month INTEGER DEFAULT 0,
          suggestion_count INTEGER,
          start_date TEXT,
          end_date TEXT,
          feedback TEXT,
          last_heartbeat_at TEXT,
          created_at TEXT NOT NULL,
          started_at TEXT,
          completed_at TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_calendar_generation_jobs_project ON calendar_generation_jobs(project_id);
        CREATE INDEX IF NOT EXISTS idx_calendar_generation_jobs_status ON calendar_generation_jobs(status);
      `);
    },
    () => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS calendar_generation_job_logs (
          id TEXT PRIMARY KEY,
          calendar_generation_job_id TEXT NOT NULL REFERENCES calendar_generation_jobs(id) ON DELETE CASCADE,
          level TEXT NOT NULL,
          message TEXT NOT NULL,
          stage TEXT,
          details TEXT,
          created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_calendar_generation_job_logs_job
          ON calendar_generation_job_logs(calendar_generation_job_id);
      `);
    },
    () => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS project_jobs (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
          job_type TEXT NOT NULL,
          owner_resource_id TEXT,
          status TEXT NOT NULL DEFAULT 'pending',
          progress INTEGER DEFAULT 0,
          total_steps INTEGER DEFAULT 0,
          current_stage TEXT DEFAULT 'queued',
          current_message TEXT,
          error_message TEXT,
          eta_seconds INTEGER,
          provider TEXT,
          model TEXT,
          attempt INTEGER DEFAULT 0,
          content_length INTEGER DEFAULT 0,
          reasoning_length INTEGER DEFAULT 0,
          last_heartbeat_at TEXT,
          cancelled_at TEXT,
          created_at TEXT NOT NULL,
          started_at TEXT,
          completed_at TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_project_jobs_project ON project_jobs(project_id);
        CREATE INDEX IF NOT EXISTS idx_project_jobs_type ON project_jobs(job_type);
        CREATE INDEX IF NOT EXISTS idx_project_jobs_status ON project_jobs(status);
        CREATE INDEX IF NOT EXISTS idx_project_jobs_project_type_status
          ON project_jobs(project_id, job_type, status);
      `);
    },
    () => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS project_job_logs (
          id TEXT PRIMARY KEY,
          project_job_id TEXT NOT NULL REFERENCES project_jobs(id) ON DELETE CASCADE,
          level TEXT NOT NULL,
          message TEXT NOT NULL,
          stage TEXT,
          details TEXT,
          created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_project_job_logs_job ON project_job_logs(project_job_id);
      `);
    },
    () => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS article_generation_jobs (
          project_job_id TEXT PRIMARY KEY REFERENCES project_jobs(id) ON DELETE CASCADE,
          calendar_item_id TEXT REFERENCES calendar_items(id) ON DELETE SET NULL,
          article_id TEXT REFERENCES articles(id) ON DELETE SET NULL,
          source TEXT NOT NULL DEFAULT 'manual',
          input_json TEXT NOT NULL,
          reasoning_content TEXT,
          research_content TEXT,
          content TEXT,
          metadata_json TEXT,
          result_json TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_article_generation_jobs_calendar_item
          ON article_generation_jobs(calendar_item_id);
        CREATE INDEX IF NOT EXISTS idx_article_generation_jobs_article
          ON article_generation_jobs(article_id);
      `);
    },
    () => {
      try {
        db.exec(`ALTER TABLE article_generation_jobs ADD COLUMN reasoning_content TEXT`);
      } catch {
        /* column exists */
      }
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
        db.exec(`ALTER TABLE crawl_jobs ADD COLUMN max_pages INTEGER DEFAULT 50`);
      } catch {
        /* column exists */
      }
    },
    () => {
      try {
        db.exec(`UPDATE crawl_jobs SET max_pages = 50 WHERE max_pages IS NULL OR max_pages = 150`);
      } catch {
        /* best effort backfill */
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
    () => {
      try {
        db.exec(`ALTER TABLE projects ADD COLUMN sitemap_url TEXT`);
      } catch {
        /* column exists */
      }
    },
    () => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS project_keywords (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
          keyword TEXT NOT NULL,
          source TEXT NOT NULL DEFAULT 'extracted',
          crawl_job_id TEXT REFERENCES crawl_jobs(id),
          created_at TEXT NOT NULL,
          UNIQUE(project_id, keyword)
        );
        CREATE INDEX IF NOT EXISTS idx_project_keywords_project ON project_keywords(project_id);
      `);
    },
    () => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS project_internal_links (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
          url TEXT NOT NULL,
          title TEXT,
          created_at TEXT NOT NULL,
          UNIQUE(project_id, url)
        );
        CREATE INDEX IF NOT EXISTS idx_project_internal_links_project ON project_internal_links(project_id);
      `);
    },
    () => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS project_external_links (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
          url TEXT NOT NULL,
          title TEXT,
          created_at TEXT NOT NULL,
          UNIQUE(project_id, url)
        );
        CREATE INDEX IF NOT EXISTS idx_project_external_links_project ON project_external_links(project_id);
      `);
    },
    () => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS project_site_settings (
          project_id TEXT PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
          auto_publish INTEGER DEFAULT 0,
          auto_internal_links INTEGER DEFAULT 1,
          auto_external_links INTEGER DEFAULT 1,
          auto_infographics INTEGER DEFAULT 1,
          auto_images INTEGER DEFAULT 0,
          eeat_optimization INTEGER DEFAULT 1,
          updated_at TEXT NOT NULL
        )
      `);
    },
    () => {
      try {
        db.exec(`ALTER TABLE project_site_settings ADD COLUMN schedule_articles_enabled INTEGER DEFAULT 0`);
      } catch {
        /* column exists */
      }
    },
    () => {
      try {
        db.exec(`ALTER TABLE project_site_settings ADD COLUMN schedule_articles_hour INTEGER DEFAULT 9`);
      } catch {
        /* column exists */
      }
    },
    () => {
      try {
        db.exec(`ALTER TABLE project_site_settings ADD COLUMN last_schedule_run TEXT`);
      } catch {
        /* column exists */
      }
    },
    () => {
      try {
        db.exec(`ALTER TABLE project_site_settings ADD COLUMN infographic_watermark INTEGER DEFAULT 1`);
      } catch {
        /* column exists */
      }
    },
    () => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS cron_logs (
          id TEXT PRIMARY KEY,
          type TEXT NOT NULL,
          project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
          job_id TEXT,
          message TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'info',
          details TEXT,
          created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_cron_logs_project ON cron_logs(project_id);
        CREATE INDEX IF NOT EXISTS idx_cron_logs_created ON cron_logs(created_at);
      `);
    },
    () => {
      const crawlJobColumns = [
        "current_stage TEXT DEFAULT 'queued'",
        "current_url TEXT",
        "eta_seconds INTEGER",
        "avg_step_ms INTEGER",
        "total_batches INTEGER DEFAULT 0",
        "completed_batches INTEGER DEFAULT 0",
        "last_heartbeat_at TEXT",
        "paused_at TEXT",
        "cancelled_at TEXT",
      ];
      for (const column of crawlJobColumns) {
        try {
          db.exec(`ALTER TABLE crawl_jobs ADD COLUMN ${column}`);
        } catch {
          /* column exists */
        }
      }
    },
    () => {
      try {
        db.exec(`ALTER TABLE crawl_job_logs ADD COLUMN stage TEXT`);
      } catch {
        /* column exists */
      }
      try {
        db.exec(`ALTER TABLE crawl_job_logs ADD COLUMN details TEXT`);
      } catch {
        /* column exists */
      }
    },
    () => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS project_seo_insights (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
          crawl_job_id TEXT REFERENCES crawl_jobs(id) ON DELETE SET NULL,
          topics_json TEXT NOT NULL,
          keywords_json TEXT NOT NULL,
          reference_json TEXT,
          summary TEXT,
          source TEXT NOT NULL DEFAULT 'crawl',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_project_seo_insights_project ON project_seo_insights(project_id);
      `);
    },
    () => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS llm_usage_logs (
          id TEXT PRIMARY KEY,
          project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
          provider TEXT NOT NULL,
          model TEXT NOT NULL,
          request_label TEXT,
          prompt_tokens INTEGER NOT NULL DEFAULT 0,
          completion_tokens INTEGER NOT NULL DEFAULT 0,
          total_tokens INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_llm_usage_logs_project ON llm_usage_logs(project_id);
        CREATE INDEX IF NOT EXISTS idx_llm_usage_logs_created ON llm_usage_logs(created_at);
      `);
    },
    () => {
      const publishingColumns = [
        "label TEXT",
        "enabled INTEGER DEFAULT 1",
        "auto_publish INTEGER DEFAULT 0",
        "last_tested_at TEXT",
        "last_error TEXT",
      ];
      for (const column of publishingColumns) {
        try {
          db.exec(`ALTER TABLE project_publishing ADD COLUMN ${column}`);
        } catch {
          /* column exists */
        }
      }
      try {
        db.exec(`UPDATE project_publishing SET label = platform WHERE label IS NULL OR TRIM(label) = ''`);
      } catch {
        /* best effort backfill */
      }
      try {
        db.exec(`UPDATE project_publishing SET enabled = 1 WHERE enabled IS NULL`);
      } catch {
        /* best effort backfill */
      }
      try {
        db.exec(`UPDATE project_publishing SET auto_publish = 0 WHERE auto_publish IS NULL`);
      } catch {
        /* best effort backfill */
      }
      try {
        db.exec(`CREATE INDEX IF NOT EXISTS idx_project_publishing_project ON project_publishing(project_id)`);
      } catch {
        /* index exists */
      }
      try {
        db.exec(`CREATE INDEX IF NOT EXISTS idx_project_publishing_project_enabled ON project_publishing(project_id, enabled)`);
      } catch {
        /* index exists */
      }
    },
    () => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS publishing_attempts (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
          article_id TEXT REFERENCES articles(id) ON DELETE SET NULL,
          calendar_item_id TEXT REFERENCES calendar_items(id) ON DELETE SET NULL,
          publishing_config_id TEXT REFERENCES project_publishing(id) ON DELETE SET NULL,
          platform TEXT NOT NULL,
          label TEXT,
          status TEXT NOT NULL,
          title TEXT NOT NULL,
          published_url TEXT,
          error_message TEXT,
          response_json TEXT,
          created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_publishing_attempts_project ON publishing_attempts(project_id);
        CREATE INDEX IF NOT EXISTS idx_publishing_attempts_article ON publishing_attempts(article_id);
        CREATE INDEX IF NOT EXISTS idx_publishing_attempts_created ON publishing_attempts(created_at);
      `);
    },
    () => {
      try {
        db.exec(`ALTER TABLE crawl_result_pages ADD COLUMN seo_reference_json TEXT`);
      } catch {
        /* column exists */
      }
    },
    () => {
      try {
        db.exec(`ALTER TABLE project_seo_insights ADD COLUMN reference_json TEXT`);
      } catch {
        /* column exists */
      }
    },
    () => {
      try {
        db.exec(`ALTER TABLE llm_settings ADD COLUMN enable_thinking INTEGER DEFAULT 0`);
      } catch {
        /* column exists */
      }
    },
    () => {
      const articleColumns = [
        "title TEXT",
        "slug TEXT",
        "seo_title TEXT",
        "meta_description TEXT",
        "excerpt TEXT",
        "tags_json TEXT",
        "category TEXT",
        "cover_image_base64 TEXT",
        "cover_image_mime_type TEXT",
        "cover_image_prompt TEXT",
        "cover_image_alt TEXT",
        "publish_metadata_json TEXT",
        "last_published_at TEXT",
      ];
      for (const column of articleColumns) {
        try {
          db.exec(`ALTER TABLE articles ADD COLUMN ${column}`);
        } catch {
          /* column exists */
        }
      }
    },
  ];
  migrations.forEach((m) => m());
}
