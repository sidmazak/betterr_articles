import { v4 as uuid } from "uuid";
import { getDb, type LLMUsageLogRow } from "./index";

export interface RecordLLMUsageInput {
  projectId?: string | null;
  provider: string;
  model: string;
  requestLabel?: string | null;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

export function recordLLMUsage(input: RecordLLMUsageInput): LLMUsageLogRow {
  const db = getDb();
  const id = uuid();
  const now = new Date().toISOString();
  const promptTokens = Math.max(0, input.promptTokens ?? 0);
  const completionTokens = Math.max(0, input.completionTokens ?? 0);
  const totalTokens = Math.max(
    0,
    input.totalTokens ?? promptTokens + completionTokens
  );

  db.prepare(
    `INSERT INTO llm_usage_logs
     (id, project_id, provider, model, request_label, prompt_tokens, completion_tokens, total_tokens, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    input.projectId ?? null,
    input.provider,
    input.model,
    input.requestLabel ?? null,
    promptTokens,
    completionTokens,
    totalTokens,
    now
  );

  return db.prepare("SELECT * FROM llm_usage_logs WHERE id = ?").get(id) as LLMUsageLogRow;
}

export function getProjectLLMUsage(projectId: string) {
  const db = getDb();
  const row = db.prepare(
    `SELECT
       COUNT(*) as request_count,
       COALESCE(SUM(prompt_tokens), 0) as prompt_tokens,
       COALESCE(SUM(completion_tokens), 0) as completion_tokens,
       COALESCE(SUM(total_tokens), 0) as total_tokens
     FROM llm_usage_logs
     WHERE project_id = ?`
  ).get(projectId) as {
    request_count: number;
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };

  return {
    request_count: row?.request_count ?? 0,
    prompt_tokens: row?.prompt_tokens ?? 0,
    completion_tokens: row?.completion_tokens ?? 0,
    total_tokens: row?.total_tokens ?? 0,
  };
}
