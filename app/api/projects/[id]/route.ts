import { NextRequest, NextResponse } from "next/server";
import { getProject, updateProject, deleteProject } from "@/lib/db/projects";
import { getActiveCrawlJob, hasCompletedCrawl } from "@/lib/db/crawl-jobs";
import { getActiveCalendarGenerationJob } from "@/lib/db/calendar-generation-jobs";
import { getActiveArticleGenerationJob } from "@/lib/db/article-generation-jobs";
import { getProjectLLMUsage } from "@/lib/db/llm-usage";
import { getLatestProjectSEOInsight, parseSEOInsight } from "@/lib/db/seo-insights";
import { getPromptOptimizationSettings } from "@/lib/db/settings";
import { listConfiguredPublishingPlatforms } from "@/lib/publishing";
import { getDb } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const project = getProject(id);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    const { getProjectStats } = await import("@/lib/db/projects");
    const stats = getProjectStats(id);
    const activeCrawlJob = getActiveCrawlJob(id);
    const activeCalendarJob = getActiveCalendarGenerationJob(id);
    const activeArticleJob = getActiveArticleGenerationJob(id);
    const seoInsight = parseSEOInsight(getLatestProjectSEOInsight(id));
    const llmUsage = getProjectLLMUsage(id);
    const promptOptimizationSettings = getPromptOptimizationSettings();
    const publishingPlatforms = listConfiguredPublishingPlatforms(id);
    const db = getDb();
    const recentArticles = db
      .prepare(
        `SELECT id, title, status, published_url, updated_at
         FROM articles
         WHERE project_id = ?
         ORDER BY updated_at DESC
         LIMIT 5`
      )
      .all(id) as Array<{
      id: string;
      title: string | null;
      status: string;
      published_url: string | null;
      updated_at: string;
    }>;
    return NextResponse.json({
      ...project,
      ...stats,
      hasCompletedCrawl: hasCompletedCrawl(id),
      llmUsage,
      promptOptimizationSettings,
      publishingPlatforms,
      recentArticles,
      seoInsight: seoInsight
        ? {
            summary: seoInsight.summary,
            topics: seoInsight.topics,
            keywords: seoInsight.keywords,
            reference: seoInsight.reference,
            updated_at: seoInsight.updated_at,
          }
        : null,
      activeCrawlJob: activeCrawlJob
        ? {
            id: activeCrawlJob.id,
            status: activeCrawlJob.status,
            progress: activeCrawlJob.progress,
            total_pages: activeCrawlJob.total_pages,
            current_stage: activeCrawlJob.current_stage,
            current_url: activeCrawlJob.current_url,
            eta_seconds: activeCrawlJob.eta_seconds,
            total_batches: activeCrawlJob.total_batches,
            completed_batches: activeCrawlJob.completed_batches,
          }
        : null,
      activeCalendarJob: activeCalendarJob
        ? {
            id: activeCalendarJob.id,
            status: activeCalendarJob.status,
            progress: activeCalendarJob.progress,
            total_steps: activeCalendarJob.total_steps,
            generated_items: activeCalendarJob.generated_items,
            total_items: activeCalendarJob.total_items,
            current_stage: activeCalendarJob.current_stage,
            current_message: activeCalendarJob.current_message,
            eta_seconds: activeCalendarJob.eta_seconds,
            start_date: activeCalendarJob.start_date,
            end_date: activeCalendarJob.end_date,
            replace_existing: !!activeCalendarJob.replace_existing,
            append_existing: !!activeCalendarJob.append_existing,
            whole_month: !!activeCalendarJob.whole_month,
          }
        : null,
      activeArticleJob: activeArticleJob
        ? {
            id: activeArticleJob.id,
            status: activeArticleJob.status,
            progress: activeArticleJob.progress,
            total_steps: activeArticleJob.total_steps,
            current_stage: activeArticleJob.current_stage,
            current_message: activeArticleJob.current_message,
            eta_seconds: activeArticleJob.eta_seconds,
            calendar_item_id: activeArticleJob.calendar_item_id,
            article_id: activeArticleJob.article_id,
            content_length: activeArticleJob.content_length,
            reasoning_length: activeArticleJob.reasoning_length,
            last_heartbeat_at: activeArticleJob.last_heartbeat_at,
          }
        : null,
      activeJobs: [
        activeCrawlJob
          ? {
              id: activeCrawlJob.id,
              type: "crawl",
              status: activeCrawlJob.status,
              progress: activeCrawlJob.progress,
              current_stage: activeCrawlJob.current_stage,
              current_message: activeCrawlJob.current_url,
              eta_seconds: activeCrawlJob.eta_seconds,
            }
          : null,
        activeCalendarJob
          ? {
              id: activeCalendarJob.id,
              type: "calendar_generation",
              status: activeCalendarJob.status,
              progress: activeCalendarJob.progress,
              current_stage: activeCalendarJob.current_stage,
              current_message: activeCalendarJob.current_message,
              eta_seconds: activeCalendarJob.eta_seconds,
            }
          : null,
        activeArticleJob
          ? {
              id: activeArticleJob.id,
              type: "article_generation",
              status: activeArticleJob.status,
              progress: activeArticleJob.progress,
              current_stage: activeArticleJob.current_stage,
              current_message: activeArticleJob.current_message,
              eta_seconds: activeArticleJob.eta_seconds,
            }
          : null,
      ].filter(Boolean),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to get project";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const project = getProject(id);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    const body = await request.json();
    const { name, homepageUrl, sitemapUrl } = body;
    updateProject(id, {
      name,
      homepage_url: homepageUrl,
      sitemap_url: sitemapUrl,
    });
    return NextResponse.json(getProject(id));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update project";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const project = getProject(id);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    deleteProject(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to delete project";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
