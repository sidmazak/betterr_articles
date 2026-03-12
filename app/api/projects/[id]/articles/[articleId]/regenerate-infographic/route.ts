import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getProject } from "@/lib/db/projects";
import { getArticle, updateArticle } from "@/lib/db/articles";
import { getCalendarItem } from "@/lib/db/calendar";
import { chat } from "@/lib/llm";
import {
  buildInfographicRegenerationPrompt,
  replaceInfographicAt,
  replaceInfographicAtWithImage,
  parseInfographicBlockResponse,
  getSurroundingContentForInfographic,
  getInfographicBlockAt,
} from "@/lib/infographic-regeneration";
import { extractInfographicSpecFromContext } from "@/lib/infographic-extractor";
import { ensureHttpsUrl, renderInfographicToBase64 } from "@/lib/infographic-renderer";
import { buildArticleSections } from "@/lib/article-content";

function safeParseStringArray(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      : [];
  } catch {
    return [];
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; articleId: string }> }
) {
  try {
    const { id: projectId, articleId } = await params;
    const project = getProject(projectId);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const infographicIndex = typeof body.infographicIndex === "number" ? body.infographicIndex : 0;
    if (infographicIndex < 1) {
      return NextResponse.json(
        { error: "infographicIndex must be a positive integer" },
        { status: 400 }
      );
    }

    const article = getArticle(articleId);
    if (!article || article.project_id !== projectId) {
      return NextResponse.json({ error: "Article not found" }, { status: 404 });
    }

    const content = typeof article.content === "string" ? article.content : "";
    const sections = buildArticleSections(content);
    const infographicCount = sections.filter((s) => s.type === "infographic").length;
    if (infographicIndex > infographicCount) {
      return NextResponse.json(
        { error: `Invalid infographicIndex: article has ${infographicCount} infographic(s)` },
        { status: 400 }
      );
    }

    let infographicConcepts: string[] = [];
    let primaryKeyword: string | null = null;
    if (article.calendar_item_id) {
      const calendarItem = getCalendarItem(article.calendar_item_id);
      if (calendarItem) {
        infographicConcepts = safeParseStringArray(calendarItem.infographic_concepts);
        primaryKeyword = calendarItem.primary_keyword ?? null;
      }
    }

    const articleTitle =
      (typeof article.title === "string" && article.title) ||
      (typeof article.excerpt === "string" && article.excerpt
        ? article.excerpt.slice(0, 80) + "..."
        : "Untitled");
    const articleExcerpt =
      typeof article.excerpt === "string" ? article.excerpt : null;

    const block = getInfographicBlockAt(content, infographicIndex);
    if (!block) {
      return NextResponse.json(
        { error: `Infographic block ${infographicIndex} not found` },
        { status: 404 }
      );
    }

    const surroundingContent = getSurroundingContentForInfographic(
      content,
      infographicIndex
    );

    let newContent: string;

    if (block.type === "image") {
      const spec = await extractInfographicSpecFromContext(
        surroundingContent,
        primaryKeyword
      );
      const db = getDb();
      const siteRow = db
        .prepare("SELECT infographic_watermark FROM project_site_settings WHERE project_id = ?")
        .get(projectId) as { infographic_watermark?: number } | undefined;
      const showWatermark = (siteRow?.infographic_watermark ?? 1) !== 0;
      const siteUrl = showWatermark ? ensureHttpsUrl(project.homepage_url) : undefined;
      const base64 = await renderInfographicToBase64(spec, { siteUrl });
      newContent = replaceInfographicAtWithImage(
        content,
        infographicIndex,
        spec.title,
        base64
      );
    } else {
      const prompt = buildInfographicRegenerationPrompt({
        articleTitle,
        articleExcerpt,
        primaryKeyword,
        infographicConcepts,
        surroundingContent,
      });

      const response = await chat(
        [
          {
            role: "user",
            content: prompt,
          },
        ],
        undefined,
        {
          maxOutputTokens: 4096,
          projectId,
          requestLabel: "regenerate-infographic",
        }
      );

      const parsed = parseInfographicBlockResponse(response.content);
      if (!parsed) {
        return NextResponse.json(
          { error: "Failed to parse infographic from model response" },
          { status: 500 }
        );
      }

      newContent = replaceInfographicAt(
        content,
        infographicIndex,
        parsed.title,
        parsed.html
      );
    }

    updateArticle(articleId, { content: newContent });

    const updatedSections = buildArticleSections(newContent);
    return NextResponse.json({
      content: newContent,
      articleSections: updatedSections,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Regenerate infographic failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
