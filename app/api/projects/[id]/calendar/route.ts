import { NextRequest, NextResponse } from "next/server";
import { getProject } from "@/lib/db/projects";
import {
  listCalendarItems,
  createCalendarItems,
  deleteCalendarItemsByProject,
} from "@/lib/db/calendar";
import { getDb } from "@/lib/db";
import { getLatestCrawlResults } from "@/lib/db/crawl-jobs";
import { listManualUrls } from "@/lib/db/manual-urls";
import { buildContentCalendarPrompt } from "@/lib/prompts";
import { chat } from "@/lib/llm";
import { sendNotification } from "@/lib/notifications";
import type { CalendarItem } from "@/lib/app-types";

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
    const items = listCalendarItems(projectId);
    const db = getDb();
    const articleMap = new Map<string, { id: string; published_url: string | null; status: string }>();
    const rows = db
      .prepare(
        `SELECT a.id, a.calendar_item_id, a.published_url, a.status
         FROM articles a
         WHERE a.project_id = ? AND a.calendar_item_id IS NOT NULL`
      )
      .all(projectId) as { id: string; calendar_item_id: string; published_url: string | null; status: string }[];
    for (const r of rows) {
      articleMap.set(r.calendar_item_id, { id: r.id, published_url: r.published_url, status: r.status });
    }
    const enriched = items.map((item) => {
      const article = articleMap.get(item.id);
      return {
        ...item,
        article_id: article?.id,
        published_url: article?.published_url ?? null,
        article_status: article?.status ?? null,
      };
    });
    return NextResponse.json(enriched);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to list calendar";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

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

    const crawlPages = getLatestCrawlResults(projectId);
    const manualUrls = listManualUrls(projectId);
    const manualPages = manualUrls.map((u) => ({ url: u.url, title: u.title ?? u.url }));

    const existingPages = crawlPages.length > 0 ? crawlPages : manualPages;
    if (existingPages.length === 0) {
      return NextResponse.json(
        { error: "No pages found. Run a crawl or add manual URLs first." },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const {
      suggestionCount = 12,
      publishingFrequency = "2 per week",
      replace = false,
      simulate = false,
    } = body;

    if (simulate) {
      const mockItems = generateMockCalendar(existingPages, suggestionCount);
      if (replace) {
        deleteCalendarItemsByProject(projectId);
      }
      const created = createCalendarItems(projectId, null, mockItems);
      return NextResponse.json(created);
    }

    const homepageUrl = project.homepage_url ?? existingPages[0]?.url ?? "";
    const prompt = buildContentCalendarPrompt({
      homepageUrl,
      existingPages,
      usedSitemap: false,
      suggestionCount,
      publishingFrequency,
    });

    let content: string;
    try {
      const result = await chat(
        [
          {
            role: "system",
            content: "You are a content strategist. Output only valid JSON arrays. No markdown, no explanation.",
          },
          { role: "user", content: prompt },
        ],
        undefined
      );
      content = result.content?.trim() ?? "[]";
    } catch (err) {
      const msg = err instanceof Error ? err.message : "LLM error";
      return NextResponse.json(
        {
          error: msg,
          mockData: generateMockCalendar(existingPages, suggestionCount),
        },
        { status: 503 }
      );
    }

    let items: CalendarItem[];
    try {
      const parsed = JSON.parse(content.replace(/^```json\s*|\s*```$/g, ""));
      items = Array.isArray(parsed) ? parsed : [];
      // Ensure each item has targetUrl from existing pages
      items = items.map((item, idx) => {
        const target = item.targetUrl && existingPages.some((p) => p.url === item.targetUrl)
          ? item.targetUrl
          : existingPages[idx % existingPages.length]?.url ?? existingPages[0]?.url ?? "";
        return { ...item, targetUrl: target };
      });
    } catch {
      return NextResponse.json(
        { error: "Failed to parse LLM response as JSON" },
        { status: 502 }
      );
    }

    if (replace) {
      deleteCalendarItemsByProject(projectId);
    }

    const created = createCalendarItems(projectId, null, items);
    sendNotification(
      "calendar_generated",
      "Content calendar generated",
      `Generated ${created.length} article suggestions for your project.`,
      project.name
    ).catch(() => {});
    return NextResponse.json(created);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to generate calendar";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function generateMockCalendar(
  existingPages: { url: string; title: string }[],
  count: number
): CalendarItem[] {
  const today = new Date();
  const items: CalendarItem[] = [];
  for (let i = 0; i < Math.min(count, Math.max(6, existingPages.length)); i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i * 3);
    const targetPage = existingPages[i % existingPages.length];
    items.push({
      targetUrl: targetPage.url,
      title: `Suggested Article ${i + 1} (Configure LLM in Settings for real suggestions)`,
      primaryKeyword: `keyword-${i + 1}`,
      secondaryKeywords: ["kw-a", "kw-b", "kw-c"],
      suggestedDate: d.toISOString().split("T")[0],
      contentGapRationale: "Go to Settings to add your API key and choose a model provider.",
      internalLinkTargets: existingPages.slice(0, 3).map((p) => ({
        url: p.url,
        title: p.title,
        reason: "Related topic",
      })),
      infographicConcepts: ["Concept 1", "Concept 2", "Concept 3"],
      rankingPotential: "medium",
      rankingJustification: "Mock data",
    });
  }
  return items;
}
