/**
 * Comprehensive types for article generation prompts.
 * Domain-agnostic: supports any industry, format, style, and article type.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Content Classification
// ─────────────────────────────────────────────────────────────────────────────

/** Article type / format - determines structure and conventions */
export type ArticleType =
  | "listicle"
  | "how-to"
  | "guide"
  | "tutorial"
  | "news"
  | "opinion"
  | "editorial"
  | "review"
  | "comparison"
  | "interview"
  | "case-study"
  | "explainer"
  | "whitepaper"
  | "report"
  | "profile"
  | "roundup"
  | "story"
  | "analysis"
  | "research"
  | string;

/** Publication format / channel */
export type ArticleFormat = "blog" | "news" | "magazine" | "newsletter" | "report" | "whitepaper" | "landing-page" | string;

/** Content freshness / recency preference for research */
export type ContentFreshness = "Last week" | "Last month" | "Last quarter" | "Evergreen" | string;

/** Content length classification */
export type ContentLength = "Short" | "Medium" | "Long" | "Ultra-long" | string;

/** Reading comprehension level */
export type ReadingLevel = "Elementary" | "Intermediate" | "Advanced" | "Expert" | "Technical" | string;

/** Tone of content */
export type ContentTone =
  | "Professional"
  | "Conversational"
  | "Authoritative"
  | "Friendly"
  | "Formal"
  | "Casual"
  | "Academic"
  | "Journalistic"
  | "Witty"
  | "Empathetic"
  | "Provocative"
  | string;

/** Editorial / writing style */
export type EditorialStyle =
  | "Informative"
  | "Persuasive"
  | "Narrative"
  | "Analytical"
  | "Instructional"
  | "Investigative"
  | "Opinion-driven"
  | "Data-driven"
  | "Storytelling"
  | string;

/** Narrative point of view */
export type PointOfView = "first-person" | "second-person" | "third-person";

/** Primary content intent / goal */
export type ContentIntent = "inform" | "persuade" | "entertain" | "sell" | "educate" | "inspire" | "debate";

/** Citation style for references */
export type CitationStyle = "APA" | "MLA" | "Chicago" | "Harvard" | "IEEE" | "footnote" | "inline";

/** Funnel stage for analytics */
export type FunnelStage = "awareness" | "consideration" | "decision" | "retention";

/** Engagement level classification */
export type EngagementLevel = "high" | "medium" | "low";

// ─────────────────────────────────────────────────────────────────────────────
// Base / Shared Types
// ─────────────────────────────────────────────────────────────────────────────

/** Core parameters shared across most prompts */
export interface BasePromptParams {
  /** Primary target keyword or topic */
  keyword: string;
  /** Content category / domain (e.g., Technology, Entertainment, Finance, Healthcare) */
  category: string;
  /** Target audience demographic or persona */
  targetAudience: string;
}

/** Parameters for prompts that require reading level */
export interface ReadingLevelParams {
  readingLevel: ReadingLevel;
}

/** Parameters for prompts that require tone */
export interface ToneParams {
  tone: ContentTone;
}

/** Parameters for prompts that require style */
export interface StyleParams {
  style: EditorialStyle;
}

/** Existing page for internal linking - URL and title from crawled site */
export interface ExistingPage {
  url: string;
  title: string;
}

/** Geographic / locale parameters */
export interface GeoParams {
  geoFocus: string;
}

/** Custom instructions - always optional, always respected */
export interface CustomInstructionsParams {
  customInstructions?: string;
}

/** Article output language (ISO 639-1 code) */
export type ArticleLanguage = "en" | "es" | "fr" | "de" | "it" | "pt" | "nl" | "pl" | "ru" | "ja" | "zh" | "ko" | "ar" | "hi" | string;

// ─────────────────────────────────────────────────────────────────────────────
// Research Prompt
// ─────────────────────────────────────────────────────────────────────────────

export interface ResearchPromptParams extends BasePromptParams, GeoParams, CustomInstructionsParams {
  /** Source URL to reference (optional - triggers independent research if absent) */
  url?: string;
  /** Include trending topics and real-time social sentiment analysis */
  includeTrendingTopics?: boolean;
  /** Content recency preference */
  contentFreshness?: ContentFreshness;
  /** Article type to tailor research methodology */
  articleType?: ArticleType;
  /** Content intent to align research focus */
  contentIntent?: ContentIntent;
}

// ─────────────────────────────────────────────────────────────────────────────
// Outline Prompt
// ─────────────────────────────────────────────────────────────────────────────

export interface OutlinePromptParams
  extends BasePromptParams,
    StyleParams,
    ReadingLevelParams,
    CustomInstructionsParams {
  /** Precise word count target (overrides length if set) */
  targetWordCount?: number;
  /** Content length classification */
  length: ContentLength;
  /** Include multi-layered subtopic development */
  includeSubtopics?: boolean;
  /** Pre-defined title (if absent, generate 5-7 variations) */
  title?: string;
  /** Article type - determines structure (listicle, how-to, guide, etc.) */
  articleType?: ArticleType;
  /** Publication format */
  articleFormat?: ArticleFormat;
  /** Narrative point of view */
  pointOfView?: PointOfView;
  /** Content intent */
  contentIntent?: ContentIntent;
  /** Require infographics in every section (mandatory) */
  requireInfographics?: boolean;
  /** Output language (ISO 639-1 code) */
  language?: ArticleLanguage;
}


// ─────────────────────────────────────────────────────────────────────────────
// Content Prompt
// ─────────────────────────────────────────────────────────────────────────────

export interface ContentPromptParams
  extends BasePromptParams,
    ToneParams,
    StyleParams,
    ReadingLevelParams,
    CustomInstructionsParams {
  /** Content length/scope */
  length: ContentLength;
  /** Author name for byline */
  authorName?: string;
  /** Enable strategic external link integration */
  externalLinking?: boolean;
  /** Enable internal linking architecture */
  internalLinking?: boolean;
  /** Article type - determines structure and conventions */
  articleType?: ArticleType;
  /** Publication format */
  articleFormat?: ArticleFormat;
  /** Narrative point of view */
  pointOfView?: PointOfView;
  /** Content intent */
  contentIntent?: ContentIntent;
  /** Citation style for references */
  citationStyle?: CitationStyle;
  /** Existing pages for internal linking (url, title) - crawled URLs */
  existingPages?: ExistingPage[];
  /** Published articles (url, title) - live blog URLs for backlinks/internal linking */
  publishedArticles?: ExistingPage[];
  /** Require infographics in every article (mandatory) */
  requireInfographics?: boolean;
  /** Output language (ISO 639-1 code, e.g. en, es, fr) */
  language?: ArticleLanguage;
}

// ─────────────────────────────────────────────────────────────────────────────
// Fact-Check Prompt
// ─────────────────────────────────────────────────────────────────────────────

export interface FactCheckPromptParams extends BasePromptParams {
  /** Citation style for footnotes */
  citationStyle?: CitationStyle;
  /** Article type for domain-appropriate source selection */
  articleType?: ArticleType;
}

// ─────────────────────────────────────────────────────────────────────────────
// Humanize Prompt
// ─────────────────────────────────────────────────────────────────────────────

export interface HumanizePromptParams extends BasePromptParams, ToneParams, ReadingLevelParams {
  /** Article type for style adaptation */
  articleType?: ArticleType;
  /** Target point of view */
  pointOfView?: PointOfView;
}

// ─────────────────────────────────────────────────────────────────────────────
// SEO Prompt
// ─────────────────────────────────────────────────────────────────────────────

export interface SEOPromptParams extends BasePromptParams, GeoParams {
  /** Include full social media optimization */
  socialMediaOptimization?: boolean;
  /** Article type for schema and optimization */
  articleType?: ArticleType;
}

// ─────────────────────────────────────────────────────────────────────────────
// Metadata Prompt
// ─────────────────────────────────────────────────────────────────────────────

export interface MetadataPromptParams extends BasePromptParams {
  /** Article title (auto-generated from content if absent) */
  title?: string;
  /** Author attribution */
  authorName?: string;
  /** Article type for schema markup */
  articleType?: ArticleType;
  /** Publication format */
  articleFormat?: ArticleFormat;
}

// ─────────────────────────────────────────────────────────────────────────────
// Unified Pipeline Input (for full article generation flow)
// ─────────────────────────────────────────────────────────────────────────────

/** Single input interface for the entire article generation pipeline */
export interface ArticlePipelineInput {
  keyword: string;
  category: string;
  targetAudience: string;
  geoFocus?: string;
  url?: string;
  title?: string;
  authorName?: string;
  length?: ContentLength;
  targetWordCount?: number;
  tone?: ContentTone;
  style?: EditorialStyle;
  readingLevel?: ReadingLevel;
  articleType?: ArticleType;
  articleFormat?: ArticleFormat;
  pointOfView?: PointOfView;
  contentIntent?: ContentIntent;
  contentFreshness?: ContentFreshness;
  citationStyle?: CitationStyle;
  includeTrendingTopics?: boolean;
  includeSubtopics?: boolean;
  externalLinking?: boolean;
  internalLinking?: boolean;
  socialMediaOptimization?: boolean;
  customInstructions?: string;
  /** Existing pages for internal linking (crawled URLs) */
  existingPages?: ExistingPage[];
  /** Published articles (live URLs) for backlinks/internal linking */
  publishedArticles?: ExistingPage[];
  /** Require infographics in every article (default: true) */
  requireInfographics?: boolean;
  /** Output language (ISO 639-1 code) */
  language?: ArticleLanguage;
}

// ─────────────────────────────────────────────────────────────────────────────
// Content Calendar Prompt
// ─────────────────────────────────────────────────────────────────────────────

export interface ContentCalendarPromptParams {
  /** Homepage URL of the website */
  homepageUrl: string;
  /** List of crawled URLs with titles (existing content) */
  existingPages: ExistingPage[];
  /** Whether sitemap was found and used */
  usedSitemap?: boolean;
  /** Number of content suggestions to generate */
  suggestionCount?: number;
  /** Target publishing frequency (e.g., "2 per week") */
  publishingFrequency?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Metadata Output Types (for buildMetadataPrompt response)
// ─────────────────────────────────────────────────────────────────────────────

export interface MetadataBasic {
  title: string;
  titleVariations: string[];
  metaDescription: string;
  metaDescriptionVariations: string[];
  keywords: string[];
  tags: string[];
  category: string;
  author: string;
}

export interface MetadataOpenGraph {
  "og:title": string;
  "og:description": string;
  "og:image": string;
  "og:url": string;
  "og:type": string;
  "og:site_name": string;
  "article:author": string;
  "article:section": string;
  "article:tag": string;
}

export interface MetadataTwitterCard {
  "twitter:card": string;
  "twitter:title": string;
  "twitter:description": string;
  "twitter:image": string;
  "twitter:creator": string;
  "twitter:site": string;
}

export interface MetadataSchemaAuthor {
  "@type": "Person";
  name: string;
}

export interface MetadataSchemaPublisher {
  "@type": "Organization";
  name: string;
  logo: {
    "@type": "ImageObject";
    url: string;
  };
}

export interface MetadataSchema {
  "@context": string;
  "@type": "Article";
  headline: string;
  description: string;
  image: string;
  author: MetadataSchemaAuthor;
  publisher: MetadataSchemaPublisher;
  datePublished: string;
  dateModified: string;
  mainEntityOfPage: {
    "@type": "WebPage";
    "@id": string;
  };
  keywords: string;
}

export interface MetadataSEO {
  openGraph: MetadataOpenGraph;
  twitterCard: MetadataTwitterCard;
  schema: MetadataSchema;
  canonical: string;
}

export interface ShareSnippet {
  title: string;
  description: string;
  image: string;
}

export interface MetadataSocial {
  hashtags: string[];
  shareSnippets: {
    facebook: ShareSnippet;
    twitter: ShareSnippet;
    linkedin: ShareSnippet;
    instagram: ShareSnippet;
  };
}

export interface MetadataAnalytics {
  contentType: string;
  audienceSegment: string;
  topics: string[];
  contentPillar: string;
  funnelStage: FunnelStage;
  engagementLevel: EngagementLevel;
  shareability: EngagementLevel;
}

export interface MetadataOutput {
  basic: MetadataBasic;
  seo: MetadataSEO;
  social: MetadataSocial;
  analytics: MetadataAnalytics;
}
