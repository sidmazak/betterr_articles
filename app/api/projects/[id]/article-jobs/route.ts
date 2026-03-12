import { NextRequest, NextResponse } from "next/server";
import { getProject } from "@/lib/db/projects";
import { resolveProjectArticleDefaults } from "@/lib/db/article-defaults";
import {
  createArticleGenerationJob,
  getActiveArticleGenerationJob,
  listArticleGenerationJobs,
} from "@/lib/db/article-generation-jobs";
import type { ArticlePipelineInput } from "@/lib/prompts/types";

function normalizeInput(
  input: ArticlePipelineInput,
  projectDefaults: Partial<ArticlePipelineInput>
) {
  return {
    ...input,
    ...(projectDefaults.articleType ? { articleType: projectDefaults.articleType } : {}),
    ...(projectDefaults.useCrawledUrlsAsInternalLinks !== undefined
      ? { useCrawledUrlsAsInternalLinks: projectDefaults.useCrawledUrlsAsInternalLinks }
      : {}),
    ...(projectDefaults.domainKnowledge && !input.domainKnowledge
      ? { domainKnowledge: projectDefaults.domainKnowledge }
      : {}),
  };
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
    return NextResponse.json(listArticleGenerationJobs(projectId));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load article jobs";
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

    const body = await request.json();
    const { calendarItemId, input, source } = body as {
      calendarItemId?: string;
      input?: ArticlePipelineInput;
      source?: "manual" | "schedule" | "api";
    };

    if (!input) {
      return NextResponse.json({ error: "Missing input" }, { status: 400 });
    }

    const active = getActiveArticleGenerationJob(projectId, calendarItemId ?? null);
    if (active) {
      return NextResponse.json(active);
    }

    const projectDefaults = (await resolveProjectArticleDefaults(projectId)) ?? {};
    const normalizedInput = normalizeInput(input, projectDefaults);
    const job = createArticleGenerationJob({
      projectId,
      calendarItemId: calendarItemId ?? null,
      source: source ?? "manual",
      input: normalizedInput,
    });
    return NextResponse.json(job, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create article generation job";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
