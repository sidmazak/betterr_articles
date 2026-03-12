"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  ExternalLink,
  FileText,
  Trash2,
  Pencil,
  Eye,
  RefreshCw,
  CalendarPlus,
  MoreVertical,
  Send,
  Clock,
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

type CalendarGenerationJobState = {
  id: string;
  status: string;
  progress: number;
  total_steps: number;
  generated_items: number;
  total_items: number;
  current_stage: string | null;
  current_message: string | null;
  eta_seconds: number | null;
  start_date: string | null;
  end_date: string | null;
  replace_existing: boolean;
  append_existing: boolean;
  whole_month: boolean;
  error_message: string | null;
};

type CalendarGenerationJobLog = {
  id: string;
  level: "info" | "warn" | "error";
  message: string;
  stage: string | null;
  details: string | null;
  created_at: string;
};

type ProjectWithCalendarJob = Project & {
  activeCalendarJob?: Partial<CalendarGenerationJobState> | null;
  publishingPlatforms?: Array<{
    id: string;
    enabled: boolean;
    auto_publish: boolean;
    label: string;
    platform: string;
  }>;
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function parseJsonArray(value: string | null) {
  if (!value) return [] as string[];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

function notifyProjectMetricsChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("project-metrics-updated"));
}

type ParsedInternalLinkTarget = {
  url: string | null;
  title: string | null;
  reason: string | null;
  label: string;
};

function parseInternalLinkTargets(value: string | null): ParsedInternalLinkTarget[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry): ParsedInternalLinkTarget | null => {
        if (typeof entry === "string") {
          const label = entry.trim();
          if (!label) return null;
          return {
            url: label.startsWith("http://") || label.startsWith("https://") ? label : null,
            title: null,
            reason: null,
            label,
          };
        }
        if (!entry || typeof entry !== "object") return null;
        const item = entry as Record<string, unknown>;
        const url = typeof item.url === "string" && item.url.trim() ? item.url.trim() : null;
        const title = typeof item.title === "string" && item.title.trim() ? item.title.trim() : null;
        const reason = typeof item.reason === "string" && item.reason.trim() ? item.reason.trim() : null;
        const label =
          title && url
            ? `${title} (${url})`
            : title
              ? title
              : url
                ? url
                : reason ?? "";
        if (!label) return null;
        return { url, title, reason, label };
      })
      .filter((entry): entry is ParsedInternalLinkTarget => entry !== null);
  } catch {
    return [];
  }
}

function normalizeCalendarGenerationJob(value: unknown): CalendarGenerationJobState | null {
  if (!value || typeof value !== "object") return null;
  const job = value as Record<string, unknown>;
  const id = typeof job.id === "string" ? job.id : null;
  const status = typeof job.status === "string" ? job.status : null;
  if (!id || !status) return null;
  return {
    id,
    status,
    progress: typeof job.progress === "number" ? job.progress : 0,
    total_steps:
      typeof job.total_steps === "number"
        ? job.total_steps
        : typeof job.totalSteps === "number"
          ? job.totalSteps
          : 0,
    generated_items:
      typeof job.generated_items === "number"
        ? job.generated_items
        : typeof job.generatedItems === "number"
          ? job.generatedItems
          : 0,
    total_items:
      typeof job.total_items === "number"
        ? job.total_items
        : typeof job.totalItems === "number"
          ? job.totalItems
          : 0,
    current_stage:
      typeof job.current_stage === "string"
        ? job.current_stage
        : typeof job.stage === "string"
          ? job.stage
          : null,
    current_message:
      typeof job.current_message === "string"
        ? job.current_message
        : typeof job.message === "string"
          ? job.message
          : null,
    eta_seconds:
      typeof job.eta_seconds === "number"
        ? job.eta_seconds
        : typeof job.etaSeconds === "number"
          ? job.etaSeconds
          : null,
    start_date:
      typeof job.start_date === "string"
        ? job.start_date
        : typeof job.startDate === "string"
          ? job.startDate
          : null,
    end_date:
      typeof job.end_date === "string"
        ? job.end_date
        : typeof job.endDate === "string"
          ? job.endDate
          : null,
    replace_existing:
      typeof job.replace_existing === "boolean"
        ? job.replace_existing
        : typeof job.replaceExisting === "boolean"
          ? job.replaceExisting
          : !!job.replace_existing,
    append_existing:
      typeof job.append_existing === "boolean"
        ? job.append_existing
        : typeof job.appendExisting === "boolean"
          ? job.appendExisting
          : !!job.append_existing,
    whole_month:
      typeof job.whole_month === "boolean"
        ? job.whole_month
        : typeof job.wholeMonth === "boolean"
          ? job.wholeMonth
          : !!job.whole_month,
    error_message:
      typeof job.error_message === "string"
        ? job.error_message
        : typeof job.errorMessage === "string"
          ? job.errorMessage
          : null,
  };
}

export default function CalendarPage() {
  const params = useParams();
  const id = params.id as string;
  const [project, setProject] = useState<ProjectWithCalendarJob | null>(null);
  const [items, setItems] = useState<EnrichedCalendarItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [calendarJob, setCalendarJob] = useState<CalendarGenerationJobState | null>(null);
  const [calendarJobLogs, setCalendarJobLogs] = useState<CalendarGenerationJobLog[]>([]);
  const [calendarJobStreaming, setCalendarJobStreaming] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedItem, setSelectedItem] = useState<EnrichedCalendarItem | null>(null);
  const [sheetMode, setSheetMode] = useState<"view" | "edit">("view");
  const [genScope, setGenScope] = useState<"today" | "week" | "month" | "custom">("month");
  const [genStartDate, setGenStartDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [genEndDate, setGenEndDate] = useState(() =>
    format(addDays(new Date(), 7), "yyyy-MM-dd")
  );
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false);
  const [scheduleMenuOpen, setScheduleMenuOpen] = useState(false);
  const [regenerateDialogOpen, setRegenerateDialogOpen] = useState(false);
  const [regenerateFeedback, setRegenerateFeedback] = useState("");
  const [genAppend, setGenAppend] = useState(true);
  const calendarEventSourceRef = useRef<EventSource | null>(null);
  const connectedCalendarJobIdRef = useRef<string | null>(null);

  const openGenerateDialog = useCallback(
    (
      scope: "today" | "week" | "month" | "custom",
      preset?: { startDate: string; endDate: string }
    ) => {
      const today = new Date();
      const todayValue = format(today, "yyyy-MM-dd");
      setGenScope(scope);
      if (preset) {
        setGenStartDate(preset.startDate);
        setGenEndDate(preset.endDate);
      } else if (scope === "today") {
        setGenStartDate(todayValue);
        setGenEndDate(todayValue);
      } else if (scope === "week") {
        setGenStartDate(todayValue);
        setGenEndDate(format(addDays(today, 6), "yyyy-MM-dd"));
      } else if (scope === "month") {
        setGenStartDate(todayValue);
        setGenEndDate(format(endOfMonth(today), "yyyy-MM-dd"));
      } else {
        setGenStartDate(todayValue);
        setGenEndDate(format(addDays(today, 7), "yyyy-MM-dd"));
      }
      setGenerateDialogOpen(true);
    },
    []
  );

  const refreshProject = useCallback(async () => {
    if (!id) return null;
    const response = await fetch(`/api/projects/${id}`);
    const data = response.ok ? await response.json() : null;
    setProject(data);
    return data as ProjectWithCalendarJob | null;
  }, [id]);

  const refreshCalendarItems = useCallback(async () => {
    if (!id) return [] as EnrichedCalendarItem[];
    const response = await fetch(`/api/projects/${id}/calendar`);
    const data = response.ok ? await response.json() : [];
    setItems(Array.isArray(data) ? data : []);
    return Array.isArray(data) ? data : [];
  }, [id]);

  const loadCalendarJob = useCallback(
    async (jobId: string) => {
      const response = await fetch(`/api/projects/${id}/calendar/jobs/${jobId}`);
      const data = response.ok ? await response.json() : null;
      if (!data) return null;
      setCalendarJob(normalizeCalendarGenerationJob(data));
      setCalendarJobLogs(Array.isArray(data.logs) ? data.logs : []);
      return data;
    },
    [id]
  );

  const connectToCalendarJob = useCallback(
    (jobId: string) => {
      if (!id || !jobId) return;
      if (connectedCalendarJobIdRef.current === jobId && calendarEventSourceRef.current) {
        return;
      }

      calendarEventSourceRef.current?.close();
      calendarEventSourceRef.current = null;

      const es = new EventSource(`/api/projects/${id}/calendar/jobs/${jobId}/stream`);
      calendarEventSourceRef.current = es;
      connectedCalendarJobIdRef.current = jobId;

      es.addEventListener("open", () => {
        setCalendarJobStreaming(true);
        console.log("[CalendarJob UI] stream connected", { jobId });
      });

      es.addEventListener("progress", (event) => {
        const data = JSON.parse((event as MessageEvent).data);
        const nextJob = normalizeCalendarGenerationJob(data);
        if (nextJob) {
          setCalendarJob((prev) => ({ ...(prev ?? nextJob), ...nextJob }));
        }
        console.log("[CalendarJob UI] progress", data);
      });

      es.addEventListener("log", (event) => {
        const data = JSON.parse((event as MessageEvent).data);
        const nextLog: CalendarGenerationJobLog = {
          id: `calendar-log-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          level: data.level ?? "info",
          message: data.message ?? "",
          stage: data.stage ?? null,
          details: data.details ? JSON.stringify(data.details) : null,
          created_at: new Date().toISOString(),
        };
        setCalendarJobLogs((prev) => [...prev, nextLog]);
        if (data.level === "error") {
          console.warn("[CalendarJob UI][error]", data.message, data.details ?? "");
        } else if (data.level === "warn") {
          console.warn("[CalendarJob UI]", data.message, data.details ?? "");
        } else {
          console.log("[CalendarJob UI]", data.message, data.details ?? "");
        }
      });

      es.addEventListener("done", async (event) => {
        const data = JSON.parse((event as MessageEvent).data);
        console.log("[CalendarJob UI] done", data);
        setCalendarJobStreaming(false);
        setLoading(false);
        es.close();
        if (calendarEventSourceRef.current === es) {
          calendarEventSourceRef.current = null;
        }
        connectedCalendarJobIdRef.current = null;

        const nextJob = normalizeCalendarGenerationJob(data.job);
        if (nextJob) {
          setCalendarJob(nextJob);
        }
        if (data.status === "failed" && data.error) {
          setError(data.error);
        }
        await Promise.allSettled([
          loadCalendarJob(jobId),
          refreshCalendarItems(),
          refreshProject(),
        ]);
        notifyProjectMetricsChanged();
      });

      es.onerror = () => {
        setCalendarJobStreaming(false);
        console.warn("[CalendarJob UI] stream disconnected, waiting for reconnect", { jobId });
      };
    },
    [id, loadCalendarJob, refreshCalendarItems, refreshProject]
  );

  useEffect(() => {
    refreshProject().catch(() => setProject(null));
  }, [refreshProject]);

  useEffect(() => {
    refreshCalendarItems().catch(() => setItems([]));
  }, [refreshCalendarItems]);

  useEffect(() => {
    const activeJobId = project?.activeCalendarJob?.id;
    if (!activeJobId) return;
    void loadCalendarJob(activeJobId).catch(() => {});
    connectToCalendarJob(activeJobId);
  }, [project?.activeCalendarJob?.id, loadCalendarJob, connectToCalendarJob]);

  useEffect(() => {
    return () => {
      calendarEventSourceRef.current?.close();
      calendarEventSourceRef.current = null;
      connectedCalendarJobIdRef.current = null;
    };
  }, []);

  const regenerateCalendarItem = useCallback(
    async (opts: {
      feedback?: string;
      itemId?: string;
    }) => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`/api/projects/${id}/calendar`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            feedback: opts.feedback,
            itemId: opts.itemId,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Failed to generate calendar");
        } else {
          if (Array.isArray(data) && data.length === 1 && opts.itemId) {
            setItems((prev) =>
              prev.map((i) => (i.id === opts.itemId ? { ...i, ...data[0] } : i))
            );
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to generate calendar");
      } finally {
        setLoading(false);
      }
    },
    [id]
  );

  const startCalendarGenerationJob = useCallback(
    async (opts: {
      wholeMonth?: boolean;
      replace?: boolean;
      append?: boolean;
      feedback?: string;
      startDate?: string;
      endDate?: string;
    }) => {
      setLoading(true);
      setError("");
      setCalendarJobLogs([]);
      try {
        const res = await fetch(`/api/projects/${id}/calendar`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            suggestionCount: opts.wholeMonth ? undefined : 12,
            wholeMonth: opts.wholeMonth,
            replace: opts.append ? false : (opts.replace ?? true),
            append: opts.append,
            feedback: opts.feedback,
            startDate: opts.startDate,
            endDate: opts.endDate,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Failed to start calendar generation");
        }
        const nextJob = normalizeCalendarGenerationJob(data);
        if (!nextJob) {
          throw new Error("Calendar generation job was created, but the response was invalid.");
        }
        setCalendarJob(nextJob);
        console.log("[CalendarJob UI] created job", nextJob);
        connectToCalendarJob(nextJob.id);
        await refreshProject().catch(() => {});
      } catch (err) {
        setLoading(false);
        setError(err instanceof Error ? err.message : "Failed to start calendar generation");
      }
    },
    [id, connectToCalendarJob, refreshProject]
  );

  async function deleteItem(itemId: string) {
    try {
      const res = await fetch(`/api/projects/${id}/calendar/${itemId}`, { method: "DELETE" });
      if (res.ok) {
        setItems((prev) => prev.filter((i) => i.id !== itemId));
        if (selectedItem?.id === itemId) setSelectedItem(null);
        await refreshProject().catch(() => {});
        notifyProjectMetricsChanged();
      }
    } catch {
      // Ignore
    }
  }

  async function updateItem(
    itemId: string,
    updates: Partial<{
      title: string;
      primaryKeyword: string;
      secondaryKeywords: string[];
      suggestedDate: string | null;
      targetUrl: string | null;
      contentGapRationale: string | null;
      internalLinkTargets: string[];
      infographicConcepts: string[];
      rankingPotential: string | null;
      rankingJustification: string | null;
    }>
  ) {
    try {
      const body: Record<string, unknown> = {};
      if (updates.title !== undefined) body.title = updates.title;
      if (updates.primaryKeyword !== undefined) body.primaryKeyword = updates.primaryKeyword;
      if (updates.secondaryKeywords !== undefined) body.secondaryKeywords = updates.secondaryKeywords;
      if (updates.suggestedDate !== undefined) body.suggestedDate = updates.suggestedDate;
      if (updates.targetUrl !== undefined) body.targetUrl = updates.targetUrl;
      if (updates.contentGapRationale !== undefined) body.contentGapRationale = updates.contentGapRationale;
      if (updates.internalLinkTargets !== undefined) body.internalLinkTargets = updates.internalLinkTargets;
      if (updates.infographicConcepts !== undefined) body.infographicConcepts = updates.infographicConcepts;
      if (updates.rankingPotential !== undefined) body.rankingPotential = updates.rankingPotential;
      if (updates.rankingJustification !== undefined) body.rankingJustification = updates.rankingJustification;
      const res = await fetch(`/api/projects/${id}/calendar/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const updated = await res.json();
        setItems((prev) => prev.map((i) => (i.id === itemId ? { ...i, ...updated } : i)));
        setSelectedItem((s) => (s?.id === itemId ? { ...s, ...updated } : s));
      } else {
        const data = await res.json().catch(() => ({}));
        setError(typeof data.error === "string" ? data.error : "Failed to update calendar item.");
      }
    } catch {
      setError("Failed to update calendar item.");
    }
  }

  const todayDateValue = format(new Date(), "yyyy-MM-dd");
  const enabledPublishingPlatforms =
    project?.publishingPlatforms?.filter((platform) => platform.enabled) ?? [];
  const hasPublishingPlatforms = enabledPublishingPlatforms.length > 0;
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

  const publishedCount = items.filter(
    (i) => i.article_status === "published" && i.published_url
  ).length;

  const scheduleMenuIcon = scheduleMenuOpen ? (
    <ChevronUp className="ml-2 h-4 w-4" />
  ) : (
    <ChevronDown className="ml-2 h-4 w-4" />
  );
  const schedulingRangeLabel =
    genStartDate && genEndDate
      ? genStartDate === genEndDate
        ? format(parseISO(genStartDate), "MMMM d, yyyy")
        : `${format(parseISO(genStartDate), "MMM d, yyyy")} – ${format(parseISO(genEndDate), "MMM d, yyyy")}`
      : "Select a custom date range";
  const schedulingActionLabel =
    items.length > 0 ? (genAppend ? "Add to existing schedule" : "Replace scheduled items") : "Create scheduled items";
  const hasActiveCalendarJob =
    calendarJob?.status === "pending" || calendarJob?.status === "running";
  const calendarJobEtaLabel =
    calendarJob?.eta_seconds && calendarJob.eta_seconds > 0
      ? calendarJob.eta_seconds >= 60
        ? `Estimated time: ~${Math.ceil(calendarJob.eta_seconds / 60)} min remaining`
        : `Estimated time: ~${calendarJob.eta_seconds}s remaining`
      : "Estimated time: calculating...";
  const scheduledDates = items
    .map((item) => item.suggested_date)
    .filter((date): date is string => typeof date === "string" && !!date)
    .sort();
  const regenerateStartDate =
    calendarJob?.start_date ?? scheduledDates[0] ?? todayDateValue;
  const regenerateEndDate =
    calendarJob?.end_date ?? scheduledDates[scheduledDates.length - 1] ?? todayDateValue;
  const regenerateRangeLabel =
    regenerateStartDate === regenerateEndDate
      ? format(parseISO(regenerateStartDate), "MMMM d, yyyy")
      : `${format(parseISO(regenerateStartDate), "MMM d, yyyy")} – ${format(parseISO(regenerateEndDate), "MMM d, yyyy")}`;
  const regeneratePlannedCount = Math.max(
    Math.ceil(
      (new Date(regenerateEndDate).getTime() - new Date(regenerateStartDate).getTime()) /
        (24 * 60 * 60 * 1000)
    ) + 1,
    1
  );
  const futureScheduledDates = Array.from(
    new Set(
      items
        .map((item) => item.suggested_date)
        .filter((date): date is string => typeof date === "string" && date >= todayDateValue)
    )
  ).sort();
  const lastScheduledDate = futureScheduledDates[futureScheduledDates.length - 1] ?? null;
  const tomorrowDateValue = format(addDays(parseISO(todayDateValue), 1), "yyyy-MM-dd");
  const nextWeekStartValue = format(addDays(parseISO(todayDateValue), 7), "yyyy-MM-dd");
  const nextWeekEndValue = format(addDays(parseISO(todayDateValue), 13), "yyyy-MM-dd");
  const nextMonthStartDate = addDays(endOfMonth(parseISO(todayDateValue)), 1);
  const nextMonthStartValue = format(nextMonthStartDate, "yyyy-MM-dd");
  const nextMonthEndValue = format(endOfMonth(nextMonthStartDate), "yyyy-MM-dd");
  const currentWeekEndValue = format(addDays(parseISO(todayDateValue), 6), "yyyy-MM-dd");
  const currentMonthEndValue = format(endOfMonth(parseISO(todayDateValue)), "yyyy-MM-dd");
  const nextArticleDateValue = lastScheduledDate
    ? format(addDays(parseISO(lastScheduledDate), 1), "yyyy-MM-dd")
    : todayDateValue;
  const dynamicScheduleOptions: Array<{
    id: string;
    label: string;
    scope: "today" | "week" | "month" | "custom";
    startDate?: string;
    endDate?: string;
  }> = [
    !lastScheduledDate
      ? { id: "today", label: "Schedule for today", scope: "today" }
      : futureScheduledDates.length === 1 && lastScheduledDate === todayDateValue
        ? {
            id: "tomorrow",
            label: "Schedule for tomorrow",
            scope: "custom",
            startDate: tomorrowDateValue,
            endDate: tomorrowDateValue,
          }
        : {
            id: "next-article",
            label: "Schedule next article",
            scope: "custom",
            startDate: nextArticleDateValue,
            endDate: nextArticleDateValue,
          },
    lastScheduledDate && lastScheduledDate >= currentWeekEndValue
      ? {
          id: "next-week",
          label: "Schedule for next week",
          scope: "custom",
          startDate: nextWeekStartValue,
          endDate: nextWeekEndValue,
        }
      : { id: "week", label: "Schedule for next 7 days", scope: "week" },
    lastScheduledDate && lastScheduledDate >= currentMonthEndValue
      ? {
          id: "next-month",
          label: "Schedule for next month",
          scope: "custom",
          startDate: nextMonthStartValue,
          endDate: nextMonthEndValue,
        }
      : { id: "month", label: "Schedule for rest of month", scope: "month" },
    { id: "custom", label: "Schedule for custom range", scope: "custom" },
  ];

  if (!project) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-w-0 w-full">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Your Content Calendar</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {items.length === 0
              ? "Schedule article ideas on your calendar using this project's crawled pages and SEO references. AI will generate and publish each article when its scheduled time arrives."
              : "Review scheduled ideas or open them to edit details. Each scheduled idea is queued for AI generation and publishing at its assigned time."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {items.length > 0 && (
            <DropdownMenu open={scheduleMenuOpen} onOpenChange={setScheduleMenuOpen}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="default"
                  disabled={loading || hasActiveCalendarJob}
                  aria-expanded={scheduleMenuOpen}
                >
                  <CalendarPlus className="mr-2 h-4 w-4" />
                  {hasActiveCalendarJob ? "Scheduling..." : loading ? "Starting..." : "Schedule articles"}
                  {scheduleMenuIcon}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {dynamicScheduleOptions.map((option) => (
                  <DropdownMenuItem
                    key={option.id}
                    onClick={() =>
                      openGenerateDialog(
                        option.scope,
                        option.startDate && option.endDate
                          ? { startDate: option.startDate, endDate: option.endDate }
                          : undefined
                      )
                    }
                  >
                    {option.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {items.length > 0 && (
            <Button
              variant="outline"
              disabled={loading || hasActiveCalendarJob}
              onClick={() => setRegenerateDialogOpen(true)}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Regenerate
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-400">
          {error}
        </div>
      )}

      {calendarJob && (
        <Card className="mb-6 border-primary/30 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Calendar generation progress</CardTitle>
            <CardDescription>
              {calendarJob.current_message ??
                "Scheduling article ideas and preparing them for AI generation and publishing."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <p className="text-sm font-medium text-primary">
                {hasActiveCalendarJob
                  ? calendarJob.progress > 0 && calendarJob.total_steps > 0
                    ? `Scheduling ideas: step ${calendarJob.progress} of ${calendarJob.total_steps}`
                    : "Starting calendar generation..."
                  : calendarJob.status === "completed"
                    ? "Calendar generation completed"
                    : calendarJob.status === "failed"
                      ? "Calendar generation failed"
                      : `Calendar generation ${calendarJob.status}`}
              </p>
              <p className="text-xs text-muted-foreground">
                Stage: {calendarJob.current_stage ?? "queued"}
                {calendarJob.current_message ? ` • ${calendarJob.current_message}` : ""}
              </p>
              <p className="text-xs text-muted-foreground">
                {calendarJobEtaLabel}
                {calendarJob.total_items > 0
                  ? ` • Ideas ${calendarJob.generated_items}/${calendarJob.total_items}`
                  : ""}
                {calendarJob.start_date && calendarJob.end_date
                  ? ` • Window ${calendarJob.start_date} to ${calendarJob.end_date}`
                  : ""}
              </p>
              <p className="text-xs text-muted-foreground">
                Mode: {calendarJob.append_existing ? "Add to existing schedule" : "Replace schedule"}
                {calendarJobStreaming
                  ? " • Live updates connected"
                  : hasActiveCalendarJob
                    ? " • Reconnecting live updates if needed"
                    : ""}
              </p>
            </div>
            {calendarJob.total_steps > 0 && (
              <Progress
                value={Math.round((calendarJob.progress / calendarJob.total_steps) * 100)}
                className="h-2"
              />
            )}
            {calendarJobLogs.length > 0 && (
              <div className="rounded-lg border bg-background/70 p-3">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Live logs
                </p>
                <div className="space-y-2">
                  {calendarJobLogs.slice(-8).map((log) => (
                    <div key={log.id} className="text-xs">
                      <p className="font-medium text-foreground">
                        [{log.level.toUpperCase()}]
                        {log.stage ? ` [${log.stage}]` : ""} {log.message}
                      </p>
                      {log.details && (
                        <p className="mt-1 break-all text-muted-foreground">{log.details}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {items.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Schedule article ideas</CardTitle>
            <CardDescription>
              Run a crawl first, then schedule article ideas using the project&apos;s extracted keywords, SEO research,
              and site context. Internal link suggestions come from the URLs you add in project settings.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DropdownMenu open={scheduleMenuOpen} onOpenChange={setScheduleMenuOpen}>
              <DropdownMenuTrigger asChild>
                <Button
                  disabled={loading || hasActiveCalendarJob}
                  aria-expanded={scheduleMenuOpen}
                >
                  <CalendarPlus className="mr-2 h-4 w-4" />
                  {hasActiveCalendarJob ? "Scheduling..." : loading ? "Starting..." : "Schedule articles"}
                  {scheduleMenuIcon}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {dynamicScheduleOptions.map((option) => (
                  <DropdownMenuItem
                    key={option.id}
                    onClick={() =>
                      openGenerateDialog(
                        option.scope,
                        option.startDate && option.endDate
                          ? { startDate: option.startDate, endDate: option.endDate }
                          : undefined
                      )
                    }
                  >
                    {option.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
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
            </div>

            {publishedCount > 0 && (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/20">
                  <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">G</span>
                </div>
                <div>
                  <p className="font-medium text-emerald-800 dark:text-emerald-200">
                    Your site has {publishedCount} new article{publishedCount !== 1 ? "s" : ""}.
                  </p>
                  <p className="text-sm text-emerald-700 dark:text-emerald-300">
                    Your site should start appearing more in Google as these get indexed.
                  </p>
                </div>
              </div>
            )}

            <Card>
              <CardContent className="p-0">
                <div className="min-w-0 overflow-hidden">
                  <table className="w-full min-w-0 table-fixed border-collapse">
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
                            const dateStr = format(date, "yyyy-MM-dd");
                            return (
                              <CalendarCell
                                key={dateStr}
                                date={date}
                                isCurrentMonth={isCurrentMonth}
                                items={dayItems}
                                projectId={id}
                                canPublish={hasPublishingPlatforms}
                                onDelete={deleteItem}
                                onSelect={(item) => {
                                  setSelectedItem(item);
                                  setSheetMode("view");
                                }}
                                onRegenerateSingle={(itemId) =>
                                  regenerateCalendarItem({ itemId })
                                }
                              />
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

      <ItemSheet
        key={selectedItem?.id ?? "empty"}
        item={selectedItem}
        mode={sheetMode}
        onClose={() => setSelectedItem(null)}
        onEdit={() => setSheetMode("edit")}
        onCancelEdit={() => setSheetMode("view")}
        onSave={(updates) => {
          if (updates.suggestedDate && updates.suggestedDate < todayDateValue) {
            setError("You can only schedule articles for today or a future date.");
            return;
          }
          if (selectedItem) updateItem(selectedItem.id, updates);
          setError("");
          setSheetMode("view");
        }}
        onRegenerate={() => {
          if (selectedItem) regenerateCalendarItem({ itemId: selectedItem.id });
          setSelectedItem(null);
        }}
        onDelete={() => {
          if (selectedItem) deleteItem(selectedItem.id);
          setSelectedItem(null);
        }}
        projectId={id}
      />

      <Dialog open={generateDialogOpen} onOpenChange={setGenerateDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Schedule article ideas</DialogTitle>
            <DialogDescription>
              Review the schedule below, then confirm. AI will use this project&apos;s site context, extracted
              keywords, SEO research, and your saved internal links to generate and publish each article at its scheduled time.
              {items.length > 0 && " You can either add to your existing schedule or replace the currently scheduled items."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="space-y-3">
              <Label className="text-sm font-medium">Scheduling window</Label>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={genScope === "today" ? "default" : "outline"}
                  size="sm"
                  onClick={() => openGenerateDialog("today")}
                >
                  Today
                </Button>
                <Button
                  variant={genScope === "week" ? "default" : "outline"}
                  size="sm"
                  onClick={() => openGenerateDialog("week")}
                >
                  Next 7 days
                </Button>
                <Button
                  variant={genScope === "month" ? "default" : "outline"}
                  size="sm"
                  onClick={() => openGenerateDialog("month")}
                >
                  Rest of month
                </Button>
                <Button
                  variant={genScope === "custom" ? "default" : "outline"}
                  size="sm"
                  onClick={() => openGenerateDialog("custom")}
                >
                  Custom
                </Button>
              </div>
            </div>

            {genScope !== "custom" && genStartDate && genEndDate && (
              <p className="rounded-md bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
                {format(parseISO(genStartDate), "EEE, MMM d")} – {format(parseISO(genEndDate), "EEE, MMM d, yyyy")}
              </p>
            )}

            {genScope === "custom" && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="gen-start" className="text-sm font-medium">Start date</Label>
                  <Input
                    id="gen-start"
                    type="date"
                    value={genStartDate}
                    onChange={(e) => setGenStartDate(e.target.value)}
                    min={todayDateValue}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gen-end" className="text-sm font-medium">End date</Label>
                  <Input
                    id="gen-end"
                    type="date"
                    value={genEndDate}
                    onChange={(e) => setGenEndDate(e.target.value)}
                    min={genStartDate || todayDateValue}
                  />
                </div>
              </div>
            )}

            {items.length > 0 && (
              <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/20 px-4 py-3">
                <div className="flex-1">
                  <Label htmlFor="gen-append" className="cursor-pointer text-sm font-medium">
                    Keep existing scheduled items
                  </Label>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Turn this off to replace the current schedule with newly generated article ideas.
                  </p>
                </div>
                <Switch
                  id="gen-append"
                  checked={genAppend}
                  onCheckedChange={setGenAppend}
                />
              </div>
            )}

            <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
              <p className="text-sm font-medium text-foreground">Confirm scheduled AI article generation</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Window: {schedulingRangeLabel}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Action: {schedulingActionLabel}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Once confirmed, article ideas will be scheduled on the calendar and AI will generate and publish them when their scheduled time arrives.
              </p>
            </div>

          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setGenerateDialogOpen(false)}
            >
              Go back
            </Button>
            <Button
              onClick={async () => {
                const today = new Date();
                const todayValue = format(today, "yyyy-MM-dd");
                let start: string;
                let end: string;
                if (genScope === "today") {
                  start = todayValue;
                  end = start;
                } else if (genScope === "week") {
                  start = genStartDate || todayValue;
                  end = genEndDate || format(addDays(today, 6), "yyyy-MM-dd");
                } else if (genScope === "month") {
                  start = genStartDate || todayValue;
                  end = genEndDate || format(endOfMonth(today), "yyyy-MM-dd");
                } else {
                  if (!genStartDate || !genEndDate) {
                    setError("Please select start and end dates.");
                    return;
                  }
                  if (genStartDate < todayDateValue || genEndDate < todayDateValue) {
                    setError("You can only schedule articles for today or a future date.");
                    return;
                  }
                  if (genStartDate > genEndDate) {
                    setError("Start date must be before end date.");
                    return;
                  }
                  start = genStartDate;
                  end = genEndDate;
                }
                if (start < todayDateValue || end < todayDateValue) {
                  setError("You can only schedule articles for today or a future date.");
                  return;
                }
                setError("");
                setGenerateDialogOpen(false);
                await startCalendarGenerationJob({
                  wholeMonth: true,
                  replace: items.length === 0 ? true : !genAppend,
                  append: items.length > 0 && genAppend,
                  startDate: start,
                  endDate: end,
                });
              }}
              disabled={loading || hasActiveCalendarJob}
            >
              {loading ? "Starting..." : "Confirm & generate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={regenerateDialogOpen} onOpenChange={setRegenerateDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Regenerate the last generated schedule</DialogTitle>
            <DialogDescription>
              This will regenerate the same schedule window as the last generation run so the same batch of
              ideas gets replaced together.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-muted-foreground">
              <p>
                Window: <span className="font-medium text-foreground">{regenerateRangeLabel}</span>
              </p>
              <p className="mt-1">
                Planned ideas: <span className="font-medium text-foreground">{regeneratePlannedCount}</span>
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="regen-feedback" className="text-sm font-medium">
                Optional feedback for AI
              </Label>
              <Textarea
                id="regen-feedback"
                placeholder="e.g. More how-to guides, fewer listicles, focus on X topic..."
                value={regenerateFeedback}
                onChange={(e) => setRegenerateFeedback(e.target.value)}
                className="min-h-[80px] resize-y"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRegenerateDialogOpen(false);
                setRegenerateFeedback("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={async () => {
                setRegenerateDialogOpen(false);
                await startCalendarGenerationJob({
                  wholeMonth: true,
                  replace: true,
                  startDate: regenerateStartDate,
                  endDate: regenerateEndDate,
                  feedback: regenerateFeedback || undefined,
                });
                setRegenerateFeedback("");
              }}
              disabled={loading || hasActiveCalendarJob}
            >
              {loading ? "Starting..." : "Confirm & regenerate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CalendarCell({
  date,
  isCurrentMonth,
  items,
  projectId,
  canPublish,
  onDelete,
  onSelect,
  onRegenerateSingle,
}: {
  date: Date;
  isCurrentMonth: boolean;
  items: EnrichedCalendarItem[];
  projectId: string;
  canPublish: boolean;
  onDelete: (id: string) => void;
  onSelect: (item: EnrichedCalendarItem) => void;
  onRegenerateSingle: (itemId: string) => void;
}) {
  return (
    <td
      className="min-h-[120px] min-w-0 align-top overflow-hidden border-b border-r p-2 last:border-r-0"
    >
      <div
        className={`text-sm font-medium ${
          isCurrentMonth ? "text-foreground" : "text-muted-foreground/60"
        }`}
      >
        {format(date, "d")}
      </div>
      <div className="mt-2 min-w-0 space-y-2">
        {items.map((item) => (
          <ArticleCard
            key={item.id}
            item={item}
            projectId={projectId}
            canPublish={canPublish}
            onDelete={() => onDelete(item.id)}
            onSelect={() => onSelect(item)}
            onRegenerateSingle={() => onRegenerateSingle(item.id)}
          />
        ))}
      </div>
    </td>
  );
}

function ArticleCard({
  item,
  projectId,
  canPublish,
  onDelete,
  onSelect,
  onRegenerateSingle,
}: {
  item: EnrichedCalendarItem;
  projectId: string;
  canPublish: boolean;
  onDelete: () => void;
  onSelect: () => void;
  onRegenerateSingle: () => void;
}) {
  const published = item.article_status === "published" && item.published_url;
  const written = item.article_id && item.article_status === "draft";
  const canRegenerateSingle = !written && !published;
  const canDelete = !written && !published;

  const statusVariant = published
    ? "published"
    : written
      ? "written"
      : "suggested";

  return (
    <div
      className={`overflow-hidden rounded-lg border text-left shadow-sm transition-all hover:shadow-md ${
        statusVariant === "published"
          ? "border-emerald-500/40 bg-emerald-50/50 dark:bg-emerald-950/20 dark:border-emerald-500/30"
          : statusVariant === "written"
            ? "border-cyan-500/40 bg-cyan-50/50 dark:bg-cyan-950/20 dark:border-cyan-500/30"
            : "border-blue-200/60 bg-white dark:bg-card dark:border-border"
      }`}
    >
      {/* Status badge bar */}
      <div
        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold ${
          statusVariant === "published"
            ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
            : statusVariant === "written"
              ? "bg-cyan-500/20 text-cyan-700 dark:text-cyan-300"
              : "bg-slate-100 text-slate-600 dark:bg-muted dark:text-muted-foreground"
        }`}
      >
        {statusVariant === "published" && (
          <>
            <CheckCircle className="h-3.5 w-3.5 shrink-0" />
            PUBLISHED
          </>
        )}
        {statusVariant === "written" && (
          <>
            <Clock className="h-3.5 w-3.5 shrink-0" />
            WRITTEN
          </>
        )}
        {statusVariant === "suggested" && "SCHEDULED"}
      </div>

      <div className="p-3">
        <div
          className="min-w-0 cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            onSelect();
          }}
        >
          <p
            className="line-clamp-3 wrap-break-word text-sm font-semibold leading-snug text-foreground"
            title={item.title}
          >
            {item.title}
          </p>
          <p className="mt-1.5 truncate text-xs text-muted-foreground">
            <span className="font-medium text-muted-foreground/80">Search term:</span>{" "}
            {item.primary_keyword}
          </p>
          {item.suggested_date && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {format(parseISO(item.suggested_date), "EEE, MMM d")}
            </p>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <div className="flex shrink-0 items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6">
                  <MoreVertical className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onSelect}>
                  <Eye className="mr-2 h-4 w-4" />
                  View / Edit
                </DropdownMenuItem>
                {canRegenerateSingle && (
                  <DropdownMenuItem onClick={onRegenerateSingle}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Regenerate this idea
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            {canDelete && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete this calendar item?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will remove the item from the calendar.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={(e) => { e.stopPropagation(); onDelete(); }}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
          <Link
            href={
              item.article_id
                ? `/projects/${projectId}/articles/${item.article_id}`
                : `/projects/${projectId}/write/${item.id}`
            }
            onClick={(e) => e.stopPropagation()}
          >
            <Button
              size="sm"
              variant={published ? "secondary" : "default"}
              className="h-7 text-xs font-medium"
            >
              <FileText className="mr-1.5 h-3 w-3" />
              {published ? "View Article" : written ? "Open Article" : "Write article"}
            </Button>
          </Link>
          {written && item.article_id && (
            <PublishNowButton
              projectId={projectId}
              calendarItemId={item.id}
              title={item.title}
              articleId={item.article_id}
              canPublish={canPublish}
            />
          )}
          {published && item.published_url && (
            <a
              href={item.published_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
            >
              <Button size="sm" variant="outline" className="h-7 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                <ExternalLink className="mr-1.5 h-3 w-3" />
                View Live
              </Button>
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function PublishNowButton({
  projectId,
  calendarItemId,
  title,
  articleId,
  canPublish,
}: {
  projectId: string;
  calendarItemId: string;
  title: string;
  articleId: string;
  canPublish: boolean;
}) {
  const [publishing, setPublishing] = useState(false);
  async function handlePublish() {
    if (!canPublish) return;
    setPublishing(true);
    try {
      const artRes = await fetch(`/api/projects/${projectId}/articles/${articleId}`);
      const art = await artRes.json();
      if (!art?.content) {
        window.location.href = `/projects/${projectId}/write/${calendarItemId}`;
        return;
      }
      const pubRes = await fetch(`/api/projects/${projectId}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content: art.content, calendarItemId, articleId }),
      });
      if (pubRes.ok) window.location.reload();
      else window.location.href = `/projects/${projectId}/write/${calendarItemId}`;
    } catch {
      window.location.href = `/projects/${projectId}/write/${calendarItemId}`;
    } finally {
      setPublishing(false);
    }
  }
  return (
    <Button
      size="sm"
      variant={canPublish ? "default" : "secondary"}
      className="h-7 text-xs font-medium disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
      onClick={(e) => {
        e.stopPropagation();
        handlePublish();
      }}
      disabled={publishing || !canPublish}
      title={canPublish ? "Publish now" : "Add a publishing platform in Settings to enable publishing"}
    >
      <Send className="mr-1.5 h-3 w-3" />
      {publishing ? "Publishing…" : "Publish Now"}
    </Button>
  );
}

function ItemSheet({
  item,
  mode,
  onClose,
  onEdit,
  onCancelEdit,
  onSave,
  onRegenerate,
  onDelete,
  projectId,
}: {
  item: EnrichedCalendarItem | null;
  mode: "view" | "edit";
  onClose: () => void;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSave: (updates: {
    title?: string;
    primaryKeyword?: string;
    secondaryKeywords?: string[];
    suggestedDate?: string | null;
    contentGapRationale?: string | null;
    internalLinkTargets?: string[];
    infographicConcepts?: string[];
    rankingPotential?: string | null;
    rankingJustification?: string | null;
  }) => void;
  onRegenerate: () => void;
  onDelete: () => void;
  projectId: string;
}) {
  const secondaryKw = parseJsonArray(item?.secondary_keywords ?? null);
  const [editTitle, setEditTitle] = useState(item?.title ?? "");
  const [editKeyword, setEditKeyword] = useState(item?.primary_keyword ?? "");
  const [editDate, setEditDate] = useState(item?.suggested_date ?? "");
  const [editSecondaryKw, setEditSecondaryKw] = useState(secondaryKw.join(", "));
  const [editRationale, setEditRationale] = useState(item?.content_gap_rationale ?? "");
  const [editInternalLinks, setEditInternalLinks] = useState(
    parseInternalLinkTargets(item?.internal_link_targets ?? null)
      .map((link) => link.url ?? link.title ?? link.label)
      .filter(Boolean)
      .join(", ")
  );
  const [editInfographics, setEditInfographics] = useState(
    parseJsonArray(item?.infographic_concepts ?? null).join(", ")
  );
  const [editRankingPotential, setEditRankingPotential] = useState<string>(
    item?.ranking_potential?.toLowerCase() ?? ""
  );
  const [editRankingJustification, setEditRankingJustification] = useState(
    item?.ranking_justification ?? ""
  );
  const minScheduleDate = format(new Date(), "yyyy-MM-dd");
  const written = !!item?.article_id && item?.article_status === "draft";
  const published = item?.article_status === "published" && !!item?.published_url;
  const canRegenerate = !written && !published;
  const canDelete = !written && !published;

  if (!item) return null;

  return (
    <Sheet open={!!item} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="flex w-full flex-col overflow-y-auto sm:max-w-xl">
        <SheetHeader className="border-b px-6 pb-6 pt-6">
          <SheetTitle>{mode === "edit" ? "Edit idea" : "View idea"}</SheetTitle>
          <SheetDescription>
            {mode === "view"
              ? "Full details of this content idea. Edit to adjust or use the actions below."
              : "Update the fields below and save your changes."}
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {mode === "view" ? (
            <div className="space-y-6">
              <section>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Article details
                </h3>
                <div className="space-y-4">
                  <div>
                    <Label className="text-muted-foreground">Title</Label>
                    <p className="mt-1.5 rounded-md bg-muted/50 px-3 py-2.5 text-sm font-medium leading-relaxed text-foreground">
                      {item.title}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Primary keyword</Label>
                    <p className="mt-1.5 rounded-md bg-muted/50 px-3 py-2 text-sm text-foreground">
                      {item.primary_keyword}
                    </p>
                  </div>
                  {secondaryKw.length > 0 && (
                    <div>
                      <Label className="text-muted-foreground">Secondary keywords</Label>
                      <p className="mt-1.5 rounded-md bg-muted/50 px-3 py-2 text-sm text-foreground">
                        {secondaryKw.join(", ")}
                      </p>
                    </div>
                  )}
                </div>
              </section>

              <section>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Schedule & targeting
                </h3>
                <div className="space-y-4">
                  <div>
                    <Label className="text-muted-foreground">Suggested publish date</Label>
                    <p className="mt-1.5 rounded-md bg-muted/50 px-3 py-2 text-sm text-foreground">
                      {item.suggested_date
                        ? format(parseISO(item.suggested_date), "EEEE, MMMM d, yyyy")
                        : "—"}
                    </p>
                  </div>
                  {item.ranking_potential && (
                    <div>
                      <Label className="text-muted-foreground">Ranking potential</Label>
                      <p className="mt-1.5">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            item.ranking_potential === "high"
                              ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                              : item.ranking_potential === "low"
                                ? "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                                : "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
                          }`}
                        >
                          {item.ranking_potential}
                        </span>
                      </p>
                    </div>
                  )}
                  {(() => {
                    const links = parseInternalLinkTargets(item.internal_link_targets);
                    return links.length > 0 ? (
                      <div>
                        <Label className="text-muted-foreground">Internal links from settings</Label>
                        <div className="mt-1.5 space-y-2 rounded-md bg-muted/50 px-3 py-2 text-sm text-foreground">
                          {links.map((link, index) => (
                            <div key={`${link.label}-${index}`}>
                              <p className="break-all">{link.label}</p>
                              {link.reason ? (
                                <p className="mt-0.5 text-xs text-muted-foreground">{link.reason}</p>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null;
                  })()}
                  {(() => {
                    const infos = item.infographic_concepts
                      ? (typeof item.infographic_concepts === "string"
                          ? (JSON.parse(item.infographic_concepts) as string[])
                          : item.infographic_concepts)
                      : [];
                    return Array.isArray(infos) && infos.length > 0 ? (
                      <div>
                        <Label className="text-muted-foreground">Infographic concepts</Label>
                        <p className="mt-1.5 rounded-md bg-muted/50 px-3 py-2 text-sm text-foreground">
                          {infos.join(", ")}
                        </p>
                      </div>
                    ) : null;
                  })()}
                </div>
              </section>

              {item.content_gap_rationale && (
                <section>
                  <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    AI rationale
                  </h3>
                  <p className="rounded-md bg-muted/50 px-3 py-2.5 text-sm leading-relaxed text-foreground">
                    {item.content_gap_rationale}
                  </p>
                </section>
              )}

              {item.ranking_justification && (
                <section>
                  <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Ranking justification
                  </h3>
                  <p className="rounded-md bg-muted/50 px-3 py-2.5 text-sm leading-relaxed text-foreground">
                    {item.ranking_justification}
                  </p>
                </section>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              <section>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Article details
                </h3>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="edit-title">Title</Label>
                    <Input
                      id="edit-title"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="mt-1.5"
                      placeholder="Article title"
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-keyword">Primary keyword</Label>
                    <Input
                      id="edit-keyword"
                      value={editKeyword}
                      onChange={(e) => setEditKeyword(e.target.value)}
                      className="mt-1.5"
                      placeholder="Main target keyword"
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-secondary-kw">Secondary keywords</Label>
                    <Input
                      id="edit-secondary-kw"
                      value={editSecondaryKw}
                      onChange={(e) => setEditSecondaryKw(e.target.value)}
                      className="mt-1.5"
                      placeholder="kw-a, kw-b, kw-c"
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      Comma-separated list of additional keywords
                    </p>
                  </div>
                </div>
              </section>

              <section>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Schedule & targeting
                </h3>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="edit-date">Suggested publish date</Label>
                    <Input
                      id="edit-date"
                      type="date"
                      value={editDate}
                      onChange={(e) => setEditDate(e.target.value)}
                      min={minScheduleDate}
                      className="mt-1.5"
                    />
                  </div>
                </div>
              </section>

              <section>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Content strategy
                </h3>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="edit-rationale">Content gap rationale</Label>
                    <Textarea
                      id="edit-rationale"
                      value={editRationale}
                      onChange={(e) => setEditRationale(e.target.value)}
                      className="mt-1.5 min-h-[80px] resize-y"
                      placeholder="Why this article fills a content gap..."
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-internal-links">Internal link targets</Label>
                    <Input
                      id="edit-internal-links"
                      value={editInternalLinks}
                      onChange={(e) => setEditInternalLinks(e.target.value)}
                      placeholder="https://example.com/page-1, https://example.com/page-2"
                      className="mt-1.5"
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      These should match the internal URLs you added in project settings.
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="edit-infographics">Infographic concepts</Label>
                    <Input
                      id="edit-infographics"
                      value={editInfographics}
                      onChange={(e) => setEditInfographics(e.target.value)}
                      placeholder="Concept 1, Concept 2"
                      className="mt-1.5"
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      Ideas for infographics to include
                    </p>
                  </div>
                </div>
              </section>

              <section>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Ranking potential
                </h3>
                <div className="space-y-4">
                  <div>
                    <Label>Ranking potential</Label>
                    <Select
                      value={editRankingPotential?.toLowerCase() || "medium"}
                      onValueChange={setEditRankingPotential}
                    >
                      <SelectTrigger className="mt-1.5 w-full">
                        <SelectValue placeholder="Select potential" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="edit-ranking-just">Ranking justification</Label>
                    <Textarea
                      id="edit-ranking-just"
                      value={editRankingJustification}
                      onChange={(e) => setEditRankingJustification(e.target.value)}
                      className="mt-1.5 min-h-[60px] resize-y"
                      placeholder="Why this has high/medium/low ranking potential..."
                    />
                  </div>
                </div>
              </section>
            </div>
          )}
        </div>
        <div className="shrink-0 border-t bg-muted/20 px-6 py-4">
          <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Actions
          </p>
          <div className="flex flex-wrap gap-2">
          {mode === "view" ? (
            <>
              <Button onClick={onEdit}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </Button>
              {canRegenerate && (
                <Button variant="outline" onClick={onRegenerate}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Regenerate with AI
                </Button>
              )}
              <Link href={`/projects/${projectId}/write/${item.id}`}>
                <Button variant="secondary">
                  <FileText className="mr-2 h-4 w-4" />
                  Write article
                </Button>
              </Link>
              {canDelete && (
                <Button variant="destructive" onClick={onDelete}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
              )}
            </>
          ) : (
            <>
              <Button
                onClick={() => {
                  if (editDate && editDate < minScheduleDate) {
                    return;
                  }
                  const secondaryArr = editSecondaryKw
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean);
                  const internalArr = editInternalLinks
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean);
                  const infographicArr = editInfographics
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean);
                  onSave({
                    title: editTitle,
                    primaryKeyword: editKeyword,
                    secondaryKeywords: secondaryArr,
                    suggestedDate: editDate || null,
                    contentGapRationale: editRationale || null,
                    internalLinkTargets: internalArr,
                    infographicConcepts: infographicArr,
                    rankingPotential: editRankingPotential || null,
                    rankingJustification: editRankingJustification || null,
                  });
                }}
              >
                Save
              </Button>
              <Button variant="outline" onClick={onCancelEdit}>
                Cancel
              </Button>
            </>
          )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
