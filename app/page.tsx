"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, Globe, Calendar, FileText, Network, LayoutGrid, Search, FileEdit, Plus, Settings } from "lucide-react";
import { useNewProjectModal } from "@/components/new-project-context";
import type { Project } from "@/lib/db";

export type ProjectWithStats = Project & {
  crawl_jobs_count?: number;
  calendar_items_count?: number;
  pages_count?: number;
  keywords_count?: number;
  articles_count?: number;
};

export default function Home() {
  const { openModal } = useNewProjectModal();
  const [projects, setProjects] = useState<ProjectWithStats[]>([]);
  const [llmConfigured, setLlmConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then(setProjects)
      .catch(() => setProjects([]));
  }, []);

  useEffect(() => {
    fetch("/api/settings/llm")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setLlmConfigured(!!d?.default?.is_configured))
      .catch(() => setLlmConfigured(false));
  }, []);

  const totalSites = projects.length;
  const totalCrawls = projects.reduce((s, p) => s + (p.crawl_jobs_count ?? 0), 0);
  const totalContentIdeas = projects.reduce((s, p) => s + (p.calendar_items_count ?? 0), 0);
  const totalPages = projects.reduce((s, p) => s + (p.pages_count ?? 0), 0);
  const totalKeywords = projects.reduce((s, p) => s + (p.keywords_count ?? 0), 0);
  const totalArticles = projects.reduce((s, p) => s + (p.articles_count ?? 0), 0);

  return (
    <div className="w-full px-4 py-8 lg:px-8">
      <div className="mx-auto w-full max-w-[1600px]">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Sites</h1>
          <p className="mt-1 text-muted-foreground">
            Manage each website as a separate site. Crawl for SEO data, extract search terms, and plan content. BYOM — bring your own model.
          </p>
        </div>

        {/* Setup message */}
        {(projects.length === 0 || llmConfigured === false) && (
          <Card className="mb-6 border-primary/30 bg-primary/5">
            <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium">
                  {projects.length === 0 && llmConfigured === false
                    ? "Get started"
                    : projects.length === 0
                      ? "Add your first site"
                      : "Complete setup"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {projects.length === 0 && llmConfigured === false
                    ? "Add a website and configure your AI provider in Settings to enable content ideas and article generation."
                    : projects.length === 0
                      ? "Add a website to crawl pages, extract keywords, and plan content."
                      : "Configure your AI provider in Settings to enable content ideas and article generation."}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                {projects.length === 0 && (
                  <Button onClick={openModal}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add site
                  </Button>
                )}
                {llmConfigured === false && (
                  <Link href="/settings?tab=llm">
                    <Button variant={projects.length === 0 ? "outline" : "default"}>
                      <Settings className="mr-2 h-4 w-4" />
                      Configure AI
                    </Button>
                  </Link>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Overall stats cards */}
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total sites</CardTitle>
              <LayoutGrid className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalSites}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total crawls</CardTitle>
              <Network className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalCrawls}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Content ideas</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalContentIdeas}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pages crawled</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalPages.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Search terms</CardTitle>
              <Search className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalKeywords.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Articles</CardTitle>
              <FileEdit className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalArticles.toLocaleString()}</div>
            </CardContent>
          </Card>
        </div>

        {/* Site section */}
        <div>
          <h2 className="mb-4 text-lg font-semibold">Your sites</h2>
          {projects.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {projects.map((p) => (
              <Link key={p.id} href={`/projects/${p.id}`}>
                <Card className="h-full transition-colors hover:border-primary/50 hover:bg-muted/30">
                  <CardContent className="flex items-start justify-between gap-4 p-4">
                    <div className="min-w-0 flex-1 space-y-2">
                      <p className="font-medium truncate">{p.name}</p>
                      {p.homepage_url && (
                        <p className="flex items-center gap-1.5 text-sm text-muted-foreground truncate">
                          <Globe className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{p.homepage_url}</span>
                        </p>
                      )}
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Network className="h-3 w-3" />
                          {p.crawl_jobs_count ?? 0} crawls
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {p.calendar_items_count ?? 0} content ideas
                        </span>
                        <span className="flex items-center gap-1">
                          <FileText className="h-3 w-3" />
                          {p.pages_count ?? 0} pages
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Updated {p.updated_at ? new Date(p.updated_at).toLocaleDateString() : "—"}
                      </p>
                    </div>
                    <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-20 text-center">
              <Button
                size="lg"
                variant="outline"
                className="mb-4 h-16 w-16 rounded-full border-none cursor-pointer"
                onClick={openModal}
                aria-label="Add site"
              >
                <Plus className="h-8 w-8" />
              </Button>
              <p className="font-medium text-muted-foreground">No sites yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Click the + button or use the site selector in the sidebar to add your first website.
              </p>
            </CardContent>
          </Card>
        )}
        </div>
      </div>
    </div>
  );
}
