import { NextRequest, NextResponse } from "next/server";
import { getProject } from "@/lib/db/projects";
import { getCrawlResultPages } from "@/lib/db/crawl-jobs";
import { getDb } from "@/lib/db";
import { extractSEOInsights } from "@/lib/seo-extraction";
import { getLatestProjectSEOInsight, parseSEOInsight } from "@/lib/db/seo-insights";
import { refreshProjectArticleDefaultsFromInsight } from "@/lib/db/article-defaults";

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

    const body = await request.json().catch(() => ({}));
    const { crawlJobId, maxKeywords = 100, save = true } = body;

    // Get crawl pages - from specific job or latest completed job
    let pages: Array<{
      url: string;
      title: string | null;
      meta_description: string | null;
      content_preview: string | null;
    }>;

    if (crawlJobId) {
      const jobPages = getCrawlResultPages(crawlJobId);
      if (jobPages.length === 0) {
        return NextResponse.json(
          { error: "Crawl job has no pages. Run a crawl first." },
          { status: 400 }
        );
      }
      pages = jobPages;
    } else {
      const db = getDb();
      const latestJob = db
        .prepare(
          `SELECT id FROM crawl_jobs WHERE project_id = ? AND status = 'completed'
           ORDER BY completed_at DESC LIMIT 1`
        )
        .get(projectId) as { id: string } | undefined;
      if (!latestJob) {
        return NextResponse.json(
          { error: "No completed crawl found. Run a crawl first." },
          { status: 400 }
        );
      }
      pages = getCrawlResultPages(latestJob.id);
    }

    const homepageUrl = project.homepage_url ?? pages[0]?.url ?? "";
    const insights = await extractSEOInsights(projectId, homepageUrl, pages, {
      crawlJobId: crawlJobId ?? null,
      maxKeywords,
      save,
    });
    if (save) {
      await refreshProjectArticleDefaultsFromInsight(projectId).catch(() => null);
    }

    return NextResponse.json({
      keywords: insights.keywords,
      topics: insights.topics,
      summary: insights.summary,
      reference: insights.reference,
      count: insights.keywords.length,
      saved: save && insights.keywords.length > 0,
    });
  } catch (err) {
    if (err instanceof Error && (err.message === "CRAWL_PAUSED" || err.message === "CRAWL_CANCELLED")) {
      return NextResponse.json({ error: "Extraction interrupted" }, { status: 409 });
    }
    const message = err instanceof Error ? err.message : "Failed to extract keywords";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const project = getProject(projectId);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const db = getDb();
    const rows = db
      .prepare(
        `SELECT id, keyword, source, created_at FROM project_keywords
         WHERE project_id = ? ORDER BY created_at DESC`
      )
      .all(projectId) as { id: string; keyword: string; source: string; created_at: string }[];
    const latestInsight = parseSEOInsight(getLatestProjectSEOInsight(projectId));

    return NextResponse.json({
      keywords: rows,
      insight: latestInsight
        ? {
            id: latestInsight.id,
            topics: latestInsight.topics,
            keywords: latestInsight.keywords,
            summary: latestInsight.summary,
            reference: latestInsight.reference,
            source: latestInsight.source,
            created_at: latestInsight.created_at,
          }
        : null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to list keywords";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
