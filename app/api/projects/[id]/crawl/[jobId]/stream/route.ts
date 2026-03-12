import { NextRequest } from "next/server";
import { getProject } from "@/lib/db/projects";
import { getCrawlJob } from "@/lib/db/crawl-jobs";
import { processCrawlJob } from "@/lib/crawl-job-runner";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; jobId: string }> }
) {
  const { id: projectId, jobId } = await params;
  const project = getProject(projectId);
  if (!project) {
    return new Response("Project not found", { status: 404 });
  }

  const job = getCrawlJob(jobId);
  if (!job || job.project_id !== projectId) {
    return new Response("Crawl job not found", { status: 404 });
  }

  const encoder = new TextEncoder();
  let pollRef: ReturnType<typeof setInterval> | null = null;
  let timeoutRef: ReturnType<typeof setTimeout> | null = null;
  let startedProcessing = false;

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const send = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
          );
        } catch {
          closed = true;
        }
      };

      const cleanup = () => {
        closed = true;
        if (pollRef) {
          clearInterval(pollRef);
          pollRef = null;
        }
        if (timeoutRef) {
          clearTimeout(timeoutRef);
          timeoutRef = null;
        }
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };

      request.signal?.addEventListener("abort", cleanup);

      if (job.status === "completed" || job.status === "failed" || job.status === "cancelled") {
        send("done", { status: job.status, job });
        cleanup();
        return;
      }

      if (job.status === "pending" && project.homepage_url && !startedProcessing) {
        startedProcessing = true;
        void processCrawlJob(job.id, {
          onEvent: (event, data) => {
            if (closed) return;
            send(event, data);
            if (event === "done") {
              cleanup();
            }
          },
        }).catch((error) => {
          if (closed) return;
          const message = error instanceof Error ? error.message : "Crawl failed";
          send("log", { level: "error", message });
          send("done", { status: "failed", job: getCrawlJob(job.id), error: message });
          cleanup();
        });
      }

      pollRef = setInterval(() => {
        if (closed) return;
        const currentJob = getCrawlJob(jobId);
        if (!currentJob) return;
        send("progress", {
          progress: currentJob.progress,
          total: currentJob.total_pages,
          url: currentJob.current_url,
          stage: currentJob.current_stage,
          etaSeconds: currentJob.eta_seconds,
          completedBatches: currentJob.completed_batches,
          totalBatches: currentJob.total_batches,
        });
        if (
          currentJob.status === "completed" ||
          currentJob.status === "failed" ||
          currentJob.status === "paused" ||
          currentJob.status === "cancelled"
        ) {
          send("done", { status: currentJob.status, job: currentJob });
          cleanup();
        }
      }, 1500);

      timeoutRef = setTimeout(cleanup, 300000);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
