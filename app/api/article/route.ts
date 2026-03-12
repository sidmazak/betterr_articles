import { NextRequest, NextResponse } from "next/server";
import { generateArticleBody, maybeGenerateArticleResearch } from "@/lib/article-pipeline";
import { generateArticleMetadata, syncArticleH1WithTitle } from "@/lib/article-assets";
import { upsertArticle } from "@/lib/db/articles";
import { updateCalendarItemStatus } from "@/lib/db/calendar";
import { getDb } from "@/lib/db";
import { resolveProjectArticleDefaults } from "@/lib/db/article-defaults";
import { isImageGenerationConfigured } from "@/lib/db/settings";
import { generateArticleImage } from "@/lib/image-generation";
import { chat, chatStream, type ChatRunner } from "@/lib/llm";
import { type ArticlePipelineInput, type ExistingPage } from "@/lib/prompts/types";

export const dynamic = "force-dynamic";
export const maxDuration = 600;

type ArticleRequestInput = ArticlePipelineInput & {
  existingPages?: ExistingPage[];
  publishedArticles?: ExistingPage[];
};

type StreamLevel = "info" | "success" | "warn" | "error";
type StreamPreviewTarget = "content" | "research" | "none";
type StreamChunkMode = "append" | "replace";

interface StreamPhaseConfig {
  title: string;
  detail: string;
  progress: number;
  previewTarget: StreamPreviewTarget;
  chunkMode: StreamChunkMode;
}

const STREAM_PHASES: Record<string, StreamPhaseConfig> = {
  "article-research-decision": {
    title: "Deciding research depth",
    detail: "The model is evaluating whether this topic needs separate research before drafting.",
    progress: 32,
    previewTarget: "none",
    chunkMode: "append",
  },
  "article-research": {
    title: "Collecting support material",
    detail: "Research notes are streaming in with supporting angles, facts, and context.",
    progress: 48,
    previewTarget: "research",
    chunkMode: "replace",
  },
  "article-content": {
    title: "Writing the article",
    detail: "The main draft is streaming live from the model.",
    progress: 66,
    previewTarget: "content",
    chunkMode: "replace",
  },
  "article-content-complete": {
    title: "Completing unfinished sections",
    detail: "The model is finishing any cutoff sections and stitching the draft cleanly.",
    progress: 78,
    previewTarget: "content",
    chunkMode: "append",
  },
  "article-seo-optimize": {
    title: "Optimizing SEO signals",
    detail: "A second pass is rewriting the draft to tighten keyword and infographic coverage.",
    progress: 86,
    previewTarget: "content",
    chunkMode: "replace",
  },
  "article-metadata": {
    title: "Generating metadata",
    detail: "Slug, SEO title, description, tags, and publishing metadata are streaming now.",
    progress: 94,
    previewTarget: "none",
    chunkMode: "append",
  },
};

function normalizeInput(
  input: ArticleRequestInput,
  projectDefaults: Partial<ArticlePipelineInput>
) {
  return {
    ...input,
    ...(projectDefaults.articleType ? { articleType: projectDefaults.articleType } : {}),
    ...(projectDefaults.useCrawledUrlsAsInternalLinks !== undefined
      ? { useCrawledUrlsAsInternalLinks: projectDefaults.useCrawledUrlsAsInternalLinks }
      : {}),
    ...(projectDefaults.domainKnowledge && !input.domainKnowledge
      ? { domainKnowledge: projectDefaults.domainKnowledge }
      : {}),
  };
}

function stringifyLogValue(value: unknown) {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function previewText(value: string, maxLength = 180) {
  const compact = value.replace(/\s+/g, " ").trim();
  if (!compact) return "";
  return compact.length > maxLength ? `${compact.slice(0, maxLength - 1)}…` : compact;
}

function shouldUseNonStreamingChat(requestLabel: string, responseFormat?: "text" | "json") {
  return requestLabel === "article-research-decision" || responseFormat === "json";
}

async function generateArticleResult(
  calendarItemId: string | undefined,
  projectId: string | undefined,
  input: ArticleRequestInput,
  chatRunner?: ChatRunner,
  hooks?: {
    onResearchDecision?: (decision: { needsResearch: boolean; reason: string; focusAreas: string[] }) => void;
    onBeforeMetadata?: (payload: { content: string; researchContent: string }) => void;
    onBeforeImage?: (payload: { coverImagePrompt: string }) => void;
    onBeforeSave?: (payload: { content: string; researchContent: string }) => void;
  }
) {
  const runner = chatRunner;
  const { decision, researchContent } = await maybeGenerateArticleResearch(
    projectId ?? null,
    input,
    runner
  );
  hooks?.onResearchDecision?.(decision);
  const content = await generateArticleBody(
    projectId ?? null,
    input,
    researchContent,
    runner
  );

  if (content && calendarItemId && projectId) {
    hooks?.onBeforeMetadata?.({ content, researchContent });
    const metadata = await generateArticleMetadata(
      {
        projectId,
        input,
        researchContent,
        content,
      },
      runner
    );
    const db = getDb();
    const settings = db
      .prepare("SELECT auto_images FROM project_site_settings WHERE project_id = ?")
      .get(projectId) as { auto_images: number } | undefined;
    const shouldGenerateImage = settings?.auto_images === 1 && isImageGenerationConfigured();
    if (shouldGenerateImage) {
      hooks?.onBeforeImage?.({ coverImagePrompt: metadata.coverImagePrompt });
    }
    const generatedImage =
      shouldGenerateImage
        ? await generateArticleImage(metadata.coverImagePrompt).catch(() => null)
        : null;
    const finalizedContent = syncArticleH1WithTitle(content, metadata.title);
    hooks?.onBeforeSave?.({ content: finalizedContent, researchContent });

    const article = upsertArticle(projectId, calendarItemId, {
      title: metadata.title,
      language: input.language ?? null,
      research_content: researchContent || null,
      content: finalizedContent,
      status: "draft",
      slug: metadata.slug,
      seo_title: metadata.seoTitle,
      meta_description: metadata.metaDescription,
      excerpt: metadata.excerpt,
      tags_json: JSON.stringify(metadata.tags),
      category: metadata.category,
      cover_image_base64: generatedImage?.base64 ?? null,
      cover_image_mime_type: generatedImage?.mimeType ?? null,
      cover_image_prompt: generatedImage?.revisedPrompt ?? metadata.coverImagePrompt,
      cover_image_alt: metadata.coverImageAlt,
      publish_metadata_json: JSON.stringify(metadata),
    });
    updateCalendarItemStatus(calendarItemId, "completed");

    return {
      content: finalizedContent,
      articleId: article.id,
      metadata,
      researchContent,
      researchDecision: decision,
      coverImageBase64: generatedImage?.base64 ?? null,
      coverImageMimeType: generatedImage?.mimeType ?? null,
    };
  }

  return {
    content,
    researchContent,
    researchDecision: decision,
  };
}

async function createStreamingResponse(
  request: NextRequest,
  calendarItemId: string | undefined,
  projectId: string | undefined,
  input: ArticleRequestInput
) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;

      const send = (event: string, data: unknown) => {
        if (closed) return;
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      };

      const close = () => {
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };

      const emitLog = (level: StreamLevel, message: string, extra?: unknown) => {
        const payload = {
          level,
          message,
          extra: extra === undefined ? null : stringifyLogValue(extra),
          timestamp: new Date().toISOString(),
        };
        const extraSuffix = payload.extra ? ` ${payload.extra}` : "";
        console[level === "error" ? "error" : level === "warn" ? "warn" : "log"](
          `[article:sse] ${message}${extraSuffix}`
        );
        send("log", payload);
      };

      const emitPhase = (
        title: string,
        detail: string,
        progress: number,
        previewTarget: StreamPreviewTarget = "none",
        chunkMode: StreamChunkMode = "append"
      ) => {
        send("phase", {
          title,
          detail,
          progress,
          previewTarget,
          chunkMode,
          timestamp: new Date().toISOString(),
        });
      };

      request.signal.addEventListener("abort", close);

      try {
        emitPhase(
          "Preparing site context",
          "Loading defaults, internal links, calendar inputs, and project settings.",
          8
        );
        emitLog("info", "Generation request received.", {
          projectId,
          calendarItemId,
          keyword: input.keyword,
          title: input.title,
          language: input.language,
        });

        emitPhase(
          "Reviewing search intent",
          "Checking the topic, audience, format, and crawl context before generation starts.",
          18
        );
        emitLog("info", "Normalized generation input prepared.", {
          keyword: input.keyword,
          articleType: input.articleType,
          length: input.length,
          tone: input.tone,
          requireInfographics: input.requireInfographics,
          internalLinks: input.internalLinks?.length ?? 0,
          existingPages: input.existingPages?.length ?? 0,
        });

        const streamChat: ChatRunner = (messages, model, options) => {
          const requestLabel = options?.requestLabel ?? "llm";
          const phase = STREAM_PHASES[requestLabel];
          const promptChars = messages.reduce((total, message) => total + message.content.length, 0);
          const promptPreview = previewText(messages[messages.length - 1]?.content ?? "");
          let nextVerboseMark = 300;
          let latestProvider: string | null = null;
          let latestModel: string | null = model ?? null;
          let currentAttempt = 1;
          const maxAttempts = (options?.maxRetries ?? 4) + 1;
          const startedAt = Date.now();
          let firstVisibleOutputSeen = false;
          let firstReasoningSeen = false;
          let latestReasoningLength = 0;
          let latestContentLength = 0;
          let waitingLogMark = 15000;

          if (phase) {
            emitPhase(
              phase.title,
              phase.detail,
              phase.progress,
              phase.previewTarget,
              phase.chunkMode
            );
          }

          emitLog("info", `Starting ${requestLabel}.`, {
            model: model ?? null,
            promptChars,
            responseFormat: options?.responseFormat ?? "text",
            promptPreview,
          });

          const emitStatus = (status: "waiting" | "streaming" | "completed") => {
            const elapsedMs = Date.now() - startedAt;
            send("status", {
              requestLabel,
              provider: latestProvider,
              model: latestModel,
              attempt: currentAttempt,
              maxAttempts,
              elapsedMs,
              status,
              waitingForFirstChunk: !firstVisibleOutputSeen,
              reasoningActive: firstReasoningSeen && latestContentLength === 0,
              reasoningLength: latestReasoningLength,
              contentLength: latestContentLength,
              timestamp: new Date().toISOString(),
            });
            if (!firstVisibleOutputSeen && elapsedMs >= waitingLogMark && status === "waiting") {
              emitLog("info", `Still waiting for ${requestLabel} to produce its first response.`, {
                attempt: currentAttempt,
                elapsedSeconds: Number((elapsedMs / 1000).toFixed(1)),
                provider: latestProvider,
                model: latestModel,
              });
              waitingLogMark += 15000;
            }
          };

          const heartbeat = setInterval(() => emitStatus("waiting"), 2000);
          emitStatus("waiting");

          const finish = () => {
            clearInterval(heartbeat);
          };

          if (shouldUseNonStreamingChat(requestLabel, options?.responseFormat)) {
            emitLog("info", `${requestLabel} is using the direct response path for faster structured output.`, {
              responseFormat: options?.responseFormat ?? "text",
            });
            return chat(messages, model, options)
              .then((response) => {
                latestModel = response.model ?? latestModel;
                firstVisibleOutputSeen = true;
                latestContentLength = response.content.length;
                emitStatus("completed");
                if (response.usage) {
                  send("usage", {
                    requestLabel,
                    model: latestModel,
                    provider: latestProvider,
                    usage: response.usage,
                    timestamp: new Date().toISOString(),
                  });
                  emitLog("success", `${requestLabel} finished.`, response.usage);
                } else {
                  emitLog("success", `${requestLabel} finished.`, {
                    mode: "direct-response",
                    contentLength: response.content.length,
                  });
                }
                return response;
              })
              .finally(finish);
          }

          return chatStream(messages, model, options, {
            onAttempt: ({ provider, model: activeModel, attempt }) => {
              latestProvider = provider;
              latestModel = activeModel;
              currentAttempt = attempt;
              emitLog("info", `Opening provider stream attempt for ${requestLabel}.`, {
                attempt,
                maxAttempts,
                provider,
                model: activeModel,
              });
              emitStatus("waiting");
            },
            onStart: ({ provider, model: activeModel }) => {
              latestProvider = provider;
              latestModel = activeModel;
              emitLog("info", `Provider stream opened for ${requestLabel}.`, {
                attempt: currentAttempt,
                provider,
                model: activeModel,
              });
            },
            onRetry: ({ attempt, delayMs, error, provider, model: activeModel }) => {
              latestProvider = provider;
              latestModel = activeModel;
              emitLog("warn", `${requestLabel} stream attempt did not produce output and will retry.`, {
                attempt,
                nextAttempt: attempt + 1,
                delayMs,
                provider,
                model: activeModel,
                error,
              });
            },
            onChunk: (chunk, info) => {
              firstVisibleOutputSeen = true;
              latestContentLength = info.content.length;
              emitStatus("streaming");
              send("token", {
                requestLabel: info.requestLabel,
                model: info.model,
                provider: info.provider,
                estimatedCompletionTokens: info.estimatedCompletionTokens,
                estimatedReasoningTokens: latestReasoningLength / 4,
                reasoningLength: latestReasoningLength,
                contentLength: info.content.length,
                timestamp: new Date().toISOString(),
              });

              if (phase && phase.previewTarget !== "none" && chunk) {
                send("chunk", {
                  requestLabel: info.requestLabel,
                  target: phase.previewTarget,
                  chunkMode: phase.chunkMode,
                  textDelta: chunk,
                  timestamp: new Date().toISOString(),
                });
              }

              if (info.content.length >= nextVerboseMark) {
                emitLog("info", `${info.requestLabel} streamed another chunk.`, {
                  estimatedCompletionTokens: info.estimatedCompletionTokens.toFixed(1),
                  contentLength: info.content.length,
                  preview: previewText(info.content.slice(-260)),
                });
                nextVerboseMark += info.requestLabel === "article-content" ? 900 : 600;
              }
            },
            onReasoningChunk: (chunk, info) => {
              firstVisibleOutputSeen = true;
              firstReasoningSeen = true;
              latestReasoningLength = info.reasoning.length;
              emitStatus("streaming");
              send("token", {
                requestLabel: info.requestLabel,
                model: info.model,
                provider: info.provider,
                estimatedCompletionTokens: latestContentLength / 4,
                estimatedReasoningTokens: info.estimatedReasoningTokens,
                reasoningLength: info.reasoning.length,
                contentLength: latestContentLength,
                timestamp: new Date().toISOString(),
              });
              send("reasoning", {
                requestLabel: info.requestLabel,
                textDelta: chunk,
                reasoningLength: info.reasoning.length,
                timestamp: new Date().toISOString(),
              });
              if (info.reasoning.length === chunk.length) {
                emitLog("info", `${info.requestLabel} started returning reasoning tokens.`, {
                  provider: info.provider,
                  model: info.model,
                });
              }
            },
            onUsage: (usage, info) => {
              firstVisibleOutputSeen = true;
              emitStatus("completed");
              send("usage", {
                requestLabel: info.requestLabel,
                model: info.model,
                provider: info.provider,
                usage,
                timestamp: new Date().toISOString(),
              });
              emitLog("success", `${info.requestLabel} finished streaming.`, usage);
            },
          }).finally(finish);
        };

        const result = await generateArticleResult(
          calendarItemId,
          projectId,
          input,
          streamChat,
          {
            onResearchDecision: (decision) => {
              emitLog(
                decision.needsResearch ? "info" : "success",
                decision.needsResearch
                  ? "Research was requested for this topic."
                  : "Separate research was skipped for this topic.",
                {
                  reason: decision.reason,
                  focusAreas: decision.focusAreas,
                }
              );
            },
            onBeforeMetadata: ({ content, researchContent }) => {
              emitLog("info", "Draft ready. Preparing metadata and publish assets.", {
                contentLength: content.length,
                researchLength: researchContent.length,
              });
            },
            onBeforeImage: ({ coverImagePrompt }) => {
              emitPhase(
                "Generating cover image",
                "Creating the article image asset before the draft is saved.",
                97
              );
              emitLog("info", "Cover image generation started.", {
                promptPreview: previewText(coverImagePrompt),
              });
            },
            onBeforeSave: ({ content, researchContent }) => {
              emitPhase(
                "Saving final result",
                "Persisting the draft, score inputs, and generated assets.",
                99
              );
              emitLog("info", "Saving generated article data.", {
                contentLength: content.length,
                researchLength: researchContent.length,
              });
            },
          }
        );
        emitLog("success", "Article generation finished successfully.", {
          articleId: "articleId" in result ? result.articleId ?? null : null,
          contentLength: result.content.length,
          researchLength: result.researchContent.length,
        });

        send("result", result);
        send("done", {
          status: "completed",
          articleId: "articleId" in result ? result.articleId ?? null : null,
          timestamp: new Date().toISOString(),
        });
        close();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Article generation failed";
        emitLog("error", "Article generation failed.", { message });
        send("error", {
          message,
          timestamp: new Date().toISOString(),
        });
        send("done", {
          status: "failed",
          timestamp: new Date().toISOString(),
        });
        close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { calendarItemId, projectId, input, stream } = body as {
      calendarItemId?: string;
      projectId?: string;
      input: ArticleRequestInput;
      stream?: boolean;
    };

    if (!input) {
      return NextResponse.json({ error: "Missing input" }, { status: 400 });
    }

    const projectDefaults = projectId
      ? (await resolveProjectArticleDefaults(projectId)) ?? {}
      : {};
    const normalizedInput = normalizeInput(input, projectDefaults);

    if (stream) {
      return createStreamingResponse(
        request,
        calendarItemId,
        projectId,
        normalizedInput
      );
    }

    const result = await generateArticleResult(
      calendarItemId,
      projectId,
      normalizedInput
    );

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Article generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
