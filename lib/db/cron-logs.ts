import { v4 as uuid } from "uuid";
import { getDb } from "./index";

export type CronLogType = "crawl" | "article_schedule";
export type CronLogStatus = "info" | "success" | "warning" | "error";

export interface CronLogRow {
  id: string;
  type: CronLogType;
  project_id: string | null;
  job_id: string | null;
  message: string;
  status: CronLogStatus;
  details: string | null;
  created_at: string;
}

export function addCronLog(
  type: CronLogType,
  message: string,
  opts?: {
    projectId?: string;
    jobId?: string;
    status?: CronLogStatus;
    details?: Record<string, unknown>;
  }
): void {
  const db = getDb();
  const id = uuid();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO cron_logs (id, type, project_id, job_id, message, status, details, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    type,
    opts?.projectId ?? null,
    opts?.jobId ?? null,
    message,
    opts?.status ?? "info",
    opts?.details ? JSON.stringify(opts.details) : null,
    now
  );
}

export function listCronLogs(opts?: {
  projectId?: string;
  type?: CronLogType;
  limit?: number;
}): CronLogRow[] {
  const db = getDb();
  let sql = "SELECT * FROM cron_logs WHERE 1=1";
  const params: unknown[] = [];
  if (opts?.projectId) {
    sql += " AND project_id = ?";
    params.push(opts.projectId);
  }
  if (opts?.type) {
    sql += " AND type = ?";
    params.push(opts.type);
  }
  sql += " ORDER BY created_at DESC LIMIT ?";
  params.push(opts?.limit ?? 100);
  return db.prepare(sql).all(...params) as CronLogRow[];
}
