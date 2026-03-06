/**
 * Article generation prompts - modular, typed, domain-agnostic.
 * Supports any industry, format, style, and article type.
 *
 * Usage:
 *   import { buildResearchPrompt, buildOutlinePrompt } from "@/lib/prompts";
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
  OutlinePromptParams,
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
export { buildOutlinePrompt } from "./outline";
export { buildContentPrompt } from "./content";
export { buildFactCheckPrompt } from "./fact-check";
export { buildHumanizePrompt } from "./humanize";
export { buildSEOPrompt } from "./seo";
export { buildMetadataPrompt } from "./metadata";
export { buildContentCalendarPrompt } from "./content-calendar";

// Pipeline helpers (unified input -> individual prompts)
export {
  toResearchParams,
  toOutlineParams,
  toContentParams,
  toFactCheckParams,
  toHumanizeParams,
  toSEOParams,
  toMetadataParams,
  buildAllPrompts,
} from "./pipeline";
