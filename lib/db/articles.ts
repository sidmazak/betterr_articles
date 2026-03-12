import { v4 as uuid } from "uuid";
import { getDb, type ArticleRow } from "./index";

export interface ArticleUpsertInput {
  research_content?: string | null;
  content?: string | null;
  status?: string;
  language?: string | null;
  title?: string | null;
  slug?: string | null;
  seo_title?: string | null;
  meta_description?: string | null;
  excerpt?: string | null;
  tags_json?: string | null;
  category?: string | null;
  cover_image_base64?: string | null;
  cover_image_mime_type?: string | null;
  cover_image_prompt?: string | null;
  cover_image_alt?: string | null;
  publish_metadata_json?: string | null;
  published_url?: string | null;
  last_published_at?: string | null;
}

export function createArticle(
  projectId: string,
  calendarItemId?: string
): ArticleRow {
  const db = getDb();
  const id = uuid();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO articles (id, project_id, calendar_item_id, status, created_at, updated_at)
     VALUES (?, ?, ?, 'draft', ?, ?)`
  ).run(id, projectId, calendarItemId ?? null, now, now);
  return getArticle(id)!;
}

export function getArticle(id: string): ArticleRow | null {
  const db = getDb();
  return db.prepare("SELECT * FROM articles WHERE id = ?").get(id) as ArticleRow | null;
}

export function deleteArticle(id: string): boolean {
  const db = getDb();
  const r = db.prepare("DELETE FROM articles WHERE id = ?").run(id);
  return r.changes > 0;
}

/** Returns true if the article has no meaningful content (empty or very short). */
export function isArticleEmpty(article: ArticleRow | null): boolean {
  if (!article) return true;
  const content = (article.content ?? "").trim();
  if (!content) return true;
  const wordCount = content.split(/\s+/).filter(Boolean).length;
  return wordCount < 50;
}

export function getArticleByCalendarItem(calendarItemId: string): ArticleRow | null {
  const db = getDb();
  return db
    .prepare("SELECT * FROM articles WHERE calendar_item_id = ?")
    .get(calendarItemId) as ArticleRow | null;
}

export function updateArticleContent(
  id: string,
  updates: ArticleUpsertInput
): void {
  updateArticle(id, updates);
}

export function listArticles(projectId: string): ArticleRow[] {
  const db = getDb();
  return db
    .prepare("SELECT * FROM articles WHERE project_id = ? ORDER BY updated_at DESC")
    .all(projectId) as ArticleRow[];
}

export function listPublishedArticles(projectId: string): { url: string; title: string }[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT a.published_url, a.content, a.title, c.title as calendar_title
       FROM articles a
       LEFT JOIN calendar_items c ON a.calendar_item_id = c.id
       WHERE a.project_id = ? AND a.status = 'published' AND a.published_url IS NOT NULL`
    )
    .all(projectId) as {
      published_url: string;
      content: string | null;
      title: string | null;
      calendar_title: string | null;
    }[];
  return rows.map((r) => ({
    url: r.published_url,
    title:
      r.title ||
      r.calendar_title ||
      (r.content ? r.content.slice(0, 60) + "..." : "Published article"),
  }));
}

export function upsertArticle(
  projectId: string,
  calendarItemId: string | null,
  updates: ArticleUpsertInput
): ArticleRow {
  const db = getDb();
  const existing = calendarItemId
    ? db.prepare("SELECT id FROM articles WHERE calendar_item_id = ?").get(calendarItemId) as { id: string } | undefined
    : undefined;

  const now = new Date().toISOString();
  if (existing) {
    updateArticle(existing.id, updates);
    return getArticle(existing.id)!;
  }

  const id = uuid();
  const title = updates.title ?? null;
  const excerpt = updates.excerpt ?? null;
  const status = updates.status ?? "draft";
  const publishedAt = status === "published" ? updates.last_published_at ?? now : updates.last_published_at ?? null;
  db.prepare(
    `INSERT INTO articles (
      id, project_id, calendar_item_id, research_content, content,
      status, language, title, slug, seo_title, meta_description, excerpt, tags_json,
      category, cover_image_base64, cover_image_mime_type, cover_image_prompt,
      cover_image_alt, publish_metadata_json, published_url, last_published_at,
      created_at, updated_at
    )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    projectId,
    calendarItemId,
    updates.research_content ?? null,
    updates.content ?? null,
    status,
    updates.language ?? null,
    title,
    updates.slug ?? null,
    updates.seo_title ?? null,
    updates.meta_description ?? null,
    excerpt,
    updates.tags_json ?? null,
    updates.category ?? null,
    updates.cover_image_base64 ?? null,
    updates.cover_image_mime_type ?? null,
    updates.cover_image_prompt ?? null,
    updates.cover_image_alt ?? null,
    updates.publish_metadata_json ?? null,
    updates.published_url ?? null,
    publishedAt,
    now,
    now
  );
  return getArticle(id)!;
}

export function updateArticle(id: string, updates: ArticleUpsertInput): ArticleRow | null {
  const db = getDb();
  const article = getArticle(id);
  if (!article) return null;

  const now = new Date().toISOString();
  const cols: string[] = ["updated_at = ?"];
  const vals: unknown[] = [now];

  const updateEntries: Array<[keyof ArticleUpsertInput, string]> = [
    ["research_content", "research_content"],
    ["content", "content"],
    ["status", "status"],
    ["language", "language"],
    ["title", "title"],
    ["slug", "slug"],
    ["seo_title", "seo_title"],
    ["meta_description", "meta_description"],
    ["excerpt", "excerpt"],
    ["tags_json", "tags_json"],
    ["category", "category"],
    ["cover_image_base64", "cover_image_base64"],
    ["cover_image_mime_type", "cover_image_mime_type"],
    ["cover_image_prompt", "cover_image_prompt"],
    ["cover_image_alt", "cover_image_alt"],
    ["publish_metadata_json", "publish_metadata_json"],
    ["published_url", "published_url"],
    ["last_published_at", "last_published_at"],
  ];

  for (const [key, column] of updateEntries) {
    if (updates[key] !== undefined) {
      cols.push(`${column} = ?`);
      vals.push(updates[key]);
    }
  }

  if (updates.status === "published" && updates.last_published_at === undefined) {
    cols.push("last_published_at = ?");
    vals.push(now);
  }

  if (cols.length > 1) {
    vals.push(id);
    db.prepare(`UPDATE articles SET ${cols.join(", ")} WHERE id = ?`).run(...vals);
  }

  return getArticle(id);
}

export function unlinkArticleFromCalendar(articleId: string): boolean {
  const db = getDb();
  const r = db.prepare("UPDATE articles SET calendar_item_id = NULL, updated_at = ? WHERE id = ?").run(
    new Date().toISOString(),
    articleId
  );
  return r.changes > 0;
}
