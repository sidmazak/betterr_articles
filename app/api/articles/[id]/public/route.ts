import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import {
  buildArticleSections,
  renderArticleAsHtml,
} from "@/lib/article-content";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: articleId } = await params;
    const db = getDb();
    const row = db
      .prepare(
        `SELECT a.*, c.primary_keyword as calendar_primary_keyword
         FROM articles a
         LEFT JOIN calendar_items c ON a.calendar_item_id = c.id
         WHERE a.id = ?`
      )
      .get(articleId) as Record<string, unknown> | undefined;
    if (!row) {
      return NextResponse.json({ error: "Article not found" }, { status: 404 });
    }
    const title =
      (typeof row.title === "string" && row.title) ||
      (typeof row.content === "string" && row.content
        ? row.content.slice(0, 80).replace(/<[^>]+>/g, "").trim() + "..."
        : "Untitled");
    const rawContent = typeof row.content === "string" ? row.content : "";
    const articleSections = buildArticleSections(rawContent);
    const publishMetadata =
      typeof row.publish_metadata_json === "string"
        ? (() => {
            try {
              return JSON.parse(row.publish_metadata_json) as Record<string, unknown>;
            } catch {
              return null;
            }
          })()
        : null;
    const tags = (() => {
      try {
        const parsed = JSON.parse((row.tags_json as string) ?? "[]");
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    })() as string[];

    return NextResponse.json({
      id: row.id,
      title,
      slug: row.slug ?? null,
      excerpt: row.excerpt ?? null,
      category: row.category ?? null,
      tags,
      cover_image_base64: row.cover_image_base64 ?? null,
      cover_image_mime_type: row.cover_image_mime_type ?? null,
      cover_image_alt: row.cover_image_alt ?? null,
      contentHtml: renderArticleAsHtml(rawContent),
      articleSections,
      publishMetadata,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to get article";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
