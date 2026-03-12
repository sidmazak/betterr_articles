"use client";

import { usePathname } from "next/navigation";
import { AppHeader } from "./app-header";
import { NewProjectProvider } from "@/components/new-project-context";
import { HomeSidebar } from "./home-sidebar";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPublicArticle = pathname?.startsWith("/a/");
  const isInfographicRender = pathname?.startsWith("/infographic/render");
  const isProject = pathname?.startsWith("/projects/");
  const isHome = pathname === "/";

  if (isPublicArticle || isInfographicRender) {
    return <>{children}</>;
  }

  return (
    <NewProjectProvider>
      <div className="flex h-screen w-full flex-col overflow-hidden bg-background">
        <header className="h-14 shrink-0 border-b bg-background">
          <AppHeader />
        </header>
        <div
          className={
            isProject
              ? "flex min-h-0 flex-1 flex-col overflow-hidden"
              : "min-h-0 flex-1 overflow-hidden"
          }
        >
          {isHome || pathname?.startsWith("/settings") ? (
            <HomeSidebar>{children}</HomeSidebar>
          ) : (
            children
          )}
        </div>
      </div>
    </NewProjectProvider>
  );
}
