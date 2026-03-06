"use client";

import { useState } from "react";
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, homepageUrl: homepageUrl || undefined }),
      });
      const project = await res.json();
      if (project.id) {
        setName("");
        setHomepageUrl("");
        onOpenChange(false);
        router.push(`/projects/${project.id}`);
      }
    } finally {
      setLoading(false);
    }
  }

  function handleOpenChange(next: boolean) {
    if (!next) {
      setName("");
      setHomepageUrl("");
    }
    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New project</DialogTitle>
          <DialogDescription>
            Add a project with an optional homepage URL for crawling.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="modal-name">Project name</Label>
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
            <Button type="submit" disabled={loading}>
              {loading ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
