"use client";

import { useEffect, useState } from "react";
import { useParams, usePathname } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { LayoutGrid, Search, Calendar, Settings, Menu, ArrowLeft, FileEdit, Network, History, Cpu, Send } from "lucide-react";
import type { Project } from "@/lib/db";
import { WorkspaceSelector } from "@/components/workspace-selector";

const navItems = [
  { href: (id: string) => `/projects/${id}`, label: "Dashboard", icon: LayoutGrid },
  { href: (id: string) => `/projects/${id}/content-history`, label: "Content history", icon: History },
  { href: (id: string) => `/projects/${id}/crawl`, label: "Crawl", icon: Search },
  { href: (id: string) => `/projects/${id}/calendar`, label: "Calendar", icon: Calendar },
  { href: (id: string) => `/projects/${id}/settings`, label: "Settings", icon: Settings },
];

function formatCompactTokenCount(value: number | null | undefined) {
  const total = value ?? 0;
  if (total < 1000) return `${total}`;
  if (total < 1_000_000) return `${(total / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return `${(total / 1_000_000).toFixed(1).replace(/\.0$/, "")}m`;
}

type ProjectWithStats = Project & {
  crawl_jobs_count?: number;
  calendar_items_count?: number;
  pages_count?: number;
  llmUsage?: {
    request_count: number;
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  publishingPlatforms?: Array<{
    id: string;
    platform: string;
    label: string;
    enabled: boolean;
    auto_publish: boolean;
    last_error?: string | null;
    last_tested_at?: string | null;
  }>;
  activeCrawlJob?: { id: string; status: string; progress: number; total_pages: number } | null;
};

export default function ProjectLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const pathname = usePathname();
  const id = params.id as string;
  const [project, setProject] = useState<ProjectWithStats | null>(null);
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    if (!id) return;
    let interval: ReturnType<typeof setInterval> | null = null;
    const load = () =>
      fetch(`/api/projects/${id}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          setProject(data);
          if (data?.activeCrawlJob) {
            if (!interval) interval = setInterval(load, 2000);
          } else if (interval) {
            clearInterval(interval);
            interval = null;
          }
        })
        .catch(() => setProject(null));
    const handleMetricsRefresh = () => {
      void load();
    };
    window.addEventListener("project-metrics-updated", handleMetricsRefresh);
    load();
    // Poll every 4s for 20s to catch auto-crawl that starts after dashboard load
    const catchCrawl = setInterval(load, 4000);
    const t = setTimeout(() => clearInterval(catchCrawl), 20000);
    return () => {
      window.removeEventListener("project-metrics-updated", handleMetricsRefresh);
      clearInterval(catchCrawl);
      clearTimeout(t);
      if (interval) clearInterval(interval);
    };
  }, [id, pathname]);

  const NavLinks = ({ onNavigate }: { onNavigate?: () => void }) => (
    <>
      {navItems.map((item) => {
        const href = item.href(id);
        const isActive =
          pathname === href || (item.label !== "Dashboard" && pathname?.startsWith(href));
        const Icon = item.icon;
        return (
          <Link key={item.label} href={href} onClick={onNavigate}>
            <Button
              variant={isActive ? "secondary" : "ghost"}
              className="w-full justify-start"
            >
              <Icon className="mr-2 h-4 w-4" />
              {item.label}
            </Button>
          </Link>
        );
      })}
    </>
  );

  const enabledPublishingPlatforms = project?.publishingPlatforms?.filter((platform) => platform.enabled) ?? [];

  return (
    <div className="flex h-full min-h-0 w-full overflow-hidden">
      {/* Sidebar - desktop, fixed height */}
      <aside className="hidden h-full w-64 shrink-0 flex-col border-r bg-muted/30 lg:flex">
        <div className="flex flex-col gap-2 p-4">
          <WorkspaceSelector />
          {project?.name && (
            <p className="text-xs text-muted-foreground truncate px-1" title={project.name}>
              {project.name}
            </p>
          )}
        </div>
        <Separator />
        <nav className="flex flex-col gap-1 p-2">
          <NavLinks />
        </nav>
        <div className="mt-auto border-t p-2">
          <Link href="/">
            <Button variant="ghost" className="w-full justify-start">
              <ArrowLeft className="mr-2 h-4 w-4" />
              All sites
            </Button>
          </Link>
          <Link href="/settings">
            <Button variant="ghost" className="w-full justify-start">
              <Settings className="mr-2 h-4 w-4" />
              App settings
            </Button>
          </Link>
        </div>
      </aside>

      {/* Main content - scrollable */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {/* Metrics bar - desktop */}
        {project && (
          <div className="hidden shrink-0 border-b bg-muted/30 px-6 py-2 lg:flex lg:items-center lg:gap-6">
            <div className="flex items-center gap-2 text-sm">
              <Network className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Pages</span>
              <span className="font-semibold">{project.pages_count ?? 0}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <FileEdit className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Content ideas</span>
              <span className="font-semibold">{project.calendar_items_count ?? 0}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Search className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">
                {project.activeCrawlJob ? "Crawling" : "Crawls"}
              </span>
              <span className="font-semibold">
                {project.activeCrawlJob
                  ? project.activeCrawlJob.total_pages > 0
                    ? `${project.activeCrawlJob.progress} / ${project.activeCrawlJob.total_pages}`
                    : project.activeCrawlJob.progress > 0
                      ? `${project.activeCrawlJob.progress}`
                      : "…"
                  : project.crawl_jobs_count ?? 0}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Cpu className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">AI tokens</span>
              <span className="font-semibold">{formatCompactTokenCount(project.llmUsage?.total_tokens)}</span>
              {/* <span className="text-xs text-muted-foreground">
                {project.llmUsage?.request_count?.toLocaleString() ?? 0} req
              </span> */}
            </div>
            <div className="flex min-w-0 items-center gap-2 text-sm">
              <Send className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="shrink-0 text-muted-foreground">Platforms</span>
              <div className="flex min-w-0 flex-wrap gap-2">
                {enabledPublishingPlatforms.length ? (
                  enabledPublishingPlatforms.map((platform) => (
                    <Badge key={platform.id} variant={platform.auto_publish ? "default" : "outline"} className="max-w-[180px] truncate">
                      {platform.label}
                    </Badge>
                  ))
                ) : (
                  <span className="text-xs text-muted-foreground">None configured</span>
                )}
              </div>
            </div>
          </div>
        )}
        {/* Mobile: top bar */}
        <div className="flex shrink-0 items-center justify-between border-b px-4 py-3 lg:hidden">
          <Sheet open={navOpen} onOpenChange={setNavOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Open menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0">
              <div className="flex flex-col p-4">
                <div className="mb-4">
                  <WorkspaceSelector />
                </div>
                <Separator className="mb-4" />
                <nav className="flex flex-col gap-1">
                  <NavLinks onNavigate={() => setNavOpen(false)} />
                </nav>
                <Separator className="my-4" />
                <Link href="/" onClick={() => setNavOpen(false)}>
                  <Button variant="ghost" className="w-full justify-start">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    All sites
                  </Button>
                </Link>
                <Link href="/settings" onClick={() => setNavOpen(false)}>
                  <Button variant="ghost" className="w-full justify-start">
                    <Settings className="mr-2 h-4 w-4" />
                    App settings
                  </Button>
                </Link>
              </div>
            </SheetContent>
          </Sheet>
          <span className="font-medium truncate">{project?.name ?? "Site"}</span>
          {project?.activeCrawlJob && (
            <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              <Search className="h-3 w-3" />
              {project.activeCrawlJob.total_pages > 0
                ? `${project.activeCrawlJob.progress}/${project.activeCrawlJob.total_pages}`
                : "…"}
            </span>
          )}
          <div className="w-10" />
        </div>
        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-4 py-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
