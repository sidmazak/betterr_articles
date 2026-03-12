import { NextRequest, NextResponse } from "next/server";
import { getProject } from "@/lib/db/projects";
import { getDb } from "@/lib/db";
import { renderMarkdown } from "@/lib/markdown";
import type { GeneratedArticleMetadata } from "@/lib/prompts/types";
import {
  buildArticleSections,
  renderArticleAsHtml,
  renderArticleAsText,
} from "@/lib/article-content";
import { articleNeedsCompletion } from "@/lib/article-pipeline";
import { buildSeoAudit } from "@/lib/seo-audit";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; articleId: string }> }
) {
  try {
    const { id: projectId, articleId } = await params;
    const project = getProject(projectId);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    const db = getDb();
    const row = db
      .prepare(
        `SELECT a.*, c.title as calendar_title, c.primary_keyword as calendar_primary_keyword, c.secondary_keywords as calendar_secondary_keywords
         FROM articles a
         LEFT JOIN calendar_items c ON a.calendar_item_id = c.id
         WHERE a.id = ? AND a.project_id = ?`
      )
      .get(articleId, projectId) as
      | ({
          calendar_title: string | null;
          calendar_primary_keyword: string | null;
          calendar_secondary_keywords: string | null;
        } & Record<string, unknown>)
      | undefined;
    if (!row) {
      return NextResponse.json({ error: "Article not found" }, { status: 404 });
    }
    const attempts = db
      .prepare(
        `SELECT id, platform, label, status, published_url, error_message, created_at
         FROM publishing_attempts
         WHERE article_id = ?
         ORDER BY created_at DESC
         LIMIT 10`
      )
      .all(articleId) as Array<{
      id: string;
      platform: string;
      label: string | null;
      status: string;
      published_url: string | null;
      error_message: string | null;
      created_at: string;
    }>;
    // Use model from the job that generated this article (not current app settings)
    const generationJob = db
      .prepare(
        `SELECT pj.provider, pj.model FROM article_generation_jobs agj
         JOIN project_jobs pj ON pj.id = agj.project_job_id
         WHERE agj.article_id = ?
         ORDER BY pj.completed_at DESC, pj.started_at DESC
         LIMIT 1`
      )
      .get(articleId) as { provider: string | null; model: string | null } | undefined;
    let generationModel: string | null =
      generationJob?.model && generationJob?.provider
        ? `${generationJob.provider}/${generationJob.model}`
        : generationJob?.model ?? generationJob?.provider ?? null;
    if (!generationModel && projectId && typeof row.created_at === "string") {
      const usage = db
        .prepare(
          `SELECT provider, model FROM llm_usage_logs
           WHERE project_id = ? AND created_at >= datetime(?, '-1 hour') AND created_at <= datetime(?, '+1 hour')
           ORDER BY created_at DESC LIMIT 1`
        )
        .get(
          projectId,
          row.created_at as string,
          row.created_at as string
        ) as { provider: string; model: string } | undefined;
      if (usage && usage.model && usage.provider) {
        generationModel = `${usage.provider}/${usage.model}`;
      }
    }
    const title =
      (typeof row.title === "string" && row.title) ||
      (typeof row.calendar_title === "string" && row.calendar_title) ||
      (typeof row.content === "string" && row.content
        ? row.content.slice(0, 80).replace(/<[^>]+>/g, "").trim() + "..."
        : "Untitled");

    const publishMetadata =
      safeParseJson<GeneratedArticleMetadata>(
        typeof row.publish_metadata_json === "string" ? row.publish_metadata_json : null
      ) ?? null;
    const articleRow = Object.fromEntries(
      Object.entries(row).filter(([key]) => key !== "outline_content")
    );
    const rawContent = typeof row.content === "string" ? row.content : "";
    const articleSections = buildArticleSections(rawContent);
    const cleanedContentForAudit = renderArticleAsText(rawContent);
    const articleQuality = buildArticleQuality(rawContent, cleanedContentForAudit);
    const seoAudit = buildSeoAudit({
      title,
      seoTitle: typeof row.seo_title === "string" ? row.seo_title : null,
      metaDescription: typeof row.meta_description === "string" ? row.meta_description : null,
      excerpt: typeof row.excerpt === "string" ? row.excerpt : null,
      tags: safeParseJson<string[]>(typeof row.tags_json === "string" ? row.tags_json : null) ?? [],
      slug: typeof row.slug === "string" ? row.slug : null,
      socialHashtags: publishMetadata?.socialHashtags ?? [],
      content: rawContent,
      contentText: cleanedContentForAudit,
      primaryKeyword:
        typeof row.calendar_primary_keyword === "string" ? row.calendar_primary_keyword : null,
      secondaryKeywords: (() => {
        const raw = row.calendar_secondary_keywords;
        if (typeof raw !== "string") return [];
        try {
          const parsed = JSON.parse(raw);
          return Array.isArray(parsed) ? parsed.filter((k): k is string => typeof k === "string") : [];
        } catch {
          return [];
        }
      })(),
      articleSections,
      hasConclusion: articleQuality.hasConclusion,
      coverImageAlt:
        typeof row.cover_image_alt === "string"
          ? row.cover_image_alt
          : publishMetadata?.coverImageAlt ?? null,
      hasFeaturedImage:
        typeof row.cover_image_base64 === "string" && typeof row.cover_image_mime_type === "string",
      homepageUrl: project.homepage_url,
    });

    return NextResponse.json({
      ...articleRow,
      id: row.id,
      title,
      primaryKeyword:
        typeof row.calendar_primary_keyword === "string" ? row.calendar_primary_keyword : null,
      tags: safeParseJson<string[]>(typeof row.tags_json === "string" ? row.tags_json : null) ?? [],
      publishMetadata,
      contentHtml: renderArticleAsHtml(rawContent),
      contentText: cleanedContentForAudit,
      researchHtml: renderMarkdown(typeof row.research_content === "string" ? row.research_content : ""),
      articleSections,
      articleQuality,
      seoAudit,
      attempts,
      generationModel,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to get article";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function safeParseJson<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function buildArticleQuality(rawContent: string, cleanedText: string) {
  const trailingOrphanToken = /\n\d+\s*$/.test(rawContent.trim());
  const hasConclusion = /(^|\n)#{1,6}\s*(Conclusion|Final Thoughts|Key Takeaways|Wrapping Up)\b/im.test(rawContent);
  const wordCount = cleanedText ? cleanedText.split(/\s+/).filter(Boolean).length : 0;
  const looksIncomplete = articleNeedsCompletion(rawContent);

  return {
    wordCount,
    hasConclusion,
    trailingOrphanToken,
    looksIncomplete,
  };
}
