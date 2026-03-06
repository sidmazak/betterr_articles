"use client";

import { useEffect, useState } from "react";
import { useParams, usePathname } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { LayoutGrid, Search, Calendar, FileText, Settings, Menu, ArrowLeft } from "lucide-react";
import type { Project } from "@/lib/db";

const navItems = [
  { href: (id: string) => `/projects/${id}`, label: "Overview", icon: LayoutGrid },
  { href: (id: string) => `/projects/${id}/crawl`, label: "Crawl", icon: Search },
  { href: (id: string) => `/projects/${id}/calendar`, label: "Calendar", icon: Calendar },
  { href: (id: string) => `/projects/${id}/article-settings`, label: "Article settings", icon: FileText },
];

export default function ProjectLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const pathname = usePathname();
  const id = params.id as string;
  const [project, setProject] = useState<Project | null>(null);
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/projects/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setProject)
      .catch(() => setProject(null));
  }, [id]);

  const NavLinks = ({ onNavigate }: { onNavigate?: () => void }) => (
    <>
      {navItems.map((item) => {
        const href = item.href(id);
        const isActive =
          pathname === href || (item.label !== "Overview" && pathname?.startsWith(href));
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

  return (
    <div className="flex h-full min-h-0 w-full overflow-hidden">
      {/* Sidebar - desktop, fixed height */}
      <aside className="hidden h-full w-64 shrink-0 flex-col border-r bg-muted/30 lg:flex">
        <div className="flex flex-col gap-2 p-4">
          <Link
            href={`/projects/${id}`}
            className="font-semibold text-foreground hover:underline"
          >
            {project?.name ?? "Project"}
          </Link>
          {project?.homepage_url && (
            <p className="text-xs text-muted-foreground truncate">{project.homepage_url}</p>
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
              All projects
            </Button>
          </Link>
          <Link href="/settings">
            <Button variant="ghost" className="w-full justify-start">
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </Button>
          </Link>
        </div>
      </aside>

      {/* Main content - scrollable */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
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
                <div className="mb-4 font-semibold">{project?.name ?? "Project"}</div>
                <Separator className="mb-4" />
                <nav className="flex flex-col gap-1">
                  <NavLinks onNavigate={() => setNavOpen(false)} />
                </nav>
                <Separator className="my-4" />
                <Link href="/" onClick={() => setNavOpen(false)}>
                  <Button variant="ghost" className="w-full justify-start">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    All projects
                  </Button>
                </Link>
                <Link href="/settings" onClick={() => setNavOpen(false)}>
                  <Button variant="ghost" className="w-full justify-start">
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
                  </Button>
                </Link>
              </div>
            </SheetContent>
          </Sheet>
          <span className="font-medium">{project?.name ?? "Project"}</span>
          <div className="w-10" />
        </div>
        <main className="min-h-0 flex-1 overflow-y-auto px-4 py-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
