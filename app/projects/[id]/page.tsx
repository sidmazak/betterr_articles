"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
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
import { Search, Calendar, Globe, Send, Trash2 } from "lucide-react";
import type { Project } from "@/lib/db";
import { PUBLISHING_PLATFORMS } from "@/lib/publishing-constants";

export default function ProjectPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [project, setProject] = useState<Project | null>(null);
  const [homepageUrl, setHomepageUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [publishPlatform, setPublishPlatform] = useState("wordpress");
  const [publishConfig, setPublishConfig] = useState<Record<string, string>>({});
  const [publishSaving, setPublishSaving] = useState(false);
  const [publishMessage, setPublishMessage] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetch(`/api/projects/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((p) => {
        setProject(p);
        if (p?.homepage_url) setHomepageUrl(p.homepage_url);
      })
      .catch(() => setProject(null));
  }, [id]);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/settings/publishing/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { platform?: string; config?: string | Record<string, unknown> } | null) => {
        if (d?.platform) {
          setPublishPlatform(d.platform);
          try {
            const c = typeof d.config === "string" ? JSON.parse(d.config) : d.config ?? {};
            setPublishConfig(c);
          } catch {
            setPublishConfig({});
          }
        }
      })
      .catch(() => {});
  }, [id]);

  async function saveHomepage(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ homepageUrl: homepageUrl || null }),
      });
      if (res.ok) {
        const p = await res.json();
        setProject(p);
      }
    } finally {
      setSaving(false);
    }
  }

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

  async function savePublishing(e: React.FormEvent) {
    e.preventDefault();
    setPublishSaving(true);
    setPublishMessage("");
    try {
      const platform = PUBLISHING_PLATFORMS.find((p) => p.id === publishPlatform);
      const config: Record<string, string> = {};
      for (const f of platform?.fields ?? []) {
        const v = publishConfig[f];
        if (v) config[f] = v;
      }
      const res = await fetch(`/api/settings/publishing/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform: publishPlatform, config }),
      });
      if (res.ok) {
        setPublishMessage("Publishing config saved.");
      } else {
        const d = await res.json();
        setPublishMessage(d.error || "Failed to save");
      }
    } catch (err) {
      setPublishMessage(err instanceof Error ? err.message : "Failed");
    } finally {
      setPublishSaving(false);
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
    <div className="w-full">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">{project.name}</h1>
        {project.homepage_url && (
          <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
            <Globe className="h-4 w-4" />
            {project.homepage_url}
          </p>
        )}
      </div>

      <div className="grid gap-8 xl:grid-cols-3">
        <div className="xl:col-span-2 space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>Homepage URL</CardTitle>
              <CardDescription>
                Set the homepage URL for auto crawling. Required for crawling.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={saveHomepage} className="flex flex-col gap-4 sm:flex-row sm:items-end">
                <div className="flex-1 space-y-2">
                  <Label htmlFor="homepage">URL</Label>
                  <Input
                    id="homepage"
                    type="url"
                    value={homepageUrl}
                    onChange={(e) => setHomepageUrl(e.target.value)}
                    placeholder="https://yoursite.com"
                  />
                </div>
                <Button type="submit" disabled={saving}>
                  {saving ? "Saving..." : "Save"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Publishing</CardTitle>
              <CardDescription>
                Configure where articles are published. Supports WordPress, Ghost, Medium, and webhooks.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={savePublishing} className="space-y-4">
                <div className="space-y-2">
                  <Label>Platform</Label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={publishPlatform}
                    onChange={(e) => {
                      setPublishPlatform(e.target.value);
                      setPublishConfig({});
                    }}
                  >
                    {PUBLISHING_PLATFORMS.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  {PUBLISHING_PLATFORMS.find((p) => p.id === publishPlatform)?.fields.map((f) => (
                    <div key={f} className="space-y-2">
                      <Label htmlFor={f}>
                        {f.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase())}
                      </Label>
                      <Input
                        id={f}
                        type={f.toLowerCase().includes("pass") ? "password" : "text"}
                        value={publishConfig[f] ?? ""}
                        onChange={(e) => setPublishConfig((c) => ({ ...c, [f]: e.target.value }))}
                        placeholder={f === "siteUrl" ? "https://yoursite.com" : f === "webhookUrl" ? "https://..." : ""}
                      />
                    </div>
                  ))}
                </div>
                {publishMessage && (
                  <p className="text-sm text-primary">{publishMessage}</p>
                )}
                <Button type="submit" disabled={publishSaving}>
                  <Send className="mr-2 h-4 w-4" />
                  {publishSaving ? "Saving..." : "Save publishing config"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Quick actions</h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <Link href={`/projects/${id}/crawl`}>
              <Card className="h-full transition-colors hover:border-primary/50 hover:bg-muted/30">
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <Search className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">Crawl</p>
                    <p className="text-sm text-muted-foreground">Discover pages for internal linking</p>
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
                    <p className="text-sm text-muted-foreground">AI-suggested titles and schedule</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>

          <Card className="border-destructive/30">
            <CardHeader>
              <CardTitle className="text-destructive">Danger zone</CardTitle>
              <CardDescription>
                Permanently delete this project and all its data (crawls, calendar, articles).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" disabled={deleting}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete project
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete project?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete &quot;{project.name}&quot; and all associated data.
                      This action cannot be undone.
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
      </div>
    </div>
  );
}
