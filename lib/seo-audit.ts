import {
  extractMarkdownLinks,
  renderArticleAsText,
  type ArticleSection,
} from "@/lib/article-content";
import {
  SEO_RULE_CATEGORIES,
  SEO_TARGETS,
  type SeoRuleCategory,
} from "@/lib/seo-rules";

export interface SeoAuditCheck {
  id: string;
  category: SeoRuleCategory;
  label: string;
  passed: boolean;
  details: string;
}

export interface SeoAuditCategorySummary {
  id: SeoRuleCategory;
  label: string;
  summary: string;
  score: number;
  passedChecks: number;
  totalChecks: number;
}

export interface SeoAuditResult {
  score: number;
  passedChecks: number;
  totalChecks: number;
  checks: SeoAuditCheck[];
  categories: SeoAuditCategorySummary[];
}

interface BuildSeoAuditInput {
  title: string;
  seoTitle: string | null;
  metaDescription: string | null;
  excerpt: string | null;
  tags: string[];
  slug: string | null;
  socialHashtags: string[];
  content: string;
  contentText?: string;
  primaryKeyword: string | null;
  /** Semantic variants / secondary keywords for intro, headings, infographic (per SEORULES.md) */
  secondaryKeywords?: string[];
  articleSections: ArticleSection[];
  hasConclusion: boolean;
  coverImageAlt: string | null;
  hasFeaturedImage: boolean;
  homepageUrl?: string | null;
}

function normalizeKeyword(value: string | null) {
  return (value ?? "").trim().toLowerCase();
}

function normalizeWords(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function includesKeywordOrWords(text: string, keyword: string) {
  const normalizedText = text.toLowerCase();
  if (!keyword) return false;
  if (normalizedText.includes(keyword)) return true;
  const words = normalizeWords(keyword);
  return words.length > 1 && words.every((word) => normalizedText.includes(word));
}

/** Pass if text includes primary keyword OR any secondary/semantic variant (per SEORULES.md) */
function includesPrimaryOrSemantic(
  text: string,
  primaryKeyword: string | null,
  secondaryKeywords: string[]
) {
  if (primaryKeyword && includesKeywordOrWords(text, primaryKeyword)) return true;
  const secondaries = secondaryKeywords.filter((k) => typeof k === "string" && k.trim().length > 0);
  return secondaries.some((kw) => includesKeywordOrWords(text, kw.trim()));
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function countKeywordOccurrences(text: string, keyword: string) {
  if (!keyword) return 0;
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return (text.match(new RegExp(`\\b${escaped}\\b`, "gi")) ?? []).length;
}

function parseHeadings(content: string) {
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^#{1,6}\s+/.test(line))
    .map((line) => ({
      depth: (line.match(/^#+/)?.[0].length ?? 1),
      text: line.replace(/^#{1,6}\s+/, "").trim(),
    }));
}

function parseParagraphs(content: string) {
  return content
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(
      (block) =>
        block.length > 0 &&
        !/^#{1,6}\s+/.test(block) &&
        !/^\s*[-*+]\s+/.test(block) &&
        !/^\s*\d+\.\s+/.test(block) &&
        !/^```/.test(block) &&
        !/^Infographic:/i.test(block)
    );
}

function normalizeFaqLine(line: string) {
  return line
    .trim()
    .replace(/^#{1,6}\s+/, "")
    .replace(/^[-*+]\s+/, "")
    .replace(/^\d+\.\s+/, "")
    .replace(/^\*\*(.+)\*\*$/, "$1")
    .trim();
}

function isFaqSectionHeading(line: string) {
  const normalized = normalizeFaqLine(line).replace(/:$/, "");
  return /^(faq|frequently asked questions)$/i.test(normalized);
}

function isQuestionLine(line: string) {
  const normalized = normalizeFaqLine(line);
  return normalized.endsWith("?");
}

function countPlainTextFaqItems(content: string) {
  const lines = content.split("\n");
  const faqStartIndex = lines.findIndex((line) => isFaqSectionHeading(line));
  if (faqStartIndex === -1) return 0;

  let count = 0;
  for (let index = faqStartIndex + 1; index < lines.length; index += 1) {
    const rawLine = lines[index];
    const trimmed = rawLine.trim();
    if (!trimmed) continue;
    if (/^#{1,6}\s+/.test(trimmed)) break;
    if (isQuestionLine(trimmed)) count += 1;
  }

  return count;
}

function parseFaqCount(content: string, headings: Array<{ depth: number; text: string }>) {
  const faqHeadingIndex = headings.findIndex((heading) => /faq|frequently asked questions/i.test(heading.text));
  if (faqHeadingIndex === -1) {
    const plainTextFaqCount = countPlainTextFaqItems(content);
    if (plainTextFaqCount > 0) return plainTextFaqCount;
    return headings.filter((heading) => heading.text.endsWith("?")).length;
  }

  const faqDepth = headings[faqHeadingIndex].depth;
  let count = 0;
  for (let index = faqHeadingIndex + 1; index < headings.length; index += 1) {
    const heading = headings[index];
    if (heading.depth <= faqDepth) break;
    if (heading.text.endsWith("?")) count += 1;
  }
  return count > 0 ? count : countPlainTextFaqItems(content);
}

function getDomain(url: string) {
  try {
    if (url.startsWith("/")) return null;
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function isInternalUrl(url: string, homepageUrl?: string | null) {
  if (url.startsWith("/")) return true;
  if (!homepageUrl) return false;
  try {
    return new URL(url).hostname === new URL(homepageUrl).hostname;
  } catch {
    return false;
  }
}

function isAuthorityDomain(domain: string | null) {
  if (!domain) return false;
  return (
    domain.endsWith(".gov") ||
    domain.endsWith(".edu") ||
    /(nih\.gov|cdc\.gov|fda\.gov|who\.int|wikipedia\.org|harvard\.edu|mit\.edu|stanford\.edu|forbes\.com|nytimes\.com|reuters\.com|statista\.com|hubspot\.com|google\.com)/.test(domain)
  );
}

function buildCheck(
  id: string,
  category: SeoRuleCategory,
  label: string,
  passed: boolean,
  details: string
): SeoAuditCheck {
  return { id, category, label, passed, details };
}

export function buildSeoAudit(input: BuildSeoAuditInput): SeoAuditResult {
  const primaryKeyword = normalizeKeyword(input.primaryKeyword);
  const secondaryKeywords = (input.secondaryKeywords ?? []).map((k) => normalizeKeyword(k)).filter(Boolean);
  const contentText = (input.contentText ?? renderArticleAsText(input.content)).trim();
  const intro = contentText.slice(0, 500).toLowerCase();
  const headings = parseHeadings(input.content);
  const headingTexts = headings.map((heading) => heading.text.toLowerCase());
  const uniqueHeadings = new Set(headingTexts);
  const paragraphs = parseParagraphs(input.content);
  const words = contentText.split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const keywordOccurrences = countKeywordOccurrences(contentText.toLowerCase(), primaryKeyword);
  const keywordDensity = wordCount > 0 ? (keywordOccurrences / wordCount) * 100 : 0;
  const slugSource = input.slug ?? "";
  const slugContainsKeyword = primaryKeyword
    ? slugify(slugSource).includes(slugify(primaryKeyword))
    : false;
  const links = extractMarkdownLinks(input.content);
  const internalLinks = links.filter((link) => isInternalUrl(link.url, input.homepageUrl));
  const externalLinks = links.filter((link) => !isInternalUrl(link.url, input.homepageUrl));
  const authorityLinks = externalLinks.filter((link) => isAuthorityDomain(getDomain(link.url)));
  const infographicText = input.articleSections
    .filter((section): section is Extract<ArticleSection, { type: "infographic" }> => section.type === "infographic")
    .map((section) => ("html" in section ? `${section.title}\n${section.html}` : section.title).toLowerCase())
    .join("\n");
  const faqCount = parseFaqCount(input.content, headings);
  const listCount = (input.content.match(/(^|\n)\s*([-*+]\s+|\d+\.\s+)/g) ?? []).length;
  const paragraphLengths = paragraphs.map((paragraph) => paragraph.split(/\s+/).filter(Boolean).length);
  const readableParagraphs =
    paragraphLengths.length > 0 &&
    paragraphLengths.filter((length) => length <= SEO_TARGETS.maximumParagraphWords).length /
      paragraphLengths.length >=
      0.8;
  const cleanFormatting =
    !/^\s*```/m.test(input.content.trimEnd().split("\n").slice(-1)[0] ?? "") &&
    !/\n\d+\s*$/.test(input.content.trim()) &&
    !/<\/?(script|style)\b/i.test(input.content);
  const titleLower = input.title.toLowerCase();
  const seoTitleLower = (input.seoTitle ?? "").toLowerCase();
  const metaDescriptionLower = (input.metaDescription ?? "").toLowerCase();

  const checks: SeoAuditCheck[] = [
    buildCheck(
      "keyword-in-title",
      "search-term-optimizations",
      "Keyword in title (incl. semantic variants)",
      includesPrimaryOrSemantic(titleLower, primaryKeyword || null, secondaryKeywords) ||
        includesPrimaryOrSemantic(seoTitleLower, primaryKeyword || null, secondaryKeywords),
      primaryKeyword || secondaryKeywords.length > 0 ? "Primary or secondary keyword" : "No keyword available"
    ),
    buildCheck(
      "keyword-position",
      "search-term-optimizations",
      "Keyword near start of title",
      !!primaryKeyword &&
        ((seoTitleLower.indexOf(primaryKeyword) >= 0 && seoTitleLower.indexOf(primaryKeyword) <= 24) ||
          (titleLower.indexOf(primaryKeyword) >= 0 && titleLower.indexOf(primaryKeyword) <= 24)),
      primaryKeyword ? "Checked within the first 24 characters" : "No primary keyword available"
    ),
    buildCheck(
      "keyword-in-meta",
      "search-term-optimizations",
      "Keyword in meta description (incl. semantic)",
      includesPrimaryOrSemantic(metaDescriptionLower, primaryKeyword || null, secondaryKeywords),
      input.metaDescription ? `${input.metaDescription.length} characters` : "Missing"
    ),
    buildCheck(
      "keyword-in-intro",
      "search-term-optimizations",
      "Keyword in introduction (incl. semantic)",
      includesPrimaryOrSemantic(intro, primaryKeyword || null, secondaryKeywords),
      primaryKeyword || secondaryKeywords.length > 0 ? "Primary or semantic variant" : "No keyword available"
    ),
    buildCheck(
      "keyword-in-headings",
      "search-term-optimizations",
      "Keyword in headings (incl. semantic)",
      headingTexts.some((h) => includesPrimaryOrSemantic(h, primaryKeyword || null, secondaryKeywords)),
      `${headings.length} headings parsed`
    ),
    buildCheck(
      "keyword-density",
      "search-term-optimizations",
      "Keyword density",
      keywordDensity >= SEO_TARGETS.keywordDensity.min && keywordDensity <= SEO_TARGETS.keywordDensity.max,
      `${keywordDensity.toFixed(2)}% density`
    ),
    buildCheck(
      "seo-friendly-url",
      "search-term-optimizations",
      "SEO-friendly URL",
      slugContainsKeyword,
      input.slug ?? "Missing slug"
    ),
    buildCheck(
      "content-length",
      "content-quality",
      "Content length",
      wordCount >= SEO_TARGETS.minimumWordCount,
      `${wordCount} words`
    ),
    buildCheck(
      "heading-structure",
      "content-quality",
      "Heading structure",
      headings.length >= 4 && headings[0]?.depth === 1,
      `${headings.length} headings`
    ),
    buildCheck(
      "unique-headings",
      "content-quality",
      "Unique headings",
      uniqueHeadings.size === headingTexts.length,
      `${uniqueHeadings.size}/${headingTexts.length} unique`
    ),
    buildCheck(
      "readable-paragraphs",
      "content-quality",
      "Readable paragraphs",
      readableParagraphs,
      `${paragraphs.length} paragraph blocks`
    ),
    buildCheck(
      "faq-section",
      "content-quality",
      "FAQ section",
      faqCount >= SEO_TARGETS.minimumFaqItems,
      `${faqCount} FAQ question heading(s)`
    ),
    buildCheck(
      "list-formatting",
      "content-quality",
      "List formatting",
      listCount >= SEO_TARGETS.minimumListCount,
      `${listCount} list marker groups`
    ),
    buildCheck(
      "clean-formatting",
      "content-quality",
      "Clean formatting",
      cleanFormatting,
      cleanFormatting ? "Formatting looks clean" : "Detected broken or suspicious formatting"
    ),
    buildCheck(
      "featured-image",
      "media-and-visuals",
      "Featured image",
      input.hasFeaturedImage,
      input.hasFeaturedImage ? "Present" : "Missing"
    ),
    buildCheck(
      "image-alt-text",
      "media-and-visuals",
      "Image alt text",
      !!input.coverImageAlt && input.coverImageAlt.trim().length >= 12,
      input.coverImageAlt ?? "Missing"
    ),
    buildCheck(
      "infographic-coverage",
      "media-and-visuals",
      "Infographic coverage",
      input.articleSections.some((section) => section.type === "infographic"),
      `${input.articleSections.filter((section) => section.type === "infographic").length} infographic section(s)`
    ),
    buildCheck(
      "keyword-in-infographic",
      "media-and-visuals",
      "Keyword in infographic (incl. semantic)",
      !input.articleSections.some((section) => section.type === "infographic") ||
        includesPrimaryOrSemantic(infographicText, primaryKeyword || null, secondaryKeywords),
      input.articleSections.some((section) => section.type === "infographic")
        ? "Primary or semantic variant in title/HTML"
        : "No infographic present"
    ),
    buildCheck(
      "internal-links",
      "links",
      "Internal links",
      internalLinks.length >= SEO_TARGETS.minimumInternalLinks,
      `${internalLinks.length} internal link(s)`
    ),
    buildCheck(
      "anchor-text",
      "links",
      "Link anchor text",
      links.length > 0 && links.every((link) => link.text.length >= 4 && !/click here|learn more|read more/i.test(link.text)),
      `${links.length} total link(s)`
    ),
    buildCheck(
      "authority-links",
      "links",
      "High-authority links",
      authorityLinks.length >= SEO_TARGETS.minimumAuthorityLinks,
      `${authorityLinks.length} authority source link(s)`
    ),
    buildCheck(
      "meta-description-length",
      "meta-and-technical",
      "Meta description length",
      !!input.metaDescription &&
        input.metaDescription.length >= SEO_TARGETS.metaDescriptionLength.min &&
        input.metaDescription.length <= SEO_TARGETS.metaDescriptionLength.max,
      input.metaDescription ? `${input.metaDescription.length} characters` : "Missing"
    ),
    buildCheck(
      "title-length",
      "meta-and-technical",
      "Title length",
      !!input.seoTitle &&
        input.seoTitle.length >= SEO_TARGETS.titleLength.min &&
        input.seoTitle.length <= SEO_TARGETS.titleLength.max,
      input.seoTitle ? `${input.seoTitle.length} characters` : "Missing"
    ),
    buildCheck(
      "content-tags",
      "meta-and-technical",
      "Content tags",
      input.tags.length >= SEO_TARGETS.minimumTags && input.tags.length <= SEO_TARGETS.maximumTags,
      `${input.tags.length} tags`
    ),
    buildCheck(
      "meta-keywords",
      "meta-and-technical",
      "Meta keywords coverage",
      input.tags.length >= 3 || !!primaryKeyword,
      input.tags.length > 0 ? `${input.tags.slice(0, 6).join(", ")}` : "Using primary keyword only"
    ),
    buildCheck(
      "social-hashtags",
      "meta-and-technical",
      "Social hashtags",
      input.socialHashtags.length >= SEO_TARGETS.minimumHashtags,
      `${input.socialHashtags.length} hashtag(s)`
    ),
    buildCheck(
      "excerpt",
      "meta-and-technical",
      "Excerpt ready",
      !!input.excerpt &&
        input.excerpt.trim().length >= SEO_TARGETS.excerptLength.min &&
        input.excerpt.trim().length <= SEO_TARGETS.excerptLength.max,
      input.excerpt ? `${input.excerpt.length} characters` : "Missing"
    ),
  ];

  const categories = SEO_RULE_CATEGORIES.map((definition) => {
    const categoryChecks = checks.filter((check) => check.category === definition.id);
    const passedChecks = categoryChecks.filter((check) => check.passed).length;
    const score =
      categoryChecks.length > 0
        ? Math.round((passedChecks / categoryChecks.length) * 100)
        : 0;

    return {
      id: definition.id,
      label: definition.label,
      summary: definition.summary,
      score,
      passedChecks,
      totalChecks: categoryChecks.length,
    };
  });

  const passedChecks = checks.filter((check) => check.passed).length;
  const score = Math.round((passedChecks / checks.length) * 100);

  return {
    score,
    passedChecks,
    totalChecks: checks.length,
    checks,
    categories,
  };
}

