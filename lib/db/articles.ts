import { v4 as uuid } from "uuid";
import { getDb, type ArticleRow } from "./index";

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

export function getArticleByCalendarItem(calendarItemId: string): ArticleRow | null {
  const db = getDb();
  return db
    .prepare("SELECT * FROM articles WHERE calendar_item_id = ?")
    .get(calendarItemId) as ArticleRow | null;
}

export function updateArticleContent(
  id: string,
  updates: {
    research_content?: string;
    outline_content?: string;
    content?: string;
    status?: string;
  }
): void {
  const db = getDb();
  const now = new Date().toISOString();
  const article = getArticle(id);
  if (!article) return;

  if (updates.research_content !== undefined) {
    db.prepare("UPDATE articles SET research_content = ?, updated_at = ? WHERE id = ?").run(
      updates.research_content,
      now,
      id
    );
  }
  if (updates.outline_content !== undefined) {
    db.prepare("UPDATE articles SET outline_content = ?, updated_at = ? WHERE id = ?").run(
      updates.outline_content,
      now,
      id
    );
  }
  if (updates.content !== undefined) {
    db.prepare("UPDATE articles SET content = ?, updated_at = ? WHERE id = ?").run(
      updates.content,
      now,
      id
    );
  }
  if (updates.status !== undefined) {
    db.prepare("UPDATE articles SET status = ?, updated_at = ? WHERE id = ?").run(
      updates.status,
      now,
      id
    );
  }
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
      `SELECT a.published_url, a.content, c.title
       FROM articles a
       LEFT JOIN calendar_items c ON a.calendar_item_id = c.id
       WHERE a.project_id = ? AND a.status = 'published' AND a.published_url IS NOT NULL`
    )
    .all(projectId) as { published_url: string; content: string; title: string }[];
  return rows.map((r) => ({
    url: r.published_url,
    title: r.title || (r.content ? r.content.slice(0, 60) + "..." : "Published article"),
  }));
}

export function upsertArticle(
  projectId: string,
  calendarItemId: string | null,
  updates: {
    research_content?: string;
    outline_content?: string;
    content?: string;
    status?: string;
    published_url?: string;
  }
): ArticleRow {
  const db = getDb();
  const existing = calendarItemId
    ? db.prepare("SELECT id FROM articles WHERE calendar_item_id = ?").get(calendarItemId) as { id: string } | undefined
    : undefined;

  const now = new Date().toISOString();
  if (existing) {
    const cols: string[] = ["updated_at = ?"];
    const vals: unknown[] = [now];
    if (updates.research_content !== undefined) {
      cols.push("research_content = ?");
      vals.push(updates.research_content);
    }
    if (updates.outline_content !== undefined) {
      cols.push("outline_content = ?");
      vals.push(updates.outline_content);
    }
    if (updates.content !== undefined) {
      cols.push("content = ?");
      vals.push(updates.content);
    }
    if (updates.status !== undefined) {
      cols.push("status = ?");
      vals.push(updates.status);
    }
    if (updates.published_url !== undefined) {
      cols.push("published_url = ?");
      vals.push(updates.published_url);
    }
    if (cols.length > 1) {
      vals.push(existing.id);
      db.prepare(`UPDATE articles SET ${cols.join(", ")} WHERE id = ?`).run(...vals);
    }
    return getArticle(existing.id)!;
  }

  const id = uuid();
  db.prepare(
    `INSERT INTO articles (id, project_id, calendar_item_id, research_content, outline_content, content, status, published_url, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    projectId,
    calendarItemId,
    updates.research_content ?? null,
    updates.outline_content ?? null,
    updates.content ?? null,
    updates.status ?? "draft",
    updates.published_url ?? null,
    now,
    now
  );
  return getArticle(id)!;
}
