"use client";

import { usePathname } from "next/navigation";
import { AppHeader } from "./app-header";
import { NewProjectProvider } from "@/components/new-project-context";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isProject = pathname?.startsWith("/projects/");

  return (
    <NewProjectProvider>
      <div className="flex h-screen w-full flex-col overflow-hidden bg-background">
        <header className="h-14 shrink-0 border-b bg-background">
          <AppHeader />
        </header>
        <main
          className={
            isProject
              ? "flex min-h-0 flex-1 flex-col overflow-hidden"
              : "min-h-0 flex-1 overflow-y-auto"
          }
        >
          {children}
        </main>
      </div>
    </NewProjectProvider>
  );
}
