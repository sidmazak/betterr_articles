"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { LayoutDashboard, Settings, Menu } from "lucide-react";
import { WorkspaceSelector } from "@/components/workspace-selector";

export function HomeSidebar({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isSettings = pathname?.startsWith("/settings");
  const isHome = pathname === "/";

  const SidebarContent = () => (
    <>
      <div className="flex flex-col gap-2 p-4">
        <WorkspaceSelector />
      </div>
      <Separator />
      <nav className="flex flex-col gap-1 p-2">
        <Link href="/">
          <Button
            variant={isHome ? "secondary" : "ghost"}
            className="w-full justify-start"
          >
            <LayoutDashboard className="mr-2 h-4 w-4" />
            Home
          </Button>
        </Link>
      </nav>
      <div className="mt-auto border-t p-2">
        <Link href="/settings">
          <Button
            variant={isSettings ? "secondary" : "ghost"}
            className="w-full justify-start"
          >
            <Settings className="mr-2 h-4 w-4" />
            App settings
          </Button>
        </Link>
      </div>
    </>
  );

  return (
    <div className="flex h-full min-h-0 w-full overflow-hidden">
      {/* Sidebar - desktop */}
      <aside className="hidden h-full w-64 shrink-0 flex-col border-r bg-muted/30 lg:flex">
        <SidebarContent />
      </aside>

      {/* Content area */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {/* Mobile: top bar with hamburger */}
        <div className="flex shrink-0 items-center justify-between border-b px-4 py-3 lg:hidden">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Open menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0">
              <div className="flex flex-col p-4">
                <div className="mb-4 flex items-center gap-2 font-semibold">
                  <LayoutDashboard className="h-5 w-5 text-primary" />
                  {process.env.NEXT_PUBLIC_SITE_NAME}
                </div>
                <Separator className="mb-4" />
                <SidebarContent />
              </div>
            </SheetContent>
          </Sheet>
          <span className="font-medium">{isSettings ? "App settings" : "Sites"}</span>
          <div className="w-10" />
        </div>
        {/* Main content */}
        <main className="min-h-0 flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
