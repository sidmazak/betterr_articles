"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { useNewProjectModal } from "@/components/new-project-context";
import { LayoutDashboard, Settings, Menu, Plus } from "lucide-react";

export function AppHeader() {
  const pathname = usePathname();
  const { openModal } = useNewProjectModal();
  const isSettings = pathname === "/settings";

  return (
    <div className="flex h-full w-full items-center">
      <div className="flex h-14 w-full items-center px-4 lg:px-6">
        <div className="flex flex-1 items-center gap-4">
          <Sheet>
            <SheetTrigger asChild className="lg:hidden">
              <Button variant="ghost" size="icon" aria-label="Open menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0 lg:hidden">
              <div className="flex flex-col gap-2 p-4">
                <Link href="/" className="flex items-center gap-2 font-semibold">
                  <LayoutDashboard className="h-5 w-5" />
                  Better Articles
                </Link>
                <Separator />
                <nav className="flex flex-col gap-1">
                  <Button variant="default" className="w-full justify-start" onClick={openModal}>
                    <Plus className="mr-2 h-4 w-4" />
                    New project
                  </Button>
                  <Link href="/settings">
                    <Button variant={isSettings ? "secondary" : "ghost"} className="w-full justify-start">
                      <Settings className="mr-2 h-4 w-4" />
                      Settings
                    </Button>
                  </Link>
                </nav>
              </div>
            </SheetContent>
          </Sheet>
          <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <LayoutDashboard className="h-5 w-5 text-primary" />
            <span className="hidden sm:inline-block">Better Articles</span>
          </Link>
        </div>
        <nav className="hidden items-center gap-1 lg:flex">
          <Button variant="default" size="sm" onClick={openModal}>
            <Plus className="mr-2 h-4 w-4" />
            New project
          </Button>
          <Link href="/settings">
            <Button variant={isSettings ? "secondary" : "ghost"} size="icon" aria-label="Settings">
              <Settings className="h-4 w-4" />
            </Button>
          </Link>
        </nav>
      </div>
    </div>
  );
}
