import { NextRequest, NextResponse } from "next/server";
import { getProject } from "@/lib/db/projects";
import { getDb } from "@/lib/db";
import { getProjectLLMUsage } from "@/lib/db/llm-usage";
import { getLatestProjectSEOInsight, parseSEOInsight } from "@/lib/db/seo-insights";

function wordCount(text: string | null): number {
  if (!text || typeof text !== "string") return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
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

    const articles = db
      .prepare("SELECT content FROM articles WHERE project_id = ?")
      .all(projectId) as { content: string | null }[];
    const totalWords = articles.reduce((sum, a) => sum + wordCount(a.content), 0);

    const publishedCount = db
      .prepare("SELECT COUNT(*) as c FROM articles WHERE project_id = ? AND status = 'published'")
      .get(projectId) as { c: number };
    const totalArticles = articles.length;

    // Rough estimates: ~250 words/min writing, ~$0.10/word for writers
    const timeSavedHours = Math.round((totalWords / 15000) * 10) / 10;
    const costSavings = Math.round(totalWords * 0.1);
    const seoInsight = parseSEOInsight(getLatestProjectSEOInsight(projectId));
    const llmUsage = getProjectLLMUsage(projectId);

    return NextResponse.json({
      total_words: totalWords,
      total_articles: totalArticles,
      published_count: publishedCount?.c ?? 0,
      time_saved_hours: timeSavedHours,
      cost_savings: costSavings,
      seo_topics: seoInsight?.topics.slice(0, 6) ?? [],
      seo_keywords: seoInsight?.keywords.slice(0, 10) ?? [],
      seo_summary: seoInsight?.summary ?? null,
      llm_requests: llmUsage.request_count,
      llm_prompt_tokens: llmUsage.prompt_tokens,
      llm_completion_tokens: llmUsage.completion_tokens,
      llm_total_tokens: llmUsage.total_tokens,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to get stats";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
