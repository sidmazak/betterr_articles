import { NextRequest, NextResponse } from "next/server";
import { getProject } from "@/lib/db/projects";
import { getDb } from "@/lib/db";

function wordCount(text: string | null): number {
  if (!text || typeof text !== "string") return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function parseArray(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const project = getProject(projectId);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim() || "";
    const status = searchParams.get("status") || "all";
    const sort = searchParams.get("sort") || "newest";

    const db = getDb();
    let sql = `
      SELECT a.id, a.calendar_item_id, a.title as article_title, a.content, a.status, a.published_url, a.created_at, a.updated_at,
             c.title, c.primary_keyword, c.secondary_keywords
      FROM articles a
      LEFT JOIN calendar_items c ON a.calendar_item_id = c.id
      WHERE a.project_id = ?
    `;
    const args: (string | number)[] = [projectId];

    if (search) {
      sql += ` AND (c.title LIKE ? OR c.primary_keyword LIKE ? OR a.content LIKE ?)`;
      const like = `%${search}%`;
      args.push(like, like, like);
    }
    if (status !== "all") {
      sql += ` AND a.status = ?`;
      args.push(status);
    }

    sql += ` ORDER BY a.updated_at ${sort === "oldest" ? "ASC" : "DESC"}`;

    const rows = db.prepare(sql).all(...args) as {
      id: string;
      calendar_item_id: string | null;
      article_title: string | null;
      content: string | null;
      status: string;
      published_url: string | null;
      created_at: string;
      updated_at: string;
      title: string | null;
      primary_keyword: string | null;
      secondary_keywords: string | null;
    }[];

    const items = rows.map((r) => ({
      id: r.id,
      calendar_item_id: r.calendar_item_id,
      title: r.article_title || r.title || (r.content ? r.content.slice(0, 80).replace(/<[^>]+>/g, "").trim() + "..." : "Untitled"),
      search_term: r.primary_keyword || "",
      secondary_keywords: parseArray(r.secondary_keywords),
      status: r.status,
      words: wordCount(r.content),
      published_url: r.published_url,
      published_at: r.status === "published" ? r.updated_at : null,
      created_at: r.created_at,
    }));

    return NextResponse.json(items);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to list content";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
