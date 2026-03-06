import { NextRequest } from "next/server";
import { getProject } from "@/lib/db/projects";
import {
  getCrawlJob,
  startCrawlJob,
  completeCrawlJob,
  failCrawlJob,
  saveCrawlResults,
  addCrawlLog,
  updateCrawlJobProgress,
} from "@/lib/db/crawl-jobs";
import { crawlWebsite } from "@/lib/crawler";
import { sendNotification } from "@/lib/notifications";

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

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      };

      if (job.status === "completed" || job.status === "failed") {
        send("done", { status: job.status, job });
        controller.close();
        return;
      }

      if (job.status === "pending" && project.homepage_url) {
        startCrawlJob(job.id);
        addCrawlLog(job.id, "info", `Starting crawl of ${project.homepage_url}`);
        send("log", { level: "info", message: `Starting crawl of ${project.homepage_url}` });

        try {
          const maxPages = (job as { max_pages?: number }).max_pages ?? 150;
          const result = await crawlWebsite(project.homepage_url, (progress, total, url) => {
            updateCrawlJobProgress(job.id, progress, total);
            send("progress", { progress, total, url });
            const msg = `Page ${progress}/${total}: ${url}`;
            addCrawlLog(job.id, "info", msg);
            send("log", { level: "info", message: msg });
          }, { maxPages });
          saveCrawlResults(job.id, projectId, result.pages);
          const doneMsg = `Crawl completed: found ${result.totalFound} pages (sitemap: ${result.usedSitemap})`;
          addCrawlLog(job.id, "info", doneMsg);
          send("log", { level: "info", message: doneMsg });
          completeCrawlJob(job.id, result.totalFound, result.usedSitemap);
          sendNotification(
            "crawl_complete",
            "Crawl finished",
            `Found ${result.totalFound} pages. Used sitemap: ${result.usedSitemap}.`,
            project.name
          ).catch(() => {});
          send("done", {
            status: "completed",
            job: getCrawlJob(job.id),
            totalFound: result.totalFound,
            pages: result.pages,
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Crawl failed";
          addCrawlLog(job.id, "error", msg);
          send("log", { level: "error", message: msg });
          failCrawlJob(job.id, msg);
          send("done", {
            status: "failed",
            job: getCrawlJob(job.id),
            error: msg,
          });
        }
        controller.close();
        return;
      } else if (job.status === "running") {
        // Cron or another process is running - poll until done
        const poll = setInterval(() => {
          const j = getCrawlJob(jobId);
          if (!j) return;
          send("progress", {
            progress: j.progress,
            total: j.total_pages,
          });
          if (j.status === "completed" || j.status === "failed") {
            clearInterval(poll);
            send("done", { status: j.status, job: j });
            controller.close();
          }
        }, 2000);
        // Timeout after 5 min
        setTimeout(() => {
          clearInterval(poll);
          controller.close();
        }, 300000);
      } else {
        if (job.status === "pending" && !project.homepage_url) {
          addCrawlLog(job.id, "error", "Project has no homepage URL");
          failCrawlJob(job.id, "Project has no homepage URL");
          send("done", {
            status: "failed",
            job: getCrawlJob(job.id),
            error: "Project has no homepage URL",
          });
        } else {
          send("done", { status: job.status, job });
        }
      }
      controller.close();
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
