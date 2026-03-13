/**
 * SEO audit layer: AI-based patching for metadata overshoots.
 * When title, meta description, or excerpt exceed SEO limits, use AI to shorten
 * them while preserving meaning—no programmatic truncation.
 */

import { chat, type ChatRunner } from "@/lib/llm";
import type { GeneratedArticleMetadata } from "@/lib/prompts/types";
import { SEO_TARGETS } from "@/lib/seo-rules";

const OVERSHOOT_CHECK_IDS = new Set([
  "title-length",
  "meta-description-length",
  "excerpt",
]);

function isOvershoot(
  checkId: string,
  metadata: GeneratedArticleMetadata
): boolean {
  if (checkId === "title-length" && metadata.seoTitle) {
    return metadata.seoTitle.length > SEO_TARGETS.titleLength.max;
  }
  if (checkId === "meta-description-length" && metadata.metaDescription) {
    return metadata.metaDescription.length > SEO_TARGETS.metaDescriptionLength.max;
  }
  if (checkId === "excerpt" && metadata.excerpt) {
    return metadata.excerpt.trim().length > SEO_TARGETS.excerptLength.max;
  }
  return false;
}

export function getOvershootCheckIds(
  failingCheckIds: Set<string>,
  metadata: GeneratedArticleMetadata
): Set<string> {
  const overshoots = new Set<string>();
  for (const id of failingCheckIds) {
    if (OVERSHOOT_CHECK_IDS.has(id) && isOvershoot(id, metadata)) {
      overshoots.add(id);
    }
  }
  return overshoots;
}

function parseJsonResponse(content: string) {
  return JSON.parse(content.replace(/^```json\s*|\s*```$/g, "").trim());
}

/**
 * Use AI to shorten metadata that exceeds SEO limits.
 * Called only when SEO audit fails due to overshoots (title or meta too long).
 */
export async function patchMetadataOvershootsWithAI(
  metadata: GeneratedArticleMetadata,
  overshootCheckIds: Set<string>,
  keyword: string,
  chatRunner: ChatRunner = chat
): Promise<GeneratedArticleMetadata> {
  if (overshootCheckIds.size === 0) return metadata;

  const fixes: string[] = [];
  if (overshootCheckIds.has("title-length") && metadata.seoTitle.length > SEO_TARGETS.titleLength.max) {
    fixes.push(
      `seoTitle: "${metadata.seoTitle}" (${metadata.seoTitle.length} chars) → shorten to ${SEO_TARGETS.titleLength.min}-${SEO_TARGETS.titleLength.max} chars, keep keyword "${keyword}" near start`
    );
  }
  if (
    overshootCheckIds.has("meta-description-length") &&
    metadata.metaDescription.length > SEO_TARGETS.metaDescriptionLength.max
  ) {
    fixes.push(
      `metaDescription: "${metadata.metaDescription}" (${metadata.metaDescription.length} chars) → shorten to ${SEO_TARGETS.metaDescriptionLength.min}-${SEO_TARGETS.metaDescriptionLength.max} chars, keep keyword "${keyword}"`
    );
  }
  if (
    overshootCheckIds.has("excerpt") &&
    metadata.excerpt.trim().length > SEO_TARGETS.excerptLength.max
  ) {
    fixes.push(
      `excerpt: "${metadata.excerpt}" (${metadata.excerpt.length} chars) → shorten to ${SEO_TARGETS.excerptLength.min}-${SEO_TARGETS.excerptLength.max} chars, keep keyword "${keyword}"`
    );
  }

  if (fixes.length === 0) return metadata;

  const prompt = `You are an SEO editor. Fix these metadata overshoots. Return ONLY valid JSON with the corrected fields.

Current metadata:
- seoTitle: "${metadata.seoTitle}"
- metaDescription: "${metadata.metaDescription}"
- excerpt: "${metadata.excerpt}"

Required fixes:
${fixes.map((f) => `- ${f}`).join("\n")}

Return JSON in this exact shape (only include fields you are fixing):
{
  "seoTitle": "corrected SEO title",
  "metaDescription": "corrected meta description",
  "excerpt": "corrected excerpt"
}

Rules:
- Preserve meaning and keyword placement.
- Do not truncate mid-word; rewrite to fit within the character limits.
- Output JSON only.`;

  try {
    const result = await chatRunner(
      [
        {
          role: "system",
          content:
            "You are a senior SEO editor. Return only valid JSON. No explanations.",
        },
        { role: "user", content: prompt },
      ],
      undefined,
      {
        temperature: 0.2,
        maxOutputTokens: 500,
        responseFormat: "json",
      }
    );

    const patched = parseJsonResponse(result.content ?? "{}") as Partial<{
      seoTitle: string;
      metaDescription: string;
      excerpt: string;
    }>;

    return {
      ...metadata,
      seoTitle:
        typeof patched.seoTitle === "string" && patched.seoTitle.trim()
          ? patched.seoTitle.trim()
          : metadata.seoTitle,
      metaDescription:
        typeof patched.metaDescription === "string" && patched.metaDescription.trim()
          ? patched.metaDescription.trim()
          : metadata.metaDescription,
      excerpt:
        typeof patched.excerpt === "string" && patched.excerpt.trim()
          ? patched.excerpt.trim()
          : metadata.excerpt,
      title:
        typeof patched.seoTitle === "string" && patched.seoTitle.trim()
          ? patched.seoTitle.trim()
          : metadata.title,
    };
  } catch {
    return metadata;
  }
}
