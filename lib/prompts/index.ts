/**
 * Article generation prompts - modular, typed, domain-agnostic.
 * Supports any industry, format, style, and article type.
 *
 * Usage:
 *   import { buildResearchPrompt, buildContentPrompt } from "@/lib/prompts";
 *   import type { ResearchPromptParams, ArticlePipelineInput } from "@/lib/prompts";
 */

// Types
export type {
  ArticleType,
  ArticleFormat,
  ContentFreshness,
  ContentLength,
  ReadingLevel,
  ContentTone,
  EditorialStyle,
  PointOfView,
  ContentIntent,
  CitationStyle,
  FunnelStage,
  EngagementLevel,
  BasePromptParams,
  ReadingLevelParams,
  ToneParams,
  StyleParams,
  GeoParams,
  CustomInstructionsParams,
  ResearchPromptParams,
  ContentPromptParams,
  FactCheckPromptParams,
  HumanizePromptParams,
  SEOPromptParams,
  MetadataPromptParams,
  ContentCalendarPromptParams,
  ExistingPage,
  ArticlePipelineInput,
  MetadataBasic,
  MetadataOpenGraph,
  MetadataTwitterCard,
  MetadataSchema,
  MetadataSchemaAuthor,
  MetadataSchemaPublisher,
  MetadataSEO,
  MetadataSocial,
  MetadataAnalytics,
  MetadataOutput,
  ShareSnippet,
} from "./types";

// Prompt builders
export { buildResearchPrompt } from "./research";
export { buildContentPrompt } from "./content";
export { buildFactCheckPrompt } from "./fact-check";
export { buildHumanizePrompt } from "./humanize";
export { buildSEOPrompt } from "./seo";
export { buildMetadataPrompt } from "./metadata";
export { buildContentCalendarPrompt } from "./content-calendar";

// Pipeline helpers (unified input -> individual prompts)
export {
  toResearchParams,
  toContentParams,
  toFactCheckParams,
  toHumanizeParams,
  toSEOParams,
  toMetadataParams,
  buildAllPrompts,
} from "./pipeline";
