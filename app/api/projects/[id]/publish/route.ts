import { NextRequest, NextResponse } from "next/server";
import { getProject } from "@/lib/db/projects";
import { publishArticleToPlatforms } from "@/lib/publishing";
import { sendNotification } from "@/lib/notifications";
import { getArticle, getArticleByCalendarItem, updateArticle, upsertArticle } from "@/lib/db/articles";
import { updateCalendarItemStatus } from "@/lib/db/calendar";
import type { GeneratedArticleMetadata } from "@/lib/prompts/types";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const project = getProject(projectId);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const body = await request.json();
    const { title, content, excerpt, tags, calendarItemId, publishingConfigIds, articleId } = body as {
      title?: string;
      content?: string;
      excerpt?: string;
      tags?: string[];
      calendarItemId?: string;
      articleId?: string;
      publishingConfigIds?: string[];
    };

    const article =
      (articleId ? getArticle(articleId) : null) ||
      (calendarItemId ? getArticleByCalendarItem(calendarItemId) : null);
    const storedMetadata = safeParseJson<GeneratedArticleMetadata>(article?.publish_metadata_json);
    const publishTitle = article?.title ?? title;
    const publishContent = article?.content ?? content;

    if (!publishTitle || !publishContent) {
      return NextResponse.json(
        { error: "title and content are required" },
        { status: 400 }
      );
    }

    const result = await publishArticleToPlatforms(
      projectId,
      {
        title: publishTitle,
        content: publishContent,
        metadata: {
          excerpt: article?.excerpt ?? excerpt,
          tags: safeParseJson<string[]>(article?.tags_json) ?? tags,
          slug: article?.slug ?? storedMetadata?.slug,
          seoTitle: article?.seo_title ?? storedMetadata?.seoTitle,
          metaDescription: article?.meta_description ?? storedMetadata?.metaDescription,
          category: article?.category ?? storedMetadata?.category,
          canonicalUrl: storedMetadata?.canonicalUrl ?? null,
          socialHashtags: storedMetadata?.socialHashtags ?? [],
          coverImageBase64: article?.cover_image_base64 ?? null,
          coverImageMimeType: article?.cover_image_mime_type ?? null,
          coverImageAlt: article?.cover_image_alt ?? storedMetadata?.coverImageAlt ?? null,
        },
      },
      {
        articleId: article?.id ?? articleId,
        calendarItemId,
        publishingConfigIds,
      }
    );
    const successfulResults = result.results.filter((item) => item.success);
    if (successfulResults.length === 0) {
      return NextResponse.json(
        {
          error: result.results.map((item) => `${item.label}: ${item.error ?? "Publish failed"}`).join(" | "),
          results: result.results,
        },
        { status: 500 }
      );
    }

    if (article?.id) {
      const firstUrl = successfulResults.find((item) => item.url)?.url;
      updateArticle(article.id, {
        content: publishContent,
        title: publishTitle,
        status: "published",
        published_url: firstUrl ?? null,
        last_published_at: new Date().toISOString(),
      });
    } else if (calendarItemId) {
      const firstUrl = successfulResults.find((item) => item.url)?.url;
      upsertArticle(projectId, calendarItemId, {
        content: publishContent,
        title: publishTitle,
        status: "published",
        published_url: firstUrl ?? null,
        last_published_at: new Date().toISOString(),
      });
    }

    if (calendarItemId) {
      updateCalendarItemStatus(calendarItemId, "completed");
    }

    sendNotification(
      "article_published",
      "Article published",
      `"${publishTitle}" was published to ${successfulResults.length} destination(s).`,
      project.name
    ).catch(() => {});

    return NextResponse.json({
      success: true,
      url: successfulResults.find((item) => item.url)?.url,
      results: result.results,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Publish failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function safeParseJson<T>(value: string | null | undefined): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}
