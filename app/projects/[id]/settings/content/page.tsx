"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Save, Sparkles, Trash2 } from "lucide-react";
import { ArticleDefaultsForm, type ArticleDefaultsFormValues } from "@/components/article-defaults-form";
import type { Project } from "@/lib/db";

const HOURS = Array.from({ length: 24 }, (_, i) => ({ value: String(i), label: `${i.toString().padStart(2, "0")}:00` }));

type CrawledLinkRow = {
  id: string;
  crawl_job_id: string;
  url: string;
  title: string | null;
};

type ArticleDefaultsApiResponse = ArticleDefaultsFormValues & {
  _researchSummary?: {
    headline: string;
    points: string[];
  } | null;
};

export default function ContentSettingsPage() {
  const params = useParams();
  const id = params.id as string;
  const [project, setProject] = useState<Project | null>(null);
  const [values, setValues] = useState<ArticleDefaultsFormValues>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [scheduleEnabled, setScheduleEnabled] = useState(true);
  const [scheduleHour, setScheduleHour] = useState("9");
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [cronLogs, setCronLogs] = useState<{ id: string; type: string; message: string; status: string; created_at: string }[]>([]);
  const [crawledLinks, setCrawledLinks] = useState<CrawledLinkRow[]>([]);
  const [linksLoading, setLinksLoading] = useState(false);
  const [updatingLinkId, setUpdatingLinkId] = useState<string | null>(null);
  const [deletingLinkId, setDeletingLinkId] = useState<string | null>(null);
  const [researchSummary, setResearchSummary] = useState<ArticleDefaultsApiResponse["_researchSummary"]>(null);
  const [loadingOptimal, setLoadingOptimal] = useState(false);

  useEffect(() => {
    fetch(`/api/projects/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setProject)
      .catch(() => setProject(null));
  }, [id]);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/projects/${id}/article-defaults`)
      .then((r) => (r.ok ? r.json() : {}))
      .then((data: ArticleDefaultsApiResponse) => {
        setResearchSummary(data._researchSummary ?? null);
        const { _researchSummary: _ignored, ...defaults } = data;
        setValues(defaults);
      })
      .catch(() => {
        setValues({});
        setResearchSummary(null);
      });
    fetch(`/api/projects/${id}/article-schedule`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) {
          setScheduleEnabled(d.enabled);
          setScheduleHour(String(d.hour ?? 9));
        }
      })
      .catch(() => {});
    fetch(`/api/projects/${id}/cron-logs?limit=30`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setCronLogs)
      .catch(() => setCronLogs([]));
  }, [id]);

  useEffect(() => {
    if (!id) return;
    setLinksLoading(true);
    fetch(`/api/projects/${id}/crawl-results`)
      .then((r) => (r.ok ? r.json() : { detailedPages: [] }))
      .then((data) => {
        setCrawledLinks(Array.isArray(data.detailedPages) ? data.detailedPages : []);
      })
      .catch(() => setCrawledLinks([]))
      .finally(() => setLinksLoading(false));
  }, [id]);

  async function save() {
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch(`/api/projects/${id}/article-defaults`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (res.ok) {
        const data = (await res.json()) as ArticleDefaultsApiResponse;
        setResearchSummary(data._researchSummary ?? null);
        const { _researchSummary: _ignored, ...defaults } = data;
        setValues(defaults);
        setMessage("Content defaults saved. These apply when generating articles for this site.");
      } else {
        const d = await res.json();
        setMessage(d.error || "Failed to save");
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  async function saveSchedule() {
    setScheduleSaving(true);
    setMessage("");
    try {
      const res = await fetch(`/api/projects/${id}/article-schedule`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: scheduleEnabled, hour: parseInt(scheduleHour, 10) }),
      });
      if (res.ok) {
        setMessage("Schedule saved. Articles due today will be generated automatically at the set hour.");
      } else {
        const d = await res.json();
        setMessage(d.error || "Failed to save schedule");
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to save schedule");
    } finally {
      setScheduleSaving(false);
    }
  }

  async function loadAppDefaults() {
    try {
      const res = await fetch("/api/settings/article-defaults");
      const data = await res.ok ? await res.json() : {};
      setValues(data);
      setResearchSummary(null);
      setMessage("Loaded app-level defaults. Edit and save to use for this site.");
    } catch {
      setMessage("Failed to load app defaults");
    }
  }

  async function loadOptimalSettings() {
    setLoadingOptimal(true);
    setMessage("");
    try {
      const res = await fetch(`/api/projects/${id}/article-defaults/load-optimal`, {
        method: "POST",
      });
      const data = (await res.json()) as ArticleDefaultsApiResponse & { error?: string };
      if (!res.ok) {
        setMessage(data.error ?? "Failed to load optimal settings");
        return;
      }
      setResearchSummary(data._researchSummary ?? null);
      const { _researchSummary: _ignored, error: _e, ...defaults } = data;
      setValues(defaults);
      setMessage(
        "Loaded AI-optimized settings for this site. Review, edit if needed, then click Save defaults to apply to all articles."
      );
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to load optimal settings");
    } finally {
      setLoadingOptimal(false);
    }
  }

  function updateCrawledLinkDraft(pageId: string, value: string) {
    setCrawledLinks((prev) =>
      prev.map((link) =>
        link.id === pageId
          ? { ...link, url: value }
          : link
      )
    );
  }

  async function saveCrawledLink(link: CrawledLinkRow) {
    setUpdatingLinkId(link.id);
    setMessage("");
    try {
      const res = await fetch(`/api/projects/${id}/crawl/${link.crawl_job_id}/pages/${link.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: link.url.trim(),
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        setCrawledLinks((prev) =>
          prev.map((item) =>
            item.id === link.id
              ? {
                  id: updated.id,
                  crawl_job_id: updated.crawl_job_id,
                  url: updated.url,
                  title: updated.title,
                }
              : item
          )
        );
        setMessage("Crawled link updated.");
      } else {
        const data = await res.json();
        setMessage(data.error || "Failed to update crawled link");
      }
    } catch {
      setMessage("Failed to update crawled link");
    } finally {
      setUpdatingLinkId(null);
    }
  }

  async function deleteCrawledLink(link: CrawledLinkRow) {
    setDeletingLinkId(link.id);
    setMessage("");
    try {
      const res = await fetch(`/api/projects/${id}/crawl/${link.crawl_job_id}/pages/${link.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setCrawledLinks((prev) => prev.filter((item) => item.id !== link.id));
        setMessage("Crawled link removed.");
      } else {
        const data = await res.json();
        setMessage(data.error || "Failed to delete crawled link");
      }
    } catch {
      setMessage("Failed to delete crawled link");
    } finally {
      setDeletingLinkId(null);
    }
  }

  if (!project) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {message && (
        <div className="rounded-lg border border-primary/30 bg-primary/10 p-4 text-sm text-primary">
          {message}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Generation mode</CardTitle>
          <CardDescription>
            <strong>Manual:</strong> Generate articles from the Content calendar → Write when you click a content idea.{" "}
            <strong>Scheduled:</strong> Enable below to automatically generate articles due each day at the set hour.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <Label>Enable scheduled article generation</Label>
              <p className="text-sm text-muted-foreground">
                Automatically generate articles for calendar items due today. Runs daily at the selected hour.
              </p>
            </div>
            <Switch
              checked={scheduleEnabled}
              onCheckedChange={setScheduleEnabled}
            />
          </div>
          {scheduleEnabled && (
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <Label>Run at</Label>
                <p className="text-sm text-muted-foreground">Hour (UTC) when the cron worker checks for due articles</p>
              </div>
              <Select value={scheduleHour} onValueChange={setScheduleHour}>
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HOURS.map((h) => (
                    <SelectItem key={h.value} value={h.value}>
                      {h.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <Button onClick={saveSchedule} disabled={scheduleSaving}>
            {scheduleSaving ? "Saving..." : "Save schedule"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>Cron logs</CardTitle>
            <CardDescription>
              Recent scheduled runs and article generation. All persisted in the database.
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              fetch(`/api/projects/${id}/cron-logs?limit=30`)
                .then((r) => (r.ok ? r.json() : []))
                .then(setCronLogs)
            }
          >
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          <div className="max-h-64 overflow-y-auto rounded border bg-muted/30 p-2">
            {cronLogs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No cron logs yet.</p>
            ) : (
              <ul className="space-y-2">
                {cronLogs.map((log) => (
                  <li
                    key={log.id}
                    className={`rounded px-2 py-1 text-sm ${
                      log.status === "error"
                        ? "bg-destructive/10 text-destructive"
                        : log.status === "success"
                          ? "bg-green-500/10 text-green-700 dark:text-green-400"
                          : log.status === "warning"
                            ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                            : "bg-muted/50"
                    }`}
                  >
                    <span className="font-mono text-xs text-muted-foreground">
                      {new Date(log.created_at).toLocaleString()}
                    </span>{" "}
                    <span className="font-medium">{log.type}:</span> {log.message}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="space-y-4">
          <div>
            <CardTitle>Content defaults</CardTitle>
            <CardDescription>
              Default length, tone, audience, format, and intent for generated content. Crawl-derived recommendations will prefill these using the latest SEO insights and global SEO rules until you override them.
            </CardDescription>
          </div>
          <div className="flex flex-nowrap items-center gap-2">
            <Button
              variant="default"
              size="sm"
              onClick={loadOptimalSettings}
              disabled={loadingOptimal}
            >
              <Sparkles className={`mr-2 h-4 w-4 ${loadingOptimal ? "animate-pulse" : ""}`} />
              {loadingOptimal ? "Loading…" : "Load optimal settings"}
            </Button>
            <Button variant="outline" size="sm" onClick={loadAppDefaults}>
              Load app defaults
            </Button>
            <Button size="sm" onClick={save} disabled={saving}>
              {saving ? "Saving..." : "Save defaults"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {researchSummary?.points?.length ? (
            <div className="mb-6 rounded-xl border bg-muted/30 p-4">
              <p className="text-sm font-medium text-foreground">Optimal content setup for this site</p>
              <p className="mt-1 text-sm text-muted-foreground">{researchSummary.headline}</p>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                {researchSummary.points.map((point) => (
                  <li key={point} className="flex gap-2">
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary/70" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <ArticleDefaultsForm
            values={values}
            onChange={setValues}
            showProjectContext
            crawledLinksContent={
              <div className="rounded-lg border border-dashed p-3">
                <div className="mb-3">
                  <p className="text-sm font-medium">Crawled URLs</p>
                  <p className="text-xs text-muted-foreground">
                    These URLs become available for internal linking. You can edit or remove any URL below.
                  </p>
                </div>
                {linksLoading ? (
                  <p className="text-sm text-muted-foreground">Loading crawled URLs...</p>
                ) : crawledLinks.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No crawled URLs available yet. Run a crawl first to manage them here.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {crawledLinks.map((link) => (
                      <div key={link.id} className="grid gap-3 rounded-lg border p-3 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-end">
                        <div className="space-y-2">
                          <Label>URL</Label>
                          <Input
                            value={link.url}
                            onChange={(e) => updateCrawledLinkDraft(link.id, e.target.value)}
                            placeholder="https://example.com/page"
                          />
                        </div>
                        <Button
                          variant="outline"
                          onClick={() => saveCrawledLink(link)}
                          disabled={updatingLinkId === link.id || deletingLinkId === link.id || !link.url.trim()}
                        >
                          <Save className="mr-2 h-4 w-4" />
                          {updatingLinkId === link.id ? "Saving..." : "Save"}
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => deleteCrawledLink(link)}
                          disabled={deletingLinkId === link.id || updatingLinkId === link.id}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          {deletingLinkId === link.id ? "Deleting..." : "Delete"}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}
