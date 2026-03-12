import { v4 as uuid } from "uuid";
import {
  getDb,
  type ProjectJob,
  type ProjectJobLogLevel,
  type ProjectJobLogRow,
  type ProjectJobStatus,
  type ProjectJobType,
} from "./index";

export interface CreateProjectJobInput {
  projectId: string;
  jobType: ProjectJobType;
  ownerResourceId?: string | null;
  totalSteps?: number;
  currentStage?: string;
  currentMessage?: string | null;
}

export function createProjectJob(input: CreateProjectJobInput): ProjectJob {
  const db = getDb();
  const id = uuid();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO project_jobs (
      id, project_id, job_type, owner_resource_id, status, progress, total_steps,
      current_stage, current_message, created_at
    ) VALUES (?, ?, ?, ?, 'pending', 0, ?, ?, ?, ?)`
  ).run(
    id,
    input.projectId,
    input.jobType,
    input.ownerResourceId ?? null,
    input.totalSteps ?? 0,
    input.currentStage ?? "queued",
    input.currentMessage ?? null,
    now
  );
  return getProjectJob(id)!;
}

export function getProjectJob(id: string): ProjectJob | null {
  const db = getDb();
  return db.prepare("SELECT * FROM project_jobs WHERE id = ?").get(id) as ProjectJob | null;
}

export function listProjectJobLogs(projectJobId: string): ProjectJobLogRow[] {
  const db = getDb();
  return db
    .prepare("SELECT * FROM project_job_logs WHERE project_job_id = ? ORDER BY created_at ASC")
    .all(projectJobId) as ProjectJobLogRow[];
}

export function addProjectJobLog(
  projectJobId: string,
  level: ProjectJobLogLevel,
  message: string,
  meta?: { stage?: string | null; details?: Record<string, unknown> | null }
): ProjectJobLogRow {
  const db = getDb();
  const id = uuid();
  const now = new Date().toISOString();
  const details =
    meta?.details == null ? null : JSON.stringify(meta.details);
  db.prepare(
    `INSERT INTO project_job_logs (
      id, project_job_id, level, message, stage, details, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(id, projectJobId, level, message, meta?.stage ?? null, details, now);
  return db.prepare("SELECT * FROM project_job_logs WHERE id = ?").get(id) as ProjectJobLogRow;
}

export function getActiveProjectJob(projectId: string, jobType?: ProjectJobType): ProjectJob | null {
  const db = getDb();
  if (jobType) {
    return db
      .prepare(
        `SELECT * FROM project_jobs
         WHERE project_id = ? AND job_type = ? AND status IN ('pending', 'running', 'paused')
         ORDER BY created_at DESC
         LIMIT 1`
      )
      .get(projectId, jobType) as ProjectJob | null;
  }
  return db
    .prepare(
      `SELECT * FROM project_jobs
       WHERE project_id = ? AND status IN ('pending', 'running', 'paused')
       ORDER BY created_at DESC
       LIMIT 1`
    )
    .get(projectId) as ProjectJob | null;
}

export function claimPendingProjectJob(
  id: string,
  jobType?: ProjectJobType,
  runningStage = "running"
): ProjectJob | null {
  const db = getDb();
  const now = new Date().toISOString();
  const result = jobType
    ? db.prepare(
        `UPDATE project_jobs
         SET status = 'running',
             current_stage = CASE WHEN current_stage = 'queued' THEN ? ELSE current_stage END,
             started_at = COALESCE(started_at, ?),
             last_heartbeat_at = ?,
             error_message = NULL
         WHERE id = ? AND job_type = ? AND status = 'pending'`
      ).run(runningStage, now, now, id, jobType)
    : db.prepare(
        `UPDATE project_jobs
         SET status = 'running',
             current_stage = CASE WHEN current_stage = 'queued' THEN ? ELSE current_stage END,
             started_at = COALESCE(started_at, ?),
             last_heartbeat_at = ?,
             error_message = NULL
         WHERE id = ? AND status = 'pending'`
      ).run(runningStage, now, now, id);
  return result.changes > 0 ? getProjectJob(id) : null;
}

export function startProjectJob(id: string, runningStage = "running"): void {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE project_jobs
     SET status = 'running',
         current_stage = CASE WHEN current_stage = 'queued' THEN ? ELSE current_stage END,
         started_at = COALESCE(started_at, ?),
         last_heartbeat_at = ?,
         error_message = NULL
     WHERE id = ?`
  ).run(runningStage, now, now, id);
}

export function updateProjectJobProgress(
  id: string,
  progress: number,
  totalSteps: number,
  updates?: {
    stage?: string;
    message?: string | null;
    etaSeconds?: number | null;
    provider?: string | null;
    model?: string | null;
    attempt?: number | null;
    contentLength?: number | null;
    reasoningLength?: number | null;
    ownerResourceId?: string | null;
  }
): void {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE project_jobs
     SET progress = ?,
         total_steps = ?,
         current_stage = COALESCE(?, current_stage),
         current_message = ?,
         eta_seconds = ?,
         provider = COALESCE(?, provider),
         model = COALESCE(?, model),
         attempt = COALESCE(?, attempt),
         content_length = COALESCE(?, content_length),
         reasoning_length = COALESCE(?, reasoning_length),
         owner_resource_id = COALESCE(?, owner_resource_id),
         last_heartbeat_at = ?
     WHERE id = ?`
  ).run(
    progress,
    totalSteps,
    updates?.stage ?? null,
    updates?.message ?? null,
    updates?.etaSeconds ?? null,
    updates?.provider ?? null,
    updates?.model ?? null,
    updates?.attempt ?? null,
    updates?.contentLength ?? null,
    updates?.reasoningLength ?? null,
    updates?.ownerResourceId ?? null,
    now,
    id
  );
}

export function setProjectJobStage(
  id: string,
  stage: string,
  updates?: {
    message?: string | null;
    etaSeconds?: number | null;
    provider?: string | null;
    model?: string | null;
    attempt?: number | null;
    contentLength?: number | null;
    reasoningLength?: number | null;
    ownerResourceId?: string | null;
  }
): void {
  const job = getProjectJob(id);
  updateProjectJobProgress(id, job?.progress ?? 0, job?.total_steps ?? 0, {
    stage,
    message: updates?.message ?? null,
    etaSeconds: updates?.etaSeconds ?? null,
    provider: updates?.provider ?? null,
    model: updates?.model ?? null,
    attempt: updates?.attempt ?? null,
    contentLength: updates?.contentLength ?? null,
    reasoningLength: updates?.reasoningLength ?? null,
    ownerResourceId: updates?.ownerResourceId ?? null,
  });
}

export function touchProjectJob(id: string): void {
  const db = getDb();
  db.prepare("UPDATE project_jobs SET last_heartbeat_at = ? WHERE id = ?").run(
    new Date().toISOString(),
    id
  );
}

export function cancelProjectJob(id: string, message = "Job cancelled by user"): void {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE project_jobs
     SET status = 'cancelled',
         current_stage = 'cancelled',
         current_message = ?,
         error_message = ?,
         eta_seconds = 0,
         completed_at = COALESCE(completed_at, ?),
         cancelled_at = ?,
         last_heartbeat_at = ?
     WHERE id = ? AND status NOT IN ('completed', 'failed', 'cancelled')`
  ).run(message, message, now, now, now, id);
}

export function completeProjectJob(
  id: string,
  updates?: {
    message?: string | null;
    progress?: number;
    totalSteps?: number;
    ownerResourceId?: string | null;
    contentLength?: number | null;
    reasoningLength?: number | null;
    provider?: string | null;
    model?: string | null;
    attempt?: number | null;
  }
): void {
  const db = getDb();
  const job = getProjectJob(id);
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE project_jobs
     SET status = 'completed',
         progress = ?,
         total_steps = ?,
         current_stage = 'completed',
         current_message = ?,
         owner_resource_id = COALESCE(?, owner_resource_id),
         provider = COALESCE(?, provider),
         model = COALESCE(?, model),
         attempt = COALESCE(?, attempt),
         content_length = COALESCE(?, content_length),
         reasoning_length = COALESCE(?, reasoning_length),
         eta_seconds = 0,
         completed_at = ?,
         last_heartbeat_at = ?
     WHERE id = ?`
  ).run(
    updates?.progress ?? job?.progress ?? 100,
    updates?.totalSteps ?? job?.total_steps ?? 0,
    updates?.message ?? "Job complete",
    updates?.ownerResourceId ?? null,
    updates?.provider ?? null,
    updates?.model ?? null,
    updates?.attempt ?? null,
    updates?.contentLength ?? null,
    updates?.reasoningLength ?? null,
    now,
    now,
    id
  );
}

export function failProjectJob(id: string, errorMessage: string): void {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE project_jobs
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

export function isProjectJobTerminal(status: ProjectJobStatus | null | undefined) {
  return status === "completed" || status === "failed" || status === "cancelled";
}
