import { NextRequest, NextResponse } from "next/server";
import { getProject } from "@/lib/db/projects";
import {
  createCrawlJob,
  getCrawlJob,
} from "@/lib/db/crawl-jobs";
import { hasConfiguredDefaultLLM } from "@/lib/db/settings";
import { processCrawlJob } from "@/lib/crawl-job-runner";

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

    if (!hasConfiguredDefaultLLM()) {
      return NextResponse.json(
        {
          error:
            "AI provider not configured. Go to App Settings → LLM Provider to add your API key and model before crawling.",
        },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { runImmediately = true, maxPages = 10 } = body;

    const job = createCrawlJob(projectId, "auto", maxPages);

    if (runImmediately && project.homepage_url) {
      const processed = await processCrawlJob(job.id);
      const finalJob = getCrawlJob(job.id);
      if (processed?.status === "failed") {
        return NextResponse.json({ error: finalJob?.error_message ?? "Crawl failed", jobId: job.id }, { status: 500 });
      }
      return NextResponse.json(finalJob);
    }

    return NextResponse.json(job);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to start crawl";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
