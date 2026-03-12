"use client";

import Link from "next/link";
import { LayoutDashboard } from "lucide-react";

export function AppHeader() {
  return (
    <div className="flex h-full w-full items-center">
      <div className="flex h-14 w-full items-center gap-4 px-4 lg:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2 font-semibold tracking-tight">
          <LayoutDashboard className="h-5 w-5 text-primary" />
          <span className="hidden sm:inline-block">{process.env.NEXT_PUBLIC_SITE_NAME}</span>
        </Link>
      </div>
    </div>
  );
}
