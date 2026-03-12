import { v4 as uuid } from "uuid";
import { getDb, type ProjectSEOInsightRow } from "./index";

export interface PersistedSEOInsight {
  topics: string[];
  keywords: string[];
  summary?: string | null;
  source?: string;
  reference?: SEOReference | null;
}

export interface SEOReference {
  entities: string[];
  questions: string[];
  painPoints: string[];
  contentAngles: string[];
  searchIntents: string[];
  productsServices: string[];
}

export function saveProjectSEOInsight(
  projectId: string,
  crawlJobId: string | null,
  insight: PersistedSEOInsight
): ProjectSEOInsightRow {
  const db = getDb();
  const id = uuid();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO project_seo_insights
     (id, project_id, crawl_job_id, topics_json, keywords_json, reference_json, summary, source, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    projectId,
    crawlJobId,
    JSON.stringify(insight.topics),
    JSON.stringify(insight.keywords),
    insight.reference ? JSON.stringify(insight.reference) : null,
    insight.summary ?? null,
    insight.source ?? "crawl",
    now,
    now
  );
  return db.prepare("SELECT * FROM project_seo_insights WHERE id = ?").get(id) as ProjectSEOInsightRow;
}

export function getLatestProjectSEOInsight(projectId: string): ProjectSEOInsightRow | null {
  const db = getDb();
  return db
    .prepare(
      `SELECT * FROM project_seo_insights
       WHERE project_id = ?
       ORDER BY updated_at DESC, created_at DESC
       LIMIT 1`
    )
    .get(projectId) as ProjectSEOInsightRow | null;
}

export function parseSEOInsight(row: ProjectSEOInsightRow | null) {
  if (!row) return null;
  return {
    ...row,
    topics: safeParseArray(row.topics_json),
    keywords: safeParseArray(row.keywords_json),
    reference: safeParseReference(row.reference_json),
  };
}

function safeParseArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

function safeParseReference(value: string | null): SEOReference {
  const fallback: SEOReference = {
    entities: [],
    questions: [],
    painPoints: [],
    contentAngles: [],
    searchIntents: [],
    productsServices: [],
  };
  if (!value) return fallback;

  try {
    const parsed = JSON.parse(value) as Partial<SEOReference>;
    return {
      entities: normalizeArray(parsed.entities),
      questions: normalizeArray(parsed.questions),
      painPoints: normalizeArray(parsed.painPoints),
      contentAngles: normalizeArray(parsed.contentAngles),
      searchIntents: normalizeArray(parsed.searchIntents),
      productsServices: normalizeArray(parsed.productsServices),
    };
  } catch {
    return fallback;
  }
}

function normalizeArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}
