export type SeoRuleCategory =
  | "search-term-optimizations"
  | "content-quality"
  | "media-and-visuals"
  | "links"
  | "meta-and-technical";

export interface SeoCategoryDefinition {
  id: SeoRuleCategory;
  label: string;
  summary: string;
}

export const SEO_RULE_CATEGORIES: SeoCategoryDefinition[] = [
  {
    id: "search-term-optimizations",
    label: "Search term optimizations",
    summary: "Keyword placement, coverage, density, and SEO-friendly URLs.",
  },
  {
    id: "content-quality",
    label: "Content quality",
    summary: "Length, structure, readability, FAQs, lists, and clean formatting.",
  },
  {
    id: "media-and-visuals",
    label: "Media and visuals",
    summary: "Featured image support, infographic coverage, and alt text quality.",
  },
  {
    id: "links",
    label: "Links",
    summary: "Internal links, descriptive anchors, and authoritative sources.",
  },
  {
    id: "meta-and-technical",
    label: "Meta and technical",
    summary: "Meta lengths, tags, and metadata coverage.",
  },
];

export const SEO_TARGETS = {
  titleLength: { min: 45, max: 100 },
  metaDescriptionLength: { min: 120, max: 160 },
  keywordDensity: { min: 0.5, max: 1.5 },
  minimumWordCount: 1500,
  minimumTags: 4,
  maximumTags: 8,
  minimumInternalLinks: 3,
  minimumAuthorityLinks: 1,
  minimumParagraphSentences: 1,
  maximumParagraphWords: 120,
  minimumHashtags: 2,
  minimumListCount: 1,
  minimumFaqItems: 3,
} as const;

/** Target SEO score. Optimization loop runs until score >= this or max passes. */
export const SEO_TARGET_SCORE = 90;

/** Minimum score string for prompt copy (91+ for aspirational target). */
export const SEO_MINIMUM_SCORE = "91+";

export const SEO_RULES_PROMPT_BLOCK = `Follow these SEO rules exactly. Articles must score at least ${SEO_MINIMUM_SCORE}/100:
- Put the primary keyword or a close semantic variant in the title and keep it near the beginning.
- Use the primary keyword naturally in the meta description, introduction, at least one H2 or H3, the slug, and the article body.
- Keep keyword density natural, roughly within 0.5% to 1.5%.
- Write a comprehensive article that is usually at least 1,500 words unless the topic genuinely requires less.
- Use a clear H1/H2/H3 hierarchy: one H1 for the title, H2 for major sections, H3 for subsections. Never repeat the full title as plain text. Each section must have a proper heading.
- Keep paragraphs readable and scannable. Prefer short paragraphs, bullet lists, comparison tables, and practical examples where useful.
- Include a dedicated FAQ section with question-style headings when the topic supports it.
- Format the FAQ section in markdown using \`## FAQ\` or \`## Frequently Asked Questions\`, followed by at least 3 \`### Question?\` subheadings when the topic supports it.
- Include at least one meaningful list.
- Use a concluding section or closing summary only when it improves the article format and reader experience. Do not force a conclusion when the format would feel unnatural without it.
- Keep formatting clean. Do not leave broken HTML, unfinished code fences, dangling bullets, or orphaned tokens.
- Include a featured image concept and descriptive alt text tied to the topic.
- If infographics are enabled, include exactly one rich self-contained infographic HTML block that matches the topic and includes the exact primary keyword phrase in at least one infographic title, caption, or visible label.
- Make the infographic feel editorial and premium rather than generic: strong heading/subheading, modular panels, concise text, clear hierarchy, and purposeful accent colors.
- Use descriptive internal links when relevant.
- Use high-authority external sources when external linking is enabled or factual claims need support.`;

export function getSeoScoreVariant(score: number) {
  if (score >= 90) return "excellent";
  if (score >= 75) return "good";
  if (score >= 60) return "fair";
  return "poor";
}

