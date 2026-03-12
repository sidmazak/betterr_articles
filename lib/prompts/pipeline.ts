import type {
  ArticlePipelineInput,
  ResearchPromptParams,
  ContentPromptParams,
  FactCheckPromptParams,
  HumanizePromptParams,
  SEOPromptParams,
  MetadataPromptParams,
} from "./types";
import { buildResearchPrompt } from "./research";
import { buildContentPrompt } from "./content";
import { buildFactCheckPrompt } from "./fact-check";
import { buildHumanizePrompt } from "./humanize";
import { buildSEOPrompt } from "./seo";
import { buildMetadataPrompt } from "./metadata";

/**
 * Converts unified pipeline input to ResearchPromptParams.
 */
export function toResearchParams(input: ArticlePipelineInput): ResearchPromptParams {
  return {
    keyword: input.keyword,
    category: input.category,
    targetAudience: input.targetAudience,
    geoFocus: input.geoFocus ?? "Global",
    url: input.url,
    includeTrendingTopics: input.includeTrendingTopics,
    contentFreshness: input.contentFreshness,
    articleType: input.articleType,
    contentIntent: input.contentIntent,
    customInstructions: input.customInstructions,
    domainKnowledge: input.domainKnowledge,
  };
}

/**
 * Converts unified pipeline input to ContentPromptParams.
 */
export function toContentParams(input: ArticlePipelineInput): ContentPromptParams {
  return {
    keyword: input.keyword,
    category: input.category,
    targetAudience: input.targetAudience,
    title: input.title,
    tone: input.tone ?? "Professional",
    style: input.style ?? "Informative",
    readingLevel: input.readingLevel ?? "Intermediate",
    length: input.length ?? "Medium",
    authorName: input.authorName,
    externalLinking: input.externalLinking,
    internalLinking: input.internalLinking ?? true,
    useCrawledUrlsAsInternalLinks: input.useCrawledUrlsAsInternalLinks ?? true,
    articleType: input.articleType,
    existingPages: input.existingPages,
    publishedArticles: input.publishedArticles,
    internalLinks: input.internalLinks,
    requireInfographics: input.requireInfographics ?? true,
    articleFormat: input.articleFormat,
    pointOfView: input.pointOfView,
    contentIntent: input.contentIntent,
    citationStyle: input.citationStyle,
    customInstructions: input.customInstructions,
    domainKnowledge: input.domainKnowledge,
    language: input.language,
  };
}

/**
 * Converts unified pipeline input to FactCheckPromptParams.
 */
export function toFactCheckParams(input: ArticlePipelineInput): FactCheckPromptParams {
  return {
    keyword: input.keyword,
    category: input.category,
    targetAudience: input.targetAudience,
    citationStyle: input.citationStyle,
    articleType: input.articleType,
  };
}

/**
 * Converts unified pipeline input to HumanizePromptParams.
 */
export function toHumanizeParams(input: ArticlePipelineInput): HumanizePromptParams {
  return {
    keyword: input.keyword,
    category: input.category,
    targetAudience: input.targetAudience,
    tone: input.tone ?? "Professional",
    readingLevel: input.readingLevel ?? "Intermediate",
    articleType: input.articleType,
    pointOfView: input.pointOfView,
  };
}

/**
 * Converts unified pipeline input to SEOPromptParams.
 */
export function toSEOParams(input: ArticlePipelineInput): SEOPromptParams {
  return {
    keyword: input.keyword,
    category: input.category,
    targetAudience: input.targetAudience,
    geoFocus: input.geoFocus ?? "Global",
    socialMediaOptimization: input.socialMediaOptimization,
    articleType: input.articleType,
  };
}

/**
 * Converts unified pipeline input to MetadataPromptParams.
 */
export function toMetadataParams(input: ArticlePipelineInput): MetadataPromptParams {
  return {
    keyword: input.keyword,
    category: input.category,
    targetAudience: input.targetAudience,
    title: input.title,
    authorName: input.authorName,
    articleType: input.articleType,
    articleFormat: input.articleFormat,
    content: input.content,
    researchContent: input.researchContent,
    secondaryKeywords: input.secondaryKeywords,
    language: input.language,
  };
}

/**
 * Builds all prompts for the full article generation pipeline from a single input.
 */
export function buildAllPrompts(input: ArticlePipelineInput) {
  return {
    research: buildResearchPrompt(toResearchParams(input)),
    content: buildContentPrompt(toContentParams(input)),
    factCheck: buildFactCheckPrompt(toFactCheckParams(input)),
    humanize: buildHumanizePrompt(toHumanizeParams(input)),
    seo: buildSEOPrompt(toSEOParams(input)),
    metadata: buildMetadataPrompt(toMetadataParams(input)),
  };
}
