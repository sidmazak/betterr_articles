import { getDb } from "./index";
import type { ArticlePipelineInput } from "@/lib/prompts/types";
import { getLatestProjectSEOInsight } from "@/lib/db/seo-insights";
import { getProject } from "@/lib/db/projects";
import {
  buildArticleDefaultsResearchSummary,
  inferArticleDefaultsFromSEOInsight,
  inferArticleDefaultsFromSEOInsightWithAI,
  needsAiDefaultsRefresh,
} from "@/lib/article-default-inference";

export type ArticleDefaultsConfig = Partial<ArticlePipelineInput>;
export interface ProjectArticleDefaultsResponse extends ArticleDefaultsConfig {
  _researchSummary?: {
    headline: string;
    points: string[];
  } | null;
}

export function getStoredProjectArticleDefaults(projectId: string): ArticleDefaultsConfig | null {
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

export function getProjectArticleDefaults(projectId: string): ArticleDefaultsConfig | null {
  const stored = getStoredProjectArticleDefaults(projectId);
  const project = getProject(projectId);
  const inferred = inferArticleDefaultsFromSEOInsight(getLatestProjectSEOInsight(projectId), {
    projectName: project?.name,
    homepageUrl: project?.homepage_url ?? null,
  });

  if (!stored && !inferred) return null;
  return {
    ...(inferred ?? {}),
    ...(stored ?? {}),
  };
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

export async function resolveProjectArticleDefaults(projectId: string): Promise<ArticleDefaultsConfig | null> {
  const stored = getStoredProjectArticleDefaults(projectId);
  const project = getProject(projectId);
  const latestInsight = getLatestProjectSEOInsight(projectId);
  const inferred = inferArticleDefaultsFromSEOInsight(latestInsight, {
    projectName: project?.name,
    homepageUrl: project?.homepage_url ?? null,
  });
  const base = {
    ...(inferred ?? {}),
    ...(stored ?? {}),
  };

  if (!latestInsight) {
    return Object.keys(base).length > 0 ? base : null;
  }

  if (!needsAiDefaultsRefresh(base, { projectName: project?.name, homepageUrl: project?.homepage_url ?? null })) {
    return Object.keys(base).length > 0 ? base : null;
  }

  const aiDefaults = await inferArticleDefaultsFromSEOInsightWithAI({
    row: latestInsight,
    projectName: project?.name,
    homepageUrl: project?.homepage_url ?? null,
    existingDefaults: base,
    projectId,
  });

  return {
    ...(aiDefaults ?? inferred ?? {}),
    ...(stored ?? {}),
  };
}

export async function refreshProjectArticleDefaultsFromInsight(
  projectId: string
): Promise<ArticleDefaultsConfig | null> {
  const stored = getStoredProjectArticleDefaults(projectId);
  const resolved = await resolveProjectArticleDefaults(projectId);
  if (!resolved) return null;

  if (!stored) {
    setProjectArticleDefaults(projectId, resolved);
  }

  return resolved;
}

export async function resolveProjectArticleDefaultsResponse(
  projectId: string
): Promise<ProjectArticleDefaultsResponse | null> {
  const resolved = await resolveProjectArticleDefaults(projectId);
  const project = getProject(projectId);
  const latestInsight = getLatestProjectSEOInsight(projectId);

  if (!resolved) return null;

  return {
    ...resolved,
    _researchSummary: buildArticleDefaultsResearchSummary({
      row: latestInsight,
      config: resolved,
      projectName: project?.name,
      homepageUrl: project?.homepage_url ?? null,
    }),
  };
}
