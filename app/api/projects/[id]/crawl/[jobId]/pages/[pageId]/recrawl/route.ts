import { NextRequest, NextResponse } from "next/server";
import { getProject } from "@/lib/db/projects";
import {
  getCrawlJob,
  getCrawlResultPages,
  updateCrawlResultPage,
  updateCrawlResultPageSEOReference,
} from "@/lib/db/crawl-jobs";
import { crawlSingleUrl } from "@/lib/crawler";
import { extractSEOInsights } from "@/lib/seo-extraction";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; jobId: string; pageId: string }> }
) {
  try {
    const { id: projectId, jobId, pageId } = await params;
    const project = getProject(projectId);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const job = getCrawlJob(jobId);
    if (!job || job.project_id !== projectId) {
      return NextResponse.json({ error: "Crawl job not found" }, { status: 404 });
    }

    const pages = getCrawlResultPages(jobId);
    const page = pages.find((p) => p.id === pageId);
    if (!page) {
      return NextResponse.json({ error: "Page not found" }, { status: 404 });
    }

    const fresh = await crawlSingleUrl(page.url);
    const updated = updateCrawlResultPage(pageId, {
      title: fresh.title,
      meta_description: fresh.meta_description ?? undefined,
      content_preview: fresh.content_preview ?? undefined,
    });

    if (!updated) {
      return NextResponse.json({ error: "Page not editable" }, { status: 404 });
    }

    const pageInsight = await extractSEOInsights(
      projectId,
      project.homepage_url ?? page.url,
      [fresh],
      {
        crawlJobId: jobId,
        maxKeywords: 20,
        save: false,
      }
    );

    const withSeoData = updateCrawlResultPageSEOReference(jobId, page.url, {
      topics: pageInsight.topics,
      keywords: pageInsight.keywords,
      summary: pageInsight.summary,
      reference: pageInsight.reference,
    });

    return NextResponse.json(withSeoData ?? updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Recrawl failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
