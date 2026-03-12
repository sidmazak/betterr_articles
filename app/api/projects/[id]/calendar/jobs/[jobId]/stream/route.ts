import { NextRequest } from "next/server";
import { getProject } from "@/lib/db/projects";
import { processCalendarGenerationJob } from "@/lib/calendar-generation-runner";
import { getCalendarGenerationJob } from "@/lib/db/calendar-generation-jobs";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function logCalendarStream(
  level: "info" | "warn" | "error",
  message: string,
  details?: Record<string, unknown>
) {
  if (process.env.NODE_ENV === "test") return;
  const payload = details ? ` ${JSON.stringify(details)}` : "";
  const formatted = `[CalendarStream] [${level.toUpperCase()}] ${message}${payload}`;
  if (level === "error") {
    console.error(formatted);
  } else if (level === "warn") {
    console.warn(formatted);
  } else {
    console.log(formatted);
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; jobId: string }> }
) {
  const { id: projectId, jobId } = await params;
  logCalendarStream("info", "Stream request received", {
    projectId,
    jobId,
    userAgent: request.headers.get("user-agent") ?? null,
  });
  const project = getProject(projectId);
  if (!project) {
    logCalendarStream("warn", "Stream request rejected because project was missing", {
      projectId,
      jobId,
    });
    return new Response("Project not found", { status: 404 });
  }

  const job = getCalendarGenerationJob(jobId);
  if (!job || job.project_id !== projectId) {
    logCalendarStream("warn", "Stream request rejected because job was missing", {
      projectId,
      jobId,
    });
    return new Response("Calendar generation job not found", { status: 404 });
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
        logCalendarStream("info", "Closing stream", {
          projectId,
          jobId,
        });
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
        logCalendarStream("info", "Stream opened for already-finished job", {
          projectId,
          jobId,
          status: job.status,
        });
        send("done", { status: job.status, job });
        cleanup();
        return;
      }

      if (job.status === "pending" && !startedProcessing) {
        startedProcessing = true;
        logCalendarStream("info", "Starting calendar generation from stream", {
          projectId,
          jobId,
          status: job.status,
        });
        void processCalendarGenerationJob(job.id, {
          onEvent: (event, data) => {
            if (closed) return;
            send(event, data);
            if (event === "done") {
              logCalendarStream("info", "Runner emitted done event", {
                projectId,
                jobId,
              });
              cleanup();
            }
          },
        }).catch((error) => {
          if (closed) return;
          const message =
            error instanceof Error ? error.message : "Calendar generation failed";
          logCalendarStream("error", "Runner crashed while streaming", {
            projectId,
            jobId,
            error: message,
          });
          send("log", { level: "error", message, stage: "failed" });
          send("done", {
            status: "failed",
            job: getCalendarGenerationJob(job.id),
            error: message,
          });
          cleanup();
        });
      }

      pollRef = setInterval(() => {
        if (closed) return;
        const currentJob = getCalendarGenerationJob(jobId);
        if (!currentJob) return;
        send("progress", {
          id: currentJob.id,
          status: currentJob.status,
          progress: currentJob.progress,
          totalSteps: currentJob.total_steps,
          generatedItems: currentJob.generated_items,
          totalItems: currentJob.total_items,
          stage: currentJob.current_stage,
          message: currentJob.current_message,
          etaSeconds: currentJob.eta_seconds,
          errorMessage: currentJob.error_message,
          startDate: currentJob.start_date,
          endDate: currentJob.end_date,
          replaceExisting: !!currentJob.replace_existing,
          appendExisting: !!currentJob.append_existing,
          wholeMonth: !!currentJob.whole_month,
        });
        if (
          currentJob.status === "completed" ||
          currentJob.status === "failed" ||
          currentJob.status === "cancelled"
        ) {
          logCalendarStream("info", "Polling detected terminal job state", {
            projectId,
            jobId,
            status: currentJob.status,
            progress: currentJob.progress,
            totalSteps: currentJob.total_steps,
            generatedItems: currentJob.generated_items,
            totalItems: currentJob.total_items,
          });
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
