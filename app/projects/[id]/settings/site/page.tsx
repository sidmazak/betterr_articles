"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import Link from "next/link";
import { Trash2, Send } from "lucide-react";
import type { Project } from "@/lib/db";

type SiteSettings = {
  auto_publish: number;
  auto_internal_links: number;
  auto_external_links: number;
  auto_infographics: number;
  auto_images: number;
  eeat_optimization: number;
  infographic_watermark: number;
};

type LinkRow = { id: string; url: string; title: string | null };

export default function SiteSettingsPage() {
  const params = useParams();
  const id = params.id as string;
  const [project, setProject] = useState<Project | null>(null);
  const [siteSettings, setSiteSettings] = useState<SiteSettings | null>(null);
  const [internalLinks, setInternalLinks] = useState<LinkRow[]>([]);
  const [homepageUrl, setHomepageUrl] = useState("");
  const [sitemapUrl, setSitemapUrl] = useState("");
  const [newInternalUrl, setNewInternalUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch(`/api/projects/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((p) => {
        setProject(p);
        if (p?.homepage_url) setHomepageUrl(p.homepage_url);
        if (p?.sitemap_url) setSitemapUrl(p.sitemap_url ?? "");
      })
      .catch(() => setProject(null));
  }, [id]);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      fetch(`/api/projects/${id}/site-settings`).then((r) => (r.ok ? r.json() : null)),
      fetch(`/api/projects/${id}/internal-links`).then((r) => (r.ok ? r.json() : [])),
    ]).then(([settings, internal]) => {
      setSiteSettings(settings);
      setInternalLinks(internal);
    });
  }, [id]);

  async function saveSiteSettings() {
    if (!siteSettings) return;
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch(`/api/projects/${id}/site-settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(siteSettings),
      });
      if (res.ok) setMessage("Site settings saved.");
      else setMessage((await res.json()).error || "Failed to save");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  async function saveHomepage(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          homepageUrl: homepageUrl || null,
          sitemapUrl: sitemapUrl.trim() || null,
        }),
      });
      if (res.ok) {
        setProject(await res.json());
        setMessage("URLs saved.");
      } else setMessage((await res.json()).error || "Failed");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  async function addInternalLink() {
    if (!newInternalUrl.trim().startsWith("http")) {
      setMessage("Enter a valid URL starting with http");
      return;
    }
    try {
      const res = await fetch(`/api/projects/${id}/internal-links`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: newInternalUrl.trim() }),
      });
      if (res.ok) {
        const link = await res.json();
        setInternalLinks((prev) => [link, ...prev]);
        setNewInternalUrl("");
        setMessage("");
      } else setMessage((await res.json()).error || "Failed to add link");
    } catch {
      setMessage("Failed to add link");
    }
  }

  async function removeInternalLink(linkId: string) {
    try {
      const res = await fetch(`/api/projects/${id}/internal-links?linkId=${linkId}`, { method: "DELETE" });
      if (res.ok) setInternalLinks((prev) => prev.filter((l) => l.id !== linkId));
    } catch {
      setMessage("Failed to remove link");
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
    <div className="space-y-8">
      {message && (
        <div className="rounded-lg border border-primary/30 bg-primary/10 p-4 text-sm text-primary">
          {message}
        </div>
      )}

      {/* Connect site */}
      <Card>
        <CardHeader>
          <CardTitle>Connect site</CardTitle>
          <CardDescription>
            Set your website URL. Crawls, search terms, and content are scoped to this site.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={saveHomepage} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="homepage">Homepage URL</Label>
              <Input
                id="homepage"
                type="url"
                value={homepageUrl}
                onChange={(e) => setHomepageUrl(e.target.value)}
                placeholder="https://yoursite.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sitemap">Sitemap URL (optional)</Label>
              <Input
                id="sitemap"
                type="url"
                value={sitemapUrl}
                onChange={(e) => setSitemapUrl(e.target.value)}
                placeholder="https://yoursite.com/sitemap.xml"
              />
              <p className="text-xs text-muted-foreground">Provide a sitemap for faster, more comprehensive crawling.</p>
            </div>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Automation */}
      <Card>
        <CardHeader>
          <CardTitle>Automation</CardTitle>
          <CardDescription>
            Control automated actions for this site.{" "}
            <Link href={`/projects/${id}/settings/content`} className="text-primary underline hover:no-underline">
              Content settings
            </Link>{" "}
            control internal linking, external linking, and infographics for article generation.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <Label>Enable auto-publishing</Label>
              <p className="text-sm text-muted-foreground">Automatically publish articles when ready</p>
            </div>
            <Switch
              checked={!!siteSettings?.auto_publish}
              onCheckedChange={(v) => setSiteSettings((s) => s ? { ...s, auto_publish: v ? 1 : 0 } : null)}
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <Label>Automatically generate images</Label>
              <p className="text-sm text-muted-foreground">Add AI-generated images to articles</p>
            </div>
            <Switch
              checked={!!siteSettings?.auto_images}
              onCheckedChange={(v) => setSiteSettings((s) => s ? { ...s, auto_images: v ? 1 : 0 } : null)}
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <Label>Optimize for E-E-A-T</Label>
              <p className="text-sm text-muted-foreground">Follow Google E-E-A-T guidelines</p>
            </div>
            <Switch
              checked={!!siteSettings?.eeat_optimization}
              onCheckedChange={(v) => setSiteSettings((s) => s ? { ...s, eeat_optimization: v ? 1 : 0 } : null)}
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <Label>Infographic watermark</Label>
              <p className="text-sm text-muted-foreground">Show site domain (https) in infographic footer</p>
            </div>
            <Switch
              checked={!!siteSettings?.infographic_watermark}
              onCheckedChange={(v) => setSiteSettings((s) => s ? { ...s, infographic_watermark: v ? 1 : 0 } : null)}
            />
          </div>
          <Button onClick={saveSiteSettings} disabled={saving}>
            {saving ? "Saving..." : "Update automation"}
          </Button>
        </CardContent>
      </Card>

      {/* Internal links */}
      <Card>
        <CardHeader>
          <CardTitle>Internal linkings</CardTitle>
          <CardDescription>
            URLs you&apos;ve added for this site only. Used when generating internal links in articles.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={newInternalUrl}
              onChange={(e) => setNewInternalUrl(e.target.value)}
              placeholder="https://yoursite.com/page"
            />
            <Button onClick={addInternalLink}>Add link</Button>
          </div>
          <ul className="space-y-2">
            {internalLinks.map((l) => (
              <li key={l.id} className="flex items-center justify-between rounded border px-3 py-2">
                <a href={l.url} target="_blank" rel="noopener noreferrer" className="truncate text-sm text-primary hover:underline">
                  {l.url}
                </a>
                <Button variant="ghost" size="icon" onClick={() => removeInternalLink(l.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
            {internalLinks.length === 0 && (
              <li className="text-sm text-muted-foreground">No internal links added yet.</li>
            )}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Publishing destinations</CardTitle>
          <CardDescription>
            Manage WordPress, Ghost, Medium, Wix, Odoo, and custom webhook publishing in the dedicated Publishing tab.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">
              Publishing is now project-scoped and supports multiple destinations with per-platform auto-publish controls and connection tests.
            </p>
          </div>
          <Link href={`/projects/${id}/settings/publishing`}>
            <Button>
              <Send className="mr-2 h-4 w-4" />
              Open publishing settings
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
