import { NextRequest, NextResponse } from "next/server";
import {
  buildResearchPrompt,
  buildOutlinePrompt,
  buildContentPrompt,
  toResearchParams,
  toOutlineParams,
  toContentParams,
} from "@/lib/prompts";
import { chat } from "@/lib/llm";
import { upsertArticle } from "@/lib/db/articles";
import { updateCalendarItemStatus } from "@/lib/db/calendar";
import type { ArticlePipelineInput, ExistingPage } from "@/lib/prompts/types";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { step, calendarItemId, projectId, input } = body as {
      step: "research" | "outline" | "content";
      calendarItemId?: string;
      projectId?: string;
      input: ArticlePipelineInput & { existingPages?: ExistingPage[]; publishedArticles?: ExistingPage[] };
    };

    if (!step || !input) {
      return NextResponse.json(
        { error: "Missing step or input" },
        { status: 400 }
      );
    }

    let prompt: string;
    if (step === "research") {
      const params = toResearchParams(input);
      prompt = buildResearchPrompt(params);
    } else if (step === "outline") {
      const params = toOutlineParams({
        ...input,
        requireInfographics: input.requireInfographics ?? true,
      });
      prompt = buildOutlinePrompt(params);
    } else if (step === "content") {
      const params = toContentParams({
        ...input,
        existingPages: input.existingPages ?? [],
        publishedArticles: input.publishedArticles ?? [],
        requireInfographics: input.requireInfographics ?? true,
        internalLinking: input.internalLinking ?? true,
      });
      prompt = buildContentPrompt(params);
    } else {
      return NextResponse.json({ error: "Invalid step" }, { status: 400 });
    }

    const result = await chat(
      [
        { role: "system", content: "You are an expert content strategist and writer. Output in markdown." },
        { role: "user", content: prompt },
      ],
      undefined
    );
    const content = result.content?.trim() ?? "";

    if (step === "content" && content && calendarItemId) {
      const projectId = body.projectId as string | undefined;
      if (projectId) {
        upsertArticle(projectId, calendarItemId, { content, status: "draft" });
        updateCalendarItemStatus(calendarItemId, "completed");
      }
    }

    return NextResponse.json({ content });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Article generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
