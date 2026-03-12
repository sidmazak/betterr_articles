import { chat, chatStream, type ChatRunner } from "@/lib/llm";
import {
  addArticleGenerationJobLog,
  cancelArticleGenerationJob,
  claimPendingArticleGenerationJob,
  completeArticleGenerationJob,
  failArticleGenerationJob,
  getArticleGenerationJob,
  saveArticleGenerationSnapshot,
  setArticleGenerationJobStage,
  updateArticleGenerationJobProgress,
} from "@/lib/db/article-generation-jobs";
import { getProjectJob, isProjectJobTerminal } from "@/lib/db/project-jobs";
import { getArticle, deleteArticle, isArticleEmpty, unlinkArticleFromCalendar, updateArticle, upsertArticle } from "@/lib/db/articles";
import { updateCalendarItemStatus } from "@/lib/db/calendar";
import { generateArticleBody, maybeGenerateArticleResearch, optimizeArticleForSeoSignals, PATCHABLE_CONTENT_CHECK_IDS } from "@/lib/article-pipeline";
import { bootstrapMetadataForSeo, generateArticleMetadata, syncArticleH1WithTitle } from "@/lib/article-assets";
import { buildArticleSections, cleanArticleMarkdown, renderArticleAsText } from "@/lib/article-content";
import { ensureHttpsUrl } from "@/lib/infographic-renderer";
import { generateAndReplacePlaceholders } from "@/lib/infographic-placeholder";
import { generateArticleImage } from "@/lib/image-generation";
import { getDb } from "@/lib/db";
import { getProject } from "@/lib/db/projects";
import { isImageGenerationConfigured } from "@/lib/db/settings";
import { buildSeoAudit } from "@/lib/seo-audit";
import { SEO_TARGET_SCORE } from "@/lib/seo-rules";
import type { ArticlePipelineInput } from "@/lib/prompts/types";

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

class ArticleGenerationCancelledError extends Error {
  constructor(message = "Article generation cancelled") {
    super(message);
    this.name = "ArticleGenerationCancelledError";
  }
}

export interface ArticleGenerationRunnerHooks {
  onEvent?: (event: string, data: unknown) => void;
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

function emit(hooks: ArticleGenerationRunnerHooks | undefined, event: string, data: unknown) {
  hooks?.onEvent?.(event, data);
}

function ensureJobCanContinue(projectJobId: string) {
  const job = getProjectJob(projectJobId);
  if (!job) {
    throw new ArticleGenerationCancelledError("Article generation job no longer exists");
  }
  if (job.status === "cancelled") {
    throw new ArticleGenerationCancelledError(job.error_message || "Article generation cancelled");
  }
  if (job.status === "completed" || job.status === "failed") {
    throw new ArticleGenerationCancelledError(job.error_message || `Article generation stopped with status ${job.status}`);
  }
  return job;
}

function parseInput(projectJobId: string): { input: ArticlePipelineInput; projectId: string; calendarItemId: string | null; articleId: string | null; source: string } {
  const job = getArticleGenerationJob(projectJobId);
  if (!job) {
    throw new Error("Article generation job not found");
  }
  return {
    input: JSON.parse(job.input_json) as ArticlePipelineInput,
    projectId: job.project_id,
    calendarItemId: job.calendar_item_id,
    articleId: job.article_id,
    source: job.source,
  };
}

export async function processArticleGenerationJob(
  projectJobId: string,
  hooks?: ArticleGenerationRunnerHooks
) {
  const claimed = claimPendingArticleGenerationJob(projectJobId);
  const current = getArticleGenerationJob(projectJobId);
  if (!current) {
    throw new Error("Article generation job not found");
  }
  if (!claimed) {
    return current;
  }

  const { input, projectId, calendarItemId, articleId: existingArticleId, source } = parseInput(projectJobId);
  let articleId = existingArticleId;
  let reasoningContent = current.reasoning_content ?? "";
  let researchContent = current.research_content ?? "";
  let contentPreview = current.content ?? "";
  let latestProvider: string | null = null;
  let latestModel: string | null = null;
  let currentAttempt = 1;
  const emitLog = (level: StreamLevel, message: string, extra?: unknown, stage?: string) => {
    const payload = {
      level,
      message,
      extra: extra === undefined ? null : stringifyLogValue(extra),
      timestamp: new Date().toISOString(),
    };
    addArticleGenerationJobLog(projectJobId, level, message, {
      stage: stage ?? getProjectJob(projectJobId)?.current_stage ?? null,
      details: extra && typeof extra === "object" ? (extra as Record<string, unknown>) : extra === undefined ? null : { value: payload.extra },
    });
    emit(hooks, "log", payload);
    const extraStr = payload.extra ? ` ${payload.extra}` : "";
    console.log(`[ArticleGen] [${level.toUpperCase()}] ${message}${extraStr}`);
  };
  const emitPhase = (
    title: string,
    detail: string,
    progress: number,
    previewTarget: StreamPreviewTarget = "none",
    chunkMode: StreamChunkMode = "append"
  ) => {
    console.log(`[ArticleGen] [PHASE] ${title} (${progress}%) - ${detail}`);
    emit(hooks, "phase", {
      title,
      detail,
      progress,
      previewTarget,
      chunkMode,
      timestamp: new Date().toISOString(),
    });
  };
  const emitStatus = (status: "waiting" | "streaming" | "completed", waitingForFirstChunk: boolean) => {
    const job = getProjectJob(projectJobId);
    emit(hooks, "status", {
      requestLabel: job?.current_stage ?? "article_generation",
      provider: latestProvider,
      model: latestModel,
      attempt: currentAttempt,
      maxAttempts: 5,
      elapsedMs: job?.started_at ? Date.now() - new Date(job.started_at).getTime() : 0,
      status,
      waitingForFirstChunk,
      reasoningActive: reasoningContent.length > 0 && contentPreview.length === 0,
      reasoningLength: reasoningContent.length,
      contentLength: contentPreview.length,
      timestamp: new Date().toISOString(),
    });
  };

  try {
    setArticleGenerationJobStage(projectJobId, "preparing", {
      message: "Loading article context and initializing the generation job.",
      articleId,
    });
    updateArticleGenerationJobProgress(projectJobId, 8, {
      stage: "preparing",
      message: "Loading defaults, internal links, calendar inputs, and project settings.",
      articleId,
    });
    emitPhase(
      "Preparing site context",
      "Loading defaults, internal links, calendar inputs, and project settings.",
      8
    );
    emitLog("info", "Article generation job claimed.", {
      projectJobId,
      projectId,
      calendarItemId,
      source,
    }, "preparing");
    ensureJobCanContinue(projectJobId);

    if (calendarItemId) {
      articleId =
        upsertArticle(projectId, calendarItemId, {
          title: input.title ?? null,
          language: input.language ?? null,
          status: "draft",
          category: input.category ?? null,
        }).id;
      saveArticleGenerationSnapshot(projectJobId, { articleId });
      updateCalendarItemStatus(calendarItemId, "writing");
    }

    updateArticleGenerationJobProgress(projectJobId, 18, {
      stage: "reviewing",
      message: "Checking the topic, audience, format, and crawl context before generation starts.",
      articleId,
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
    }, "reviewing");
    ensureJobCanContinue(projectJobId);

    const streamChat: ChatRunner = (messages, model, options) => {
      const requestLabel = options?.requestLabel ?? "llm";
      const phase = STREAM_PHASES[requestLabel];
      const promptChars = messages.reduce((total, message) => total + message.content.length, 0);
      const promptPreview = previewText(messages[messages.length - 1]?.content ?? "");
      let nextVerboseMark = 300;
      let firstVisibleOutputSeen = false;
      let firstContentChunkLogged = false;
      let firstResearchChunkLogged = false;
      let firstReasoningChunkLogged = false;
      const startedAt = Date.now();

      if (phase) {
        if (phase.previewTarget === "content" && phase.chunkMode === "replace") {
          contentPreview = "";
          saveArticleGenerationSnapshot(projectJobId, { content: "" });
        }
        if (phase.previewTarget === "research" && phase.chunkMode === "replace") {
          researchContent = "";
          saveArticleGenerationSnapshot(projectJobId, { researchContent: "" });
        }
        emitPhase(phase.title, phase.detail, phase.progress, phase.previewTarget, phase.chunkMode);
        updateArticleGenerationJobProgress(projectJobId, phase.progress, {
          stage: requestLabel,
          message: phase.detail,
          articleId,
          provider: latestProvider,
          model: latestModel,
          attempt: currentAttempt,
          contentLength: contentPreview.length,
          reasoningLength: reasoningContent.length,
        });
      }

      emitLog("info", `Starting ${requestLabel}.`, {
        model: model ?? latestModel ?? null,
        promptChars,
        responseFormat: options?.responseFormat ?? "text",
        promptPreview,
      }, requestLabel);

      let heartbeatStopped = false;
      const stopHeartbeat = () => {
        if (heartbeatStopped) return;
        heartbeatStopped = true;
        clearInterval(heartbeat);
      };

      const heartbeat = setInterval(() => {
        try {
          const job = getProjectJob(projectJobId);
          if (!job || isProjectJobTerminal(job.status)) {
            stopHeartbeat();
            return;
          }
          emitStatus(firstVisibleOutputSeen ? "streaming" : "waiting", !firstVisibleOutputSeen);
        } catch {
          stopHeartbeat();
        }
      }, 2000);

      const finish = () => stopHeartbeat();

      if (shouldUseNonStreamingChat(requestLabel, options?.responseFormat)) {
        emitLog("info", `${requestLabel} is using the direct response path for faster structured output.`, {
          responseFormat: options?.responseFormat ?? "text",
        }, requestLabel);
        return chat(messages, model, options)
          .then((response) => {
            latestModel = response.model ?? latestModel;
            firstVisibleOutputSeen = true;
            if (phase?.previewTarget === "research") {
              researchContent = response.content;
              saveArticleGenerationSnapshot(projectJobId, { researchContent });
            }
            emitStatus("completed", false);
            if (response.usage) {
              emit(hooks, "usage", {
                requestLabel,
                model: latestModel,
                provider: latestProvider,
                usage: response.usage,
                timestamp: new Date().toISOString(),
              });
              emitLog("success", `${requestLabel} finished.`, response.usage, requestLabel);
            }
            return response;
          })
          .finally(finish);
      }

      emitStatus("waiting", true);
      return chatStream(messages, model, options, {
        onAttempt: ({ provider, model: activeModel, attempt, maxAttempts }) => {
          latestProvider = provider;
          latestModel = activeModel;
          currentAttempt = attempt;
          updateArticleGenerationJobProgress(projectJobId, getProjectJob(projectJobId)?.progress ?? 0, {
            stage: requestLabel,
            message: phase?.detail ?? `Streaming ${requestLabel}`,
            articleId,
            provider,
            model: activeModel,
            attempt,
            contentLength: contentPreview.length,
            reasoningLength: reasoningContent.length,
          });
          emitLog("info", `Opening provider stream attempt for ${requestLabel}.`, {
            attempt,
            maxAttempts,
            provider,
            model: activeModel,
          }, requestLabel);
          emitStatus("waiting", !firstVisibleOutputSeen);
        },
        onStart: ({ provider, model: activeModel }) => {
          latestProvider = provider;
          latestModel = activeModel;
          emitLog("info", `Provider stream opened for ${requestLabel}.`, {
            attempt: currentAttempt,
            provider,
            model: activeModel,
          }, requestLabel);
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
          }, requestLabel);
        },
        onChunk: (chunk, info) => {
          ensureJobCanContinue(projectJobId);
          firstVisibleOutputSeen = true;
          if (phase?.previewTarget === "content") {
            contentPreview = phase.chunkMode === "replace" && contentPreview.length === 0
              ? chunk
              : `${contentPreview}${chunk}`;
            saveArticleGenerationSnapshot(projectJobId, { content: contentPreview });
          }
          if (phase?.previewTarget === "research") {
            researchContent = phase.chunkMode === "replace" && researchContent.length === 0
              ? chunk
              : `${researchContent}${chunk}`;
            saveArticleGenerationSnapshot(projectJobId, { researchContent });
          }
          updateArticleGenerationJobProgress(projectJobId, phase?.progress ?? getProjectJob(projectJobId)?.progress ?? 0, {
            stage: requestLabel,
            message: phase?.detail ?? null,
            articleId,
            provider: info.provider,
            model: info.model,
            attempt: currentAttempt,
            contentLength: contentPreview.length,
            reasoningLength: reasoningContent.length,
          });
          emitStatus("streaming", false);
          emit(hooks, "token", {
            requestLabel: info.requestLabel,
            model: info.model,
            provider: info.provider,
            estimatedCompletionTokens: info.estimatedCompletionTokens,
            estimatedReasoningTokens: reasoningContent.length / 4,
            reasoningLength: reasoningContent.length,
            contentLength: contentPreview.length,
            timestamp: new Date().toISOString(),
          });
          if (phase?.previewTarget !== "none" && chunk) {
            emit(hooks, "chunk", {
              requestLabel: info.requestLabel,
              target: phase.previewTarget,
              chunkMode: phase.chunkMode,
              textDelta: chunk,
              timestamp: new Date().toISOString(),
            });
          }
          if (phase?.previewTarget === "content" && chunk && !firstContentChunkLogged) {
            firstContentChunkLogged = true;
            console.log(`[ArticleGen] [AI] First content chunk: "${previewText(chunk, 150)}"`);
          }
          if (phase?.previewTarget === "research" && chunk && !firstResearchChunkLogged) {
            firstResearchChunkLogged = true;
            console.log(`[ArticleGen] [AI] First research chunk: "${previewText(chunk, 150)}"`);
          }
          if (info.content.length >= nextVerboseMark) {
            emitLog("info", `${info.requestLabel} streamed another chunk.`, {
              estimatedCompletionTokens: info.estimatedCompletionTokens.toFixed(1),
              contentLength: info.content.length,
              preview: previewText(info.content.slice(-260)),
            }, requestLabel);
            nextVerboseMark += info.requestLabel === "article-content" ? 900 : 600;
          }
        },
        onReasoningChunk: (chunk, info) => {
          ensureJobCanContinue(projectJobId);
          firstVisibleOutputSeen = true;
          reasoningContent = info.reasoning;
          saveArticleGenerationSnapshot(projectJobId, { reasoningContent });
          updateArticleGenerationJobProgress(projectJobId, phase?.progress ?? getProjectJob(projectJobId)?.progress ?? 0, {
            stage: requestLabel,
            message: phase?.detail ?? null,
            articleId,
            provider: info.provider,
            model: info.model,
            attempt: currentAttempt,
            contentLength: contentPreview.length,
            reasoningLength: reasoningContent.length,
          });
          emitStatus("streaming", false);
          emit(hooks, "token", {
            requestLabel: info.requestLabel,
            model: info.model,
            provider: info.provider,
            estimatedCompletionTokens: contentPreview.length / 4,
            estimatedReasoningTokens: info.estimatedReasoningTokens,
            reasoningLength: reasoningContent.length,
            contentLength: contentPreview.length,
            timestamp: new Date().toISOString(),
          });
          emit(hooks, "reasoning", {
            requestLabel: info.requestLabel,
            textDelta: chunk,
            reasoningLength: reasoningContent.length,
            timestamp: new Date().toISOString(),
          });
          if (chunk && !firstReasoningChunkLogged) {
            firstReasoningChunkLogged = true;
            console.log(`[ArticleGen] [AI] First reasoning chunk: "${previewText(chunk, 150)}"`);
          }
          if (reasoningContent.length === chunk.length) {
            emitLog("info", `${info.requestLabel} started returning reasoning tokens.`, {
              provider: info.provider,
              model: info.model,
            }, requestLabel);
          }
        },
        onUsage: (usage, info) => {
          emitStatus("completed", false);
          emit(hooks, "usage", {
            requestLabel: info.requestLabel,
            model: info.model,
            provider: info.provider,
            usage,
            timestamp: new Date().toISOString(),
          });
          emitLog("success", `${info.requestLabel} finished streaming.`, usage, requestLabel);
        },
      }).finally(() => {
        const elapsedMs = Date.now() - startedAt;
        if (elapsedMs > 0) {
          updateArticleGenerationJobProgress(projectJobId, getProjectJob(projectJobId)?.progress ?? 0, {
            stage: requestLabel,
            message: phase?.detail ?? null,
            articleId,
            provider: latestProvider,
            model: latestModel,
            attempt: currentAttempt,
            contentLength: contentPreview.length,
            reasoningLength: reasoningContent.length,
          });
        }
        finish();
      });
    };

    const decisionResult = await maybeGenerateArticleResearch(projectId, input, streamChat);
    researchContent = decisionResult.researchContent;
    saveArticleGenerationSnapshot(projectJobId, { researchContent, reasoningContent });
    emitLog(
      decisionResult.decision.needsResearch ? "info" : "success",
      decisionResult.decision.needsResearch
        ? "Research was requested for this topic."
        : "Separate research was skipped for this topic.",
      {
        reason: decisionResult.decision.reason,
        focusAreas: decisionResult.decision.focusAreas,
      },
      "article-research"
    );
    ensureJobCanContinue(projectJobId);

    if (articleId) {
      updateArticle(articleId, {
        research_content: researchContent || null,
        language: input.language ?? null,
        title: input.title ?? null,
        category: input.category ?? null,
        status: "draft",
      });
    }

    let content = await generateArticleBody(projectId, input, researchContent, streamChat);
    contentPreview = content;
    saveArticleGenerationSnapshot(projectJobId, { content: contentPreview, reasoningContent, researchContent });
    ensureJobCanContinue(projectJobId);

    if (input.requireInfographics) {
      try {
        emitLog("info", "Generating infographic(s) from article content.", {}, "article-content");
        const project = getProject(projectId);
        const db = getDb();
        const siteRow = db
          .prepare("SELECT infographic_watermark FROM project_site_settings WHERE project_id = ?")
          .get(projectId) as { infographic_watermark?: number } | undefined;
        const showWatermark = (siteRow?.infographic_watermark ?? 1) !== 0;
        const siteUrl = showWatermark ? ensureHttpsUrl(project?.homepage_url) : undefined;
        const { content: withInfographic, replaced } = await generateAndReplacePlaceholders(
          content,
          input.keyword ?? null,
          { articleLength: input.length ?? undefined, siteUrl }
        );
        if (replaced > 0) {
          content = withInfographic;
          contentPreview = content;
          saveArticleGenerationSnapshot(projectJobId, { content: contentPreview, reasoningContent, researchContent });
          emitLog("success", `Infographic(s) generated and injected.`, { replaced }, "article-content");
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Infographic generation failed";
        emitLog("warn", `Infographic generation skipped: ${msg}`, {}, "article-content");
      }
    }

    emitLog("info", "Draft ready. Preparing metadata and publish assets.", {
      contentLength: content.length,
      researchLength: researchContent.length,
    }, "article-metadata");
    setArticleGenerationJobStage(projectJobId, "article-metadata", {
      message: "Preparing metadata and publish assets.",
      articleId,
      provider: latestProvider,
      model: latestModel,
      attempt: currentAttempt,
      contentLength: content.length,
      reasoningLength: reasoningContent.length,
    });
    updateArticleGenerationJobProgress(projectJobId, 94, {
      stage: "article-metadata",
      message: "Preparing metadata and publish assets.",
      articleId,
      provider: latestProvider,
      model: latestModel,
      attempt: currentAttempt,
      contentLength: content.length,
      reasoningLength: reasoningContent.length,
    });
    emitPhase(
      "Generating metadata",
      "Slug, SEO title, description, tags, and publishing metadata are streaming now.",
      94
    );

    const metadata = await generateArticleMetadata(
      {
        projectId,
        input,
        researchContent,
        content,
      },
      streamChat
    );
    saveArticleGenerationSnapshot(projectJobId, {
      metadataJson: JSON.stringify(metadata),
      content: contentPreview,
      researchContent,
      reasoningContent,
    });
    ensureJobCanContinue(projectJobId);

    const db = getDb();
    const settings = db
      .prepare("SELECT auto_publish, auto_images FROM project_site_settings WHERE project_id = ?")
      .get(projectId) as { auto_publish: number; auto_images: number } | undefined;

    const shouldGenerateImage = settings?.auto_images === 1 && isImageGenerationConfigured();
    let generatedImage: Awaited<ReturnType<typeof generateArticleImage>> = null;

    if (shouldGenerateImage) {
      setArticleGenerationJobStage(projectJobId, "generating-image", {
        message: "Creating the article image asset before the draft is saved.",
        articleId,
        provider: latestProvider,
        model: latestModel,
        attempt: currentAttempt,
        contentLength: content.length,
        reasoningLength: reasoningContent.length,
      });
      updateArticleGenerationJobProgress(projectJobId, 97, {
        stage: "generating-image",
        message: "Creating the article image asset before the draft is saved.",
        articleId,
        provider: latestProvider,
        model: latestModel,
        attempt: currentAttempt,
        contentLength: content.length,
        reasoningLength: reasoningContent.length,
      });
      emitPhase(
        "Generating cover image",
        "Creating the article image asset before the draft is saved.",
        97
      );
      emitLog("info", "Cover image generation started.", {
        promptPreview: previewText(metadata.coverImagePrompt),
      }, "generating-image");

      const coverPrompt = (metadata.coverImagePrompt ?? "").trim();
      const promptsToTry = coverPrompt
        ? [coverPrompt, coverPrompt.slice(0, 200), `${metadata.title ?? "Article"} - professional editorial image`]
        : [`${metadata.title ?? "Article"} - professional editorial image`];
      for (let attempt = 0; attempt < promptsToTry.length; attempt++) {
        const prompt = promptsToTry[attempt];
        if (!prompt?.trim()) continue;
        if (attempt > 0) await new Promise((r) => setTimeout(r, 3000));
        try {
          generatedImage = await generateArticleImage(prompt);
          if (generatedImage) break;
        } catch (err) {
          emitLog("warn", `Cover image attempt ${attempt + 1} failed.`, { error: String(err) }, "generating-image");
        }
      }
    }

    let finalizedContent = cleanArticleMarkdown(syncArticleH1WithTitle(content, metadata.title));

    const project = getProject(projectId);
    const articleSections = buildArticleSections(finalizedContent);
    const contentText = renderArticleAsText(finalizedContent);
    const hasConclusion = /(^|\n)#{1,6}\s*(Conclusion|Final Thoughts|Key Takeaways|Wrapping Up)\b/im.test(finalizedContent);
    const seoAudit = buildSeoAudit({
      title: metadata.title,
      seoTitle: metadata.seoTitle,
      metaDescription: metadata.metaDescription,
      excerpt: metadata.excerpt,
      tags: metadata.tags,
      slug: metadata.slug,
      socialHashtags: metadata.socialHashtags ?? [],
      content: finalizedContent,
      contentText,
      primaryKeyword: input.keyword ?? null,
      secondaryKeywords: input.secondaryKeywords ?? [],
      articleSections,
      hasConclusion,
      coverImageAlt: metadata.coverImageAlt ?? null,
      hasFeaturedImage: !!generatedImage,
      homepageUrl: project?.homepage_url ?? null,
    });
    /** Safety cap. Loop continues until score >= 90 or max passes. No early exit on "no progress" - keep trying until 90+ or cap. */
    const MAX_SEO_PASSES_SAFETY = 500;
    const METADATA_CHECK_IDS = new Set([
      "keyword-in-title", "keyword-position", "keyword-in-meta", "meta-description-length",
      "title-length", "seo-friendly-url", "content-tags", "meta-keywords", "social-hashtags", "excerpt",
    ]);
    let passCount = 0;
    let currentAudit = seoAudit;
    let currentMetadata = metadata;
    let lastScore = currentAudit.score;
    let noProgressCount = 0;
    while (
      currentAudit.score < SEO_TARGET_SCORE &&
      passCount < MAX_SEO_PASSES_SAFETY
    ) {
      passCount++;
      emitLog("info", `SEO score ${currentAudit.score} below ${SEO_TARGET_SCORE}, running optimization pass ${passCount}.`, { score: currentAudit.score }, "article-seo-optimize");
      try {
        const failingContentChecks = currentAudit.checks
          .filter((c) => !c.passed && PATCHABLE_CONTENT_CHECK_IDS.has(c.id));
        let didPatch = false;

        /** When stuck (no progress for several passes), try fixing all content issues in one aggressive pass */
        if (noProgressCount >= 4 && failingContentChecks.length > 1) {
          const allLabels = failingContentChecks.map((c) => `${c.label} (${c.details})`);
          emitLog("info", "Aggressive multi-check optimization (fixing all content issues at once).", { count: allLabels.length }, "article-seo-optimize");
          try {
            const aggressiveOptimized = await optimizeArticleForSeoSignals(
              projectId,
              input,
              finalizedContent,
              researchContent,
              chat,
              { forceRun: true, failingChecks: allLabels, aggressiveTruncation: finalizedContent.length > 12000 }
            );
            if (aggressiveOptimized?.trim() && aggressiveOptimized !== finalizedContent) {
              content = aggressiveOptimized;
              finalizedContent = cleanArticleMarkdown(syncArticleH1WithTitle(content, currentMetadata.title));
              didPatch = true;
            }
          } catch {
            /* fall through to per-check loop */
          }
        }

        if (!didPatch) for (const check of failingContentChecks) {
          const checkLabel = `${check.label} (${check.details})`;
          emitLog("info", `Patching single check: ${check.label}`, { checkId: check.id }, "article-seo-optimize");
          let optimized: string;
          try {
            optimized = await optimizeArticleForSeoSignals(
              projectId,
              input,
              finalizedContent,
              researchContent,
              chat,
              { singleCheckToFix: checkLabel, singleCheckId: check.id }
            );
          } catch (optimizeErr) {
            const errMsg = String(optimizeErr);
            if (/token|context|26214|input_tokens|BadRequest/i.test(errMsg)) {
              emitLog("info", "Retrying with truncated context.", { checkId: check.id }, "article-seo-optimize");
              optimized = await optimizeArticleForSeoSignals(
                projectId,
                input,
                finalizedContent,
                researchContent,
                chat,
                { singleCheckToFix: checkLabel, singleCheckId: check.id, aggressiveTruncation: true }
              );
            } else {
              throw optimizeErr;
            }
          }
          if (optimized?.trim() && optimized !== finalizedContent) {
            content = optimized;
            finalizedContent = cleanArticleMarkdown(syncArticleH1WithTitle(content, currentMetadata.title));
            didPatch = true;
            break;
          }
          /** Surgical patch returned unchanged; try full multi-issue optimization as fallback */
          emitLog("info", "Surgical patch unchanged, trying full multi-issue optimization.", { checkId: check.id }, "article-seo-optimize");
          try {
            const fullOptimized = await optimizeArticleForSeoSignals(
              projectId,
              input,
              finalizedContent,
              researchContent,
              chat,
              { forceRun: true, failingChecks: [checkLabel] }
            );
            if (fullOptimized?.trim() && fullOptimized !== finalizedContent) {
              content = fullOptimized;
              finalizedContent = cleanArticleMarkdown(syncArticleH1WithTitle(content, currentMetadata.title));
              didPatch = true;
              break;
            }
          } catch {
            /* continue to next check */
          }
        }
        if (!didPatch) {
          const metadataOnlyFailing = currentAudit.checks
            .filter((c) => !c.passed && METADATA_CHECK_IDS.has(c.id))
            .length;
          if (metadataOnlyFailing === 0) {
            emitLog("warn", "No patch applied (unchanged or no patchable checks), stopping.", { passCount }, "article-seo-optimize");
            break;
          }
        } else {
          finalizedContent = cleanArticleMarkdown(syncArticleH1WithTitle(content, currentMetadata.title));
        }
        const metadataChecksFailing = currentAudit.checks
          .filter((c) => !c.passed && METADATA_CHECK_IDS.has(c.id))
          .length;
        if (metadataChecksFailing > 0) {
          /** When stuck (15+ passes no progress), bootstrap metadata programmatically to reach 90+ */
          if (noProgressCount >= 15) {
            const failingIds = new Set(
              currentAudit.checks
                .filter((c) => !c.passed && METADATA_CHECK_IDS.has(c.id))
                .map((c) => c.id)
            );
            emitLog("info", "Applying metadata bootstrap to fix failing checks (model stuck).", { count: failingIds.size }, "article-seo-optimize");
            currentMetadata = bootstrapMetadataForSeo(currentMetadata, failingIds, input, finalizedContent);
          } else {
            emitLog("info", "Regenerating metadata to fix failing metadata checks.", { count: metadataChecksFailing }, "article-seo-optimize");
            try {
              const freshMetadata = await generateArticleMetadata(
                { projectId, input, researchContent, content: finalizedContent },
                streamChat
              );
              currentMetadata = freshMetadata;
            } catch {
              /* keep existing metadata */
            }
          }
        }
        const articleSections = buildArticleSections(finalizedContent);
        const contentText = renderArticleAsText(finalizedContent);
        currentAudit = buildSeoAudit({
          title: currentMetadata.title,
          seoTitle: currentMetadata.seoTitle,
          metaDescription: currentMetadata.metaDescription,
          excerpt: currentMetadata.excerpt,
          tags: currentMetadata.tags,
          slug: currentMetadata.slug,
          socialHashtags: currentMetadata.socialHashtags ?? [],
          content: finalizedContent,
          contentText,
          primaryKeyword: input.keyword ?? null,
          secondaryKeywords: input.secondaryKeywords ?? [],
          articleSections,
          hasConclusion: /(^|\n)#{1,6}\s*(Conclusion|Final Thoughts|Key Takeaways|Wrapping Up)\b/im.test(finalizedContent),
          coverImageAlt: currentMetadata.coverImageAlt ?? null,
          hasFeaturedImage: !!generatedImage,
          homepageUrl: project?.homepage_url ?? null,
        });
        if (currentAudit.score > lastScore) {
          noProgressCount = 0;
          lastScore = currentAudit.score;
        } else {
          noProgressCount++;
          if (noProgressCount >= 5) {
            emitLog("info", `No score improvement for ${noProgressCount} passes, continuing until 90+ or max passes.`, { score: currentAudit.score, passCount }, "article-seo-optimize");
          }
        }
        emitLog("info", `SEO optimization pass ${passCount} complete. Score: ${currentAudit.score}.`, { score: currentAudit.score, passCount }, "article-seo-optimize");
      } catch (err) {
        emitLog("warn", "SEO optimization pass failed, saving current content.", { error: String(err) }, "article-seo-optimize");
        break;
      }
    }

    if (currentAudit.score < SEO_TARGET_SCORE) {
      emitLog(
        "warn",
        `SEO score below ${SEO_TARGET_SCORE}. Consider switching to a more capable model in Settings (e.g. GPT-4, Claude Opus, or a stronger reasoning model) and regenerating the article for better results.`,
        { score: currentAudit.score, suggestion: "regenerate_with_better_model" },
        "article-seo-optimize"
      );
      emit(hooks, "seoScoreBelowTarget", {
        score: currentAudit.score,
        suggestion: "Switch to a more capable model in Settings and regenerate the article.",
        timestamp: new Date().toISOString(),
      });
    }

    emitPhase(
      "Saving final result",
      "Persisting the draft, score inputs, generated assets, and job state.",
      99
    );
    updateArticleGenerationJobProgress(projectJobId, 99, {
      stage: "saving",
      message: "Persisting the draft, score inputs, generated assets, and job state.",
      articleId,
      provider: latestProvider,
      model: latestModel,
      attempt: currentAttempt,
      contentLength: finalizedContent.length,
      reasoningLength: reasoningContent.length,
    });
    emitLog("info", "Saving generated article data.", {
      contentLength: finalizedContent.length,
      researchLength: researchContent.length,
    }, "saving");
    ensureJobCanContinue(projectJobId);

    const article = upsertArticle(projectId, calendarItemId, {
      title: currentMetadata.title,
      language: input.language ?? null,
      research_content: researchContent || null,
      content: finalizedContent,
      status: "draft",
      slug: currentMetadata.slug,
      seo_title: currentMetadata.seoTitle,
      meta_description: currentMetadata.metaDescription,
      excerpt: currentMetadata.excerpt,
      tags_json: JSON.stringify(currentMetadata.tags),
      category: currentMetadata.category,
      cover_image_base64: generatedImage?.base64 ?? null,
      cover_image_mime_type: generatedImage?.mimeType ?? null,
      cover_image_prompt: generatedImage?.revisedPrompt ?? currentMetadata.coverImagePrompt,
      cover_image_alt: currentMetadata.coverImageAlt,
      publish_metadata_json: JSON.stringify(currentMetadata),
    });
    articleId = article.id;
    if (calendarItemId) {
      updateCalendarItemStatus(calendarItemId, "completed");
    }

    let finalStatus: "draft" | "published" = "draft";
    let publishedUrl: string | null = null;
    if (settings?.auto_publish && source === "schedule") {
      try {
        setArticleGenerationJobStage(projectJobId, "publishing", {
          message: "Publishing the generated article to enabled platforms.",
          articleId,
          contentLength: finalizedContent.length,
          reasoningLength: reasoningContent.length,
        });
        updateArticleGenerationJobProgress(projectJobId, 99, {
          stage: "publishing",
          message: "Publishing the generated article to enabled platforms.",
          articleId,
          contentLength: finalizedContent.length,
          reasoningLength: reasoningContent.length,
        });
        const { publishArticleToPlatforms } = await import("@/lib/publishing");
        const result = await publishArticleToPlatforms(
          projectId,
          {
            title: currentMetadata.title,
            content: finalizedContent,
            metadata: {
              excerpt: currentMetadata.excerpt,
              tags: currentMetadata.tags,
              slug: currentMetadata.slug,
              seoTitle: currentMetadata.seoTitle,
              metaDescription: currentMetadata.metaDescription,
              category: currentMetadata.category,
              canonicalUrl: currentMetadata.canonicalUrl ?? null,
              socialHashtags: currentMetadata.socialHashtags,
              coverImageBase64: generatedImage?.base64 ?? null,
              coverImageMimeType: generatedImage?.mimeType ?? null,
              coverImageAlt: currentMetadata.coverImageAlt,
            },
          },
          {
            articleId: article.id,
            calendarItemId,
            autoPublishOnly: true,
          }
        );
        const successfulResults = result.results.filter((item) => item.success);
        publishedUrl = successfulResults.find((item) => item.url)?.url ?? null;
        if (successfulResults.length > 0) {
          finalStatus = "published";
          updateArticle(article.id, {
            status: "published",
            published_url: publishedUrl,
            last_published_at: new Date().toISOString(),
          });
        }
      } catch (error) {
        emitLog("warn", "Auto-publish failed. Leaving article as draft.", {
          error: error instanceof Error ? error.message : String(error),
        }, "publishing");
      }
    }

    const resultPayload = {
      content: finalizedContent,
      articleId: article.id,
      metadata,
      researchContent,
      researchDecision: decisionResult.decision,
      coverImageBase64: generatedImage?.base64 ?? null,
      coverImageMimeType: generatedImage?.mimeType ?? null,
      status: finalStatus,
      publishedUrl,
    };
    saveArticleGenerationSnapshot(projectJobId, {
      articleId: article.id,
      metadataJson: JSON.stringify(metadata),
      researchContent,
      content: finalizedContent,
      reasoningContent,
      resultJson: JSON.stringify(resultPayload),
    });
    completeArticleGenerationJob(projectJobId, {
      message: finalStatus === "published" ? "Article generation and publishing complete" : "Article generation finished successfully",
      articleId: article.id,
      contentLength: finalizedContent.length,
      reasoningLength: reasoningContent.length,
      provider: latestProvider,
      model: latestModel,
      attempt: currentAttempt,
    });
    emitLog("success", "Article generation finished successfully.", {
      articleId: article.id,
      contentLength: finalizedContent.length,
      researchLength: researchContent.length,
      status: finalStatus,
    }, "completed");
    emit(hooks, "result", resultPayload);
    emit(hooks, "done", {
      status: "completed",
      articleId: article.id,
      timestamp: new Date().toISOString(),
    });
    return getArticleGenerationJob(projectJobId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Article generation failed";
    if (error instanceof ArticleGenerationCancelledError) {
      cancelArticleGenerationJob(projectJobId, message);
      const job = getArticleGenerationJob(projectJobId);
      const articleId = job?.article_id ?? null;
      const calendarItemId = job?.calendar_item_id ?? null;
      if (articleId && calendarItemId) {
        const article = getArticle(articleId);
        if (article && isArticleEmpty(article)) {
          deleteArticle(articleId);
          updateCalendarItemStatus(calendarItemId, "suggested");
          emitLog("info", "Removed empty article and reverted calendar item to suggested.", {
            articleId,
            calendarItemId,
          }, "cancelled");
        } else if (article) {
          unlinkArticleFromCalendar(articleId);
          updateCalendarItemStatus(calendarItemId, "suggested");
          emitLog("info", "Unlinked article from calendar and reverted to suggested.", {
            articleId,
            calendarItemId,
          }, "cancelled");
        }
      }
      emitLog("warn", "Article generation cancelled.", { message }, "cancelled");
      emit(hooks, "done", { status: "cancelled", timestamp: new Date().toISOString() });
      return getArticleGenerationJob(projectJobId);
    }
    failArticleGenerationJob(projectJobId, message);
    emitLog("error", "Article generation failed.", { message }, "failed");
    emit(hooks, "error", { message, timestamp: new Date().toISOString() });
    emit(hooks, "done", { status: "failed", timestamp: new Date().toISOString() });
    throw error;
  }
}
