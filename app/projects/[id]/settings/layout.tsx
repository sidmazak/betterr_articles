"use client";

import { useParams, usePathname } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Globe, FileText, Send } from "lucide-react";

const subNavItems = [
  { href: (id: string) => `/projects/${id}/settings/site`, label: "Site", icon: Globe },
  { href: (id: string) => `/projects/${id}/settings/content`, label: "Content", icon: FileText },
  { href: (id: string) => `/projects/${id}/settings/publishing`, label: "Publishing", icon: Send },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const pathname = usePathname();
  const id = params.id as string;

  return (
    <div className="w-full space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="mt-1 text-muted-foreground">
          Configure your site, content generation defaults, and publishing destinations.
        </p>
      </div>

      <div className="flex gap-2 border-b pb-2">
        {subNavItems.map((item) => {
          const href = item.href(id);
          const isActive = pathname === href || pathname?.startsWith(href + "/");
          const Icon = item.icon;
          return (
            <Link key={item.label} href={href}>
              <Button variant={isActive ? "secondary" : "ghost"} size="sm">
                <Icon className="mr-2 h-4 w-4" />
                {item.label}
              </Button>
            </Link>
          );
        })}
      </div>

      {children}
    </div>
  );
}
