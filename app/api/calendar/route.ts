import { NextRequest, NextResponse } from "next/server";
import { buildContentCalendarPrompt } from "@/lib/prompts";
import { getStructuredPromptInstruction } from "@/lib/prompts/toon";
import { chat } from "@/lib/llm";
import type { CalendarItem } from "@/lib/app-types";
import { parseCalendarItemsFromLlmContent } from "@/lib/calendar-generation-parser";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      homepageUrl,
      existingPages,
      usedSitemap,
      suggestionCount = 12,
      publishingFrequency = "2 per week",
      projectId,
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

    let trimmed: string;
    try {
      const { content } = await chat(
        [
          {
            role: "system",
            content:
              `You are a senior content strategist. Follow the prompt exactly, avoid duplicates, and return only a bare JSON array. Never return an error object or explanatory note. ${getStructuredPromptInstruction()}`,
          },
          { role: "user", content: prompt },
        ],
        undefined,
        {
          projectId: typeof projectId === "string" ? projectId : null,
          requestLabel: "calendar-preview",
          temperature: 0.2,
          maxOutputTokens: null,
          responseFormat: "text",
        }
      );
      trimmed = content?.trim() ?? "[]";
    } catch (err) {
      const msg = err instanceof Error ? err.message : "LLM not configured";
      return NextResponse.json(
        { error: msg.includes("No LLM") ? msg : "LLM error" },
        { status: 503 }
      );
    }

    let items: CalendarItem[];
    try {
      items = parseCalendarItemsFromLlmContent(trimmed).items;
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
