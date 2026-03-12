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
  max_pages INTEGER DEFAULT 50,
  current_stage TEXT DEFAULT 'queued',
  current_url TEXT,
  eta_seconds INTEGER,
  avg_step_ms INTEGER,
  total_batches INTEGER DEFAULT 0,
  completed_batches INTEGER DEFAULT 0,
  last_heartbeat_at TEXT,
  paused_at TEXT,
  cancelled_at TEXT,
  created_at TEXT NOT NULL,
  started_at TEXT,
  completed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_crawl_jobs_project ON crawl_jobs(project_id);
CREATE INDEX IF NOT EXISTS idx_crawl_jobs_status ON crawl_jobs(status);

-- Calendar generation jobs
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

CREATE TABLE IF NOT EXISTS calendar_generation_job_logs (
  id TEXT PRIMARY KEY,
  calendar_generation_job_id TEXT NOT NULL REFERENCES calendar_generation_jobs(id) ON DELETE CASCADE,
  level TEXT NOT NULL,
  message TEXT NOT NULL,
  stage TEXT,
  details TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_calendar_generation_job_logs_job ON calendar_generation_job_logs(calendar_generation_job_id);

-- Shared project jobs
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
CREATE INDEX IF NOT EXISTS idx_project_jobs_project_type_status ON project_jobs(project_id, job_type, status);

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

CREATE INDEX IF NOT EXISTS idx_article_generation_jobs_calendar_item ON article_generation_jobs(calendar_item_id);
CREATE INDEX IF NOT EXISTS idx_article_generation_jobs_article ON article_generation_jobs(article_id);

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
  content TEXT,
  status TEXT DEFAULT 'draft',
  language TEXT DEFAULT 'en',
  title TEXT,
  slug TEXT,
  seo_title TEXT,
  meta_description TEXT,
  excerpt TEXT,
  tags_json TEXT,
  category TEXT,
  cover_image_base64 TEXT,
  cover_image_mime_type TEXT,
  cover_image_prompt TEXT,
  cover_image_alt TEXT,
  publish_metadata_json TEXT,
  published_url TEXT,
  last_published_at TEXT,
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

-- Project publishing config (WordPress, Wix, Odoo, webhook, etc.)
CREATE TABLE IF NOT EXISTS project_publishing (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  label TEXT NOT NULL,
  config TEXT NOT NULL,
  enabled INTEGER DEFAULT 1,
  auto_publish INTEGER DEFAULT 0,
  last_tested_at TEXT,
  last_error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_project_publishing_project ON project_publishing(project_id);
CREATE INDEX IF NOT EXISTS idx_project_publishing_project_enabled ON project_publishing(project_id, enabled);

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
