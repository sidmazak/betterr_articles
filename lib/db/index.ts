import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { SCHEMA } from "./schema";
import { runMigrations } from "./migrate";

const dbPath = process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "app.db");

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    db = new Database(dbPath);
    db.pragma("journal_mode = WAL");
    db.exec(SCHEMA);
    runMigrations();
  }
  return db;
}

export type CrawlJobStatus =
  | "pending"
  | "running"
  | "paused"
  | "completed"
  | "failed"
  | "cancelled";
export type CrawlJobSource = "auto" | "manual";
export type CrawlJobStage =
  | "queued"
  | "discovering"
  | "crawling"
  | "extracting"
  | "saving"
  | "paused"
  | "completed"
  | "failed"
  | "cancelled";
export type CalendarGenerationJobStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";
export type ProjectJobType = "article_generation" | "crawl" | "calendar_generation";
export type ProjectJobStatus =
  | "pending"
  | "running"
  | "paused"
  | "completed"
  | "failed"
  | "cancelled";
export type CalendarGenerationJobStage =
  | "queued"
  | "loading"
  | "preparing"
  | "generating"
  | "parsing"
  | "saving"
  | "completed"
  | "failed"
  | "cancelled";
export type CalendarItemStatus = "suggested" | "scheduled" | "writing" | "completed";
export type ArticleStatus = "draft" | "published";
export type ProjectJobLogLevel = "info" | "success" | "warn" | "error";
export type ArticleGenerationJobSource = "manual" | "schedule" | "api";

export interface Project {
  id: string;
  name: string;
  homepage_url: string | null;
  sitemap_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface CrawlJob {
  id: string;
  project_id: string;
  status: CrawlJobStatus;
  progress: number;
  total_pages: number;
  total_found: number;
  used_sitemap: number;
  error_message: string | null;
  source: CrawlJobSource;
  max_pages?: number;
  current_stage: CrawlJobStage;
  current_url: string | null;
  eta_seconds: number | null;
  avg_step_ms: number | null;
  total_batches: number;
  completed_batches: number;
  last_heartbeat_at: string | null;
  paused_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface CalendarGenerationJob {
  id: string;
  project_id: string;
  status: CalendarGenerationJobStatus;
  progress: number;
  total_steps: number;
  generated_items: number;
  total_items: number;
  current_stage: CalendarGenerationJobStage;
  current_message: string | null;
  eta_seconds: number | null;
  error_message: string | null;
  replace_existing: number;
  append_existing: number;
  whole_month: number;
  suggestion_count: number | null;
  start_date: string | null;
  end_date: string | null;
  feedback: string | null;
  last_heartbeat_at: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface ProjectJob {
  id: string;
  project_id: string;
  job_type: ProjectJobType;
  owner_resource_id: string | null;
  status: ProjectJobStatus;
  progress: number;
  total_steps: number;
  current_stage: string;
  current_message: string | null;
  error_message: string | null;
  eta_seconds: number | null;
  provider: string | null;
  model: string | null;
  attempt: number;
  content_length: number;
  reasoning_length: number;
  last_heartbeat_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface ProjectJobLogRow {
  id: string;
  project_job_id: string;
  level: ProjectJobLogLevel;
  message: string;
  stage: string | null;
  details: string | null;
  created_at: string;
}

export interface ArticleGenerationJobDetailRow {
  project_job_id: string;
  calendar_item_id: string | null;
  article_id: string | null;
  source: ArticleGenerationJobSource;
  input_json: string;
  reasoning_content: string | null;
  research_content: string | null;
  content: string | null;
  metadata_json: string | null;
  result_json: string | null;
  created_at: string;
  updated_at: string;
}

export interface ArticleGenerationJob extends ProjectJob, ArticleGenerationJobDetailRow {}

export interface CrawlResultRow {
  id: string;
  crawl_job_id: string;
  project_id: string;
  url: string;
  title: string;
  created_at: string;
}

export interface CrawlResultPageRow {
  id: string;
  crawl_job_id: string;
  project_id: string;
  url: string;
  title: string | null;
  meta_description: string | null;
  content_preview: string | null;
  status_code: number | null;
  seo_reference_json: string | null;
  created_at: string;
}

export type CrawlJobLogLevel = "info" | "warn" | "error";
export type CalendarGenerationJobLogLevel = "info" | "warn" | "error";

export interface CrawlJobLogRow {
  id: string;
  crawl_job_id: string;
  level: CrawlJobLogLevel;
  message: string;
  stage: string | null;
  details: string | null;
  created_at: string;
}

export interface CalendarGenerationJobLogRow {
  id: string;
  calendar_generation_job_id: string;
  level: CalendarGenerationJobLogLevel;
  message: string;
  stage: string | null;
  details: string | null;
  created_at: string;
}

export interface ProjectSEOInsightRow {
  id: string;
  project_id: string;
  crawl_job_id: string | null;
  topics_json: string;
  keywords_json: string;
  reference_json: string | null;
  summary: string | null;
  source: string;
  created_at: string;
  updated_at: string;
}

export interface LLMUsageLogRow {
  id: string;
  project_id: string | null;
  provider: string;
  model: string;
  request_label: string | null;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  created_at: string;
}

export interface ProjectPublishingRow {
  id: string;
  project_id: string;
  platform: string;
  label: string;
  config: string;
  enabled: number;
  auto_publish: number;
  last_tested_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface PublishingAttemptRow {
  id: string;
  project_id: string;
  article_id: string | null;
  calendar_item_id: string | null;
  publishing_config_id: string | null;
  platform: string;
  label: string | null;
  status: "success" | "failed";
  title: string;
  published_url: string | null;
  error_message: string | null;
  response_json: string | null;
  created_at: string;
}

export interface CalendarItemRow {
  id: string;
  project_id: string;
  crawl_job_id: string | null;
  target_url: string | null;
  title: string;
  primary_keyword: string;
  secondary_keywords: string | null;
  content_gap_rationale: string | null;
  internal_link_targets: string | null;
  infographic_concepts: string | null;
  ranking_potential: string | null;
  ranking_justification: string | null;
  suggested_date: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface ArticleRow {
  id: string;
  project_id: string;
  calendar_item_id: string | null;
  research_content: string | null;
  content: string | null;
  status: string;
  language: string | null;
  title: string | null;
  slug: string | null;
  seo_title: string | null;
  meta_description: string | null;
  excerpt: string | null;
  tags_json: string | null;
  category: string | null;
  cover_image_base64: string | null;
  cover_image_mime_type: string | null;
  cover_image_prompt: string | null;
  cover_image_alt: string | null;
  publish_metadata_json: string | null;
  published_url: string | null;
  last_published_at: string | null;
  created_at: string;
  updated_at: string;
}

