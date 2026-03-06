import { NextRequest, NextResponse } from "next/server";
import { buildContentCalendarPrompt } from "@/lib/prompts";
import type { CalendarItem } from "@/lib/app-types";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      homepageUrl,
      existingPages,
      usedSitemap,
      suggestionCount = 12,
      publishingFrequency = "2 per week",
    } = body;

    if (!homepageUrl || !existingPages || !Array.isArray(existingPages)) {
      return NextResponse.json(
        { error: "Missing homepageUrl or existingPages" },
        { status: 400 }
      );
    }

    const prompt = buildContentCalendarPrompt({
      homepageUrl,
      existingPages,
      usedSitemap,
      suggestionCount,
      publishingFrequency,
    });

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        {
          error: "OPENAI_API_KEY not configured. Add it to .env.local to generate calendar.",
          prompt,
          mockData: generateMockCalendar(existingPages, suggestionCount),
        },
        { status: 503 }
      );
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are a content strategist. Output only valid JSON arrays. No markdown, no explanation.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return NextResponse.json(
        { error: `OpenAI API error: ${err}` },
        { status: 502 }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim() ?? "[]";

    let items: CalendarItem[];
    try {
      const parsed = JSON.parse(content.replace(/^```json\s*|\s*```$/g, ""));
      items = Array.isArray(parsed) ? parsed : [];
    } catch {
      return NextResponse.json(
        { error: "Failed to parse LLM response as JSON" },
        { status: 502 }
      );
    }

    return NextResponse.json({ items });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Calendar generation failed";
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
    const targets = existingPages.slice(0, 3).map((p) => ({
      url: p.url,
      title: p.title,
      reason: "Related topic",
    }));
    items.push({
      targetUrl: targetPage?.url ?? "",
      title: `Suggested Article ${i + 1} (Configure OPENAI_API_KEY for real suggestions)`,
      primaryKeyword: `keyword-${i + 1}`,
      secondaryKeywords: ["kw-a", "kw-b", "kw-c"],
      suggestedDate: d.toISOString().split("T")[0],
      contentGapRationale: "Add OPENAI_API_KEY to .env.local for AI-generated suggestions.",
      internalLinkTargets: targets,
      infographicConcepts: ["Concept 1", "Concept 2", "Concept 3"],
      rankingPotential: "medium",
      rankingJustification: "Mock data",
    });
  }
  return items;
}
