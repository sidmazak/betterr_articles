"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, Globe, Calendar, FileText, Network } from "lucide-react";
import type { Project } from "@/lib/db";

export type ProjectWithStats = Project & {
  crawl_jobs_count?: number;
  calendar_items_count?: number;
  pages_count?: number;
};

export default function Home() {
  const [projects, setProjects] = useState<ProjectWithStats[]>([]);

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then(setProjects)
      .catch(() => setProjects([]));
  }, []);

  return (
    <div className="w-full px-4 py-8 lg:px-8">
      <div className="mx-auto w-full max-w-[1600px]">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
          <p className="mt-1 text-muted-foreground">
            Create a project to start. Each project has its own crawl data, content calendar, and articles.
          </p>
        </div>

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
                          {p.calendar_items_count ?? 0} calendar items
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
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-muted-foreground">No projects yet.</p>
              <p className="mt-1 text-sm text-muted-foreground">Use the New project button in the header to create one.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
