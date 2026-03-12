import { NextRequest } from "next/server";
import { getProject } from "@/lib/db/projects";
import { getArticleGenerationJob } from "@/lib/db/article-generation-jobs";
import { isProjectJobTerminal } from "@/lib/db/project-jobs";
import { processArticleGenerationJob } from "@/lib/article-generation-runner";

export const dynamic = "force-dynamic";
export const maxDuration = 1800;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; jobId: string }> }
) {
  const { id: projectId, jobId } = await params;
  const project = getProject(projectId);
  if (!project) {
    return new Response("Project not found", { status: 404 });
  }

  const job = getArticleGenerationJob(jobId);
  if (!job || job.project_id !== projectId) {
    return new Response("Article generation job not found", { status: 404 });
  }

  const encoder = new TextEncoder();
  let pollRef: ReturnType<typeof setInterval> | null = null;
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
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };

      request.signal?.addEventListener("abort", () => {
        cleanup();
      });

      const sendTerminalSnapshot = (currentJobId: string) => {
        const currentJob = getArticleGenerationJob(currentJobId);
        if (!currentJob) return;
        if (currentJob.result_json) {
          try {
            send("result", JSON.parse(currentJob.result_json));
          } catch {
            /* ignore malformed stored result */
          }
        }
        send("done", {
          status: currentJob.status,
          articleId: currentJob.article_id,
          timestamp: new Date().toISOString(),
        });
      };

      if (isProjectJobTerminal(job.status)) {
        sendTerminalSnapshot(jobId);
        cleanup();
        return;
      }

      if (job.status === "pending" && !startedProcessing) {
        startedProcessing = true;
        void processArticleGenerationJob(job.id, {
          onEvent: (event, data) => {
            if (closed) return;
            send(event, data);
            if (event === "done") {
              cleanup();
            }
          },
        }).catch((error) => {
          if (closed) return;
          const message =
            error instanceof Error ? error.message : "Article generation failed";
          send("error", { message, timestamp: new Date().toISOString() });
          send("done", { status: "failed", timestamp: new Date().toISOString() });
          cleanup();
        });
      }

      pollRef = setInterval(() => {
        if (closed) return;
        const currentJob = getArticleGenerationJob(jobId);
        if (!currentJob) return;
        send("progress", {
          id: currentJob.id,
          status: currentJob.status,
          progress: currentJob.progress,
          totalSteps: currentJob.total_steps,
          stage: currentJob.current_stage,
          message: currentJob.current_message,
          etaSeconds: currentJob.eta_seconds,
          errorMessage: currentJob.error_message,
          contentLength: currentJob.content_length,
          reasoningLength: currentJob.reasoning_length,
          articleId: currentJob.article_id,
          calendarItemId: currentJob.calendar_item_id,
        });
        if (isProjectJobTerminal(currentJob.status)) {
          sendTerminalSnapshot(jobId);
          cleanup();
        }
      }, 1500);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
