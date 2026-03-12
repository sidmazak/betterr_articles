import { getDb, type ArticleGenerationJob, type ArticleGenerationJobDetailRow } from "./index";
import { getArticle, deleteArticle, isArticleEmpty, unlinkArticleFromCalendar } from "./articles";
import { updateCalendarItemStatus } from "./calendar";
import {
  addProjectJobLog,
  cancelProjectJob,
  claimPendingProjectJob,
  completeProjectJob,
  createProjectJob,
  failProjectJob,
  getActiveProjectJob,
  getProjectJob,
  listProjectJobLogs,
  setProjectJobStage,
  updateProjectJobProgress,
} from "./project-jobs";
import type { ArticlePipelineInput } from "@/lib/prompts/types";
import type { ProjectJobLogLevel, ProjectJobLogRow } from "./index";

export interface CreateArticleGenerationJobInput {
  projectId: string;
  calendarItemId?: string | null;
  articleId?: string | null;
  source?: "manual" | "schedule" | "api";
  input: ArticlePipelineInput;
}

function getArticleGenerationJobDetail(projectJobId: string): ArticleGenerationJobDetailRow | null {
  const db = getDb();
  return db
    .prepare("SELECT * FROM article_generation_jobs WHERE project_job_id = ?")
    .get(projectJobId) as ArticleGenerationJobDetailRow | null;
}

function hydrateArticleGenerationJob(projectJobId: string): ArticleGenerationJob | null {
  const job = getProjectJob(projectJobId);
  const detail = getArticleGenerationJobDetail(projectJobId);
  if (!job || !detail) return null;
  return {
    ...job,
    ...detail,
  };
}

export function createArticleGenerationJob(
  input: CreateArticleGenerationJobInput
): ArticleGenerationJob {
  const db = getDb();
  const now = new Date().toISOString();
  const job = createProjectJob({
    projectId: input.projectId,
    jobType: "article_generation",
    ownerResourceId: input.calendarItemId ?? input.articleId ?? null,
    totalSteps: 100,
    currentStage: "queued",
    currentMessage: "Waiting to start article generation",
  });
  db.prepare(
    `INSERT INTO article_generation_jobs (
      project_job_id, calendar_item_id, article_id, source, input_json, reasoning_content, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, NULL, ?, ?)`
  ).run(
    job.id,
    input.calendarItemId ?? null,
    input.articleId ?? null,
    input.source ?? "manual",
    JSON.stringify(input.input),
    now,
    now
  );
  return hydrateArticleGenerationJob(job.id)!;
}

export function getArticleGenerationJob(projectJobId: string): ArticleGenerationJob | null {
  return hydrateArticleGenerationJob(projectJobId);
}

export function getActiveArticleGenerationJob(
  projectId: string,
  calendarItemId?: string | null
): ArticleGenerationJob | null {
  const active = getActiveProjectJob(projectId, "article_generation");
  if (!active) return null;
  const hydrated = hydrateArticleGenerationJob(active.id);
  if (!hydrated) return null;
  if (calendarItemId && hydrated.calendar_item_id !== calendarItemId) {
    const db = getDb();
    return db
      .prepare(
        `SELECT pj.*, agj.*
         FROM project_jobs pj
         JOIN article_generation_jobs agj ON agj.project_job_id = pj.id
         WHERE pj.project_id = ?
           AND pj.job_type = 'article_generation'
           AND pj.status IN ('pending', 'running')
           AND agj.calendar_item_id = ?
         ORDER BY pj.created_at DESC
         LIMIT 1`
      )
      .get(projectId, calendarItemId) as ArticleGenerationJob | null;
  }
  return hydrated;
}

export function listArticleGenerationJobs(projectId: string): ArticleGenerationJob[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT pj.*, agj.*
       FROM project_jobs pj
       JOIN article_generation_jobs agj ON agj.project_job_id = pj.id
       WHERE pj.project_id = ? AND pj.job_type = 'article_generation'
       ORDER BY pj.created_at DESC`
    )
    .all(projectId) as ArticleGenerationJob[];
}

export function getArticleGenerationJobLogs(projectJobId: string): ProjectJobLogRow[] {
  return listProjectJobLogs(projectJobId);
}

export function claimPendingArticleGenerationJob(projectJobId: string) {
  return claimPendingProjectJob(projectJobId, "article_generation", "preparing");
}

export function setArticleGenerationJobStage(
  projectJobId: string,
  stage: string,
  updates?: {
    message?: string | null;
    etaSeconds?: number | null;
    provider?: string | null;
    model?: string | null;
    attempt?: number | null;
    contentLength?: number | null;
    reasoningLength?: number | null;
    articleId?: string | null;
  }
) {
  setProjectJobStage(projectJobId, stage, {
    message: updates?.message ?? null,
    etaSeconds: updates?.etaSeconds ?? null,
    provider: updates?.provider ?? null,
    model: updates?.model ?? null,
    attempt: updates?.attempt ?? null,
    contentLength: updates?.contentLength ?? null,
    reasoningLength: updates?.reasoningLength ?? null,
    ownerResourceId: updates?.articleId ?? null,
  });
}

export function updateArticleGenerationJobProgress(
  projectJobId: string,
  progress: number,
  updates?: {
    stage?: string;
    message?: string | null;
    etaSeconds?: number | null;
    provider?: string | null;
    model?: string | null;
    attempt?: number | null;
    contentLength?: number | null;
    reasoningLength?: number | null;
    articleId?: string | null;
  }
) {
  updateProjectJobProgress(projectJobId, progress, 100, {
    stage: updates?.stage,
    message: updates?.message ?? null,
    etaSeconds: updates?.etaSeconds ?? null,
    provider: updates?.provider ?? null,
    model: updates?.model ?? null,
    attempt: updates?.attempt ?? null,
    contentLength: updates?.contentLength ?? null,
    reasoningLength: updates?.reasoningLength ?? null,
    ownerResourceId: updates?.articleId ?? null,
  });
}

export function saveArticleGenerationSnapshot(
  projectJobId: string,
  updates: {
    articleId?: string | null;
    reasoningContent?: string | null;
    researchContent?: string | null;
    content?: string | null;
    metadataJson?: string | null;
    resultJson?: string | null;
  }
) {
  const db = getDb();
  const sets = ["updated_at = ?"];
  const values: unknown[] = [new Date().toISOString()];
  if (updates.articleId !== undefined) {
    sets.push("article_id = ?");
    values.push(updates.articleId);
  }
  if (updates.reasoningContent !== undefined) {
    sets.push("reasoning_content = ?");
    values.push(updates.reasoningContent);
  }
  if (updates.researchContent !== undefined) {
    sets.push("research_content = ?");
    values.push(updates.researchContent);
  }
  if (updates.content !== undefined) {
    sets.push("content = ?");
    values.push(updates.content);
  }
  if (updates.metadataJson !== undefined) {
    sets.push("metadata_json = ?");
    values.push(updates.metadataJson);
  }
  if (updates.resultJson !== undefined) {
    sets.push("result_json = ?");
    values.push(updates.resultJson);
  }
  values.push(projectJobId);
  db.prepare(`UPDATE article_generation_jobs SET ${sets.join(", ")} WHERE project_job_id = ?`).run(...values);
}

export function addArticleGenerationJobLog(
  projectJobId: string,
  level: ProjectJobLogLevel,
  message: string,
  meta?: { stage?: string | null; details?: Record<string, unknown> | null }
) {
  return addProjectJobLog(projectJobId, level, message, meta);
}

export function cancelArticleGenerationJob(projectJobId: string, message = "Article generation cancelled") {
  cancelProjectJob(projectJobId, message);
}

/** Removes empty article and reverts calendar when job has orphaned draft. Safe to call multiple times. */
export function cleanupOrphanedArticleFromJob(job: ArticleGenerationJob): void {
  const articleId = job.article_id ?? null;
  const calendarItemId = job.calendar_item_id ?? null;
  if (!articleId || !calendarItemId) return;
  const article = getArticle(articleId);
  if (!article) return;
  if (isArticleEmpty(article)) {
    deleteArticle(articleId);
    updateCalendarItemStatus(calendarItemId, "suggested");
  } else {
    unlinkArticleFromCalendar(articleId);
    updateCalendarItemStatus(calendarItemId, "suggested");
  }
}

/** On stream timeout: only delete empty articles so user can recover partial content. */
export function cleanupEmptyArticleOnlyFromJob(job: ArticleGenerationJob): void {
  const articleId = job.article_id ?? null;
  const calendarItemId = job.calendar_item_id ?? null;
  if (!articleId || !calendarItemId) return;
  const article = getArticle(articleId);
  if (!article) return;
  if (isArticleEmpty(article)) {
    deleteArticle(articleId);
    updateCalendarItemStatus(calendarItemId, "suggested");
  }
}

export function completeArticleGenerationJob(
  projectJobId: string,
  updates?: {
    message?: string | null;
    articleId?: string | null;
    contentLength?: number | null;
    reasoningLength?: number | null;
    provider?: string | null;
    model?: string | null;
    attempt?: number | null;
  }
) {
  completeProjectJob(projectJobId, {
    message: updates?.message ?? "Article generation complete",
    progress: 100,
    totalSteps: 100,
    ownerResourceId: updates?.articleId ?? null,
    contentLength: updates?.contentLength ?? null,
    reasoningLength: updates?.reasoningLength ?? null,
    provider: updates?.provider ?? null,
    model: updates?.model ?? null,
    attempt: updates?.attempt ?? null,
  });
}

export function failArticleGenerationJob(projectJobId: string, message: string) {
  failProjectJob(projectJobId, message);
}
