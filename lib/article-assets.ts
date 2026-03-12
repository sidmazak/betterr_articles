import { chat, type ChatRunner } from "@/lib/llm";
import { buildMetadataPrompt } from "@/lib/prompts/metadata";
import { getStructuredPromptInstruction } from "@/lib/prompts/toon";
import type { ArticlePipelineInput, GeneratedArticleMetadata } from "@/lib/prompts/types";
import { SEO_TARGETS } from "@/lib/seo-rules";

const METADATA_CHECK_IDS = new Set([
  "keyword-in-title",
  "keyword-position",
  "keyword-in-meta",
  "meta-description-length",
  "title-length",
  "seo-friendly-url",
  "content-tags",
  "meta-keywords",
  "social-hashtags",
  "excerpt",
]);

function includesKeyword(text: string, keyword: string) {
  if (!keyword) return false;
  return text.toLowerCase().includes(keyword.toLowerCase());
}

/** Programmatically fix metadata to pass failing SEO checks when the LLM is stuck. */
export function bootstrapMetadataForSeo(
  metadata: GeneratedArticleMetadata,
  failingCheckIds: Set<string>,
  input: ArticlePipelineInput,
  content: string
): GeneratedArticleMetadata {
  const keyword = input.keyword?.trim() ?? "";
  const secondary = (input.secondaryKeywords ?? []).filter((k) => typeof k === "string" && k.trim());
  let { title, seoTitle, metaDescription, excerpt, slug, tags, socialHashtags } = metadata;

  if (failingCheckIds.has("keyword-in-title") && keyword && !includesKeyword(title, keyword) && !includesKeyword(seoTitle || "", keyword)) {
    const base = title || seoTitle || keyword;
    seoTitle = `${keyword}: ${base}`.slice(0, SEO_TARGETS.titleLength.max);
    title = seoTitle;
  }

  if (failingCheckIds.has("keyword-position") && keyword) {
    const current = (seoTitle || title).toLowerCase();
    const idx = current.indexOf(keyword.toLowerCase());
    if (idx > 24 || idx < 0) {
      const rest = (seoTitle || title).replace(new RegExp(keyword, "gi"), "").replace(/\s*:\s*/, "").trim();
      seoTitle = `${keyword}: ${rest}`.slice(0, SEO_TARGETS.titleLength.max);
      title = seoTitle;
    }
  }

  if (failingCheckIds.has("title-length") && seoTitle) {
    if (seoTitle.length < SEO_TARGETS.titleLength.min) {
      seoTitle = `${seoTitle} - ${keyword} guide`.slice(0, SEO_TARGETS.titleLength.max);
      title = seoTitle;
    } else if (seoTitle.length > SEO_TARGETS.titleLength.max) {
      seoTitle = seoTitle.slice(0, SEO_TARGETS.titleLength.max);
      title = seoTitle;
    }
  }

  if (failingCheckIds.has("keyword-in-meta") && keyword) {
    if (!metaDescription || !includesKeyword(metaDescription, keyword)) {
      const seed = metaDescription?.slice(0, 80) || buildExcerpt(content, 80);
      metaDescription = `${seed} ${keyword} guide for ${input.targetAudience}.`.replace(/\s+/g, " ").trim();
    }
  }
  if (failingCheckIds.has("meta-description-length") || (metaDescription && metaDescription.length < SEO_TARGETS.metaDescriptionLength.min)) {
    if (!metaDescription || metaDescription.length < SEO_TARGETS.metaDescriptionLength.min) {
      const seed = metaDescription || buildExcerpt(content, 100) || `${keyword} guide`;
      metaDescription = ensureMinimumMetaDescription(seed, `${keyword} for ${input.targetAudience}`);
    }
    metaDescription = metaDescription.slice(0, SEO_TARGETS.metaDescriptionLength.max);
  }

  if (failingCheckIds.has("seo-friendly-url") && keyword && slug) {
    const slugLower = slug.toLowerCase();
    if (!slugLower.includes(keyword.toLowerCase().replace(/\s+/g, "-"))) {
      slug = createSlug(`${keyword} ${slug}`);
    }
  }

  if (failingCheckIds.has("content-tags") || failingCheckIds.has("meta-keywords")) {
    const fallback = buildFallbackTags(input, title);
    tags = dedupeStrings([...tags, ...fallback]).slice(0, SEO_TARGETS.maximumTags);
    if (tags.length < SEO_TARGETS.minimumTags) {
      tags = [...tags, keyword, ...(secondary.slice(0, 4))].filter(Boolean).slice(0, SEO_TARGETS.maximumTags);
    }
  }

  if (failingCheckIds.has("social-hashtags")) {
    socialHashtags = buildFallbackHashtags(input, title);
  }

  if (failingCheckIds.has("excerpt")) {
    const base = excerpt?.trim() || buildExcerpt(content, 200);
    if (base.length < 120) {
      excerpt = `${base} ${keyword} guide for ${input.targetAudience}. Learn more about ${keyword} and get expert tips.`.replace(/\s+/g, " ").trim().slice(0, 220);
    } else {
      excerpt = base.slice(0, 220);
    }
  }

  return { ...metadata, title, seoTitle, metaDescription, excerpt, slug, tags, socialHashtags };
}


interface GenerateArticleMetadataInput {
  projectId?: string | null;
  input: ArticlePipelineInput;
  researchContent?: string;
  content: string;
}

export function createSlug(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 96);
}

export function buildExcerpt(content: string, maxLength = 220) {
  const clean = content
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/[#>*_`-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!clean) return "";
  if (clean.length <= maxLength) return clean;
  return `${clean.slice(0, maxLength - 1).trim()}…`;
}

export function parseStringArray(value: unknown, fallback: string[] = []) {
  if (!Array.isArray(value)) return fallback;
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function dedupeStrings(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function clampTextLength(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  return value.slice(0, maxLength).trim();
}

function ensureMinimumMetaDescription(content: string, fallback: string) {
  if (content.length >= SEO_TARGETS.metaDescriptionLength.min) {
    return clampTextLength(content, SEO_TARGETS.metaDescriptionLength.max);
  }

  const padded = `${content} ${fallback}`.replace(/\s+/g, " ").trim();
  return clampTextLength(padded, SEO_TARGETS.metaDescriptionLength.max);
}

function buildFallbackTags(input: GenerateArticleMetadataInput["input"], fallbackTitle: string) {
  return dedupeStrings([
    ...(input.secondaryKeywords ?? []),
    input.keyword,
    input.category,
    ...fallbackTitle
      .split(/[:|-]/)
      .map((part) => part.trim())
      .filter(Boolean),
  ]).slice(0, SEO_TARGETS.maximumTags);
}

function buildFallbackHashtags(input: GenerateArticleMetadataInput["input"], title: string) {
  const seeds = dedupeStrings([
    input.keyword,
    ...(input.secondaryKeywords ?? []).slice(0, 3),
    title,
  ]);

  return seeds
    .map((value) =>
      `#${value
        .replace(/[^a-zA-Z0-9\s]/g, " ")
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 4)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join("")}`
    )
    .filter((value) => value.length > 1)
    .slice(0, 5);
}

export function inferTitleFromContent(content: string, fallback: string) {
  const heading = content.match(/^#\s+(.+)$/m)?.[1]?.trim();
  return heading || fallback;
}

export function syncArticleH1WithTitle(content: string, title?: string) {
  const normalizedTitle = title?.trim();
  const trimmedContent = content.trim();

  if (!normalizedTitle || !trimmedContent) {
    return content;
  }

  if (/^#\s+.+$/m.test(trimmedContent)) {
    return trimmedContent.replace(/^#\s+.+$/m, `# ${normalizedTitle}`);
  }

  return `# ${normalizedTitle}\n\n${trimmedContent}`;
}

export function parseGeneratedMetadata(
  raw: unknown,
  input: Pick<GenerateArticleMetadataInput, "input" | "content">
): GeneratedArticleMetadata {
  const fallbackTitle = inferTitleFromContent(input.content, input.input.title ?? input.input.keyword);
  const fallbackTags = buildFallbackTags(input.input, fallbackTitle);

  const source = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const title = typeof source.title === "string" && source.title.trim() ? source.title.trim() : fallbackTitle;
  const rawSlug =
    typeof source.slug === "string" && source.slug.trim()
      ? source.slug.trim().replace(/^\/?(?:blog|news|articles?)\/?/i, "").replace(/^\/+/, "") || source.slug.trim()
      : "";
  const slug = rawSlug ? createSlug(rawSlug) : createSlug(title);
  const seoTitle =
    typeof source.seoTitle === "string" && source.seoTitle.trim()
      ? clampTextLength(source.seoTitle.trim(), SEO_TARGETS.titleLength.max)
      : clampTextLength(title, SEO_TARGETS.titleLength.max);
  const metaDescriptionSeed =
    typeof source.metaDescription === "string" && source.metaDescription.trim()
      ? source.metaDescription.trim()
      : buildExcerpt(input.content, SEO_TARGETS.metaDescriptionLength.max);
  const metaDescription = ensureMinimumMetaDescription(
    metaDescriptionSeed,
    `${input.input.keyword} guide for ${input.input.targetAudience}.`
  );
  const excerpt =
    typeof source.excerpt === "string" && source.excerpt.trim()
      ? source.excerpt.trim()
      : buildExcerpt(input.content, 220);
  const parsedTags = dedupeStrings(parseStringArray(source.tags, fallbackTags));
  const tags = (
    parsedTags.length >= SEO_TARGETS.minimumTags ? parsedTags : dedupeStrings([...parsedTags, ...fallbackTags])
  ).slice(0, SEO_TARGETS.maximumTags);
  const socialHashtags = dedupeStrings(
    parseStringArray(source.socialHashtags, buildFallbackHashtags(input.input, title))
  ).slice(0, 5);

  return {
    title,
    slug,
    seoTitle,
    metaDescription,
    excerpt,
    tags,
    category:
      typeof source.category === "string" && source.category.trim()
        ? source.category.trim()
        : input.input.category,
    canonicalUrl: null,
    coverImageAlt:
      typeof source.coverImageAlt === "string" && source.coverImageAlt.trim()
        ? source.coverImageAlt.trim()
        : `${input.input.keyword} featured image for ${title}`,
    coverImagePrompt:
      typeof source.coverImagePrompt === "string" && source.coverImagePrompt.trim()
        ? source.coverImagePrompt.trim()
        : `Create a professional editorial featured image for "${title}". Focus on ${input.input.keyword}, modern composition, clean brand-safe style, realistic lighting, no text overlay.`,
    socialHashtags: socialHashtags.length >= SEO_TARGETS.minimumHashtags
      ? socialHashtags
      : buildFallbackHashtags(input.input, title),
  };
}

function parseJsonResponse(content: string) {
  return JSON.parse(content.replace(/^```json\s*|\s*```$/g, "").trim());
}

export async function generateArticleMetadata({
  projectId,
  input,
  researchContent,
  content,
}: GenerateArticleMetadataInput, chatRunner: ChatRunner = chat): Promise<GeneratedArticleMetadata> {
  const prompt = buildMetadataPrompt({
    keyword: input.keyword,
    category: input.category,
    targetAudience: input.targetAudience,
    title: input.title,
    authorName: input.authorName,
    articleType: input.articleType,
    articleFormat: input.articleFormat,
    language: input.language,
    secondaryKeywords: input.secondaryKeywords,
    researchContent,
    content,
  });

  try {
    const result = await chatRunner(
      [
        {
          role: "system",
          content:
            `You are a senior SEO editor and publishing strategist. Follow the prompt exactly and return valid JSON only. ${getStructuredPromptInstruction()}`,
        },
        { role: "user", content: prompt },
      ],
      undefined,
      {
        projectId: projectId ?? null,
        requestLabel: "article-metadata",
        temperature: 0.15,
        maxOutputTokens: 1000,
        responseFormat: "json",
      }
    );

    return parseGeneratedMetadata(parseJsonResponse(result.content ?? "{}"), { input, content });
  } catch {
    return parseGeneratedMetadata({}, { input, content });
  }
}
