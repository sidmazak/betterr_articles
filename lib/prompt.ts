/**
 * @deprecated Import from "@/lib/prompts" instead.
 * This file re-exports for backward compatibility.
 */
export {
  buildResearchPrompt,
  buildOutlinePrompt,
  buildContentPrompt,
  buildFactCheckPrompt,
  buildHumanizePrompt,
  buildSEOPrompt,
  buildMetadataPrompt,
  buildContentCalendarPrompt,
  buildAllPrompts,
  toResearchParams,
  toOutlineParams,
  toContentParams,
  toFactCheckParams,
  toHumanizeParams,
  toSEOParams,
  toMetadataParams,
} from "./prompts";

export type {
  ResearchPromptParams,
  OutlinePromptParams,
  ContentPromptParams,
  FactCheckPromptParams,
  HumanizePromptParams,
  SEOPromptParams,
  MetadataPromptParams,
  ContentCalendarPromptParams,
  ArticlePipelineInput,
} from "./prompts";
