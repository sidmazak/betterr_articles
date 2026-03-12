"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface NewProjectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewProjectModal({ open, onOpenChange }: NewProjectModalProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [homepageUrl, setHomepageUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [llmConfigured, setLlmConfigured] = useState<boolean | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    fetch("/api/settings/llm")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setLlmConfigured(!!data?.default?.is_configured))
      .catch(() => setLlmConfigured(false));
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    if (llmConfigured === false) {
      setError("Configure AI first. At least one API key provider and model is required before creating a site.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, homepageUrl: homepageUrl || undefined }),
      });
      const project = await res.json();
      if (!res.ok) {
        throw new Error(project.error || "Failed to create site");
      }
      if (project.id) {
        setName("");
        setHomepageUrl("");
        onOpenChange(false);
        router.push(`/projects/${project.id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create site");
    } finally {
      setLoading(false);
    }
  }

  function handleOpenChange(next: boolean) {
    if (!next) {
      setName("");
      setHomepageUrl("");
      setError("");
    }
    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Site</DialogTitle>
          <DialogDescription>
            Add a website to manage. Crawl for SEO data, extract search terms, and plan content.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {llmConfigured === false && (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
              Configure AI first. At least one provider API key and model is required before creating a site.
              {" "}
              <Link href="/settings?tab=llm" className="font-medium underline underline-offset-2">
                Open settings
              </Link>
              .
            </div>
          )}
          {error && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="modal-name">Site name</Label>
            <Input
              id="modal-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Blog"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="modal-url">Homepage URL (optional)</Label>
            <Input
              id="modal-url"
              type="url"
              value={homepageUrl}
              onChange={(e) => setHomepageUrl(e.target.value)}
              placeholder="https://yoursite.com"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || llmConfigured === false}>
              {loading ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
