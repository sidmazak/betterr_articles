"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Search, Calendar, FileText, Clock, DollarSign, TrendingUp, Trash2, History, Loader2, Settings } from "lucide-react";
import type { Project } from "@/lib/db";

type Stats = {
  total_words: number;
  total_articles: number;
  published_count: number;
  time_saved_hours: number;
  cost_savings: number;
  seo_topics?: string[];
  seo_keywords?: string[];
  seo_summary?: string | null;
  llm_requests: number;
  llm_prompt_tokens: number;
  llm_completion_tokens: number;
  llm_total_tokens: number;
};

type ProjectWithActiveCrawl = Project & {
  activeCrawlJob?: {
    id: string;
    status: string;
    progress: number;
    total_pages: number;
    current_stage?: string | null;
    current_url?: string | null;
    eta_seconds?: number | null;
    total_batches?: number;
    completed_batches?: number;
  } | null;
  activeCalendarJob?: {
    id: string;
    status: string;
    progress: number;
    total_steps: number;
    generated_items: number;
    total_items: number;
    current_stage?: string | null;
    current_message?: string | null;
    eta_seconds?: number | null;
    start_date?: string | null;
    end_date?: string | null;
    replace_existing?: boolean;
    append_existing?: boolean;
    whole_month?: boolean;
  } | null;
  hasCompletedCrawl?: boolean;
  pages_count?: number;
  seoInsight?: {
    summary?: string | null;
    topics?: string[];
    keywords?: string[];
    updated_at?: string;
  } | null;
  recentArticles?: Array<{
    id: string;
    title: string | null;
    status: string;
    published_url: string | null;
    updated_at: string;
  }>;
  promptOptimizationSettings?: {
    structured_data_format: "toon" | "json";
  };
};

export default function ProjectDashboardPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [project, setProject] = useState<ProjectWithActiveCrawl | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [llmConfigured, setLlmConfigured] = useState<boolean | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const calendarEventSourceRef = useRef<EventSource | null>(null);
  const autoCrawlStartedRef = useRef(false);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/projects/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setProject)
      .catch(() => setProject(null));
  }, [id]);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/projects/${id}/dashboard-stats`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setStats)
      .catch(() => setStats(null));
  }, [id]);

  useEffect(() => {
    fetch("/api/settings/llm")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setLlmConfigured(!!d?.default?.is_configured))
      .catch(() => setLlmConfigured(false));
  }, []);

  // Poll project when there's active async work to refresh progress
  useEffect(() => {
    if (!id || (!project?.activeCrawlJob && !project?.activeCalendarJob)) return;
    const interval = setInterval(() => {
      fetch(`/api/projects/${id}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((p) => {
          if (p && !p.activeCrawlJob && !p.activeCalendarJob) {
            setProject((prev) => (prev ? { ...prev, ...p } : p));
            clearInterval(interval);
          } else if (p) setProject(p);
        })
        .catch(() => {});
    }, 2000);
    return () => clearInterval(interval);
  }, [id, project?.activeCrawlJob, project?.activeCalendarJob]);

  // Auto-start crawl when entering dashboard with new site (homepage_url, no completed crawl)
  useEffect(() => {
    if (!id || !project || autoCrawlStartedRef.current) return;
    if (
      project.homepage_url &&
      !project.activeCrawlJob &&
      project.hasCompletedCrawl === false
    ) {
      autoCrawlStartedRef.current = true;
      fetch("/api/settings/llm")
        .then((r) => (r.ok ? r.json() : null))
        .then((llm) => {
          if (!llm?.default?.is_configured) {
            autoCrawlStartedRef.current = false;
            return;
          }
          return fetch(`/api/projects/${id}/crawl`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ runImmediately: false, maxPages: 10 }),
          });
        })
        .then((r) => (r?.json ? r.json() : Promise.resolve(r)))
        .then((job) => {
          if (!job?.id) return;
            setProject((prev) =>
              prev
                ? {
                    ...prev,
                    activeCrawlJob: {
                      id: job.id,
                      status: job.status,
                      progress: job.progress ?? 0,
                      total_pages: job.total_pages ?? 0,
                      current_stage: job.current_stage ?? null,
                      current_url: job.current_url ?? null,
                      eta_seconds: job.eta_seconds ?? null,
                      total_batches: job.total_batches ?? 0,
                      completed_batches: job.completed_batches ?? 0,
                    },
                  }
                : prev
            );
            const es = new EventSource(`/api/projects/${id}/crawl/${job.id}/stream`);
            eventSourceRef.current = es;
            es.addEventListener("progress", (e) => {
              const data = JSON.parse((e as MessageEvent).data);
              setProject((prev) => {
                if (!prev?.activeCrawlJob || prev.activeCrawlJob.id !== job.id)
                  return prev;
                const ac = prev.activeCrawlJob;
                return {
                  ...prev,
                  activeCrawlJob: {
                    ...ac,
                    progress: data.progress ?? ac.progress,
                    total_pages: data.total ?? ac.total_pages,
                    current_stage: data.stage ?? ac.current_stage,
                    current_url: data.url ?? ac.current_url,
                    eta_seconds: data.etaSeconds ?? ac.eta_seconds,
                    total_batches: data.totalBatches ?? ac.total_batches,
                    completed_batches: data.completedBatches ?? ac.completed_batches,
                  },
                };
              });
            });
            es.addEventListener("done", () => {
              es.close();
              eventSourceRef.current = null;
              fetch(`/api/projects/${id}`)
                .then((r) => (r.ok ? r.json() : null))
                .then(setProject)
                .catch(() => {});
            });
            es.onerror = () => {
              // Don't close - EventSource auto-reconnects. Only close on "done".
            };
        })
        .catch(() => {
          autoCrawlStartedRef.current = false;
        });
    }
  }, [id, project]);

  useEffect(() => {
    if (!id || !project?.activeCalendarJob?.id) return;
    if (
      project.activeCalendarJob.status === "completed" ||
      project.activeCalendarJob.status === "failed" ||
      project.activeCalendarJob.status === "cancelled"
    ) {
      return;
    }

    const jobId = project.activeCalendarJob.id;
    const es = new EventSource(`/api/projects/${id}/calendar/jobs/${jobId}/stream`);
    calendarEventSourceRef.current = es;

    es.addEventListener("progress", (e) => {
      const data = JSON.parse((e as MessageEvent).data);
      setProject((prev) => {
        if (!prev?.activeCalendarJob || prev.activeCalendarJob.id !== jobId) return prev;
        const job = prev.activeCalendarJob;
        return {
          ...prev,
          activeCalendarJob: {
            ...job,
            progress: data.progress ?? job.progress,
            total_steps: data.totalSteps ?? job.total_steps,
            generated_items: data.generatedItems ?? job.generated_items,
            total_items: data.totalItems ?? job.total_items,
            current_stage: data.stage ?? job.current_stage,
            current_message: data.message ?? job.current_message,
            eta_seconds: data.etaSeconds ?? job.eta_seconds,
            start_date: data.startDate ?? job.start_date,
            end_date: data.endDate ?? job.end_date,
            replace_existing: data.replaceExisting ?? job.replace_existing,
            append_existing: data.appendExisting ?? job.append_existing,
            whole_month: data.wholeMonth ?? job.whole_month,
            status: data.status ?? job.status,
          },
        };
      });
    });

    es.addEventListener("done", () => {
      es.close();
      calendarEventSourceRef.current = null;
      fetch(`/api/projects/${id}`)
        .then((r) => (r.ok ? r.json() : null))
        .then(setProject)
        .catch(() => {});
    });

    es.onerror = () => {
      // Don't close - EventSource auto-reconnects. Only close on "done".
    };

    return () => {
      es.close();
      calendarEventSourceRef.current = null;
    };
  }, [id, project?.activeCalendarJob?.id, project?.activeCalendarJob?.status]);

  useEffect(() => {
    return () => {
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
      calendarEventSourceRef.current?.close();
      calendarEventSourceRef.current = null;
    };
  }, []);

  async function deleteProject() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
      if (res.ok) {
        router.push("/");
      }
    } finally {
      setDeleting(false);
    }
  }

  if (!project) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const etaLabel =
    project.activeCrawlJob?.eta_seconds && project.activeCrawlJob.eta_seconds > 0
      ? project.activeCrawlJob.eta_seconds >= 60
        ? `Estimated time: ~${Math.ceil(project.activeCrawlJob.eta_seconds / 60)} min remaining`
        : `Estimated time: ~${project.activeCrawlJob.eta_seconds}s remaining`
      : "Estimated time: calculating...";
  const calendarEtaLabel =
    project.activeCalendarJob?.eta_seconds && project.activeCalendarJob.eta_seconds > 0
      ? project.activeCalendarJob.eta_seconds >= 60
        ? `Estimated time: ~${Math.ceil(project.activeCalendarJob.eta_seconds / 60)} min remaining`
        : `Estimated time: ~${project.activeCalendarJob.eta_seconds}s remaining`
      : "Estimated time: calculating...";

  return (
    <div className="w-full space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{project.name}</h1>
        <p className="mt-1 text-muted-foreground">
          {project.homepage_url ? (
            project.homepage_url
          ) : (
            <Link href={`/projects/${id}/settings/site`} className="text-primary hover:underline">
              Connect your site in Settings
            </Link>
          )}
        </p>
        {project.homepage_url && (
          <>
            <p className="mt-2 text-sm text-muted-foreground">
              New sites begin with a focused first crawl of up to <strong>10 pages</strong> so setup stays faster and more affordable. You can always run broader re-crawls later from the Crawl section.
            </p>
            {stats && (
              <p className="mt-2 text-sm text-muted-foreground">
                Crawl reference base: <strong>{project.pages_count?.toLocaleString() ?? 0} pages</strong> collected.
                {" "}AI usage so far: <strong>{stats.llm_total_tokens.toLocaleString()} tokens</strong> across{" "}
                <strong>{stats.llm_requests.toLocaleString()} requests</strong>
                {" "}({stats.llm_prompt_tokens.toLocaleString()} prompt / {stats.llm_completion_tokens.toLocaleString()} completion).
                {" "}Structured prompt mode:{" "}
                <strong>
                  {project.promptOptimizationSettings?.structured_data_format?.toUpperCase() ?? "TOON"}
                </strong>.
              </p>
            )}
          </>
        )}
      </div>

      {/* Setup messages */}
      {(!project.homepage_url || llmConfigured === false) && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium">Complete setup</p>
              <p className="text-sm text-muted-foreground">
                {!project.homepage_url && llmConfigured === false
                  ? "Add a homepage URL and configure your AI provider to enable crawling, content ideas, and article generation."
                  : !project.homepage_url
                    ? "Add a homepage URL in site settings to enable crawling."
                    : "Configure your AI provider in App Settings to enable content ideas and article generation."}
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              {!project.homepage_url && (
                <Link href={`/projects/${id}/settings/site`}>
                  <Button variant="outline" size="sm">
                    Site settings
                  </Button>
                </Link>
              )}
              {llmConfigured === false && (
                <Link href="/settings?tab=llm">
                  <Button size="sm">
                    <Settings className="mr-2 h-4 w-4" />
                    Configure AI
                  </Button>
                </Link>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active crawl progress */}
      {project.activeCrawlJob && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Loader2
                className={`h-5 w-5 shrink-0 text-primary ${project.activeCrawlJob.status === "paused" ? "" : "animate-spin"}`}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-primary">
                  {project.activeCrawlJob.status === "paused"
                    ? "Crawl paused"
                    : project.activeCrawlJob.progress > 0
                    ? `Crawling ${project.activeCrawlJob.progress}${project.activeCrawlJob.total_pages ? ` / ${project.activeCrawlJob.total_pages}` : ""} pages`
                    : "Starting crawl..."}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Stage: {project.activeCrawlJob.current_stage ?? "queued"}
                  {project.activeCrawlJob.current_url ? ` • ${project.activeCrawlJob.current_url}` : ""}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{etaLabel}</p>
                {project.activeCrawlJob.total_pages > 0 && (
                  <Progress
                    value={Math.round(
                      (project.activeCrawlJob.progress / project.activeCrawlJob.total_pages) * 100
                    )}
                    className="mt-2 h-2"
                  />
                )}
              </div>
              <Link href={`/projects/${id}/crawl/${project.activeCrawlJob.id}`}>
                <Button variant="outline" size="sm">
                  View details
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {project.activeCalendarJob && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Loader2
                className={`h-5 w-5 shrink-0 text-primary ${
                  project.activeCalendarJob.status === "running" ? "animate-spin" : ""
                }`}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-primary">
                  {project.activeCalendarJob.progress > 0 && project.activeCalendarJob.total_steps > 0
                    ? `Scheduling ideas ${project.activeCalendarJob.progress} / ${project.activeCalendarJob.total_steps}`
                    : "Starting content scheduling..."}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Stage: {project.activeCalendarJob.current_stage ?? "queued"}
                  {project.activeCalendarJob.current_message
                    ? ` • ${project.activeCalendarJob.current_message}`
                    : ""}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {calendarEtaLabel}
                  {project.activeCalendarJob.total_items > 0
                    ? ` • Ideas ${project.activeCalendarJob.generated_items}/${project.activeCalendarJob.total_items}`
                    : ""}
                </p>
                {project.activeCalendarJob.total_steps > 0 && (
                  <Progress
                    value={Math.round(
                      (project.activeCalendarJob.progress / project.activeCalendarJob.total_steps) * 100
                    )}
                    className="mt-2 h-2"
                  />
                )}
              </div>
              <Link href={`/projects/${id}/calendar`}>
                <Button variant="outline" size="sm">
                  View calendar
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* KPIs */}
      {stats && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total words written</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total_words.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Time saved</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.time_saved_hours} hrs</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Cost savings</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${stats.cost_savings.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">vs. human writer</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Published</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.published_count}</div>
              <p className="text-xs text-muted-foreground">of {stats.total_articles} articles</p>
            </CardContent>
          </Card>
        </div>
      )}

      {project.seoInsight && (project.seoInsight.topics?.length || project.seoInsight.keywords?.length) ? (
        <Card>
          <CardHeader>
            <CardTitle>SEO insights</CardTitle>
            <CardDescription>
              Latest extracted topics and keywords from your crawled content.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {project.seoInsight.summary && (
              <p className="text-sm text-muted-foreground">{project.seoInsight.summary}</p>
            )}
            {!!project.seoInsight.topics?.length && (
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Topics</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {project.seoInsight.topics.slice(0, 6).map((topic) => (
                    <span key={topic} className="rounded-full border px-2.5 py-1 text-xs">
                      {topic}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {!!project.seoInsight.keywords?.length && (
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Top keywords</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {project.seoInsight.keywords.slice(0, 8).map((keyword) => (
                    <span key={keyword} className="rounded-full bg-muted px-2.5 py-1 text-xs">
                      {keyword}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      {/* Quick actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick actions</CardTitle>
          <CardDescription>
            Crawl your site, manage content ideas, or view content history.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Link href={`/projects/${id}/crawl`}>
            <Card className="h-full transition-colors hover:border-primary/50 hover:bg-muted/30">
              <CardContent className="flex items-center gap-4 p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <Search className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">Crawl</p>
                  <p className="text-sm text-muted-foreground">Run the first 10-page crawl, then recrawl with a higher limit when you want deeper SEO coverage</p>
                </div>
              </CardContent>
            </Card>
          </Link>
          <Link href={`/projects/${id}/calendar`}>
            <Card className="h-full transition-colors hover:border-primary/50 hover:bg-muted/30">
              <CardContent className="flex items-center gap-4 p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <Calendar className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">Content calendar</p>
                  <p className="text-sm text-muted-foreground">AI-suggested content ideas</p>
                </div>
              </CardContent>
            </Card>
          </Link>
          <Link href={`/projects/${id}/content-history`}>
            <Card className="h-full transition-colors hover:border-primary/50 hover:bg-muted/30">
              <CardContent className="flex items-center gap-4 p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <History className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">Content history</p>
                  <p className="text-sm text-muted-foreground">Track articles and performance</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        </CardContent>
      </Card>

      {project.recentArticles && project.recentArticles.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent articles</CardTitle>
            <CardDescription>
              Jump back into recent drafts and published pieces.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {project.recentArticles.map((article) => (
              <div key={article.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4">
                <div>
                  <p className="font-medium">{article.title || "Untitled article"}</p>
                  <p className="text-sm text-muted-foreground">
                    {article.status} • {new Date(article.updated_at).toLocaleString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Link href={`/projects/${id}/articles/${article.id}`}>
                    <Button variant="outline" size="sm">Open</Button>
                  </Link>
                  {article.published_url && (
                    <a href={article.published_url} target="_blank" rel="noopener noreferrer">
                      <Button size="sm">View live</Button>
                    </a>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Danger zone */}
      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="text-destructive">Danger zone</CardTitle>
          <CardDescription>
            Permanently delete this site and all its data (crawls, search terms, content, articles).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={deleting}>
                <Trash2 className="mr-2 h-4 w-4" />
                Delete site
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete site?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete &quot;{project.name}&quot; and all associated data. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={deleteProject}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
}
