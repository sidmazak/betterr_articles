"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
import { ChevronDown, ChevronRight, Pencil, Plus, Trash2, RotateCw, Map, Clock, Search, Pause, Play, CircleSlash } from "lucide-react";
import type { Project } from "@/lib/db";
import type { CrawlJob, CrawlResultPageRow, CrawlJobLogRow } from "@/lib/db";

type PageSEOReference = {
  processed: boolean;
  topics: string[];
  keywords: string[];
  summary: string;
  entities: string[];
  questions: string[];
  painPoints: string[];
  contentAngles: string[];
  searchIntents: string[];
  productsServices: string[];
};

const EMPTY_PAGE_SEO_REFERENCE: PageSEOReference = {
  processed: false,
  topics: [],
  keywords: [],
  summary: "",
  entities: [],
  questions: [],
  painPoints: [],
  contentAngles: [],
  searchIntents: [],
  productsServices: [],
};

function parsePageSEOReference(value: string | null): PageSEOReference {
  if (!value) return EMPTY_PAGE_SEO_REFERENCE;

  try {
    const parsed = JSON.parse(value) as Partial<PageSEOReference> & {
      reference?: Partial<PageSEOReference>;
    };
    const nestedReference =
      parsed.reference && typeof parsed.reference === "object"
        ? (parsed.reference as Partial<PageSEOReference>)
        : null;
    return {
      processed: true,
      topics: normalizeSeoArray(parsed.topics),
      keywords: normalizeSeoArray(parsed.keywords),
      summary: typeof parsed.summary === "string" ? parsed.summary.trim() : "",
      entities: normalizeSeoArray(parsed.entities ?? nestedReference?.entities),
      questions: normalizeSeoArray(parsed.questions ?? nestedReference?.questions),
      painPoints: normalizeSeoArray(parsed.painPoints ?? nestedReference?.painPoints),
      contentAngles: normalizeSeoArray(parsed.contentAngles ?? nestedReference?.contentAngles),
      searchIntents: normalizeSeoArray(parsed.searchIntents ?? nestedReference?.searchIntents),
      productsServices: normalizeSeoArray(parsed.productsServices ?? nestedReference?.productsServices),
    };
  } catch {
    return EMPTY_PAGE_SEO_REFERENCE;
  }
}

function normalizeSeoArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function mergeCrawlPage(
  existing: CrawlResultPageRow | undefined,
  incoming: CrawlResultPageRow
): CrawlResultPageRow {
  if (!existing) return incoming;

  return {
    ...existing,
    ...incoming,
    title: incoming.title ?? existing.title,
    meta_description: incoming.meta_description ?? existing.meta_description,
    content_preview: incoming.content_preview ?? existing.content_preview,
    status_code: incoming.status_code ?? existing.status_code,
    seo_reference_json: incoming.seo_reference_json ?? existing.seo_reference_json,
    created_at: incoming.created_at ?? existing.created_at,
  };
}

function mergeCrawlPages(
  currentPages: CrawlResultPageRow[],
  incomingPages: CrawlResultPageRow[]
): CrawlResultPageRow[] {
  if (incomingPages.length === 0) return currentPages;

  const currentByKey = new globalThis.Map<string, CrawlResultPageRow>();
  for (const page of currentPages) {
    currentByKey.set(page.id ?? page.url, page);
    currentByKey.set(page.url, page);
  }

  const merged = incomingPages.map((incomingPage) =>
    mergeCrawlPage(
      currentByKey.get(incomingPage.id ?? incomingPage.url) ?? currentByKey.get(incomingPage.url),
      incomingPage
    )
  );

  const incomingKeys = new Set(
    incomingPages.flatMap((page) => [page.id ?? page.url, page.url])
  );

  for (const page of currentPages) {
    const pageKeys = [page.id ?? page.url, page.url];
    if (pageKeys.some((key) => incomingKeys.has(key))) continue;
    merged.push(page);
  }

  return merged;
}

export default function CrawlJobStreamPage() {
  const params = useParams();
  const id = params.id as string;
  const jobId = params.jobId as string;
  const [project, setProject] = useState<Project | null>(null);
  const [job, setJob] = useState<CrawlJob | null>(null);
  const [logs, setLogs] = useState<CrawlJobLogRow[]>([]);
  const [pages, setPages] = useState<CrawlResultPageRow[]>([]);
  const [insight, setInsight] = useState<{ topics?: string[]; keywords?: string[]; summary?: string | null } | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [pageSearch, setPageSearch] = useState("");
  const eventSourceRef = useRef<EventSource | null>(null);

  const filteredPages = pageSearch.trim()
    ? pages.filter(
        (p) =>
          (p.url?.toLowerCase().includes(pageSearch.toLowerCase()) ?? false) ||
          (p.title?.toLowerCase().includes(pageSearch.toLowerCase()) ?? false) ||
          (p.meta_description?.toLowerCase().includes(pageSearch.toLowerCase()) ?? false)
      )
    : pages;

  function formatDuration(start: string | null, end: string | null): string {
    if (!start || !end) return "—";
    const a = new Date(start).getTime();
    const b = new Date(end).getTime();
    const sec = Math.round((b - a) / 1000);
    if (sec < 60) return `${sec}s`;
    return `${Math.floor(sec / 60)}m ${sec % 60}s`;
  }

  useEffect(() => {
    fetch(`/api/projects/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setProject)
      .catch(() => setProject(null));
  }, [id]);

  useEffect(() => {
    if (!id || !jobId) return;
    fetch(`/api/projects/${id}/crawl/${jobId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          setJob(data);
          setLogs(data.logs ?? []);
          setPages((prev) => mergeCrawlPages(prev, data.pages ?? []));
          setInsight(data.insight ?? null);
        }
      })
      .catch(() => setJob(null));
  }, [id, jobId]);

  // Poll for logs while crawl is in progress (fallback + when cron runs the job)
  useEffect(() => {
    if (!id || !jobId || !job) return;
    if (job.status === "completed" || job.status === "failed" || job.status === "cancelled") return;

    const poll = () => {
      fetch(`/api/projects/${id}/crawl/${jobId}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (d?.logs?.length) setLogs(d.logs);
          if (d?.pages?.length) {
            setPages((prev) => mergeCrawlPages(prev, d.pages));
          }
          setInsight(d?.insight ?? null);
          if (d) setJob(d);
        })
        .catch(() => {});
    };

    const interval = setInterval(poll, 1500);
    return () => clearInterval(interval);
  }, [id, jobId, job?.status]);

  useEffect(() => {
    if (!id || !jobId || !job) return;
    if (job.status === "completed" || job.status === "failed" || job.status === "cancelled") return;

    const es = new EventSource(`/api/projects/${id}/crawl/${jobId}/stream`);
    eventSourceRef.current = es;

    es.addEventListener("open", () => setStreaming(true));
    es.addEventListener("progress", (e) => {
      const data = JSON.parse((e as MessageEvent).data);
      setJob((prev) =>
        prev
          ? {
              ...prev,
              progress: data.progress ?? prev.progress,
              total_pages: data.total ?? prev.total_pages,
              current_stage: data.stage ?? prev.current_stage,
              current_url: data.url ?? prev.current_url,
              eta_seconds: data.etaSeconds ?? prev.eta_seconds,
              completed_batches: data.completedBatches ?? prev.completed_batches,
              total_batches: data.totalBatches ?? prev.total_batches,
            }
          : prev
      );
    });

    es.addEventListener("page", (e) => {
      const data = JSON.parse((e as MessageEvent).data) as { page?: CrawlResultPageRow };
      const updatedPage = data.page;
      if (!updatedPage) return;
      setPages((prev) => {
        const index = prev.findIndex(
          (p) => p.id === updatedPage.id || p.url === updatedPage.url
        );
        if (index === -1) {
          return [...prev, updatedPage];
        }
        const next = [...prev];
        next[index] = mergeCrawlPage(next[index], updatedPage);
        return next;
      });
    });

    es.addEventListener("log", (e) => {
      const data = JSON.parse((e as MessageEvent).data);
      setLogs((prev) => [
        ...prev,
        {
          id: `log-${Date.now()}-${prev.length}`,
          level: data.level ?? "info",
          message: data.message ?? "",
          stage: data.stage ?? null,
          details: data.details ? JSON.stringify(data.details) : null,
          created_at: new Date().toISOString(),
        } as CrawlJobLogRow,
      ]);
    });

    es.addEventListener("done", (e) => {
      const data = JSON.parse((e as MessageEvent).data);
      setJob(data.job);
      setStreaming(false);
      es.close();
      eventSourceRef.current = null;
      if (data.job) {
        fetch(`/api/projects/${id}/crawl/${jobId}`)
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => {
            if (d) {
              setLogs(d.logs ?? []);
              if (d.pages?.length) {
                setPages((prev) => mergeCrawlPages(prev, d.pages));
              }
              setInsight(d.insight ?? null);
            }
          });
      }
    });

    es.onerror = () => {
      setStreaming(false);
      // Don't close - EventSource auto-reconnects. Only close on "done".
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [id, jobId, job?.status]);

  if (!project) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  async function updateJob(action: "pause" | "resume" | "cancel") {
    const res = await fetch(`/api/projects/${id}/crawl/${jobId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const data = await res.json();
    if (res.ok) {
      setJob(data);
    }
  }

  const etaLabel =
    job?.eta_seconds && job.eta_seconds > 0
      ? job.eta_seconds >= 60
        ? `Estimated time: ~${Math.ceil(job.eta_seconds / 60)} min remaining`
        : `Estimated time: ~${job.eta_seconds}s remaining`
      : "Estimated time: calculating...";

  return (
    <div className="w-full">
      <div className="mb-8">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight">Crawl job</h1>
          {job && (
            <Badge
              variant={
                job.status === "completed"
                  ? "default"
                  : job.status === "failed"
                    ? "destructive"
                    : "secondary"
              }
            >
              {job.status}
              {streaming && " (streaming)"}
            </Badge>
          )}
        </div>
        <p className="text-muted-foreground">{project.name}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Review the full crawl timeline here: page discovery, crawl progress, extracted SEO insights, and any retries, pauses, or cancellations.
        </p>
      </div>

      {job?.error_message && (
        <div className="mb-6 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {job.error_message}
        </div>
      )}

      {job && (job.status === "running" || job.status === "pending") && (
        <div className="mb-6 space-y-2 rounded-lg border border-primary/30 bg-primary/5 p-4">
          <p className="text-sm text-primary">
            {job.progress > 0
              ? `Crawling... ${job.progress}${job.total_pages ? ` / ${job.total_pages}` : ""} pages`
              : "Starting crawl..."}
          </p>
          <p className="text-xs text-muted-foreground">
            Stage: {job.current_stage ?? job.status}
            {job.current_url ? ` • ${job.current_url}` : ""}
          </p>
          <p className="text-xs text-muted-foreground">
            {etaLabel}
            {!!job.total_batches && ` • AI batches ${job.completed_batches ?? 0}/${job.total_batches}`}
          </p>
          <p className="text-xs text-muted-foreground">
            This job preserves partial progress, so you can pause, resume, or cancel without losing the pages and logs collected so far.
          </p>
          {job.total_pages && job.total_pages > 0 && (
            <Progress
              value={Math.round((job.progress / job.total_pages) * 100)}
              className="h-2"
            />
          )}
          <div className="flex gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => updateJob("pause")}>
              <Pause className="mr-2 h-4 w-4" />
              Pause
            </Button>
            <Button variant="outline" size="sm" onClick={() => updateJob("cancel")}>
              <CircleSlash className="mr-2 h-4 w-4" />
              Cancel
            </Button>
          </div>
        </div>
      )}

      {job?.status === "paused" && (
        <div className="mb-6 space-y-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
          <p className="text-sm font-medium text-amber-700 dark:text-amber-400">Crawl paused</p>
          <p className="text-xs text-muted-foreground">
            Resume when ready. Progress, collected pages, extracted data, and logs all stay attached to this crawl job.
          </p>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => updateJob("resume")}>
              <Play className="mr-2 h-4 w-4" />
              Resume
            </Button>
            <Button variant="outline" size="sm" onClick={() => updateJob("cancel")}>
              <CircleSlash className="mr-2 h-4 w-4" />
              Cancel
            </Button>
          </div>
        </div>
      )}

      {job && (job.status === "completed" || job.status === "failed" || job.status === "cancelled") && (
        <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border bg-muted/30 px-4 py-3">
            <p className="text-xs font-medium text-muted-foreground">Source</p>
            <p className="mt-1 text-sm font-medium">{job.source ?? "auto"}</p>
          </div>
          <div className="rounded-lg border bg-muted/30 px-4 py-3">
            <p className="text-xs font-medium text-muted-foreground">Max pages</p>
            <p className="mt-1 text-sm font-medium">{job.max_pages ?? "—"}</p>
          </div>
          <div className="rounded-lg border bg-muted/30 px-4 py-3">
            <p className="text-xs font-medium text-muted-foreground">Sitemap</p>
            <p className="mt-1 flex items-center gap-1 text-sm font-medium">
              {job.used_sitemap === 1 ? (
                <>
                  <Map className="h-4 w-4 text-green-600" />
                  Used
                </>
              ) : (
                "Not used"
              )}
            </p>
          </div>
          <div className="rounded-lg border bg-muted/30 px-4 py-3">
            <p className="text-xs font-medium text-muted-foreground">Duration</p>
            <p className="mt-1 flex items-center gap-1 text-sm font-medium">
              <Clock className="h-4 w-4" />
              {formatDuration(job.started_at ?? job.created_at, job.completed_at ?? new Date().toISOString())}
            </p>
          </div>
        </div>
      )}

      {insight && (insight.topics?.length || insight.keywords?.length) ? (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Extracted SEO insights</CardTitle>
            <CardDescription>
              Topics, keyword phrases, and summary signals pulled from the pages collected in this crawl job.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {insight.summary && (
              <p className="text-sm text-muted-foreground">{insight.summary}</p>
            )}
            {!!insight.topics?.length && (
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Topics</p>
                <div className="flex flex-wrap gap-2">
                  {insight.topics.slice(0, 12).map((topic) => (
                    <Badge key={topic} variant="outline" className="font-normal">
                      {topic}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {!!insight.keywords?.length && (
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Keywords</p>
                <div className="flex flex-wrap gap-2">
                  {insight.keywords.slice(0, 20).map((keyword) => (
                    <Badge key={keyword} variant="secondary" className="font-normal">
                      {keyword}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      <div className="space-y-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Crawled pages</CardTitle>
              <CardDescription>
                {pages.length} pages found
                {pageSearch.trim() && ` (${filteredPages.length} match)`}
              </CardDescription>
            </div>
            <AddPageButton
              jobId={jobId}
              projectId={id}
              onAdded={(p) => setPages((prev) => [...prev, p])}
            />
          </CardHeader>
          <CardContent>
            {pages.length > 0 && (
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search pages by URL, title, or description..."
                  value={pageSearch}
                  onChange={(e) => setPageSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            )}
            {pages.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {job?.status === "completed" || job?.status === "failed"
                  ? "No pages found. Add one manually below."
                  : "Pages will appear as crawl progresses."}
              </p>
            ) : filteredPages.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No pages match your search.</p>
            ) : (
              <ul className="max-h-[500px] space-y-3 overflow-y-auto">
                {filteredPages.map((p, idx) => (
                  <PageCard
                    key={p.id ?? p.url ?? idx}
                    page={p}
                    projectId={id}
                    jobId={jobId}
                    isExtracting={
                      !!job &&
                      (job.status === "running" || job.status === "pending") &&
                      job.current_stage === "extracting" &&
                      job.current_url === p.url
                    }
                    onUpdate={(updated) =>
                      setPages((prev) =>
                        prev.map((x) => (x.url === p.url ? { ...x, ...updated } : x))
                      )
                    }
                    onDelete={() =>
                      setPages((prev) => prev.filter((x) => (x.id ?? x.url) !== (p.id ?? p.url)))
                    }
                  />
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Logs</CardTitle>
            <CardDescription>
              Detailed crawl and AI-processing events, including stages, retries, extraction progress, and completion details.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {logs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No logs yet. Logs stream as crawl progresses.</p>
            ) : (
              <ul className="max-h-[400px] space-y-1 overflow-y-auto font-mono text-xs">
                {logs.map((log) => (
                  <li
                    key={log.id}
                    className={`flex gap-2 py-1 ${
                      log.level === "error"
                        ? "text-destructive"
                        : log.level === "warn"
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-muted-foreground"
                    }`}
                  >
                    <span className="shrink-0 text-muted-foreground/70">
                      {log.created_at ? new Date(log.created_at).toLocaleTimeString() : ""}
                    </span>
                    <span>
                      [{log.level}]
                      {log.stage ? ` [${log.stage}]` : ""} {log.message}
                      {log.details ? ` ${log.details}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function PageCard({
  page,
  projectId,
  jobId,
  isExtracting,
  onUpdate,
  onDelete,
}: {
  page: CrawlResultPageRow;
  projectId: string;
  jobId: string;
  isExtracting: boolean;
  onUpdate: (updates: Partial<CrawlResultPageRow>) => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [title, setTitle] = useState(page.title ?? "");
  const [metaDesc, setMetaDesc] = useState(page.meta_description ?? "");
  const [content, setContent] = useState(page.content_preview ?? "");
  const [saving, setSaving] = useState(false);
  const [recrawling, setRecrawling] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const seoReference = parsePageSEOReference(page.seo_reference_json);
  const extractionCompleted = seoReference.processed || page.seo_reference_json !== null;
  const hasSeoReference =
    seoReference.topics.length > 0 ||
    seoReference.keywords.length > 0 ||
    seoReference.summary.length > 0 ||
    seoReference.entities.length > 0 ||
    seoReference.questions.length > 0 ||
    seoReference.painPoints.length > 0 ||
    seoReference.contentAngles.length > 0 ||
    seoReference.searchIntents.length > 0 ||
    seoReference.productsServices.length > 0;

  useEffect(() => {
    if (editOpen) {
      setTitle(page.title ?? "");
      setMetaDesc(page.meta_description ?? "");
      setContent(page.content_preview ?? "");
    }
  }, [editOpen, page.title, page.meta_description, page.content_preview]);

  const pageId = page.id;
  const canEdit = !!pageId;

  async function handleSave() {
    if (!canEdit) return;
    setSaving(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/crawl/${jobId}/pages/${pageId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: title || undefined,
            meta_description: metaDesc || undefined,
            content_preview: content || undefined,
          }),
        }
      );
      if (res.ok) {
        const updated = await res.json();
        onUpdate(updated);
        setEditOpen(false);
      }
    } catch {
      // Ignore - user can retry
    } finally {
      setSaving(false);
    }
  }

  async function handleRecrawl() {
    if (!canEdit) return;
    setRecrawling(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/crawl/${jobId}/pages/${pageId}/recrawl`,
        { method: "POST" }
      );
      if (res.ok) {
        const updated = await res.json();
        onUpdate(updated);
      }
    } finally {
      setRecrawling(false);
    }
  }

  async function handleDelete() {
    if (!canEdit) return;
    setDeleting(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/crawl/${jobId}/pages/${pageId}`,
        { method: "DELETE" }
      );
      if (res.ok) onDelete();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <li className="rounded-lg border bg-card transition-colors hover:bg-muted/30">
        <CollapsibleTrigger asChild>
          <div className="flex cursor-pointer items-start gap-2 p-4 text-left">
            <span className="mt-0.5 shrink-0">
              {open ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <a
                href={page.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-sm font-medium text-primary hover:underline break-all"
              >
                {page.url}
              </a>
              {page.title && (
                <p className="mt-1 text-sm font-medium text-foreground">{page.title}</p>
              )}
              {page.meta_description && (
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                  {page.meta_description}
                </p>
              )}
              {!open && page.content_preview && (
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                  {page.content_preview}
                </p>
              )}
              {page.status_code != null && (
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge variant="outline" className="text-xs">
                    {page.status_code}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={
                      hasSeoReference
                        ? "border-green-500/30 bg-green-500/10 text-green-700 dark:border-green-500/30 dark:bg-green-500/10 dark:text-green-400"
                        : extractionCompleted
                          ? "border-slate-500/30 bg-slate-500/10 text-slate-700 dark:border-slate-500/30 dark:bg-slate-500/10 dark:text-slate-300"
                        : isExtracting
                          ? "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-400"
                        : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400"
                    }
                  >
                    {hasSeoReference
                      ? "Data extracted"
                      : extractionCompleted
                        ? "Extraction complete"
                      : isExtracting
                        ? "Extracting now..."
                        : "Extraction pending"}
                  </Badge>
                </div>
              )}
              {hasSeoReference && !open && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {seoReference.topics.slice(0, 2).map((topic) => (
                    <Badge key={topic} variant="secondary" className="font-normal">
                      {topic}
                    </Badge>
                  ))}
                  {seoReference.keywords.slice(0, 3).map((keyword) => (
                    <Badge key={keyword} variant="outline" className="font-normal">
                      {keyword}
                    </Badge>
                  ))}
                  {seoReference.entities.slice(0, 3).map((entity) => (
                    <Badge key={entity} variant="secondary" className="font-normal">
                      {entity}
                    </Badge>
                  ))}
                  {seoReference.searchIntents.slice(0, 2).map((intent) => (
                    <Badge key={intent} variant="outline" className="font-normal">
                      {intent}
                    </Badge>
                  ))}
                  {seoReference.questions.length > 0 && (
                    <Badge variant="outline" className="font-normal">
                      {seoReference.questions.length} questions
                    </Badge>
                  )}
                </div>
              )}
            </div>
            {canEdit && (
              <div className="flex shrink-0 gap-1" onClick={(e) => e.stopPropagation()}>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleRecrawl}
                  disabled={recrawling}
                  title="Recrawl this URL"
                >
                  {recrawling ? (
                    <RotateCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <RotateCw className="h-4 w-4" />
                  )}
                </Button>
                <Dialog open={editOpen} onOpenChange={setEditOpen}>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="icon" title="Edit">
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </DialogTrigger>
                <DialogContent
                  onClick={(e) => e.stopPropagation()}
                  className="max-h-[90vh] max-w-2xl flex flex-col"
                >
                  <DialogHeader className="shrink-0">
                    <DialogTitle>Edit page content</DialogTitle>
                    <DialogDescription>
                      Update title, meta description, or content preview for this page.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="min-h-0 flex-1 space-y-4 overflow-y-auto py-4">
                    <div className="space-y-2">
                      <Label>URL</Label>
                      <p className="text-sm text-muted-foreground break-all">{page.url}</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Title</Label>
                      <Input
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Page title"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Meta description</Label>
                      <Input
                        value={metaDesc}
                        onChange={(e) => setMetaDesc(e.target.value)}
                        placeholder="Meta description"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Content preview</Label>
                      <Textarea
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        placeholder="Content preview (first ~2000 chars)"
                        className="min-h-[120px] max-h-[300px] resize-y font-mono text-xs"
                      />
                    </div>
                  </div>
                  <DialogFooter className="shrink-0 border-t pt-4">
                    <Button variant="outline" onClick={() => setEditOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={saving}>
                      {saving ? "Saving..." : "Save"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={deleting}
                      title="Delete page"
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete this page?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Remove this page from the crawl results. This cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDelete}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="space-y-4 border-t px-4 py-3 pl-12">
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Content preview
              </p>
              {page.content_preview ? (
                <pre className="whitespace-pre-wrap wrap-break-word font-mono text-xs text-muted-foreground">
                  {page.content_preview}
                </pre>
              ) : (
                <p className="text-xs text-muted-foreground">No content preview.</p>
              )}
            </div>

            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Extracted data
              </p>
              {hasSeoReference ? (
                <div className="space-y-3">
                  {seoReference.summary && (
                    <div>
                      <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        Summary
                      </p>
                      <p className="text-xs text-muted-foreground">{seoReference.summary}</p>
                    </div>
                  )}
                  <SeoReferenceGroup label="Topics" items={seoReference.topics} variant="secondary" />
                  <SeoReferenceGroup label="Keywords" items={seoReference.keywords} variant="outline" />
                  <SeoReferenceGroup label="Entities" items={seoReference.entities} variant="secondary" />
                  <SeoReferenceGroup label="Products & services" items={seoReference.productsServices} variant="secondary" />
                  <SeoReferenceGroup label="Search intents" items={seoReference.searchIntents} variant="outline" />
                  <SeoReferenceGroup label="Pain points" items={seoReference.painPoints} variant="outline" />
                  <SeoReferenceGroup label="Content angles" items={seoReference.contentAngles} variant="outline" />
                  <SeoReferenceGroup label="Questions" items={seoReference.questions} variant="outline" />
                </div>
              ) : extractionCompleted ? (
                <p className="text-xs text-muted-foreground">
                  Extraction completed for this URL, but the AI did not return any structured topics, keywords, or entities for this page. Check the terminal logs for the raw extraction response and parsing details.
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Extraction data is not available for this URL yet. It will appear here after the page is processed by the extraction step. You can also use the recrawl button on this card to refresh it.
                </p>
              )}
            </div>
          </div>
        </CollapsibleContent>
      </li>
    </Collapsible>
  );
}

function SeoReferenceGroup({
  label,
  items,
  variant,
}: {
  label: string;
  items: string[];
  variant: "outline" | "secondary";
}) {
  if (items.length === 0) return null;

  return (
    <div>
      <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <Badge key={item} variant={variant} className="font-normal">
            {item}
          </Badge>
        ))}
      </div>
    </div>
  );
}

function AddPageButton({
  jobId,
  projectId,
  onAdded,
}: {
  jobId: string;
  projectId: string;
  onAdded: (page: CrawlResultPageRow) => void;
}) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleAdd() {
    if (!url.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/crawl/${jobId}/pages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: url.trim(),
          title: title.trim() || undefined,
          content_preview: content.trim() || undefined,
        }),
      });
      if (res.ok) {
        const page = await res.json();
        onAdded(page);
        setUrl("");
        setTitle("");
        setContent("");
        setOpen(false);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="mr-2 h-4 w-4" />
          Add page
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add page manually</DialogTitle>
          <DialogDescription>
            Add a page URL with optional title and content. Useful when crawl misses a page.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>URL *</Label>
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/page"
            />
          </div>
          <div className="space-y-2">
            <Label>Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Page title"
            />
          </div>
          <div className="space-y-2">
            <Label>Content preview</Label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Paste or type content (optional)"
              className="min-h-[120px]"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleAdd} disabled={saving || !url.trim()}>
            {saving ? "Adding..." : "Add page"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
