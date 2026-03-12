import { NextRequest, NextResponse } from "next/server";
import { getProject } from "@/lib/db/projects";
import { getLatestProjectSEOInsight } from "@/lib/db/seo-insights";
import {
  inferArticleDefaultsFromSEOInsight,
  inferArticleDefaultsFromSEOInsightWithAI,
  buildArticleDefaultsResearchSummary,
} from "@/lib/article-default-inference";
import type { ProjectSEOInsightRow } from "@/lib/db";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const project = getProject(projectId);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const latestInsight = getLatestProjectSEOInsight(projectId) as ProjectSEOInsightRow | null;
    if (!latestInsight) {
      return NextResponse.json(
        {
          error:
            "No SEO insight available yet. Run a site crawl first to extract topics, keywords, and content signals. Then Load optimal settings will use that data to suggest the best article defaults for this site.",
        },
        { status: 400 }
      );
    }

    const heuristic = inferArticleDefaultsFromSEOInsight(latestInsight, {
      projectName: project.name,
      homepageUrl: project.homepage_url ?? null,
    });

    const optimal = await inferArticleDefaultsFromSEOInsightWithAI({
      row: latestInsight,
      projectName: project.name,
      homepageUrl: project.homepage_url ?? null,
      existingDefaults: heuristic ?? undefined,
      projectId,
    });

    const config = optimal ?? heuristic ?? {};
    const researchSummary = buildArticleDefaultsResearchSummary({
      row: latestInsight,
      config,
      projectName: project.name,
      homepageUrl: project.homepage_url ?? null,
    });

    return NextResponse.json({
      ...config,
      _researchSummary: researchSummary,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load optimal settings";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
