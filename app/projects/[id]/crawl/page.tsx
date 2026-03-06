"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Play, Link2, Clock, CheckCircle, XCircle, Loader2, RotateCw, Globe, Map } from "lucide-react";
import type { Project } from "@/lib/db";
import type { CrawlJob } from "@/lib/db";

function formatDuration(start: string | null, end: string | null): string {
  if (!start || !end) return "—";
  const a = new Date(start).getTime();
  const b = new Date(end).getTime();
  const sec = Math.round((b - a) / 1000);
  if (sec < 60) return `${sec}s`;
  return `${Math.floor(sec / 60)}m ${sec % 60}s`;
}

export default function CrawlPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [project, setProject] = useState<Project | null>(null);
  const [jobs, setJobs] = useState<CrawlJob[]>([]);
  const [manualUrls, setManualUrls] = useState<{ id: string; url: string; title: string | null }[]>([]);
  const [crawling, setCrawling] = useState(false);
  const [manualInput, setManualInput] = useState("");
  const [error, setError] = useState("");
  const [maxPages, setMaxPages] = useState(150);

  const CRAWL_LIMITS = [
    { value: 10, label: "10 URLs" },
    { value: 25, label: "25 URLs" },
    { value: 50, label: "50 URLs" },
    { value: 100, label: "100 URLs" },
    { value: 150, label: "150 URLs" },
    { value: 200, label: "200 URLs" },
  ];

  useEffect(() => {
    fetch(`/api/projects/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setProject)
      .catch(() => setProject(null));
  }, [id]);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/projects/${id}/crawl/jobs`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setJobs)
      .catch(() => setJobs([]));
    fetch(`/api/projects/${id}/manual-urls`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setManualUrls)
      .catch(() => setManualUrls([]));
  }, [id]);

  async function startCrawl() {
    if (!project?.homepage_url) {
      setError("Set homepage URL in project settings first");
      return;
    }
    setCrawling(true);
    setError("");
    try {
      const res = await fetch(`/api/projects/${id}/crawl`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runImmediately: false, maxPages }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Crawl failed");
      setJobs((prev) => [data, ...prev]);
      router.push(`/projects/${id}/crawl/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Crawl failed");
    } finally {
      setCrawling(false);
    }
  }

  async function addManualUrls() {
    const lines = manualInput
      .split("\n")
      .map((s) => s.trim())
      .filter((s) => s.startsWith("http"));
    if (lines.length === 0) {
      setError("Enter URLs (one per line)");
      return;
    }
    setError("");
    try {
      const res = await fetch(`/api/projects/${id}/manual-urls`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(lines.map((url) => ({ url }))),
      });
      const data = await res.json();
      if (Array.isArray(data)) setManualUrls(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add URLs");
    }
  }

  if (!project) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const statusIcon = (status: string) => {
    if (status === "completed") return <CheckCircle className="h-4 w-4" />;
    if (status === "failed") return <XCircle className="h-4 w-4" />;
    if (status === "running" || status === "pending") return <Loader2 className="h-4 w-4 animate-spin" />;
    return <Clock className="h-4 w-4" />;
  };

  return (
    <div className="w-full">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Crawl</h1>
        <p className="mt-1 text-muted-foreground">
          Discover pages from your site for content planning and internal linking.
        </p>
        {project.homepage_url && (
          <div className="mt-3 flex items-center gap-2 rounded-lg border bg-muted/30 px-4 py-2 text-sm">
            <Globe className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="text-muted-foreground">Target:</span>
            <a
              href={project.homepage_url}
              target="_blank"
              rel="noopener noreferrer"
              className="truncate font-medium text-primary hover:underline"
            >
              {project.homepage_url}
            </a>
          </div>
        )}
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid gap-8 xl:grid-cols-3">
        <div className="xl:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Auto crawl</CardTitle>
              <CardDescription>
                Crawl your website from the homepage. Works with or without a sitemap.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {project.homepage_url ? (
                <>
                  <div className="flex flex-wrap items-end gap-4">
                    <div className="space-y-2">
                      <Label>Max URLs to crawl</Label>
                      <Select value={String(maxPages)} onValueChange={(v) => setMaxPages(Number(v))}>
                        <SelectTrigger className="w-[140px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CRAWL_LIMITS.map((opt) => (
                            <SelectItem key={opt.value} value={String(opt.value)}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={() => startCrawl()} disabled={crawling}>
                        {crawling ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Starting...
                          </>
                        ) : (
                          <>
                            <Play className="mr-2 h-4 w-4" />
                            Start crawl
                          </>
                        )}
                      </Button>
                      <Button variant="secondary" onClick={() => startCrawl()} disabled={crawling}>
                        <RotateCw className="mr-2 h-4 w-4" />
                        Recrawl all
                      </Button>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    <strong>Start crawl</strong> discovers new pages.{" "}
                    <strong>Recrawl all</strong> fetches the entire site again and creates a new job.
                  </p>
                </>
              ) : (
                <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-400">
                  Add a homepage URL in project settings to enable auto crawl.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Manual URLs</CardTitle>
              <CardDescription>
                Add URLs manually if crawling does not work. Enter one URL per line.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>URLs (one per line)</Label>
                <Textarea
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  placeholder={"https://yoursite.com/page1\nhttps://yoursite.com/page2\nhttps://yoursite.com/page3"}
                  rows={8}
                  className="font-mono text-sm"
                />
              </div>
              <Button variant="secondary" onClick={addManualUrls}>
                <Link2 className="mr-2 h-4 w-4" />
                Add URLs
              </Button>
              {manualUrls.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <p className="mb-2 text-sm font-medium">{manualUrls.length} manual URLs</p>
                    <ul className="max-h-48 overflow-y-auto rounded-md border bg-muted/30 p-3 text-sm">
                      {manualUrls.map((u) => (
                        <li key={u.id} className="truncate py-1">
                          {u.title || u.url}
                        </li>
                      ))}
                    </ul>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        <div>
          <Card>
            <CardHeader>
              <CardTitle>Job history</CardTitle>
              <CardDescription>Click a job to view logs and crawled pages.</CardDescription>
            </CardHeader>
            <CardContent>
              {jobs.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">No crawl jobs yet.</p>
              ) : (
                <ul className="space-y-3">
                  {jobs.map((job) => (
                    <li key={job.id}>
                      <Link href={`/projects/${id}/crawl/${job.id}`}>
                        <div className="rounded-lg border p-4 transition-colors hover:bg-muted/50">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                {statusIcon(job.status)}
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
                                </Badge>
                                {job.source && (
                                  <Badge variant="outline" className="text-xs">
                                    {job.source}
                                  </Badge>
                                )}
                                {job.used_sitemap === 1 && (
                                  <span className="flex items-center gap-1 text-xs text-muted-foreground" title="Used sitemap">
                                    <Map className="h-3 w-3" />
                                    sitemap
                                  </span>
                                )}
                              </div>
                              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                                {job.total_found > 0 && (
                                  <span>{job.total_found} pages</span>
                                )}
                                {(job.started_at || job.completed_at) && (
                                  <span>
                                    {formatDuration(job.started_at ?? job.created_at, job.completed_at ?? new Date().toISOString())}
                                  </span>
                                )}
                              </div>
                              {job.error_message && (
                                <p className="mt-1 truncate text-xs text-destructive">
                                  {job.error_message}
                                </p>
                              )}
                            </div>
                            <span className="shrink-0 text-right text-xs text-muted-foreground">
                              {new Date(job.created_at).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
