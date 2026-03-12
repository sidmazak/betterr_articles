import { SEO_RULES_PROMPT_BLOCK, SEO_TARGETS } from "@/lib/seo-rules";
import type { MetadataPromptParams } from "./types";
import {
  getStructuredPromptInstruction,
  serializeStructuredPromptBlock,
} from "./toon";

export function buildMetadataPrompt(body: MetadataPromptParams): string {
  const currentDate = new Date().toISOString().slice(0, 10);
  const currentYear = new Date().getUTCFullYear();
  const title = body.title ?? "Auto-generated from content";
  const contextBlock = serializeStructuredPromptBlock("Metadata context", {
    primaryKeyword: body.keyword,
    contextDate: currentDate,
    contextYear: currentYear,
    suggestedTitle: title,
    category: body.category,
    targetAudience: body.targetAudience,
    author: body.authorName ?? "Not specified",
    articleType: body.articleType ?? "Not specified",
    articleFormat: body.articleFormat ?? "Not specified",
    secondaryKeywords: body.secondaryKeywords ?? [],
    language: body.language ?? "en",
  });

  return `You are generating publish-ready article metadata.

Return ONLY valid JSON using this exact shape:
{
  "title": "Final article title",
  "slug": "seo-friendly-url-slug",
  "seoTitle": "SEO title under 60 characters",
  "metaDescription": "Meta description under 160 characters",
  "excerpt": "Short excerpt under 220 characters",
  "tags": ["tag one", "tag two"],
  "category": "Best-fit content category",
  "coverImageAlt": "Descriptive alt text for the featured image",
  "coverImagePrompt": "Detailed text-to-image prompt for a professional featured image or thumbnail",
  "socialHashtags": ["#One", "#Two"]
}

Rules:
- Be specific, natural, and publication-ready.
- Use the primary keyword naturally in the title, slug, SEO title, and meta description.
- Keep years and date references aligned with the article title and article content. Do not introduce a conflicting year.
- Keep the slug short, lowercase, and hyphenated. Use only the slug itself (e.g. hawaii-learner-permit-guide)—no path prefixes like /blog/.
- Keep the SEO title between ${SEO_TARGETS.titleLength.min} and ${SEO_TARGETS.titleLength.max} characters.
- Keep the meta description between ${SEO_TARGETS.metaDescriptionLength.min} and ${SEO_TARGETS.metaDescriptionLength.max} characters.
- Tags must be dynamic, specific, and useful for publishing. Return ${SEO_TARGETS.minimumTags} to ${SEO_TARGETS.maximumTags} tags.
- Category must be the best-fit editorial category for this article, not a generic filler.
- coverImagePrompt must be detailed enough for text-to-image generation:
  include subject, scene, composition, mood, lighting, style, brand-safe constraints, and "no text overlay".
- coverImageAlt should describe the actual thumbnail subject, not repeat the title.
- Return 2 to 5 relevant social hashtags.
- Match the response language to "${body.language ?? "en"}".
- Output JSON only.

SEO rules:
${SEO_RULES_PROMPT_BLOCK}

Context:
${getStructuredPromptInstruction()}
${contextBlock}

Research brief:
${body.researchContent ?? "Not provided"}

Final article markdown:
${body.content ?? "Not provided"}`;
}
