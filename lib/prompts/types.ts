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

/** Domain knowledge about the site (from crawl or manual). Used in article/idea generation. */
export interface DomainKnowledgeParams {
  domainKnowledge?: string;
}

/** Article output language (ISO 639-1 code) */
export type ArticleLanguage = "en" | "es" | "fr" | "de" | "it" | "pt" | "nl" | "pl" | "ru" | "ja" | "zh" | "ko" | "ar" | "hi" | string;

// ─────────────────────────────────────────────────────────────────────────────
// Research Prompt
// ─────────────────────────────────────────────────────────────────────────────

export interface ResearchPromptParams extends BasePromptParams, GeoParams, CustomInstructionsParams, DomainKnowledgeParams {
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
// Content Prompt
// ─────────────────────────────────────────────────────────────────────────────

export interface ContentPromptParams
  extends BasePromptParams,
    ToneParams,
    StyleParams,
    ReadingLevelParams,
    CustomInstructionsParams,
    DomainKnowledgeParams {
  /** Suggested article title or required H1 */
  title?: string;
  /** Content length/scope */
  length: ContentLength;
  /** Author name for byline */
  authorName?: string;
  /** Enable strategic external link integration */
  externalLinking?: boolean;
  /** Enable internal linking architecture */
  internalLinking?: boolean;
  /** Allow crawled site URLs to be used as internal link targets */
  useCrawledUrlsAsInternalLinks?: boolean;
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
  /** Existing pages discovered from crawl/manual URLs */
  existingPages?: ExistingPage[];
  /** Published articles (url, title) - live blog URLs for backlinks/internal linking */
  publishedArticles?: ExistingPage[];
  /** User-added internal links for this site only */
  internalLinks?: ExistingPage[];
  /** User-added external links for referencing */
  externalLinks?: ExistingPage[];
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
  /** Final article markdown content */
  content?: string;
  /** Generated research brief */
  researchContent?: string;
  /** Helpful secondary keywords */
  secondaryKeywords?: string[];
  /** Output language */
  language?: ArticleLanguage;
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
  useCrawledUrlsAsInternalLinks?: boolean;
  socialMediaOptimization?: boolean;
  customInstructions?: string;
  /** Custom instructions for content idea/calendar generation (e.g. topic preferences, angles to avoid) */
  contentIdeaCustomInstructions?: string;
  /** Domain knowledge about the site (auto-filled from crawl or manual). Used in article/idea generation. */
  domainKnowledge?: string;
  researchContent?: string;
  content?: string;
  secondaryKeywords?: string[];
  /** Existing pages for internal linking (crawled URLs) */
  existingPages?: ExistingPage[];
  /** Published articles (live URLs) for backlinks/internal linking */
  publishedArticles?: ExistingPage[];
  /** User-added internal links for this site only */
  internalLinks?: ExistingPage[];
  /** User-added external links for referencing */
  externalLinks?: ExistingPage[];
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
  /** User-added internal links from project settings */
  internalLinks?: ExistingPage[];
  /** Whether sitemap was found and used */
  usedSitemap?: boolean;
  /** Number of content suggestions to generate */
  suggestionCount?: number;
  /** Target publishing frequency (e.g., "2 per week") */
  publishingFrequency?: string;
  /** AI-extracted keywords from crawled content (prioritize for article topics) */
  extractedKeywords?: string[];
  /** Rich SEO reference data collected during crawl + AI analysis */
  seoReference?: {
    summary?: string | null;
    topics?: string[];
    questions?: string[];
    painPoints?: string[];
    contentAngles?: string[];
    productsServices?: string[];
  };
  /** Generate for whole month (suggestionCount = days in month) */
  wholeMonth?: boolean;
  /** Start date for calendar range (YYYY-MM-DD) */
  startDate?: string;
  /** End date for calendar range (YYYY-MM-DD) */
  endDate?: string;
  /** User feedback to incorporate when regenerating */
  userFeedback?: string;
  /** Existing calendar items (to avoid duplicates, incorporate feedback) */
  existingItems?: { targetUrl?: string; primaryKeyword?: string; title?: string }[];
  /** Published articles already live for this project (must avoid duplicating) */
  publishedItems?: { targetUrl?: string; primaryKeyword?: string; title?: string }[];
  /** Custom instructions for content idea generation (from project settings) */
  contentIdeaCustomInstructions?: string;
  /** Domain knowledge about the site (auto-filled from crawl or manual). Used in idea generation. */
  domainKnowledge?: string;
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

export interface GeneratedArticleMetadata {
  title: string;
  slug: string;
  seoTitle: string;
  metaDescription: string;
  excerpt: string;
  tags: string[];
  category: string;
  canonicalUrl?: string | null;
  coverImageAlt: string;
  coverImagePrompt: string;
  socialHashtags?: string[];
}
