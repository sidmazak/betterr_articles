"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArticleDefaultsForm, type ArticleDefaultsFormValues } from "@/components/article-defaults-form";
import type { Project } from "@/lib/db";

export default function ProjectArticleSettingsPage() {
  const params = useParams();
  const id = params.id as string;
  const [project, setProject] = useState<Project | null>(null);
  const [values, setValues] = useState<ArticleDefaultsFormValues>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

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
      .then(setValues)
      .catch(() => setValues({}));
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
        setMessage("Article defaults saved. These apply when generating articles in this project.");
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

  async function loadAppDefaults() {
    try {
      const res = await fetch("/api/settings/article-defaults");
      const data = await res.ok ? await res.json() : {};
      setValues(data);
      setMessage("Loaded app-level defaults. Edit and save to use for this project.");
    } catch {
      setMessage("Failed to load app defaults");
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
        <h1 className="text-2xl font-bold tracking-tight">Article generation settings</h1>
        <p className="mt-1 text-muted-foreground">
          Set default parameters for article generation in this project. These apply when you write
          articles from the calendar. You can override them per-article on the write page.
        </p>
      </div>

      {message && (
        <div className="mb-6 rounded-lg border border-primary/30 bg-primary/10 p-4 text-sm text-primary">
          {message}
        </div>
      )}

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Generation mode</CardTitle>
          <CardDescription>
            <strong>Manual:</strong> Generate articles from the Calendar → Write page when you click a calendar item.{" "}
            <strong>Scheduled (cron):</strong> Coming soon — schedule automatic article generation for calendar items.
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>Project defaults</CardTitle>
            <CardDescription>
              Unique to this project. Use &quot;Load app defaults&quot; to start from global settings.
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={loadAppDefaults}>
              Load app defaults
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? "Saving..." : "Save defaults"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <ArticleDefaultsForm values={values} onChange={setValues} showProjectContext />
        </CardContent>
      </Card>
    </div>
  );
}
