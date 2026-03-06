"use client";

import { useEffect, useState, useRef } from "react";
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
import { ChevronDown, ChevronRight, Pencil, Plus, Trash2, RotateCw, Map, Clock, Search } from "lucide-react";
import type { Project } from "@/lib/db";
import type { CrawlJob, CrawlResultPageRow, CrawlJobLogRow } from "@/lib/db";

export default function CrawlJobStreamPage() {
  const params = useParams();
  const id = params.id as string;
  const jobId = params.jobId as string;
  const [project, setProject] = useState<Project | null>(null);
  const [job, setJob] = useState<CrawlJob | null>(null);
  const [logs, setLogs] = useState<CrawlJobLogRow[]>([]);
  const [pages, setPages] = useState<CrawlResultPageRow[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [pageSearch, setPageSearch] = useState("");
  const eventSourceRef = useRef<EventSource | null>(null);
  const logsEndRef = useRef<HTMLDivElement | null>(null);

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
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

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
          setPages(data.pages ?? []);
        }
      })
      .catch(() => setJob(null));
  }, [id, jobId]);

  // Poll for logs while crawl is in progress (fallback + when cron runs the job)
  useEffect(() => {
    if (!id || !jobId || !job) return;
    if (job.status === "completed" || job.status === "failed") return;

    const poll = () => {
      fetch(`/api/projects/${id}/crawl/${jobId}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (d?.logs?.length) setLogs(d.logs);
          if (d?.pages?.length) setPages(d.pages);
          if (d) setJob(d);
        })
        .catch(() => {});
    };

    const interval = setInterval(poll, 1500);
    return () => clearInterval(interval);
  }, [id, jobId, job?.status]);

  useEffect(() => {
    if (!id || !jobId || !job) return;
    if (job.status === "completed" || job.status === "failed") return;

    setStreaming(true);
    const es = new EventSource(`/api/projects/${id}/crawl/${jobId}/stream`);
    eventSourceRef.current = es;

    es.addEventListener("progress", (e) => {
      const data = JSON.parse((e as MessageEvent).data);
      setJob((prev) =>
        prev ? { ...prev, progress: data.progress, total_pages: data.total } : prev
      );
    });

    es.addEventListener("log", (e) => {
      const data = JSON.parse((e as MessageEvent).data);
      setLogs((prev) => [
        ...prev,
        {
          id: `log-${Date.now()}-${prev.length}`,
          level: data.level ?? "info",
          message: data.message ?? "",
          created_at: new Date().toISOString(),
        } as CrawlJobLogRow,
      ]);
    });

    es.addEventListener("done", (e) => {
      const data = JSON.parse((e as MessageEvent).data);
      setJob(data.job);
      setPages(data.pages ?? []);
      setStreaming(false);
      es.close();
      eventSourceRef.current = null;
      if (data.job) {
        fetch(`/api/projects/${id}/crawl/${jobId}`)
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => {
            if (d) {
              setLogs(d.logs ?? []);
              if (d.pages?.length) setPages(d.pages);
            }
          });
      }
    });

    es.onerror = () => {
      setStreaming(false);
      es.close();
      eventSourceRef.current = null;
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
          {job.total_pages && job.total_pages > 0 && (
            <Progress
              value={Math.round((job.progress / job.total_pages) * 100)}
              className="h-2"
            />
          )}
        </div>
      )}

      {job && (job.status === "completed" || job.status === "failed") && (
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
            <CardDescription>Crawl process logs</CardDescription>
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
                      [{log.level}] {log.message}
                    </span>
                  </li>
                ))}
                <div ref={logsEndRef} />
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
  onUpdate,
  onDelete,
}: {
  page: CrawlResultPageRow;
  projectId: string;
  jobId: string;
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
                <Badge variant="outline" className="mt-2 text-xs">
                  {page.status_code}
                </Badge>
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
          <div className="border-t px-4 py-3 pl-12">
            {page.content_preview ? (
              <pre className="whitespace-pre-wrap break-words font-mono text-xs text-muted-foreground">
                {page.content_preview}
              </pre>
            ) : (
              <p className="text-xs text-muted-foreground">No content preview.</p>
            )}
          </div>
        </CollapsibleContent>
      </li>
    </Collapsible>
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
