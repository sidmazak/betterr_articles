"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import dynamic from "next/dynamic";
import "@uiw/react-md-editor/markdown-editor.css";

const MDEditor = dynamic(() => import("@uiw/react-md-editor"), { ssr: false });
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ArrowLeft, ChevronDown, ChevronRight } from "lucide-react";
import type { Project } from "@/lib/db";
import type { CalendarItemRow } from "@/lib/db";
import type { ExistingPage } from "@/lib/prompts/types";
import type { ArticlePipelineInput } from "@/lib/prompts/types";
import type { ProjectArticleDefaultsResponse } from "@/lib/db/article-defaults";
import { SUPPORTED_LANGUAGES } from "@/lib/llm-constants";
import {
  CONTENT_LENGTHS,
  TONES,
  STYLES,
  READING_LEVELS,
  ARTICLE_TYPES,
} from "@/lib/article-defaults-constants";

interface ActiveArticleJobSummary {
  id: string;
  status: string;
  progress: number;
  total_steps: number;
  current_stage: string;
  current_message: string | null;
  eta_seconds: number | null;
  calendar_item_id: string | null;
  article_id: string | null;
  content_length: number;
  reasoning_length: number;
  last_heartbeat_at: string | null;
}

interface ProjectView extends Project {
  activeArticleJob?: ActiveArticleJobSummary | null;
}

const GENERATION_PROGRESS_STEPS = [
  { progress: 8, title: "Preparing site context", detail: "Loading site defaults, internal links, and article settings." },
  { progress: 18, title: "Reviewing search intent", detail: "Checking the keyword, topic fit, and site context before drafting." },
  { progress: 32, title: "Deciding research depth", detail: "Determining whether extra research is needed for this article." },
  { progress: 48, title: "Collecting support material", detail: "Gathering facts, context, and competitive angles when needed." },
  { progress: 66, title: "Writing the article", detail: "Drafting the body, structure, FAQs, links, and key sections." },
  { progress: 80, title: "Optimizing SEO signals", detail: "Balancing keyword density, headings, metadata, and infographic coverage." },
  { progress: 92, title: "Finalizing the result", detail: "Saving the article and preparing the scored article page." },
] as const;

type StreamLogLevel = "info" | "success" | "warn" | "error";
type StreamPreviewTarget = "content" | "research" | "none";
type StreamChunkMode = "append" | "replace";

interface GenerationStatus {
  title: string;
  detail: string;
}

interface GenerationLogEntry {
  id: string;
  level: StreamLogLevel;
  message: string;
  extra?: string | null;
  timestamp?: string;
}

interface LiveStreamMetrics {
  requestLabel: string;
  model: string | null;
  provider: string | null;
  estimatedCompletionTokens: number;
  estimatedReasoningTokens?: number;
  reasoningLength?: number;
  contentLength: number;
}

interface LiveStreamStatus {
  requestLabel: string;
  provider: string | null;
  model: string | null;
  attempt: number;
  maxAttempts: number;
  elapsedMs: number;
  status: "waiting" | "streaming" | "completed";
  waitingForFirstChunk: boolean;
  reasoningActive?: boolean;
  reasoningLength?: number;
  contentLength?: number;
}

interface StreamPhaseEvent {
  title: string;
  detail: string;
  progress: number;
  previewTarget?: StreamPreviewTarget;
  chunkMode?: StreamChunkMode;
}

interface StreamLogEvent {
  level: StreamLogLevel;
  message: string;
  extra?: string | null;
  timestamp?: string;
}

interface StreamTokenEvent {
  requestLabel: string;
  model?: string | null;
  provider?: string | null;
  estimatedCompletionTokens: number;
  estimatedReasoningTokens?: number;
  reasoningLength?: number;
  contentLength: number;
}

interface StreamChunkEvent {
  target: StreamPreviewTarget;
  chunkMode?: StreamChunkMode;
  textDelta: string;
}

interface StreamReasoningEvent {
  requestLabel: string;
  textDelta: string;
  reasoningLength?: number;
}

interface StreamStatusEvent {
  requestLabel: string;
  provider?: string | null;
  model?: string | null;
  attempt: number;
  maxAttempts: number;
  elapsedMs: number;
  status: "waiting" | "streaming" | "completed";
  waitingForFirstChunk: boolean;
  reasoningActive?: boolean;
  reasoningLength?: number;
  contentLength?: number;
}

interface StreamProgressEvent {
  id: string;
  status: string;
  progress: number;
  totalSteps?: number;
  stage?: string;
  message?: string | null;
  etaSeconds?: number | null;
  contentLength?: number;
  reasoningLength?: number;
  articleId?: string | null;
  calendarItemId?: string | null;
  errorMessage?: string | null;
}

interface StreamResultPayload {
  content?: string;
  articleId?: string;
  researchContent?: string;
  researchDecision?: { reason?: string };
  status?: string;
  publishedUrl?: string | null;
}

interface StreamDoneEvent {
  status?: "completed" | "failed" | "cancelled" | "timeout";
  articleId?: string | null;
}

interface ArticleJobDetailPayload {
  id: string;
  status: string;
  progress: number;
  total_steps: number;
  current_stage: string;
  current_message: string | null;
  eta_seconds: number | null;
  error_message: string | null;
  provider: string | null;
  model: string | null;
  attempt: number;
  content_length: number;
  reasoning_length: number;
  last_heartbeat_at: string | null;
  calendar_item_id: string | null;
  article_id: string | null;
  reasoning_content: string | null;
  research_content: string | null;
  content: string | null;
  result_json: string | null;
  logs: StreamLogEvent[];
}

function parseSseEventBlock(block: string) {
  const trimmed = block.trim();
  if (!trimmed) return null;

  let event = "message";
  const dataLines: string[] = [];

  for (const line of trimmed.split("\n")) {
    if (line.startsWith("event:")) {
      event = line.slice(6).trim();
      continue;
    }
    if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trimStart());
    }
  }

  if (dataLines.length === 0) return null;

  try {
    return {
      event,
      data: JSON.parse(dataLines.join("\n")) as unknown,
    };
  } catch {
    return null;
  }
}

function getTokenDrivenProgress(requestLabel: string, estimatedTokens: number) {
  switch (requestLabel) {
    case "article-research":
      return Math.min(58, 48 + estimatedTokens / 30);
    case "article-content":
      return Math.min(78, 66 + estimatedTokens / 55);
    case "article-content-complete":
      return Math.min(84, 78 + estimatedTokens / 65);
    case "article-seo-optimize":
      return Math.min(92, 86 + estimatedTokens / 65);
    case "article-metadata":
      return Math.min(96, 94 + estimatedTokens / 80);
    default:
      return 0;
  }
}

function formatLiveStreamLabel(requestLabel: string) {
  switch (requestLabel) {
    case "article-research-decision":
      return "Research decision";
    case "article-research":
      return "Research stream";
    case "article-content":
      return "Draft stream";
    case "article-content-complete":
      return "Continuation stream";
    case "article-seo-optimize":
      return "SEO rewrite";
    case "article-metadata":
      return "Metadata stream";
    default:
      return "Model stream";
  }
}

function formatElapsedMs(elapsedMs: number) {
  return `${(elapsedMs / 1000).toFixed(1)}s`;
}

export default function WritePage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;
  const calendarItemId = params.calendarItemId as string;
  const [project, setProject] = useState<ProjectView | null>(null);
  const [calendarItem, setCalendarItem] = useState<CalendarItemRow | null>(null);
  const [existingPages, setExistingPages] = useState<ExistingPage[]>([]);
  const [publishedArticles, setPublishedArticles] = useState<ExistingPage[]>([]);
  const [internalLinks, setInternalLinks] = useState<ExistingPage[]>([]);
  const [projectDefaults, setProjectDefaults] = useState<Partial<ArticlePipelineInput>>({});
  const [articleId, setArticleId] = useState<string | null>(null);
  const [articleStatus, setArticleStatus] = useState<string | null>(null);
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [researchContent, setResearchContent] = useState("");
  const [reasoningContent, setReasoningContent] = useState("");
  const [researchReason, setResearchReason] = useState("");
  const [language, setLanguage] = useState("en");
  const [requireInfographics, setRequireInfographics] = useState(true);
  const [length, setLength] = useState<ArticlePipelineInput["length"]>("Long");
  const [tone, setTone] = useState<ArticlePipelineInput["tone"]>("Professional");
  const [style, setStyle] = useState<ArticlePipelineInput["style"]>("Informative");
  const [readingLevel, setReadingLevel] = useState<ArticlePipelineInput["readingLevel"]>("Intermediate");
  const [articleType, setArticleType] = useState<ArticlePipelineInput["articleType"] | "_any">("_any");
  const [internalLinking, setInternalLinking] = useState(true);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [generationStepIndex, setGenerationStepIndex] = useState(0);
  const [generationProgressValue, setGenerationProgressValue] = useState(0);
  const [generationStatus, setGenerationStatus] = useState<GenerationStatus>({
    title: GENERATION_PROGRESS_STEPS[0].title,
    detail: GENERATION_PROGRESS_STEPS[0].detail,
  });
  const [generationLogs, setGenerationLogs] = useState<GenerationLogEntry[]>([]);
  const [liveStreamMetrics, setLiveStreamMetrics] = useState<LiveStreamMetrics | null>(null);
  const [liveStreamStatus, setLiveStreamStatus] = useState<LiveStreamStatus | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState("");
  const [articleJobId, setArticleJobId] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const streamAbortRef = useRef<AbortController | null>(null);
  const lockedProjectArticleType = projectDefaults.articleType;

  useEffect(() => {
    const nextIndex = GENERATION_PROGRESS_STEPS.reduce((bestIndex, step, index) => {
      return generationProgressValue >= step.progress ? index : bestIndex;
    }, 0);
    setGenerationStepIndex(nextIndex);
  }, [generationProgressValue]);

  useEffect(() => {
    fetch(`/api/projects/${projectId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setProject(data as ProjectView | null))
      .catch(() => setProject(null));
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return;
    Promise.all([
      fetch(`/api/projects/${projectId}/crawl-results`).then((r) => r.json()),
      fetch(`/api/projects/${projectId}/published-articles`).then((r) => r.json()),
      fetch(`/api/projects/${projectId}/internal-links`).then((r) => (r.ok ? r.json() : [])),
    ]).then(([crawl, pub, internal]) => {
      const pages = (crawl.pages ?? []) as ExistingPage[];
      const internalAsPages = (internal as { url: string; title: string | null }[]).map((l) => ({
        url: l.url,
        title: l.title || l.url,
      }));
      setExistingPages(pages);
      setPublishedArticles(pub.articles ?? []);
      setInternalLinks(internalAsPages);
    }).catch(() => {
      setExistingPages([]);
      setPublishedArticles([]);
      setInternalLinks([]);
    });
  }, [projectId]);

  useEffect(() => {
    if (!projectId || !calendarItemId) return;
    fetch(`/api/projects/${projectId}/calendar`)
      .then((r) => (r.ok ? r.json() : []))
      .then((items: CalendarItemRow[]) => {
        const found = (items as Array<CalendarItemRow & { article_id?: string; article_status?: string | null; published_url?: string | null }>).find((i) => i.id === calendarItemId);
        setCalendarItem(found ?? null);
        setArticleId(found?.article_id ?? null);
        setArticleStatus(found?.article_status ?? null);
        setPublishedUrl(found?.published_url ?? null);
      })
      .catch(() => setCalendarItem(null));
  }, [projectId, calendarItemId]);

  useEffect(() => {
    if (!projectId || !articleId) {
      setContent("");
      setResearchContent("");
      setResearchReason("");
      return;
    }

    fetch(`/api/projects/${projectId}/articles/${articleId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((article) => {
        if (!article) return;
        setContent(article.content ?? "");
        setResearchContent(article.research_content ?? "");
        setArticleStatus(article.status ?? null);
        setPublishedUrl(article.published_url ?? null);
      })
      .catch(() => {});
  }, [projectId, articleId]);

  useEffect(() => {
    if (!projectId) return;
    fetch(`/api/projects/${projectId}/article-defaults`)
      .then((r) => (r.ok ? r.json() : {}))
      .then((d: ProjectArticleDefaultsResponse) => {
        const cleanDefaults = Object.fromEntries(
          Object.entries(d).filter(([key]) => key !== "_researchSummary")
        ) as Partial<ArticlePipelineInput>;
        setProjectDefaults(cleanDefaults);
        if (cleanDefaults.language) setLanguage(cleanDefaults.language);
        if (cleanDefaults.requireInfographics === true) setRequireInfographics(true);
        if (cleanDefaults.length) setLength(cleanDefaults.length);
        if (cleanDefaults.tone) setTone(cleanDefaults.tone);
        if (cleanDefaults.style) setStyle(cleanDefaults.style);
        if (cleanDefaults.readingLevel) setReadingLevel(cleanDefaults.readingLevel);
        if (cleanDefaults.articleType) setArticleType(cleanDefaults.articleType as ArticlePipelineInput["articleType"]);
        if (cleanDefaults.internalLinking !== undefined) setInternalLinking(cleanDefaults.internalLinking);
      })
      .catch(() => setProjectDefaults({}));
  }, [projectId]);

  const appendGenerationLog = useCallback((entry: StreamLogEvent) => {
    setGenerationLogs((current) => {
      const nextEntry: GenerationLogEntry = {
        id: `log-${crypto.randomUUID()}`,
        level: entry.level,
        message: entry.message,
        extra: entry.extra ?? null,
        timestamp: entry.timestamp,
      };
      return [...current.slice(-119), nextEntry];
    });
  }, []);

  const hydrateFromJobDetail = useCallback((job: ArticleJobDetailPayload) => {
    setArticleJobId(job.id);
    setArticleId(job.article_id ?? null);
    setArticleStatus(job.article_id ? "draft" : null);
    setReasoningContent(job.reasoning_content ?? "");
    setResearchContent(job.research_content ?? "");
    setContent(job.content ?? "");
    setGenerationLogs(
      (job.logs ?? []).map((entry, index) => ({
        id: `hydrate-${index}`,
        level: entry.level,
        message: entry.message,
        extra: entry.extra ?? null,
        timestamp: entry.timestamp,
      }))
    );
    setGenerationProgressValue(job.progress ?? 0);
    setLiveStreamMetrics({
      requestLabel: job.current_stage ?? "article_generation",
      model: job.model ?? null,
      provider: job.provider ?? null,
      estimatedCompletionTokens: job.content_length / 4,
      estimatedReasoningTokens: job.reasoning_length / 4,
      reasoningLength: job.reasoning_length ?? 0,
      contentLength: job.content_length ?? 0,
    });
    setLiveStreamStatus({
      requestLabel: job.current_stage ?? "article_generation",
      provider: job.provider ?? null,
      model: job.model ?? null,
      attempt: job.attempt ?? 1,
      maxAttempts: 5,
      elapsedMs: 0,
      status:
        job.status === "completed" || job.status === "failed" || job.status === "cancelled"
          ? "completed"
          : "streaming",
      waitingForFirstChunk: (job.content_length ?? 0) === 0 && (job.reasoning_length ?? 0) === 0,
      reasoningActive: (job.reasoning_length ?? 0) > 0 && (job.content_length ?? 0) === 0,
      reasoningLength: job.reasoning_length ?? 0,
      contentLength: job.content_length ?? 0,
    });
    if (job.current_stage && job.current_message) {
      setGenerationStatus({
        title: formatLiveStreamLabel(job.current_stage),
        detail: job.current_message,
      });
    }
    if (job.result_json) {
      try {
        const result = JSON.parse(job.result_json) as StreamResultPayload;
        setResearchReason(result.researchDecision?.reason ?? "");
        setPublishedUrl(result.publishedUrl ?? null);
        if (result.status) {
          setArticleStatus(result.status);
        }
      } catch {
        // ignore malformed stored payload
      }
    }
  }, []);

  const loadArticleJobDetail = useCallback(async (jobId: string) => {
    const res = await fetch(`/api/projects/${projectId}/article-jobs/${jobId}`);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      throw new Error(data?.error || "Failed to load article generation job");
    }
    const detail = (await res.json()) as ArticleJobDetailPayload;
    hydrateFromJobDetail(detail);
    return detail;
  }, [projectId, hydrateFromJobDetail]);

  const connectToArticleJob = useCallback(async (
    jobId: string,
    options?: { resetState?: boolean; reconnecting?: boolean }
  ) => {
    const resetState = options?.resetState ?? true;
    setCancelling(false);
    setLoading(true);
    setError("");
    if (resetState) {
      setContent("");
      setResearchContent("");
      setReasoningContent("");
      setResearchReason("");
      setGenerationLogs([
        {
          id: `log-${Date.now()}`,
          level: "info",
          message: options?.reconnecting
            ? "Reconnecting to active article generation job."
            : "Creating article generation job.",
          timestamp: new Date().toISOString(),
        },
      ]);
      setLiveStreamMetrics(null);
      setLiveStreamStatus(null);
      setGenerationStatus({
        title: GENERATION_PROGRESS_STEPS[0].title,
        detail: GENERATION_PROGRESS_STEPS[0].detail,
      });
      setGenerationProgressValue(GENERATION_PROGRESS_STEPS[0].progress);
    }
    setArticleJobId(jobId);

    try {
      const detail = await loadArticleJobDetail(jobId);
      if (detail.status === "completed" || detail.status === "failed" || detail.status === "cancelled") {
        if (detail.status === "failed") {
          throw new Error(detail.error_message || "Generation failed");
        }
        if (detail.status === "cancelled") {
          appendGenerationLog({
            level: "warn",
            message: "Article generation was cancelled.",
            timestamp: new Date().toISOString(),
          });
          return;
        }
        return;
      }

      const abortController = new AbortController();
      streamAbortRef.current = abortController;

      const res = await fetch(`/api/projects/${projectId}/article-jobs/${jobId}/stream`, {
        headers: {
          Accept: "text/event-stream",
        },
        signal: abortController.signal,
      });

      if (!res.ok) {
        const data = await res.text();
        throw new Error(data || "Failed to open article generation stream");
      }

      if (!res.body) {
        throw new Error("Streaming response was empty");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let finalResult: StreamResultPayload | null = null;
      let doneStatus: StreamDoneEvent["status"] | null = null;

      while (true) {
        const { value, done } = await reader.read();
        buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
        buffer = buffer.replace(/\r\n/g, "\n");

        let boundary = buffer.indexOf("\n\n");
        while (boundary >= 0) {
          const block = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          boundary = buffer.indexOf("\n\n");

          const parsed = parseSseEventBlock(block);
          if (!parsed) continue;

          switch (parsed.event) {
            case "phase": {
              const data = parsed.data as StreamPhaseEvent;
              if (typeof data.progress === "number") {
                setGenerationProgressValue(data.progress);
              }
              if (typeof data.title === "string" && typeof data.detail === "string") {
                setGenerationStatus({
                  title: data.title,
                  detail: data.detail,
                });
              }
              if (data.previewTarget === "content" && data.chunkMode === "replace") {
                setContent("");
              }
              if (data.previewTarget === "research" && data.chunkMode === "replace") {
                setResearchContent("");
              }
              appendGenerationLog({
                level: "info",
                message: data.title,
                extra: data.detail,
                timestamp: new Date().toISOString(),
              });
              break;
            }
            case "progress": {
              const data = parsed.data as StreamProgressEvent;
              if (typeof data.progress === "number") {
                setGenerationProgressValue((current) => Math.max(current, data.progress));
              }
              if (typeof data.stage === "string") {
                setLiveStreamStatus((current) => ({
                  requestLabel: data.stage ?? current?.requestLabel ?? "article_generation",
                  provider: current?.provider ?? null,
                  model: current?.model ?? null,
                  attempt: current?.attempt ?? 1,
                  maxAttempts: current?.maxAttempts ?? 5,
                  elapsedMs: current?.elapsedMs ?? 0,
                  status:
                    data.status === "completed" ||
                    data.status === "failed" ||
                    data.status === "cancelled" ||
                    data.status === "timeout"
                      ? "completed"
                      : "streaming",
                  waitingForFirstChunk: (data.contentLength ?? 0) === 0 && (data.reasoningLength ?? 0) === 0,
                  reasoningActive: (data.reasoningLength ?? 0) > 0 && (data.contentLength ?? 0) === 0,
                  reasoningLength: data.reasoningLength ?? 0,
                  contentLength: data.contentLength ?? 0,
                }));
              }
              if (data.articleId) {
                setArticleId(data.articleId);
              }
              break;
            }
            case "log": {
              appendGenerationLog(parsed.data as StreamLogEvent);
              break;
            }
            case "status": {
              const data = parsed.data as StreamStatusEvent;
              setLiveStreamStatus({
                requestLabel: data.requestLabel,
                provider: data.provider ?? null,
                model: data.model ?? null,
                attempt: data.attempt,
                maxAttempts: data.maxAttempts,
                elapsedMs: data.elapsedMs,
                status: data.status,
                waitingForFirstChunk: data.waitingForFirstChunk,
                reasoningActive: data.reasoningActive ?? false,
                reasoningLength: data.reasoningLength ?? 0,
                contentLength: data.contentLength ?? 0,
              });
              break;
            }
            case "token": {
              const data = parsed.data as StreamTokenEvent;
              setLiveStreamMetrics({
                requestLabel: data.requestLabel,
                model: data.model ?? null,
                provider: data.provider ?? null,
                estimatedCompletionTokens: data.estimatedCompletionTokens,
                estimatedReasoningTokens: data.estimatedReasoningTokens ?? 0,
                reasoningLength: data.reasoningLength ?? 0,
                contentLength: data.contentLength,
              });
              const tokenProgress = getTokenDrivenProgress(
                data.requestLabel,
                data.estimatedCompletionTokens
              );
              if (tokenProgress > 0) {
                setGenerationProgressValue((current) =>
                  Math.max(current, Number(tokenProgress.toFixed(0)))
                );
              }
              break;
            }
            case "reasoning": {
              const data = parsed.data as StreamReasoningEvent;
              if (!data.textDelta) break;
              setReasoningContent((current) => `${current}${data.textDelta}`);
              break;
            }
            case "chunk": {
              const data = parsed.data as StreamChunkEvent;
              if (!data.textDelta) break;
              if (data.target === "content") {
                setContent((current) => `${current}${data.textDelta}`);
              }
              if (data.target === "research") {
                setResearchContent((current) => `${current}${data.textDelta}`);
              }
              break;
            }
            case "usage": {
              const usagePayload = parsed.data as {
                requestLabel?: string;
                usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
              };
              appendGenerationLog({
                level: "success",
                message: `${formatLiveStreamLabel(usagePayload.requestLabel ?? "llm")} completed.`,
                extra:
                  usagePayload.usage
                    ? `prompt ${usagePayload.usage.prompt_tokens ?? 0}, completion ${usagePayload.usage.completion_tokens ?? 0}, total ${usagePayload.usage.total_tokens ?? 0}`
                    : null,
                timestamp: new Date().toISOString(),
              });
              break;
            }
            case "result": {
              finalResult = parsed.data as StreamResultPayload;
              setContent(finalResult?.content ?? "");
              setResearchContent(finalResult?.researchContent ?? "");
              setResearchReason(finalResult?.researchDecision?.reason ?? "");
              setGenerationProgressValue(100);
              setArticleStatus(finalResult?.status ?? "draft");
              setPublishedUrl(finalResult?.publishedUrl ?? null);
              setLiveStreamStatus((current) =>
                current
                  ? {
                      ...current,
                      status: "completed",
                      waitingForFirstChunk: false,
                      reasoningActive: false,
                    }
                  : current
              );
              break;
            }
            case "error": {
              const data = parsed.data as { message?: string };
              throw new Error(data.message || "Generation failed");
            }
            case "done": {
              const data = parsed.data as StreamDoneEvent;
              doneStatus = data.status ?? null;
              if (data.articleId) {
                setArticleId(data.articleId);
              }
              break;
            }
            default:
              break;
          }
        }

        if (done) {
          break;
        }
      }

      if (doneStatus === "cancelled" || doneStatus === "timeout") {
        appendGenerationLog({
          level: "warn",
          message:
            doneStatus === "timeout"
              ? "Connection timed out. Your partial article was saved—check the calendar or refresh."
              : "Article generation cancelled.",
          timestamp: new Date().toISOString(),
        });
        if (doneStatus === "cancelled" && jobId) {
          try {
            await fetch(`/api/projects/${projectId}/article-jobs/${jobId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "cleanup" }),
            });
          } catch {
            /* best-effort cleanup */
          }
        }
        if (doneStatus === "cancelled") {
          setArticleId(null);
          setArticleStatus(null);
        }
        setArticleJobId(null);
        setLoading(false);
        return;
      }

      if (doneStatus === "failed") {
        throw new Error("Generation failed");
      }

      if (!finalResult && doneStatus !== "completed") {
        if (jobId) {
          try {
            await fetch(`/api/projects/${projectId}/article-jobs/${jobId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "cleanup" }),
            });
          } catch {
            /* best-effort cleanup */
          }
        }
        setArticleId(null);
        setArticleStatus(null);
        throw new Error("Generation stream ended unexpectedly");
      }

      if (finalResult?.articleId) {
        setArticleId(finalResult.articleId);
        router.push(`/projects/${projectId}/articles/${finalResult.articleId}?tab=score`);
      }
    } catch (err) {
      if (err instanceof Error && (err.name === "AbortError" || err.message?.includes("abort"))) {
        return;
      }
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      streamAbortRef.current = null;
      setLoading(false);
    }
  }, [appendGenerationLog, loadArticleJobDetail, projectId, router]);

  useEffect(() => {
    const activeJob = project?.activeArticleJob;
    if (!activeJob || activeJob.calendar_item_id !== calendarItemId) return;
    if (activeJob.status !== "pending" && activeJob.status !== "running") return;
    if (loading && articleJobId === activeJob.id) return;
    setArticleJobId(activeJob.id);
    void connectToArticleJob(activeJob.id, { resetState: false, reconnecting: true });
  }, [articleJobId, calendarItemId, connectToArticleJob, loading, project?.activeArticleJob]);

  async function generate() {
    if (!calendarItem) return;
    setCancelling(false);
    setLoading(true);
    try {
      const input: ArticlePipelineInput = {
        keyword: calendarItem.primary_keyword,
        category: projectDefaults.category ?? "General",
        targetAudience: projectDefaults.targetAudience ?? "General audience",
        title: calendarItem.title,
        length: length ?? projectDefaults.length ?? "Long",
        style: style ?? projectDefaults.style ?? "Informative",
        tone: tone ?? projectDefaults.tone ?? "Professional",
        readingLevel: readingLevel ?? projectDefaults.readingLevel ?? "Intermediate",
        contentIntent: projectDefaults.contentIntent ?? "inform",
        internalLinking,
        useCrawledUrlsAsInternalLinks: projectDefaults.useCrawledUrlsAsInternalLinks ?? true,
        requireInfographics,
        existingPages,
        publishedArticles,
        internalLinks,
        externalLinking: projectDefaults.externalLinking ?? false,
        ...(projectDefaults.articleFormat ? { articleFormat: projectDefaults.articleFormat } : {}),
        ...(projectDefaults.pointOfView ? { pointOfView: projectDefaults.pointOfView } : {}),
        ...(projectDefaults.citationStyle ? { citationStyle: projectDefaults.citationStyle } : {}),
        ...(projectDefaults.contentFreshness ? { contentFreshness: projectDefaults.contentFreshness } : {}),
        ...(projectDefaults.includeSubtopics !== undefined
          ? { includeSubtopics: projectDefaults.includeSubtopics }
          : {}),
        ...(projectDefaults.socialMediaOptimization !== undefined
          ? { socialMediaOptimization: projectDefaults.socialMediaOptimization }
          : {}),
        language,
        ...(lockedProjectArticleType
          ? { articleType: lockedProjectArticleType }
          : ((articleType && articleType !== "_any")
            ? { articleType }
            : {})),
        ...(projectDefaults.geoFocus ? { geoFocus: projectDefaults.geoFocus } : {}),
        ...(projectDefaults.customInstructions ? { customInstructions: projectDefaults.customInstructions } : {}),
        ...(projectDefaults.domainKnowledge ? { domainKnowledge: projectDefaults.domainKnowledge } : {}),
        ...(calendarItem.secondary_keywords
          ? {
              secondaryKeywords: JSON.parse(calendarItem.secondary_keywords) as string[],
            }
          : {}),
      };
      if (calendarItem.infographic_concepts) {
        try {
          const concepts = JSON.parse(calendarItem.infographic_concepts) as string[];
          const conceptsStr = Array.isArray(concepts) ? concepts.join(", ") : calendarItem.infographic_concepts;
          const parts = [input.customInstructions, `Infographic concepts from calendar: ${conceptsStr}`].filter(Boolean);
          input.customInstructions = parts.join("\n\n");
        } catch {
          const parts = [input.customInstructions, `Infographic concepts: ${calendarItem.infographic_concepts}`].filter(Boolean);
          input.customInstructions = parts.join("\n\n");
        }
      }

      const res = await fetch(`/api/projects/${projectId}/article-jobs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          calendarItemId,
          input,
          source: "manual",
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Generation failed");
      }
      const job = (await res.json()) as { id: string };
      await connectToArticleJob(job.id, { resetState: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  async function cancelGeneration() {
    if (!articleJobId || cancelling) return;
    setCancelling(true);
    try {
      setError("");
      appendGenerationLog({
        level: "warn",
        message: "Cancelling generation...",
        timestamp: new Date().toISOString(),
      });
      const res = await fetch(`/api/projects/${projectId}/article-jobs/${articleJobId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel" }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || "Failed to cancel generation");
      }
      streamAbortRef.current?.abort();
      appendGenerationLog({
        level: "warn",
        message: "Generation cancelled.",
        timestamp: new Date().toISOString(),
      });
      setArticleId(null);
      setArticleStatus(null);
      setArticleJobId(null);
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to cancel generation");
    } finally {
      setCancelling(false);
    }
  }

  async function publish() {
    if (!content) return;
    setPublishing(true);
    setError("");
    try {
      const res = await fetch(`/api/projects/${projectId}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: calendarItem?.title,
          content,
          calendarItemId,
          articleId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Publish failed");
      setError("");
      setArticleStatus("published");
      setPublishedUrl(data.url ?? null);
      if (articleId) {
        router.push(`/projects/${projectId}/articles/${articleId}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Publish failed");
    } finally {
      setPublishing(false);
    }
  }

  if (!project || !calendarItem) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const currentGenerationStep =
    generationStatus.title && generationStatus.detail
      ? generationStatus
      : GENERATION_PROGRESS_STEPS[Math.min(generationStepIndex, GENERATION_PROGRESS_STEPS.length - 1)];

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {calendarItem.title}
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Keyword: {calendarItem.primary_keyword}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push(`/projects/${projectId}/calendar`)}
          className="shrink-0"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to calendar
        </Button>
      </div>

      {/* Controls card */}
      <Card className="mb-6">
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Generation settings</CardTitle>
          <CardDescription>
            Configure language, infographics, and article parameters before generating.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-3">
              <Label htmlFor="lang" className="text-sm font-medium">
                Language
              </Label>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger id="lang" className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUPPORTED_LANGUAGES.map((l) => (
                    <SelectItem key={l.code} value={l.code}>
                      {l.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-4 py-2.5">
              <Label htmlFor="infographics" className="text-sm font-medium">
                Infographics
              </Label>
              <Switch
                id="infographics"
                checked={requireInfographics}
                onCheckedChange={setRequireInfographics}
              />
              <span className="text-sm text-muted-foreground">
                {requireInfographics ? "Required" : "Optional"}
              </span>
            </div>
          </div>

          <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-2 -ml-2">
                {advancedOpen ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                Article parameters
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-4 grid gap-4 rounded-lg border border-border bg-muted/20 p-5 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <Label className="text-xs">Length</Label>
                <Select value={length ?? ""} onValueChange={(v) => setLength(v as ArticlePipelineInput["length"])}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {CONTENT_LENGTHS.map((l) => (
                      <SelectItem key={l} value={l}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Tone</Label>
                <Select value={tone ?? ""} onValueChange={(v) => setTone(v as ArticlePipelineInput["tone"])}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {TONES.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Style</Label>
                <Select value={style ?? ""} onValueChange={(v) => setStyle(v as ArticlePipelineInput["style"])}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {STYLES.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Reading level</Label>
                <Select value={readingLevel ?? ""} onValueChange={(v) => setReadingLevel(v as ArticlePipelineInput["readingLevel"])}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {READING_LEVELS.map((r) => (
                      <SelectItem key={r} value={r}>{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Article type</Label>
                <Select
                  value={lockedProjectArticleType ?? (articleType === "" || !articleType ? "_any" : articleType)}
                  onValueChange={(v) => setArticleType(v === "_any" ? "_any" : (v as ArticlePipelineInput["articleType"]))}
                  disabled={!!lockedProjectArticleType}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={lockedProjectArticleType ? "Project article type" : "Any"} />
                  </SelectTrigger>
                  <SelectContent>
                    {!lockedProjectArticleType && <SelectItem value="_any">Any</SelectItem>}
                    {(lockedProjectArticleType ? [lockedProjectArticleType] : ARTICLE_TYPES).map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {lockedProjectArticleType && (
                  <p className="text-xs text-muted-foreground">
                    Locked to the project article type inferred from crawl insights and SEO rules.
                  </p>
                )}
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border px-4 py-2.5 sm:col-span-2">
                <Label htmlFor="internal" className="text-xs font-medium">Internal linking</Label>
                <Switch id="internal" checked={internalLinking} onCheckedChange={setInternalLinking} />
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
        </CardContent>
      </Card>

      {/* Main content card */}
      <Card>
        <CardHeader className="px-6 py-6 sm:px-8 sm:py-6">
          <CardTitle className="text-xl">Article</CardTitle>
          <CardDescription className="mt-1.5">
            Full article generation with optional automatic research, infographics, and internal links.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 px-6 pb-6 sm:px-8 sm:pb-8">
          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <Button
              onClick={generate}
              disabled={loading}
              size="lg"
              className="w-full sm:w-auto"
            >
              {loading ? "Generating..." : "Generate article"}
            </Button>
            {loading && articleJobId ? (
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="w-full sm:w-auto"
                onClick={cancelGeneration}
                disabled={cancelling}
              >
                {cancelling ? "Cancelling..." : "Cancel generation"}
              </Button>
            ) : null}
          </div>
          {loading ? (
            <div className="rounded-lg border border-border bg-muted/20 p-4 sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-foreground">{currentGenerationStep.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{currentGenerationStep.detail}</p>
                  {liveStreamMetrics ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      {formatLiveStreamLabel(liveStreamMetrics.requestLabel)}{" "}
                      {liveStreamMetrics.reasoningLength
                        ? `• reasoning ${liveStreamMetrics.reasoningLength.toLocaleString()} chars `
                        : ""}
                      • {liveStreamMetrics.estimatedCompletionTokens.toFixed(1)} tokens
                      {" "}• {liveStreamMetrics.contentLength.toLocaleString()} chars
                      {liveStreamMetrics.model ? ` • ${liveStreamMetrics.model}` : ""}
                    </p>
                  ) : liveStreamStatus ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      {formatLiveStreamLabel(liveStreamStatus.requestLabel)}{" "}
                      • {liveStreamStatus.waitingForFirstChunk
                        ? "waiting for first response"
                        : liveStreamStatus.reasoningActive
                          ? "streaming reasoning"
                          : liveStreamStatus.status}
                      {" "}• {formatElapsedMs(liveStreamStatus.elapsedMs)}
                      {" "}• attempt {liveStreamStatus.attempt}/{liveStreamStatus.maxAttempts}
                      {typeof liveStreamStatus.reasoningLength === "number"
                        ? ` • reasoning ${liveStreamStatus.reasoningLength.toLocaleString()} chars`
                        : ""}
                      {typeof liveStreamStatus.contentLength === "number" && liveStreamStatus.contentLength > 0
                        ? ` • content ${liveStreamStatus.contentLength.toLocaleString()} chars`
                        : ""}
                      {liveStreamStatus.provider ? ` • ${liveStreamStatus.provider}` : ""}
                      {liveStreamStatus.model ? ` • ${liveStreamStatus.model}` : ""}
                    </p>
                  ) : null}
                  {generationProgressValue >= 92 ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Final save steps can still take a little extra time while assets and score inputs are persisted.
                    </p>
                  ) : null}
                </div>
                <p className="text-sm font-medium text-muted-foreground">{generationProgressValue}%</p>
              </div>
              <Progress value={generationProgressValue} className="mt-4" />
              <div className="mt-4 space-y-2">
                {GENERATION_PROGRESS_STEPS.slice(0, generationStepIndex + 1).map((step) => (
                  <div key={step.title} className="rounded-md border border-border/70 bg-background/70 px-3 py-2 text-sm">
                    <p className="font-medium text-foreground">{step.title}</p>
                    <p className="text-muted-foreground">{step.detail}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-md border border-border/70 bg-background/80">
                <div className="border-b border-border/70 px-3 py-2">
                  <p className="text-sm font-medium text-foreground">Realtime generation log</p>
                  <p className="text-xs text-muted-foreground">
                    Verbose phase changes, model stream updates, and server-side save steps.
                  </p>
                </div>
                <div className="max-h-72 space-y-2 overflow-y-auto px-3 py-3">
                  {generationLogs.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Waiting for the first stream event...</p>
                  ) : (
                    generationLogs.map((entry, index) => (
                      <div key={entry.id ? `${entry.id}-${index}` : `log-${index}`} className="rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-sm">
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-medium text-foreground">{entry.message}</p>
                          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                            {entry.level}
                          </p>
                        </div>
                        {entry.extra ? (
                          <p className="mt-1 text-xs text-muted-foreground">{entry.extra}</p>
                        ) : null}
                      </div>
                    ))
                  )}
                </div>
              </div>
              <div className="mt-4 rounded-md border border-border/70 bg-background/80">
                <div className="border-b border-border/70 px-3 py-2">
                  <p className="text-sm font-medium text-foreground">Live model reasoning</p>
                  <p className="text-xs text-muted-foreground">
                    Visible only when the provider emits reasoning tokens before or alongside draft content.
                  </p>
                </div>
                <div className="max-h-72 overflow-y-auto px-3 py-3">
                  {reasoningContent ? (
                    <pre className="wrap-break-word whitespace-pre-wrap text-xs text-muted-foreground">
                      {reasoningContent}
                    </pre>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Waiting for visible model reasoning or draft tokens...
                    </p>
                  )}
                </div>
              </div>
            </div>
          ) : null}
          {(researchReason || researchContent) && (
            <div className="rounded-lg border border-border bg-muted/20 p-4 text-sm">
              <p className="font-medium text-foreground">Automatic research</p>
              <p className="mt-1 text-muted-foreground">
                {researchContent
                  ? researchReason || "AI decided additional research was needed and used it while drafting."
                  : researchReason || "Research skipped because existing context was sufficient."}
              </p>
            </div>
          )}
          {content && (
            <div className="space-y-4 rounded-lg border border-border bg-muted/20 p-4 sm:p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <Label className="text-sm font-medium">Output</Label>
                  {articleStatus && (
                    <p className="text-xs text-muted-foreground">
                      Article status: {articleStatus}
                      {publishedUrl ? ` • ${publishedUrl}` : ""}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {articleId && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push(`/projects/${projectId}/articles/${articleId}`)}
                    >
                      Open article page
                    </Button>
                  )}
                  <Button variant="secondary" size="sm" onClick={publish} disabled={publishing}>
                    {publishing ? "Publishing..." : "Publish to site"}
                  </Button>
                </div>
              </div>
              <div data-color-mode="light">
                <MDEditor
                  value={content}
                  onChange={(v) => setContent(v ?? "")}
                  height={400}
                  preview="edit"
                  hideToolbar={false}
                  visibleDragbar={true}
                  textareaProps={{
                    className: "font-mono text-sm",
                    placeholder: "Article content in markdown...",
                    readOnly:
                      !!liveStreamStatus &&
                      (liveStreamStatus.status === "streaming" ||
                        liveStreamStatus.status === "waiting"),
                  }}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
