import { v4 as uuid } from "uuid";
import {
  getDb,
  type CalendarGenerationJob,
  type CalendarGenerationJobLogLevel,
  type CalendarGenerationJobLogRow,
  type CalendarGenerationJobStage,
} from "./index";

type CreateCalendarGenerationJobInput = {
  replaceExisting?: boolean;
  appendExisting?: boolean;
  wholeMonth?: boolean;
  suggestionCount?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  feedback?: string | null;
};

export function createCalendarGenerationJob(
  projectId: string,
  input: CreateCalendarGenerationJobInput
): CalendarGenerationJob {
  const db = getDb();
  const id = uuid();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO calendar_generation_jobs (
      id, project_id, status, progress, total_steps, generated_items, total_items,
      current_stage, replace_existing, append_existing, whole_month, suggestion_count,
      start_date, end_date, feedback, created_at
    ) VALUES (?, ?, 'pending', 0, 0, 0, 0, 'queued', ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    projectId,
    input.replaceExisting ? 1 : 0,
    input.appendExisting ? 1 : 0,
    input.wholeMonth ? 1 : 0,
    input.suggestionCount ?? null,
    input.startDate ?? null,
    input.endDate ?? null,
    input.feedback ?? null,
    now
  );
  return getCalendarGenerationJob(id)!;
}

export function getCalendarGenerationJob(id: string): CalendarGenerationJob | null {
  const db = getDb();
  return db
    .prepare("SELECT * FROM calendar_generation_jobs WHERE id = ?")
    .get(id) as CalendarGenerationJob | null;
}

export function getActiveCalendarGenerationJob(projectId: string): CalendarGenerationJob | null {
  const db = getDb();
  return db
    .prepare(
      `SELECT * FROM calendar_generation_jobs
       WHERE project_id = ? AND status IN ('pending', 'running')
       ORDER BY created_at DESC
       LIMIT 1`
    )
    .get(projectId) as CalendarGenerationJob | null;
}

export function claimPendingCalendarGenerationJob(id: string): CalendarGenerationJob | null {
  const db = getDb();
  const now = new Date().toISOString();
  const claimed = db.prepare(
    `UPDATE calendar_generation_jobs
     SET status = 'running',
         current_stage = CASE WHEN current_stage = 'queued' THEN 'loading' ELSE current_stage END,
         started_at = COALESCE(started_at, ?),
         last_heartbeat_at = ?,
         error_message = NULL
     WHERE id = ? AND status = 'pending'`
  ).run(now, now, id);
  return claimed.changes > 0 ? getCalendarGenerationJob(id) : null;
}

export function startCalendarGenerationJob(id: string): void {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE calendar_generation_jobs
     SET status = 'running',
         current_stage = CASE WHEN current_stage = 'queued' THEN 'loading' ELSE current_stage END,
         started_at = COALESCE(started_at, ?),
         last_heartbeat_at = ?,
         error_message = NULL
     WHERE id = ?`
  ).run(now, now, id);
}

export function updateCalendarGenerationJobProgress(
  id: string,
  progress: number,
  totalSteps: number,
  updates?: {
    stage?: CalendarGenerationJobStage;
    message?: string | null;
    etaSeconds?: number | null;
    generatedItems?: number;
    totalItems?: number;
  }
): void {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE calendar_generation_jobs
     SET progress = ?,
         total_steps = ?,
         current_stage = COALESCE(?, current_stage),
         current_message = ?,
         eta_seconds = ?,
         generated_items = COALESCE(?, generated_items),
         total_items = COALESCE(?, total_items),
         last_heartbeat_at = ?
     WHERE id = ?`
  ).run(
    progress,
    totalSteps,
    updates?.stage ?? null,
    updates?.message ?? null,
    updates?.etaSeconds ?? null,
    updates?.generatedItems ?? null,
    updates?.totalItems ?? null,
    now,
    id
  );
}

export function setCalendarGenerationJobStage(
  id: string,
  stage: CalendarGenerationJobStage,
  updates?: {
    message?: string | null;
    etaSeconds?: number | null;
    generatedItems?: number;
    totalItems?: number;
  }
): void {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE calendar_generation_jobs
     SET current_stage = ?,
         current_message = ?,
         eta_seconds = ?,
         generated_items = COALESCE(?, generated_items),
         total_items = COALESCE(?, total_items),
         last_heartbeat_at = ?
     WHERE id = ?`
  ).run(
    stage,
    updates?.message ?? null,
    updates?.etaSeconds ?? null,
    updates?.generatedItems ?? null,
    updates?.totalItems ?? null,
    now,
    id
  );
}

export function touchCalendarGenerationJob(id: string): void {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare("UPDATE calendar_generation_jobs SET last_heartbeat_at = ? WHERE id = ?").run(now, id);
}

export function completeCalendarGenerationJob(
  id: string,
  generatedItems: number,
  totalItems: number,
  message = "Calendar generation complete"
): void {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE calendar_generation_jobs
     SET status = 'completed',
         current_stage = 'completed',
         current_message = ?,
         generated_items = ?,
         total_items = ?,
         eta_seconds = 0,
         completed_at = ?,
         last_heartbeat_at = ?
     WHERE id = ?`
  ).run(message, generatedItems, totalItems, now, now, id);
}

export function failCalendarGenerationJob(id: string, errorMessage: string): void {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE calendar_generation_jobs
     SET status = 'failed',
         current_stage = 'failed',
         current_message = ?,
         error_message = ?,
         eta_seconds = 0,
         completed_at = ?,
         last_heartbeat_at = ?
     WHERE id = ?`
  ).run(errorMessage, errorMessage, now, now, id);
}

export function cancelCalendarGenerationJob(id: string, message = "Calendar generation cancelled"): void {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE calendar_generation_jobs
     SET status = 'cancelled',
         current_stage = 'cancelled',
         current_message = ?,
         error_message = ?,
         eta_seconds = 0,
         completed_at = ?,
         last_heartbeat_at = ?
     WHERE id = ? AND status NOT IN ('completed', 'failed', 'cancelled')`
  ).run(message, message, now, now, id);
}

export function addCalendarGenerationJobLog(
  jobId: string,
  level: CalendarGenerationJobLogLevel,
  message: string,
  meta?: { stage?: string | null; details?: Record<string, unknown> | null }
): CalendarGenerationJobLogRow {
  const db = getDb();
  const id = uuid();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO calendar_generation_job_logs (
      id, calendar_generation_job_id, level, message, stage, details, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    jobId,
    level,
    message,
    meta?.stage ?? null,
    meta?.details ? JSON.stringify(meta.details) : null,
    now
  );
  return db
    .prepare("SELECT * FROM calendar_generation_job_logs WHERE id = ?")
    .get(id) as CalendarGenerationJobLogRow;
}

export function listCalendarGenerationJobLogs(jobId: string): CalendarGenerationJobLogRow[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT * FROM calendar_generation_job_logs
       WHERE calendar_generation_job_id = ?
       ORDER BY created_at ASC`
    )
    .all(jobId) as CalendarGenerationJobLogRow[];
}
