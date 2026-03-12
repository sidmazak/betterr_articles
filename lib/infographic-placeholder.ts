import {
  extractInfographicSpec,
  extractInfographicSpecFromContext,
  extractInfographicSpecsWithPlacements,
  type InfographicSpec,
} from "@/lib/infographic-extractor";
import { renderInfographicToBase64 } from "@/lib/infographic-renderer";

const PLACEHOLDER_REGEX = /\[Infographic:\s*(.*?)\]/gi;

const LEAD_HEADINGS = /^(key takeaways|table of contents)$/i;

const CONTEXT_RADIUS = 2000;

function resolveInsertIndex(content: string, insertAfterHeading: string): number {
  const escaped = insertAfterHeading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`^##\\s+${escaped}\\s*$`, "im");
  const match = content.match(regex);
  if (!match || typeof match.index !== "number") {
    const firstMain = content.match(/^##\s+(.+)$/gm);
    for (const m of firstMain ?? []) {
      const h = m.replace(/^##\s+/, "").trim();
      if (!LEAD_HEADINGS.test(h)) {
        const idx = content.indexOf(m);
        if (idx >= 0) {
          const after = content.slice(idx + m.length);
          const next = after.search(/\n##\s+/);
          return next >= 0 ? idx + m.length + next : content.length;
        }
      }
    }
    return Math.min(400, content.length);
  }
  const insertAt = match.index + match[0].length;
  const afterHeading = content.slice(insertAt);
  const nextH2 = afterHeading.search(/\n##\s+/);
  return nextH2 >= 0 ? insertAt + nextH2 : content.length;
}

/**
 * Injects infographic placeholders when required but missing, using LLM-inferred placements.
 */
export async function injectInfographicPlacementsFromExtractor(
  content: string,
  primaryKeyword: string | null,
  targetCount: number
): Promise<string> {
  if (findInfographicPlaceholders(content).length > 0) return content;

  const placements = await extractInfographicSpecsWithPlacements(content, primaryKeyword, {
    count: targetCount,
  });

  if (placements.length === 0) return content;

  const insertPoints: Array<{ index: number; placeholder: string }> = [];
  for (const { insertAfterHeading, spec } of placements) {
    const index = resolveInsertIndex(content, insertAfterHeading);
    insertPoints.push({
      index,
      placeholder: `\n\n[Infographic: ${spec.title}]\n\n`,
    });
  }

  insertPoints.sort((a, b) => b.index - a.index);
  let result = content;
  for (const { index, placeholder } of insertPoints) {
    result = result.slice(0, index) + placeholder + result.slice(index);
  }
  return result;
}

/**
 * Injects an infographic placeholder when required but missing (heuristic fallback).
 * @deprecated Prefer injectInfographicPlacementsFromExtractor for AI-informed placement.
 */
export function injectInfographicPlaceholderIfMissing(
  content: string,
  primaryKeyword: string | null
): string {
  if (findInfographicPlaceholders(content).length > 0) return content;
  const keyword = (primaryKeyword ?? "").trim();
  const title = keyword ? `${keyword} – Key Summary` : "Key Summary";
  const placeholder = `\n\n[Infographic: ${title}]\n\n`;

  const h2Matches = [...content.matchAll(/^##\s+(.+)$/gm)];
  for (let i = 0; i < h2Matches.length; i++) {
    const m = h2Matches[i];
    const heading = (m[1] ?? "").trim();
    if (LEAD_HEADINGS.test(heading)) continue;
    const insertIndex = m.index! + m[0].length;
    const afterHeading = content.slice(insertIndex);
    const nextH2 = afterHeading.search(/\n##\s+/);
    const sectionEnd = nextH2 >= 0 ? insertIndex + nextH2 : content.length;
    return content.slice(0, sectionEnd) + placeholder + content.slice(sectionEnd);
  }

  const firstParaEnd = content.search(/\n\n(?:#|\s*$)/);
  const insertAt = firstParaEnd >= 0 ? firstParaEnd : Math.min(400, content.length);
  return content.slice(0, insertAt) + placeholder + content.slice(insertAt);
}

export function findInfographicPlaceholders(content: string): Array<{ index: number; length: number; title: string }> {
  const matches: Array<{ index: number; length: number; title: string }> = [];
  let m: RegExpExecArray | null;
  const regex = new RegExp(PLACEHOLDER_REGEX.source, PLACEHOLDER_REGEX.flags);
  while ((m = regex.exec(content)) !== null) {
    matches.push({
      index: m.index,
      length: m[0].length,
      title: (m[1] ?? "").trim() || "Infographic",
    });
  }
  return matches;
}

export function replacePlaceholderWithImage(
  content: string,
  placeholderIndex: number,
  placeholderLength: number,
  title: string,
  base64: string
): string {
  const block = `\n\nInfographic: ${title}\n\`\`\`data:image/png;base64\n${base64}\n\`\`\``;
  return content.slice(0, placeholderIndex) + block + content.slice(placeholderIndex + placeholderLength);
}

const DUPLICATE_HTML_BLOCK_REGEX = /(\n\nInfographic:\s*.+?\n```data:image\/png;base64[\s\S]*?```)\s*\n(?:Infographic:\s*.+?\n)?```html\s*[\s\S]*?```/gi;

function stripDuplicateHtmlBlocksAfterImage(content: string): string {
  return content.replace(DUPLICATE_HTML_BLOCK_REGEX, "$1");
}

function getTargetCount(articleLength?: string): number {
  if (articleLength === "Ultra-long") return 3;
  if (articleLength === "Long") return 2;
  return 1;
}

function createFallbackSpec(primaryKeyword: string | null): InfographicSpec {
  const keyword = (primaryKeyword ?? "").trim();
  const title = keyword ? `${keyword} – Summary` : "Summary";
  return {
    chartType: "list",
    title,
    data: {
      labels: [],
      items: [{ label: "Summary", value: "See article for details" }],
    },
  };
}

export async function generateAndReplacePlaceholders(
  content: string,
  primaryKeyword: string | null,
  options?: { targetCount?: number; articleLength?: string; siteUrl?: string }
): Promise<{ content: string; replaced: number }> {
  const targetCount = options?.targetCount ?? getTargetCount(options?.articleLength);
  let contentToProcess = content;

  let placeholders = findInfographicPlaceholders(contentToProcess);
  if (placeholders.length === 0) {
    contentToProcess = await injectInfographicPlacementsFromExtractor(
      contentToProcess,
      primaryKeyword,
      targetCount
    );
    placeholders = findInfographicPlaceholders(contentToProcess);
  }

  if (placeholders.length === 0) return { content, replaced: 0 };

  let result = contentToProcess;
  let offset = 0;
  const MAX_RETRIES = 2;

  for (const ph of placeholders) {
    const adjustedIndex = ph.index + offset;
    const contextStart = Math.max(0, adjustedIndex - CONTEXT_RADIUS);
    const contextEnd = Math.min(result.length, adjustedIndex + ph.length + CONTEXT_RADIUS);
    const contextSlice = result.slice(contextStart, contextEnd);

    let spec: InfographicSpec = createFallbackSpec(primaryKeyword);
    let base64: string = "";

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const extracted = await extractInfographicSpecFromContext(contextSlice, primaryKeyword);
        const rendered = await renderInfographicToBase64(extracted, {
          siteUrl: options?.siteUrl,
        });
        spec = extracted;
        base64 = rendered;
        break;
      } catch {
        if (attempt === MAX_RETRIES) {
          spec = createFallbackSpec(primaryKeyword);
          try {
            base64 = await renderInfographicToBase64(spec, {
              siteUrl: options?.siteUrl,
            });
          } catch {
            continue;
          }
        }
      }
    }

    if (!base64) continue;

    const block = `\n\nInfographic: ${spec.title}\n\`\`\`data:image/png;base64\n${base64}\n\`\`\``;
    const before = result.slice(0, adjustedIndex);
    const after = result.slice(adjustedIndex + ph.length);
    result = before + block + after;
    offset += block.length - ph.length;
  }

  result = stripDuplicateHtmlBlocksAfterImage(result);

  return { content: result, replaced: placeholders.length };
}
