"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Play, Link2, Clock, CheckCircle, XCircle, Loader2, RotateCw, Globe, Map, Sparkles, Pause, CircleSlash } from "lucide-react";
import { Progress } from "@/components/ui/progress";
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
  const [maxPages, setMaxPages] = useState(10);
  const [customMaxPages, setCustomMaxPages] = useState("");
  const [sitemapUrl, setSitemapUrl] = useState("");
  const [savedKeywords, setSavedKeywords] = useState<{ id: string; keyword: string }[]>([]);
  const [latestInsight, setLatestInsight] = useState<{ topics?: string[]; keywords?: string[]; summary?: string | null } | null>(null);
  const [showAllTopics, setShowAllTopics] = useState(false);
  const [showAllKeywords, setShowAllKeywords] = useState(false);
  const [activeCrawlJob, setActiveCrawlJob] = useState<{
    id: string;
    status: string;
    progress: number;
    total_pages: number;
    current_stage?: string | null;
    current_url?: string | null;
    eta_seconds?: number | null;
    total_batches?: number;
    completed_batches?: number;
  } | null>(null);
  const [aiConfigured, setAiConfigured] = useState<boolean | null>(null);

  const CRAWL_LIMITS = [
    { value: 10, label: "10 URLs" },
    { value: 25, label: "25 URLs" },
    { value: 50, label: "50 URLs" },
    { value: 100, label: "100 URLs" },
    { value: 150, label: "150 URLs" },
    { value: 200, label: "200 URLs" },
    { value: 500, label: "500 URLs" },
  ];

  function loadSearchTerms() {
    fetch(`/api/projects/${id}/extract-keywords`)
      .then((r) => (r.ok ? r.json() : { keywords: [], insight: null }))
      .then((data) => {
        setSavedKeywords(data?.keywords ?? []);
        setLatestInsight(data?.insight ?? null);
      })
      .catch(() => {
        setSavedKeywords([]);
        setLatestInsight(null);
      });
  }

  useEffect(() => {
    fetch(`/api/projects/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((p) => {
        setProject(p);
        if (p?.sitemap_url) setSitemapUrl(p.sitemap_url);
        setActiveCrawlJob(p?.activeCrawlJob ?? null);
      })
      .catch(() => setProject(null));
  }, [id]);

  useEffect(() => {
    fetch("/api/settings/llm")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setAiConfigured(!!data?.default?.is_configured))
      .catch(() => setAiConfigured(false));
  }, []);

  // Poll project when there's an active crawl to show progress
  useEffect(() => {
    if (!id || !activeCrawlJob) return;
    const interval = setInterval(() => {
      fetch(`/api/projects/${id}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((p) => {
          if (p?.activeCrawlJob) setActiveCrawlJob(p.activeCrawlJob);
          else setActiveCrawlJob(null);
        })
        .catch(() => {});
    }, 2000);
    return () => clearInterval(interval);
  }, [id, activeCrawlJob?.id]);

  useEffect(() => {
    if (!id) return;
    const loadJobs = () =>
      fetch(`/api/projects/${id}/crawl/jobs`)
        .then((r) => (r.ok ? r.json() : []))
        .then(setJobs)
        .catch(() => setJobs([]));
    loadJobs();
    if (activeCrawlJob) {
      const interval = setInterval(loadJobs, 2000);
      return () => clearInterval(interval);
    }
  }, [id, activeCrawlJob?.id]);
  useEffect(() => {
    if (!id) return;
    fetch(`/api/projects/${id}/manual-urls`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setManualUrls)
      .catch(() => setManualUrls([]));
    loadSearchTerms();
  }, [id]);

  useEffect(() => {
    if (!id || !activeCrawlJob) return;
    const interval = setInterval(loadSearchTerms, 3000);
    return () => clearInterval(interval);
  }, [id, activeCrawlJob?.id]);

  const effectiveMaxPages = customMaxPages.trim()
    ? Math.min(1000, Math.max(1, parseInt(customMaxPages, 10) || 10))
    : maxPages;

  async function saveSitemap() {
    if (!id) return;
    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sitemapUrl: sitemapUrl.trim() || null }),
      });
      if (res.ok) {
        const p = await res.json();
        setProject(p);
      }
    } catch {
      // Ignore
    }
  }

  async function startCrawl() {
    if (!project?.homepage_url) {
      setError("Set homepage URL in project settings first");
      return;
    }
    setCrawling(true);
    setError("");
    try {
      await saveSitemap();
      const res = await fetch(`/api/projects/${id}/crawl`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          runImmediately: false,
          maxPages: effectiveMaxPages,
          sitemapUrl: sitemapUrl.trim() || undefined,
        }),
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

  async function updateJob(action: "pause" | "resume" | "cancel") {
    if (!activeCrawlJob) return;
    setError("");
    try {
      const res = await fetch(`/api/projects/${id}/crawl/${activeCrawlJob.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed to ${action} crawl`);
      setActiveCrawlJob(data);
      fetch(`/api/projects/${id}/crawl/jobs`)
        .then((r) => (r.ok ? r.json() : []))
        .then(setJobs)
        .catch(() => {});
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${action} crawl`);
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
    if (status === "cancelled") return <CircleSlash className="h-4 w-4" />;
    if (status === "running" || status === "pending") return <Loader2 className="h-4 w-4 animate-spin" />;
    return <Clock className="h-4 w-4" />;
  };

  const etaLabel =
    activeCrawlJob?.eta_seconds && activeCrawlJob.eta_seconds > 0
      ? activeCrawlJob.eta_seconds >= 60
        ? `Estimated time: ~${Math.ceil(activeCrawlJob.eta_seconds / 60)} min remaining`
        : `Estimated time: ~${activeCrawlJob.eta_seconds}s remaining`
      : "Estimated time: calculating...";

  return (
    <div className="w-full">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Crawl</h1>
        <p className="mt-1 text-muted-foreground">
          Crawl your site in controlled batches to collect page data, extract SEO insights, and build a stronger internal reference set for planning and writing.
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

      {aiConfigured === false && (
        <div className="mb-6 flex items-center justify-between gap-4 rounded-lg border border-amber-500/50 bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-400">
          <span>Configure an AI provider (API key) in App Settings before crawling. Crawling uses AI to extract topics and keywords.</span>
          <Link href="/settings">
            <Button variant="outline" size="sm">
              Go to Settings
            </Button>
          </Link>
        </div>
      )}

      {error && (
        <div className="mb-6 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {activeCrawlJob && (
        <div className="mb-6 flex items-center gap-4 rounded-lg border border-primary/30 bg-primary/5 p-4">
          <Loader2
            className={`h-5 w-5 shrink-0 text-primary ${activeCrawlJob.status === "paused" ? "" : "animate-spin"}`}
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-primary">
              {activeCrawlJob.status === "paused"
                ? "Crawl paused"
                : activeCrawlJob.progress > 0
                ? `Crawling ${activeCrawlJob.progress}${activeCrawlJob.total_pages ? ` / ${activeCrawlJob.total_pages}` : ""} pages`
                : "Starting crawl..."}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Stage: {activeCrawlJob.current_stage ?? activeCrawlJob.status}
              {activeCrawlJob.current_url ? ` • ${activeCrawlJob.current_url}` : ""}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {etaLabel}
              {!!activeCrawlJob.total_batches &&
                ` • AI batches ${activeCrawlJob.completed_batches ?? 0}/${activeCrawlJob.total_batches}`}
            </p>
            {activeCrawlJob.total_pages > 0 && (
              <Progress
                value={Math.round((activeCrawlJob.progress / activeCrawlJob.total_pages) * 100)}
                className="mt-2 h-2"
              />
            )}
          </div>
          <Link href={`/projects/${id}/crawl/${activeCrawlJob.id}`}>
            <Button variant="outline" size="sm">
              View job
            </Button>
          </Link>
          {activeCrawlJob.status === "paused" ? (
            <Button variant="outline" size="sm" onClick={() => updateJob("resume")}>
              <Play className="mr-2 h-4 w-4" />
              Resume
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={() => updateJob("pause")}>
              <Pause className="mr-2 h-4 w-4" />
              Pause
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => updateJob("cancel")}>
            <CircleSlash className="mr-2 h-4 w-4" />
            Cancel
          </Button>
        </div>
      )}

      <div className="grid gap-8 xl:grid-cols-3">
        <div className="xl:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Site crawl</CardTitle>
              <CardDescription>
                Start with a smaller crawl by default, then run additional crawls later if you want broader coverage, more references, or deeper SEO data.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {project.homepage_url ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="sitemap">Sitemap URL (optional)</Label>
                    <div className="flex gap-2">
                      <Input
                        id="sitemap"
                        type="url"
                        value={sitemapUrl}
                        onChange={(e) => setSitemapUrl(e.target.value)}
                        onBlur={saveSitemap}
                        placeholder="https://yoursite.com/sitemap.xml"
                        className="font-mono text-sm"
                      />
                      <Button variant="outline" size="sm" onClick={saveSitemap}>
                        Save
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Provide a sitemap if you want more precise URL discovery. Leave it blank and the crawler will auto-discover pages from the homepage and internal links.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-end gap-4">
                    <div className="space-y-2">
                      <Label>Max URLs to crawl</Label>
                      <div className="flex gap-2">
                        <Select
                          value={customMaxPages ? "custom" : String(maxPages)}
                          onValueChange={(v) => {
                            if (v === "custom") setCustomMaxPages(String(maxPages));
                            else {
                              setMaxPages(Number(v));
                              setCustomMaxPages("");
                            }
                          }}
                        >
                          <SelectTrigger className="w-[140px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {CRAWL_LIMITS.map((opt) => (
                              <SelectItem key={opt.value} value={String(opt.value)}>
                                {opt.label}
                              </SelectItem>
                            ))}
                            <SelectItem value="custom">Custom</SelectItem>
                          </SelectContent>
                        </Select>
                        {customMaxPages && (
                          <Input
                            type="number"
                            min={1}
                            max={1000}
                            value={customMaxPages}
                            onChange={(e) => setCustomMaxPages(e.target.value)}
                            placeholder="1–1000"
                            className="w-24"
                          />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Default is <strong>10 URLs</strong> so the first crawl stays fast, focused, and cost-efficient. Increase this later when you want more coverage.
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => startCrawl()}
                        disabled={crawling || aiConfigured === false || !!activeCrawlJob}
                      >
                        {crawling ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Starting...
                          </>
                        ) : (
                          <>
                            <Play className="mr-2 h-4 w-4" />
                            Start initial crawl
                          </>
                        )}
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => startCrawl()}
                        disabled={crawling || aiConfigured === false || !!activeCrawlJob}
                      >
                        <RotateCw className="mr-2 h-4 w-4" />
                        Recrawl with current limit
                      </Button>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    <strong>Start initial crawl</strong> is meant for a fast first pass and discovers up to 10 pages by default.
                    {" "}
                    <strong>Recrawl with current limit</strong> creates a fresh crawl job using whatever URL limit you currently selected above.
                    {" "}
                    If you want broader reference coverage, just raise the limit and run another crawl.
                  </p>
                </>
              ) : (
                <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-400">
                  Add a homepage URL in project settings to enable crawling.
                </p>
              )}
            </CardContent>
          </Card>

          {savedKeywords.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  Search terms
                </CardTitle>
                <CardDescription>
                  {savedKeywords.length} extracted keywords and SEO-aligned search terms from your crawled content. Use these for content planning, clustering, and topic expansion.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {latestInsight?.summary && (
                  <p className="mb-3 text-sm text-muted-foreground">{latestInsight.summary}</p>
                )}
                {!!latestInsight?.topics?.length && (
                  <div className="mb-4">
                    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Topics</p>
                    <div className="flex flex-wrap gap-2">
                      {(showAllTopics ? latestInsight.topics : latestInsight.topics.slice(0, 10)).map((topic) => (
                        <Badge key={topic} variant="outline" className="font-normal">
                          {topic}
                        </Badge>
                      ))}
                      {latestInsight.topics.length > 10 && (
                        <button
                          type="button"
                          onClick={() => setShowAllTopics((value) => !value)}
                          className="rounded-full border px-2.5 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-muted"
                        >
                          {showAllTopics ? "Show less" : `+${latestInsight.topics.length - 10} more`}
                        </button>
                      )}
                    </div>
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  {(showAllKeywords ? savedKeywords : savedKeywords.slice(0, 30)).map((k) => (
                    <Badge key={k.id} variant="secondary" className="font-normal">
                      {k.keyword}
                    </Badge>
                  ))}
                  {savedKeywords.length > 30 && (
                    <button
                      type="button"
                      onClick={() => setShowAllKeywords((value) => !value)}
                      className="rounded-full border px-2.5 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-muted"
                    >
                      {showAllKeywords ? "Show less" : `+${savedKeywords.length - 30} more`}
                    </button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Manual URLs</CardTitle>
              <CardDescription>
                Add URLs manually if the crawl misses important pages, if the site blocks bots, or if you want to enrich the reference set without running another full crawl.
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
              <CardDescription>
                Every crawl job is saved here. Open a job to review logs, see which pages were collected, and inspect the extracted SEO data.
              </CardDescription>
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
                                {(job.status === "running" || job.status === "pending" || job.status === "paused") &&
                                  !!job.current_stage && (
                                  <span>stage: {job.current_stage}</span>
                                )}
                                {(job.status === "running" || job.status === "pending" || job.status === "paused") &&
                                  (job.progress > 0 || job.total_pages > 0) && (
                                  <span className="text-primary">
                                    {job.progress} / {job.total_pages || "?"} pages
                                  </span>
                                )}
                                {(job.status === "running" || job.status === "pending" || job.status === "paused") &&
                                  !!job.eta_seconds && (
                                  <span>
                                    ETA ~{job.eta_seconds >= 60 ? `${Math.ceil(job.eta_seconds / 60)}m` : `${job.eta_seconds}s`}
                                  </span>
                                )}
                                {job.total_found > 0 && (
                                  <span>{job.total_found} pages</span>
                                )}
                                {(job.started_at || job.completed_at) && (
                                  <span>
                                    {formatDuration(job.started_at ?? job.created_at, job.completed_at ?? new Date().toISOString())}
                                  </span>
                                )}
                              </div>
                              {(job.status === "running" || job.status === "pending" || job.status === "paused") &&
                                job.total_pages > 0 && (
                                <Progress
                                  value={Math.round((job.progress / job.total_pages) * 100)}
                                  className="mt-2 h-1.5"
                                />
                              )}
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
