"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  ExternalLink,
  FileText,
  Trash2,
  Star,
} from "lucide-react";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  parseISO,
} from "date-fns";
import type { Project } from "@/lib/db";
import type { CalendarItemRow } from "@/lib/db";

type EnrichedCalendarItem = CalendarItemRow & {
  article_id?: string;
  published_url?: string | null;
  article_status?: string | null;
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function CalendarPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [project, setProject] = useState<Project | null>(null);
  const [items, setItems] = useState<EnrichedCalendarItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [currentMonth, setCurrentMonth] = useState(new Date());

  useEffect(() => {
    fetch(`/api/projects/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setProject)
      .catch(() => setProject(null));
  }, [id]);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/projects/${id}/calendar`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setItems)
      .catch(() => setItems([]));
  }, [id]);

  async function generateCalendar(simulate = false) {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/projects/${id}/calendar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          suggestionCount: 12,
          replace: true,
          simulate,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.mockData) {
          setError("Add API key for real suggestions. Showing mock data.");
          setItems(data.mockData);
        } else {
          throw new Error(data.error || "Failed");
        }
      } else {
        setItems(data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate calendar");
    } finally {
      setLoading(false);
    }
  }

  async function deleteItem(itemId: string) {
    try {
      const res = await fetch(`/api/projects/${id}/calendar/${itemId}`, { method: "DELETE" });
      if (res.ok) setItems((prev) => prev.filter((i) => i.id !== itemId));
    } catch {
      // Ignore
    }
  }

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);

  const weeks: Date[][] = [];
  let day = calendarStart;
  while (day <= calendarEnd) {
    const week: Date[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(day);
      day = addDays(day, 1);
    }
    weeks.push(week);
  }

  function getItemsForDay(date: Date) {
    return items.filter((item) => {
      if (!item.suggested_date) return false;
      const d = parseISO(item.suggested_date);
      return isSameDay(d, date);
    });
  }

  const isPublished = (item: EnrichedCalendarItem) =>
    item.article_status === "published" && item.published_url;

  if (!project) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Your Content Calendar</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Articles are published to your site daily. Click an item to write or view the article.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => generateCalendar(false)} disabled={loading}>
            {loading ? "Generating..." : "Give Feedback & Recreate"}
          </Button>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-400">
          {error}
        </div>
      )}

      {items.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Generate calendar</CardTitle>
            <CardDescription>
              Run a crawl or add manual URLs first. Then generate AI-suggested article titles,
              keywords, and a publishing schedule.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => generateCalendar(false)} disabled={loading}>
                {loading ? "Generating..." : "Generate with AI"}
              </Button>
              <Button variant="secondary" onClick={() => generateCalendar(true)} disabled={loading}>
                {loading ? "Generating..." : "Simulate AI"}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Simulate AI creates mock calendar items without calling the LLM.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <span className="ml-2 font-medium">
                {format(calendarStart, "MMM d")} – {format(calendarEnd, "MMM d, yyyy")}
              </span>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => generateCalendar(true)} disabled={loading}>
                Simulate AI
              </Button>
              <Button variant="outline" size="sm" onClick={() => generateCalendar(false)} disabled={loading}>
                Regenerate with AI
              </Button>
            </div>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      {DAYS.map((d) => (
                        <th
                          key={d}
                          className="border-b border-r bg-muted/50 px-2 py-3 text-center text-xs font-medium text-muted-foreground last:border-r-0"
                        >
                          {d}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {weeks.map((week, wi) => (
                      <tr key={wi}>
                        {week.map((date) => {
                          const dayItems = getItemsForDay(date);
                          const isCurrentMonth = isSameMonth(date, currentMonth);
                          return (
                            <td
                              key={date.toISOString()}
                              className="min-h-[120px] w-[14.28%] align-top border-b border-r p-2 last:border-r-0"
                            >
                              <div
                                className={`text-sm font-medium ${
                                  isCurrentMonth ? "text-foreground" : "text-muted-foreground/60"
                                }`}
                              >
                                {format(date, "d")}
                              </div>
                              <div className="mt-2 space-y-2">
                                {dayItems.map((item) => (
                                  <ArticleCard
                                    key={item.id}
                                    item={item}
                                    projectId={id}
                                    onDelete={() => deleteItem(item.id)}
                                  />
                                ))}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function ArticleCard({
  item,
  projectId,
  onDelete,
}: {
  item: EnrichedCalendarItem;
  projectId: string;
  onDelete: () => void;
}) {
  const published = item.article_status === "published" && item.published_url;
  const isBonus = item.ranking_potential === "high";

  return (
    <div
      className={`rounded-lg border bg-card p-3 text-left transition-colors hover:bg-muted/30 ${
        isBonus ? "border-amber-500/50 bg-amber-500/5" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          {isBonus && (
            <div className="mb-1 flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400">
              <Star className="h-3 w-3 fill-current" />
              BONUS ARTICLE
            </div>
          )}
          {published && (
            <div className="mb-1 flex items-center gap-1 text-xs font-medium text-green-600 dark:text-green-400">
              <CheckCircle className="h-3.5 w-3.5" />
              PUBLISHED
            </div>
          )}
          <p className="line-clamp-2 text-sm font-medium">{item.title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Search term: {item.primary_keyword}
          </p>
          {!published && item.suggested_date && (
            <p className="mt-1 text-xs text-muted-foreground">
              Will be written on: {format(parseISO(item.suggested_date), "EEE, MMM d")}
            </p>
          )}
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this calendar item?</AlertDialogTitle>
              <AlertDialogDescription>
                This will remove the item from the calendar. The article content (if any) will not be deleted.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={onDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        <Link href={`/projects/${projectId}/write/${item.id}`}>
          <Button size="sm" variant={published ? "secondary" : "default"} className="h-7 text-xs">
            <FileText className="mr-1 h-3 w-3" />
            {published ? "View Article" : "Write article"}
          </Button>
        </Link>
        {published && item.published_url && (
          <a href={item.published_url} target="_blank" rel="noopener noreferrer">
            <Button size="sm" variant="outline" className="h-7 text-xs">
              <ExternalLink className="mr-1 h-3 w-3" />
              View Live
            </Button>
          </a>
        )}
      </div>
    </div>
  );
}
