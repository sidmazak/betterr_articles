import { getDb } from "./index";
import type { ArticlePipelineInput } from "@/lib/prompts/types";

export type ArticleDefaultsConfig = Partial<ArticlePipelineInput>;

export function getProjectArticleDefaults(projectId: string): ArticleDefaultsConfig | null {
  const db = getDb();
  const row = db
    .prepare("SELECT config FROM project_article_defaults WHERE project_id = ?")
    .get(projectId) as { config: string } | undefined;
  if (!row?.config) return null;
  try {
    return JSON.parse(row.config) as ArticleDefaultsConfig;
  } catch {
    return null;
  }
}

export function setProjectArticleDefaults(
  projectId: string,
  config: ArticleDefaultsConfig
): void {
  const db = getDb();
  const now = new Date().toISOString();
  const json = JSON.stringify(config);
  db.prepare(
    `INSERT INTO project_article_defaults (project_id, config, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(project_id) DO UPDATE SET config = ?, updated_at = ?`
  ).run(projectId, json, now, json, now);
}
