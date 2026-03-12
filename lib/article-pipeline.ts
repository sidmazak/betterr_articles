import { chat, type ChatRunner } from "@/lib/llm";
import { buildArticleSections, extractMarkdownLinks } from "@/lib/article-content";
import {
  buildContentPrompt,
  buildResearchPrompt,
  toContentParams,
  toResearchParams,
  type ArticlePipelineInput,
} from "@/lib/prompts";
import { getStructuredPromptInstruction } from "@/lib/prompts/toon";
import { SEO_TARGETS } from "@/lib/seo-rules";

function safeParseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value.replace(/^```json\s*|\s*```$/g, "").trim()) as T;
  } catch {
    return fallback;
  }
}

export function articleNeedsCompletion(content: string) {
  const trimmed = content.trim();
  if (!trimmed) return false;
  return /\n\d+\s*$/.test(trimmed);
}

const ARTICLE_TYPES_WITHOUT_LEAD_BOXES = new Set([
  "news",
  "opinion",
  "editorial",
  "story",
  "profile",
  "interview",
]);

function normalizeArticleType(articleType: string | undefined) {
  return articleType?.trim().toLowerCase() ?? "";
}

function shouldUseLeadBoxes(input: ArticlePipelineInput) {
  const normalizedArticleType = normalizeArticleType(input.articleType);
  return !ARTICLE_TYPES_WITHOUT_LEAD_BOXES.has(normalizedArticleType);
}

function shouldRequireKeyTakeaways(input: ArticlePipelineInput) {
  return shouldUseLeadBoxes(input) && (input.length === "Long" || input.length === "Ultra-long");
}

function normalizeHeadingText(value: string) {
  return value
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_`>#]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isSpecialLeadHeading(heading: string) {
  return /^(key takeaways|table of contents)$/i.test(heading.trim());
}

function isAuxiliaryHeading(heading: string) {
  return /^(faq|frequently asked questions|conclusion|final thoughts|wrapping up)$/i.test(
    heading.trim()
  );
}

function getMainSectionHeadings(content: string) {
  return [...content.matchAll(/^##\s+(.+)$/gm)]
    .map((match) => normalizeHeadingText(match[1] ?? ""))
    .filter(Boolean)
    .filter((heading) => !isSpecialLeadHeading(heading));
}

function shouldRequireTableOfContents(
  input: ArticlePipelineInput,
  headingCount: number
) {
  if (!shouldUseLeadBoxes(input)) return false;
  const normalizedArticleType = normalizeArticleType(input.articleType);
  return (
    input.length === "Long" ||
    input.length === "Ultra-long" ||
    headingCount >= 4 ||
    [
      "guide",
      "how-to",
      "tutorial",
      "comparison",
      "explainer",
      "report",
      "research",
      "analysis",
      "case-study",
    ].includes(normalizedArticleType)
  );
}

function stripMarkdownSyntax(value: string) {
  return value
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/[*_`>#-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getSectionBodySnippet(content: string, heading: string) {
  const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const headingRegex = new RegExp(`^##\\s+${escapedHeading}\\s*$`, "m");
  const headingMatch = headingRegex.exec(content);
  if (!headingMatch) return "";

  const afterHeading = content.slice(headingMatch.index + headingMatch[0].length);
  const nextHeadingIndex = afterHeading.search(/\n##\s+/);
  const sectionBlock =
    nextHeadingIndex >= 0 ? afterHeading.slice(0, nextHeadingIndex) : afterHeading;

  const paragraphs = sectionBlock
    .split(/\n\s*\n/)
    .map((paragraph) => stripMarkdownSyntax(paragraph))
    .filter(Boolean);
  const candidate = paragraphs.find((paragraph) => paragraph.length > 35) ?? paragraphs[0] ?? "";
  if (!candidate) return "";

  const firstSentence = candidate.match(/.+?[.!?](?:\s|$)/)?.[0]?.trim() ?? candidate;
  return firstSentence.length > 150
    ? `${firstSentence.slice(0, 147).trim()}...`
    : firstSentence;
}

function buildKeyTakeawaysBlock(content: string) {
  const headings = getMainSectionHeadings(content).filter((heading) => !isAuxiliaryHeading(heading));
  const bulletItems = headings
    .slice(0, 4)
    .map((heading) => getSectionBodySnippet(content, heading) || heading)
    .filter(Boolean)
    .slice(0, 4);

  if (bulletItems.length === 0) {
    return "";
  }

  return `## Key Takeaways\n\n${bulletItems
    .map((item) => `- ${item}`)
    .join("\n")}`;
}

function buildTableOfContentsBlock(content: string) {
  const headings = getMainSectionHeadings(content)
    .filter((heading) => !isAuxiliaryHeading(heading))
    .slice(0, 8);

  if (headings.length < 2) {
    return "";
  }

  return `## Table of Contents\n\n${headings
    .map((heading) => `- ${heading}`)
    .join("\n")}`;
}

function insertLeadBlocksBeforeFirstMainHeading(content: string, blocks: string[]) {
  const cleanBlocks = blocks.filter(Boolean);
  if (cleanBlocks.length === 0) return content.trim();

  const firstMainHeading = content.match(/\n##\s+/);
  if (!firstMainHeading || typeof firstMainHeading.index !== "number") {
    return `${content.trim()}\n\n${cleanBlocks.join("\n\n")}`.trim();
  }

  const insertAt = firstMainHeading.index + 1;
  return `${content.slice(0, insertAt).trimEnd()}\n\n${cleanBlocks.join("\n\n")}\n\n${content
    .slice(insertAt)
    .trimStart()}`.trim();
}

function insertTableOfContentsAfterKeyTakeaways(
  content: string,
  tocBlock: string
) {
  const keyTakeawaysMatch = /^##\s+Key Takeaways\b[\s\S]*?(?=\n##\s+|\s*$)/im.exec(content);
  if (!keyTakeawaysMatch || typeof keyTakeawaysMatch.index !== "number") {
    return insertLeadBlocksBeforeFirstMainHeading(content, [tocBlock]);
  }

  const insertAt = keyTakeawaysMatch.index + keyTakeawaysMatch[0].length;
  return `${content.slice(0, insertAt).trimEnd()}\n\n${tocBlock}\n\n${content
    .slice(insertAt)
    .trimStart()}`.trim();
}

function ensureLeadSections(
  content: string,
  input: ArticlePipelineInput
) {
  if (!content.trim() || !shouldUseLeadBoxes(input)) {
    return content;
  }

  const headings = getMainSectionHeadings(content);
  const hasKeyTakeaways = /^##\s+Key Takeaways\b/im.test(content);
  const hasTableOfContents = /^##\s+Table of Contents\b/im.test(content);
  const blocksToInsert: string[] = [];

  if (shouldRequireKeyTakeaways(input) && !hasKeyTakeaways) {
    const takeawaysBlock = buildKeyTakeawaysBlock(content);
    if (takeawaysBlock) {
      blocksToInsert.push(takeawaysBlock);
    }
  }

  if (shouldRequireTableOfContents(input, headings.length) && !hasTableOfContents) {
    const tocBlock = buildTableOfContentsBlock(content);
    if (tocBlock) {
      if (hasKeyTakeaways) {
        return insertTableOfContentsAfterKeyTakeaways(content, tocBlock);
      }
      blocksToInsert.push(tocBlock);
    }
  }

  return insertLeadBlocksBeforeFirstMainHeading(content, blocksToInsert);
}

export interface ResearchDecision {
  needsResearch: boolean;
  reason: string;
  focusAreas: string[];
}

function buildResearchCorpus(input: ArticlePipelineInput) {
  return [
    input.keyword,
    input.title,
    input.category,
    input.articleType,
    input.contentIntent,
    input.contentFreshness,
    input.geoFocus,
    input.customInstructions,
    ...(input.secondaryKeywords ?? []),
  ]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join(" ")
    .toLowerCase();
}

function hasStrongDraftingContext(input: ArticlePipelineInput) {
  return (
    (input.existingPages?.length ?? 0) >= 3 ||
    (input.internalLinks?.length ?? 0) >= 2 ||
    (input.secondaryKeywords?.length ?? 0) >= 2 ||
    Boolean(input.customInstructions?.trim())
  );
}

function isClearlyResearchSensitive(input: ArticlePipelineInput) {
  const corpus = buildResearchCorpus(input);

  if (/(^|[^a-z])(news|report|research)([^a-z]|$)/i.test(input.articleType ?? "")) {
    return true;
  }

  if (/(last week|last month|last quarter|2024|2025|2026|latest|current|recent|new\b|updated?|today)/.test(corpus)) {
    return true;
  }

  if (/(law|legal|regulation|compliance|statistic|statistics|study|studies|survey|data|pricing|price|cost|rates|requirements|eligibility|policy|deadline|deadline|official|permit|license)/.test(corpus)) {
    return true;
  }

  return false;
}

function shouldSkipResearchByHeuristic(input: ArticlePipelineInput) {
  if (isClearlyResearchSensitive(input)) {
    return false;
  }

  return hasStrongDraftingContext(input);
}

function countKeywordOccurrences(text: string, keyword: string) {
  if (!keyword.trim()) return 0;
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return (text.match(new RegExp(`\\b${escaped}\\b`, "gi")) ?? []).length;
}

function getKeywordDensity(content: string, keyword: string) {
  const text = content
    .replace(/```html[\s\S]*?```/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/[#>*_`-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return 0;
  return (countKeywordOccurrences(text, keyword.toLowerCase()) / words.length) * 100;
}

function includesKeywordOrWords(text: string, keyword: string) {
  const normalizedText = text.toLowerCase();
  if (!keyword.trim()) return false;
  const kw = keyword.trim().toLowerCase();
  if (normalizedText.includes(kw)) return true;
  const words = kw.replace(/[^a-z0-9\s-]/g, " ").split(/\s+/).filter(Boolean);
  return words.length > 1 && words.every((w) => normalizedText.includes(w));
}

function infographicHasKeywordOrSemantic(
  content: string,
  keyword: string,
  secondaryKeywords: string[] = []
) {
  if (!keyword.trim() && secondaryKeywords.length === 0) return true;
  const keywordsToCheck = [keyword.trim()].filter(Boolean).concat(
    secondaryKeywords.map((k) => (typeof k === "string" ? k.trim() : "")).filter(Boolean)
  );
  const sections = buildArticleSections(content)
    .filter((section): section is Extract<ReturnType<typeof buildArticleSections>[number], { type: "infographic" }> => section.type === "infographic");
  if (sections.length > 0) {
    return sections.some((section) => {
      const text = "html" in section ? `${section.title}\n${section.html}` : section.title;
      const lower = text.toLowerCase();
      return keywordsToCheck.some((kw) => includesKeywordOrWords(lower, kw));
    });
  }
  const placeholderMatches = content.matchAll(/\[Infographic:\s*(.+?)\]/gi);
  for (const m of placeholderMatches) {
    const placeholderText = (m[1] ?? "").toLowerCase();
    if (keywordsToCheck.some((kw) => includesKeywordOrWords(placeholderText, kw))) return true;
  }
  return false;
}

function hasMarkdownList(content: string) {
  return ((content.match(/(^|\n)\s*([-*+]\s+|\d+\.\s+)/g) ?? []).length >= SEO_TARGETS.minimumListCount);
}

function hasAuthorityLink(content: string) {
  const links = extractMarkdownLinks(content);
  const isAuthority = (domain: string | null) =>
    domain &&
    (domain.endsWith(".gov") ||
      domain.endsWith(".edu") ||
      /(wikipedia\.org|nih\.gov|cdc\.gov|reuters\.com|nytimes\.com)/.test(domain));
  return links.some((l) => {
    try {
      return isAuthority(new URL(l.url).hostname.toLowerCase());
    } catch {
      return false;
    }
  });
}

interface SeoPatch {
  search: string;
  replace: string;
}

function applySeoPatches(content: string, patches: SeoPatch[]): string {
  let result = content;
  for (const { search, replace } of patches) {
    if (!search || typeof search !== "string") continue;
    const idx = result.indexOf(search);
    if (idx >= 0) {
      result = result.slice(0, idx) + replace + result.slice(idx + search.length);
    }
  }
  return result;
}

export interface OptimizeSeoOptions {
  /** When true, skip early-exit and always run optimization (used when audit score < 90) */
  forceRun?: boolean;
  /** Failing audit check labels to include in the revision prompt */
  failingChecks?: string[];
  /** Use smaller limits to avoid context overflow (for retry after token limit error) */
  aggressiveTruncation?: boolean;
  /** Single check to fix (for iterative patch-by-check). Format: "Label (details)" */
  singleCheckToFix?: string;
  /** Check ID for single-check mode (e.g. "keyword-in-intro") */
  singleCheckId?: string;
}

/** Content checks that can be fixed with surgical patches (preserves article integrity) */
const PATCHABLE_CONTENT_CHECK_IDS = new Set([
  "keyword-in-intro",
  "keyword-in-headings",
  "keyword-density",
  "list-formatting",
  "keyword-in-infographic",
  "authority-links",
  "internal-links",
  "faq-section",
  "content-length",
  "readable-paragraphs",
  "unique-headings",
  "clean-formatting",
]);

function buildSingleCheckPatchPrompt(
  checkId: string,
  checkLabel: string,
  content: string,
  input: ArticlePipelineInput,
  internalLinks: Array<{ title?: string; url: string }>
): string {
  const keyword = input.keyword.trim();
  const density = getKeywordDensity(content, keyword);
  const contextDate = new Date().toISOString().slice(0, 10);
  /** Use more context so the LLM can find unique substrings in long articles */
  const contextChars = Math.min(20000, content.length);
  const instructions: Record<string, string> = {
    "keyword-in-intro": `Add "${keyword}" or semantic variant in first 1–2 paragraphs. "search" = one exact sentence. "replace" = same with keyword woven in.`,
    "keyword-in-headings": `Add "${keyword}" to one H2/H3. "search" = exact heading. "replace" = same with keyword.`,
    "keyword-density": `Density ${density.toFixed(2)}% (target ${SEO_TARGETS.keywordDensity.min}–${SEO_TARGETS.keywordDensity.max}%). Add 1–2 phrases with "${keyword}". "search" = one paragraph. "replace" = same with keyword added.`,
    "list-formatting": `Add bullet list (3–5 items). "search" = a paragraph. "replace" = same + "\\n\\n- item1\\n- item2\\n- item3".`,
    "keyword-in-infographic": `Add "${keyword}" to infographic title. "search" = [Infographic: X]. "replace" = same with keyword.`,
    "authority-links": `Add ONE .gov/.edu/wikipedia link. "search" = sentence. "replace" = same with [anchor](https://...) added.`,
    "internal-links": internalLinks.length > 0
      ? `Add 1–2 internal links. URLs: ${internalLinks.slice(0, 8).map((p) => p.url).join(", ")}. "search" = sentence. "replace" = same with link.`
      : `Add internal links. "search" = sentence. "replace" = same with [anchor](/path).`,
    "faq-section": `Add ## FAQ with 3 ### Question? subheadings. "search" = end of last section. "replace" = same + FAQ block.`,
    "content-length": `Expand one paragraph with 2–4 sentences. "search" = short paragraph. "replace" = expanded.`,
    "readable-paragraphs": `Split long paragraph into 2. "search" = long paragraph. "replace" = same split.`,
    "unique-headings": `Rename duplicate heading. "search" = duplicate. "replace" = unique wording.`,
    "clean-formatting": `Fix broken formatting. "search" = broken part. "replace" = fixed.`,
  };
  const instruction = instructions[checkId] ?? `Fix: ${checkLabel}. Minimal change.`;
  return `You are an SEO editor. Fix ONE issue only. Preserve voice, style, and all other content.

Issue: ${checkLabel}
${instruction}

CRITICAL: "search" must appear EXACTLY ONCE. Copy verbatim. Minimal change.
Return ONLY: { "patches": [ { "search": "exact substring", "replace": "replacement" } ] }

Article (first ${contextChars} chars):
${content.slice(0, contextChars)}
Current date: ${contextDate}. JSON only.`;
}

async function optimizeArticleForSeoSignals(
  projectId: string | null | undefined,
  input: ArticlePipelineInput,
  content: string,
  researchContent?: string,
  chatRunner: ChatRunner = chat,
  options?: OptimizeSeoOptions
) {
  const keyword = input.keyword.trim();
  const internalLinks = input.internalLinks ?? [];

  if (options?.singleCheckToFix && options?.singleCheckId && PATCHABLE_CONTENT_CHECK_IDS.has(options.singleCheckId)) {
    try {
      const patchPrompt = buildSingleCheckPatchPrompt(
        options.singleCheckId,
        options.singleCheckToFix,
        content,
        input,
        internalLinks
      );
      const patchResult = await chatRunner(
        [
          { role: "system", content: `You return only valid JSON. One patch. Minimal change. ${getStructuredPromptInstruction()}` },
          { role: "user", content: patchPrompt },
        ],
        undefined,
        { projectId: projectId ?? null, requestLabel: "article-seo-optimize", temperature: 0.05, maxOutputTokens: 800, responseFormat: "json" }
      );
      const parsed = safeParseJson<{ patches?: Array<{ search?: string; replace?: string }> }>(patchResult.content, { patches: [] });
      const patches = (parsed.patches ?? []).filter((p): p is SeoPatch => typeof p?.search === "string" && typeof p?.replace === "string");
      if (patches.length > 0) {
        const patched = applySeoPatches(content, patches);
        if (patched !== content) return patched;
      }
    } catch {
      /* return content unchanged */
    }
    return content;
  }

  const contextDate = new Date().toISOString().slice(0, 10);
  const density = getKeywordDensity(content, keyword);
  const infographicKeywordOk = infographicHasKeywordOrSemantic(
    content,
    keyword,
    input.secondaryKeywords ?? []
  );
  const needsDensityFix =
    density < SEO_TARGETS.keywordDensity.min || density > SEO_TARGETS.keywordDensity.max;
  const needsListFix = !hasMarkdownList(content);
  const needsAuthorityLinkFix = !hasAuthorityLink(content);

  if (
    !options?.forceRun &&
    !needsDensityFix &&
    infographicKeywordOk &&
    !needsListFix &&
    !needsAuthorityLinkFix
  ) {
    return content;
  }

  const issues: string[] =
    options?.failingChecks && options.failingChecks.length > 0
      ? options.failingChecks
      : [
          ...(needsDensityFix ? [`keyword density ${density.toFixed(2)}% (target ${SEO_TARGETS.keywordDensity.min}–${SEO_TARGETS.keywordDensity.max}%)`] : []),
          ...(!infographicKeywordOk ? ["infographic missing primary or semantic keyword"] : []),
          ...(needsListFix ? ["no bullet or numbered list"] : []),
          ...(needsAuthorityLinkFix ? ["no high-authority external link (.gov, .edu, wikipedia.org, etc.)"] : []),
        ];
  if (issues.length === 0 && !options?.forceRun) return content;

  const contextChars = options?.aggressiveTruncation ? 6000 : Math.min(18000, content.length);
  const patchPrompt = `You are an SEO editor. The article below has these issues: ${issues.join("; ")}.

Return ONLY valid JSON with minimal patches. Format:
{
  "patches": [
    { "search": "exact unique substring from the article (must appear exactly once)", "replace": "replacement with fix applied" }
  ]
}

Rules:
- Each "search" must be a substring that appears EXACTLY ONCE in the article. Copy it verbatim.
- Each "replace" is the fixed version (e.g. add a list, add a link, adjust keyword).
- Use 1–4 patches. Prefer minimal, targeted edits over large rewrites.
- For missing list: add a patch that inserts a bullet list after a suitable paragraph. "search" = that paragraph's exact text. "replace" = same paragraph + newline + "- item1\\n- item2\\n- item3".
- For missing authority link: add a patch. "search" = a sentence where a citation fits. "replace" = same sentence with [anchor](https://example.gov/page) added naturally.
- For keyword density: add/replace 1–2 phrases to reach ~0.8–1.0% density.
- For infographic: "search" = the infographic figcaption or title. "replace" = include the primary keyword "${keyword}" or a semantic variant.
- Preserve year/date consistency. Current date: ${contextDate}.
- Output JSON only. No markdown, no explanation.

Article (first ${contextChars} chars for context):
${content.slice(0, contextChars)}`;

  try {
    const patchResult = await chatRunner(
      [
        {
          role: "system",
          content: `You return only valid JSON. No other text. ${getStructuredPromptInstruction()}`,
        },
        { role: "user", content: patchPrompt },
      ],
      undefined,
      {
        projectId: projectId ?? null,
        requestLabel: "article-seo-optimize",
        temperature: 0.1,
        maxOutputTokens: 1500,
        responseFormat: "json",
      }
    );

    const parsed = safeParseJson<{ patches?: Array<{ search?: string; replace?: string }> }>(
      patchResult.content,
      { patches: [] }
    );
    const patches = (parsed.patches ?? []).filter(
      (p): p is SeoPatch => typeof p?.search === "string" && typeof p?.replace === "string"
    );
    if (patches.length > 0) {
      const patched = applySeoPatches(content, patches);
      const patchedDensity = getKeywordDensity(patched, keyword);
      const patchedListOk = hasMarkdownList(patched);
      const patchedLinkOk = hasAuthorityLink(patched);
      const patchedInfographicOk = infographicHasKeywordOrSemantic(patched, keyword, input.secondaryKeywords ?? []);
      if (
        (!needsDensityFix || (patchedDensity >= SEO_TARGETS.keywordDensity.min && patchedDensity <= SEO_TARGETS.keywordDensity.max)) &&
        (!needsListFix || patchedListOk) &&
        (!needsAuthorityLinkFix || patchedLinkOk) &&
        (infographicKeywordOk || patchedInfographicOk)
      ) {
        return patched;
      }
    }
  } catch {
    /* return content unchanged - no full rewrite to preserve integrity */
  }

  return content;
}



export { optimizeArticleForSeoSignals, PATCHABLE_CONTENT_CHECK_IDS };

export async function decideArticleResearch(
  projectId: string | null | undefined,
  input: ArticlePipelineInput,
  chatRunner: ChatRunner = chat
): Promise<ResearchDecision> {
  if (shouldSkipResearchByHeuristic(input)) {
    return {
      needsResearch: false,
      reason: "Research skipped because existing context was sufficient.",
      focusAreas: [],
    };
  }

  const prompt = `Decide whether this article needs a separate research brief before writing.

Return JSON only:
{
  "needsResearch": true,
  "reason": "short reason",
  "focusAreas": ["fact-checking", "fresh statistics"]
}

Rules:
- Default to needsResearch: false.
- Set needsResearch to true only when research is clearly necessary, not merely helpful.
- Research is clearly necessary only when the draft would otherwise risk being inaccurate, outdated, non-compliant, weakly supported, or missing essential factual context.
- Strong reasons for true include: current or changing facts, official requirements, legal/compliance-sensitive details, statistics or studies, pricing/rates, recent product/service changes, or very thin project context.
- If the topic looks evergreen and the provided project context is already enough to draft a useful article, set needsResearch to false.
- Do not request research just to add polish, extra examples, or more citations.
- Keep reason under 24 words.
- Keep focusAreas to 0-4 short items.

Article context:
- Keyword: ${input.keyword}
- Title: ${input.title ?? "Not provided"}
- Category: ${input.category}
- Audience: ${input.targetAudience}
- Current date: ${new Date().toISOString().slice(0, 10)}
- Article type: ${input.articleType ?? "Not specified"}
- Content intent: ${input.contentIntent ?? "Not specified"}
- Content freshness: ${input.contentFreshness ?? "Not specified"}
- Geo focus: ${input.geoFocus ?? "Not specified"}
- Existing internal pages available: ${input.existingPages?.length ?? 0}
- External linking enabled: ${input.externalLinking ? "yes" : "no"}
- Custom instructions: ${input.customInstructions ?? "None"}`;

  try {
    const result = await chatRunner(
      [
        {
          role: "system",
          content:
            `You are an editorial research planner. Be conservative, practical, and return valid JSON only. ${getStructuredPromptInstruction()}`,
        },
        { role: "user", content: prompt },
      ],
      undefined,
      {
        projectId: projectId ?? null,
        requestLabel: "article-research-decision",
        temperature: 0,
        maxOutputTokens: 300,
        responseFormat: "json",
      }
    );

    const parsed = safeParseJson<Partial<ResearchDecision>>(result.content, {
      needsResearch: false,
      reason: "",
      focusAreas: [],
    });

    return {
      needsResearch: parsed.needsResearch === true,
      reason:
        typeof parsed.reason === "string" && parsed.reason.trim()
          ? parsed.reason.trim()
          : "Evergreen topic with enough context to draft directly.",
      focusAreas: Array.isArray(parsed.focusAreas)
        ? parsed.focusAreas.filter((item): item is string => typeof item === "string" && item.trim().length > 0).slice(0, 4)
        : [],
    };
  } catch {
    return {
      needsResearch: false,
      reason: "Research decision fallback used.",
      focusAreas: [],
    };
  }
}

export async function maybeGenerateArticleResearch(
  projectId: string | null | undefined,
  input: ArticlePipelineInput,
  chatRunner: ChatRunner = chat
): Promise<{ decision: ResearchDecision; researchContent: string }> {
  const decision = await decideArticleResearch(projectId, input, chatRunner);
  if (!decision.needsResearch) {
    return { decision, researchContent: "" };
  }

  const researchPrompt = buildResearchPrompt({
    ...toResearchParams(input),
    customInstructions: [input.customInstructions, decision.focusAreas.length > 0
      ? `Prioritize research on: ${decision.focusAreas.join(", ")}.`
      : null]
      .filter(Boolean)
      .join("\n\n"),
  });

  const researchResult = await chatRunner(
    [
      {
        role: "system",
        content:
          `You are a senior editorial strategist. Follow the prompt exactly, be factual and practical, and output clean markdown only. ${getStructuredPromptInstruction()}`,
      },
      { role: "user", content: researchPrompt },
    ],
    undefined,
    {
      projectId: projectId ?? null,
      requestLabel: "article-research",
      temperature: 0.2,
      maxOutputTokens: 1600,
    }
  );

  return {
    decision,
    researchContent: researchResult.content?.trim() ?? "",
  };
}

export async function generateArticleBody(
  projectId: string | null | undefined,
  input: ArticlePipelineInput,
  researchContent?: string,
  chatRunner: ChatRunner = chat
) {
  const contentPrompt = buildContentPrompt(
    toContentParams({
      ...input,
      existingPages: input.existingPages ?? [],
      publishedArticles: input.publishedArticles ?? [],
      internalLinks: input.internalLinks ?? [],
      externalLinking: input.externalLinking ?? false,
      requireInfographics: input.requireInfographics ?? true,
      internalLinking: input.internalLinking ?? true,
    })
  );

  const contentResult = await chatRunner(
    [
      {
        role: "system",
        content:
          `You are a senior editorial writer. Follow the prompt exactly, stay compliant with all requirements, and output publication-ready markdown only. ${getStructuredPromptInstruction()}`,
      },
      {
        role: "user",
        content: [
          contentPrompt,
          researchContent ? `Research brief:\n${researchContent}` : "",
        ]
          .filter(Boolean)
          .join("\n\n"),
      },
    ],
    undefined,
    {
      projectId: projectId ?? null,
      requestLabel: "article-content",
      temperature: 0.25,
      maxOutputTokens: null,
    }
  );
  let content = ensureLeadSections(contentResult.content?.trim() ?? "", input);

  if (content && articleNeedsCompletion(content)) {
    const continuation = await chatRunner(
      [
        {
          role: "system",
          content:
            `You are a senior editorial writer. Continue the unfinished article draft and return only the continuation in clean markdown. Finish any incomplete section, complete the remaining promised structure naturally, and close the article cleanly. Add a conclusion only if the article format benefits from one. Do not repeat the opening paragraphs. Preserve all established factual details, including years, dates, timelines, fees, and compliance requirements, unless the provided research explicitly requires a correction. ${getStructuredPromptInstruction()}`,
        },
        {
          role: "user",
          content: [
            `Current draft:\n${content}`,
            researchContent ? `Research brief:\n${researchContent}` : "",
          ]
            .filter(Boolean)
            .join("\n\n"),
        },
      ],
      undefined,
      {
        projectId: projectId ?? null,
        requestLabel: "article-content-complete",
        temperature: 0.2,
        maxOutputTokens: null,
      }
    );
    const continued = continuation.content?.trim() ?? "";
    if (continued) {
      content = ensureLeadSections(`${content}\n\n${continued}`.trim(), input);
    }
  }

  const optimized = await optimizeArticleForSeoSignals(
    projectId,
    input,
    content,
    researchContent,
    chatRunner
  );

  return ensureLeadSections(optimized, input);
}

