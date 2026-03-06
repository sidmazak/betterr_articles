export const SCHEMA = `
-- Projects
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  homepage_url TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Manual URLs (fallback when crawl fails)
CREATE TABLE IF NOT EXISTS project_manual_urls (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  title TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(project_id, url)
);

-- Crawl jobs
CREATE TABLE IF NOT EXISTS crawl_jobs (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  progress INTEGER DEFAULT 0,
  total_pages INTEGER DEFAULT 0,
  total_found INTEGER DEFAULT 0,
  used_sitemap INTEGER DEFAULT 0,
  error_message TEXT,
  source TEXT NOT NULL DEFAULT 'auto',
  created_at TEXT NOT NULL,
  started_at TEXT,
  completed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_crawl_jobs_project ON crawl_jobs(project_id);
CREATE INDEX IF NOT EXISTS idx_crawl_jobs_status ON crawl_jobs(status);

-- Crawl results (URLs from a completed job)
CREATE TABLE IF NOT EXISTS crawl_results (
  id TEXT PRIMARY KEY,
  crawl_job_id TEXT NOT NULL REFERENCES crawl_jobs(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  title TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_crawl_results_project ON crawl_results(project_id);
CREATE INDEX IF NOT EXISTS idx_crawl_results_job ON crawl_results(crawl_job_id);

-- Calendar items (content suggestions)
CREATE TABLE IF NOT EXISTS calendar_items (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  crawl_job_id TEXT REFERENCES crawl_jobs(id),
  title TEXT NOT NULL,
  primary_keyword TEXT NOT NULL,
  secondary_keywords TEXT,
  content_gap_rationale TEXT,
  internal_link_targets TEXT,
  infographic_concepts TEXT,
  ranking_potential TEXT,
  ranking_justification TEXT,
  suggested_date TEXT,
  status TEXT DEFAULT 'suggested',
  language TEXT DEFAULT 'en',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_calendar_items_project ON calendar_items(project_id);

-- Articles (generated content)
CREATE TABLE IF NOT EXISTS articles (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  calendar_item_id TEXT REFERENCES calendar_items(id),
  research_content TEXT,
  outline_content TEXT,
  content TEXT,
  status TEXT DEFAULT 'draft',
  language TEXT DEFAULT 'en',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_articles_project ON articles(project_id);

-- Schedules (for cron)
CREATE TABLE IF NOT EXISTS schedules (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  calendar_item_id TEXT REFERENCES calendar_items(id),
  cron_expression TEXT NOT NULL,
  next_run_at TEXT,
  enabled INTEGER DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_schedules_next_run ON schedules(next_run_at) WHERE enabled = 1;

-- App settings (UI-configured, key-value)
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TEXT NOT NULL
);

-- LLM provider settings (configured from UI)
CREATE TABLE IF NOT EXISTS llm_settings (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  api_key TEXT,
  model TEXT,
  base_url TEXT,
  is_default INTEGER DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Project publishing config (WordPress, Wix, Odoo, webhook, etc.)
CREATE TABLE IF NOT EXISTS project_publishing (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  config TEXT NOT NULL,
  is_default INTEGER DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Notification settings (email)
CREATE TABLE IF NOT EXISTS notification_settings (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  smtp_host TEXT,
  smtp_port INTEGER,
  smtp_user TEXT,
  smtp_pass TEXT,
  use_gmail INTEGER DEFAULT 1,
  notify_on_crawl INTEGER DEFAULT 1,
  notify_on_calendar INTEGER DEFAULT 1,
  notify_on_article INTEGER DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
`;
