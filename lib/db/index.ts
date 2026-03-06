import Database from "better-sqlite3";
import path from "path";
import { SCHEMA } from "./schema";
import { runMigrations } from "./migrate";

const dbPath = process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "app.db");

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    const fs = require("fs");
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

export type CrawlJobStatus = "pending" | "running" | "completed" | "failed";
export type CrawlJobSource = "auto" | "manual";
export type CalendarItemStatus = "suggested" | "scheduled" | "writing" | "completed";
export type ArticleStatus = "draft" | "published";

export interface Project {
  id: string;
  name: string;
  homepage_url: string | null;
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
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

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
  created_at: string;
}

export type CrawlJobLogLevel = "info" | "warn" | "error";

export interface CrawlJobLogRow {
  id: string;
  crawl_job_id: string;
  level: CrawlJobLogLevel;
  message: string;
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
  outline_content: string | null;
  content: string | null;
  status: string;
  published_url: string | null;
  created_at: string;
  updated_at: string;
}

