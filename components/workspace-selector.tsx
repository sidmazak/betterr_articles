"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Globe, Plus, Check } from "lucide-react";
import { useNewProjectModal } from "@/components/new-project-context";
import type { Project } from "@/lib/db";

function truncateDomain(url: string | null, maxLen = 22): string {
  if (!url) return "No site";
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    if (host.length <= maxLen) return host;
    return host.slice(0, maxLen - 3) + "...";
  } catch {
    return url.length > maxLen ? url.slice(0, maxLen - 3) + "..." : url;
  }
}

export function WorkspaceSelector() {
  const params = useParams();
  const currentId = params.id as string | undefined;
  const { openModal } = useNewProjectModal();
  const [workspaces, setWorkspaces] = useState<Project[]>([]);
  const [current, setCurrent] = useState<Project | null>(null);

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => (r.ok ? r.json() : []))
      .then(setWorkspaces)
      .catch(() => setWorkspaces([]));
  }, []);

  useEffect(() => {
    if (!currentId) {
      setCurrent(null);
      return;
    }
    fetch(`/api/projects/${currentId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setCurrent)
      .catch(() => setCurrent(null));
  }, [currentId]);

  const displayName = current
    ? truncateDomain(current.homepage_url) || current.name
    : workspaces.length > 0
      ? "Select site"
      : "Add site";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="w-full justify-between border-primary/30 font-medium"
        >
          <span className="flex items-center gap-2 truncate">
            <Globe className="h-4 w-4 shrink-0 text-muted-foreground" />
            {displayName}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[var(--radix-dropdown-menu-trigger-width)]">
        {workspaces.map((w) => {
          const isActive = w.id === currentId;
          return (
            <DropdownMenuItem key={w.id} asChild>
              <Link
                href={`/projects/${w.id}`}
                className="flex items-center justify-between"
              >
                <span className="flex items-center gap-2 truncate">
                  <Globe className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">
                    {truncateDomain(w.homepage_url) || w.name}
                  </span>
                  {w.name !== truncateDomain(w.homepage_url) && (
                    <span className="text-muted-foreground truncate text-xs">
                      {w.name}
                    </span>
                  )}
                </span>
                {isActive && <Check className="h-4 w-4 shrink-0 text-primary" />}
              </Link>
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={openModal} className="cursor-pointer">
          <Plus className="mr-2 h-4 w-4" />
          Add Site
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
