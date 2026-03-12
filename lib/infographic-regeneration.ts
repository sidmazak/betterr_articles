const INFOGRAPHIC_HTML_BLOCK_REGEX =
  /(?:^|\n)(?:Infographic:\s*(.+?)\n)?```html\s*([\s\S]*?)```/gi;

const INFOGRAPHIC_IMAGE_BLOCK_REGEX =
  /(?:^|\n)(?:Infographic:\s*(.+?)\n)?```data:image\/png;base64\s*([\s\S]*?)```/gi;

export interface InfographicBlockMatch {
  index: number;
  length: number;
  type: "html" | "image";
  title: string;
  html?: string;
  base64?: string;
}

/**
 * Finds all infographic blocks (HTML or image) in content, sorted by position.
 */
function getAllInfographicBlocks(content: string): InfographicBlockMatch[] {
  const blocks: InfographicBlockMatch[] = [];
  let m: RegExpExecArray | null;
  const htmlRegex = new RegExp(INFOGRAPHIC_HTML_BLOCK_REGEX.source, INFOGRAPHIC_HTML_BLOCK_REGEX.flags);
  const imageRegex = new RegExp(INFOGRAPHIC_IMAGE_BLOCK_REGEX.source, INFOGRAPHIC_IMAGE_BLOCK_REGEX.flags);

  while ((m = htmlRegex.exec(content)) !== null) {
    const title = (m[1] ?? "").trim() || "Infographic";
    const html = (m[2] ?? "").trim();
    if (html) {
      blocks.push({ index: m.index, length: m[0].length, type: "html", title, html });
    }
  }
  while ((m = imageRegex.exec(content)) !== null) {
    const title = (m[1] ?? "").trim() || "Infographic";
    const base64 = (m[2] ?? "").replace(/\s/g, "");
    if (base64) {
      blocks.push({ index: m.index, length: m[0].length, type: "image", title, base64 });
    }
  }

  blocks.sort((a, b) => a.index - b.index);
  return blocks;
}

/**
 * Gets the Nth infographic block (1-based), whether HTML or image.
 */
export function getInfographicBlockAt(
  content: string,
  infographicIndex: number
): InfographicBlockMatch | null {
  const blocks = getAllInfographicBlocks(content);
  return blocks[infographicIndex - 1] ?? null;
}

export interface InfographicReplacementContext {
  articleTitle: string;
  articleExcerpt: string | null;
  primaryKeyword: string | null;
  infographicConcepts: string[];
  surroundingContent: string;
}

function buildInfographicPrompt(context: InfographicReplacementContext): string {
  const conceptsStr =
    context.infographicConcepts.length > 0
      ? context.infographicConcepts.join(", ")
      : "general article context";
  const keywordNote = context.primaryKeyword
    ? `\n- Include the exact primary keyword phrase "${context.primaryKeyword}" in the infographic title, figcaption, or a visible label.`
    : "";

  return `You are a designer creating a single HTML infographic for an article. Aim for a polished, editorial style like professional industry guides: modular cards, clear flows, comparisons, and feature lists—not generic bar or pie charts.

## Article context
- **Title**: ${context.articleTitle}
${context.articleExcerpt ? `- **Excerpt**: ${context.articleExcerpt}` : ""}
- **Primary keyword**: ${context.primaryKeyword ?? "N/A"}
- **Infographic concepts**: ${conceptsStr}

## Surrounding article content (for context)
${context.surroundingContent.slice(0, 1500)}

## Task
Generate exactly ONE self-contained HTML infographic block. Output ONLY the infographic block in this exact format:

Infographic: Clear infographic title
\`\`\`html
<figure>...</figure>
\`\`\`

## Design style (Gold Coast / editorial guide)
- **Layout**: Modular cards, vertical flow, or section-based layout. Use distinct panels with thin borders (1px) and subtle backgrounds.
- **Content types**: Prefer flow diagrams (cause → effect → solution), comparisons (Option A vs Option B), feature lists, checklists, timelines, decision guides, or breakdowns—not simple bar/pie charts.
- **Colors**: Semantic accents—teal/cyan for info, green for positive/success, amber/gold for caution or highlights, red for warnings or critical items. Use sparingly for emphasis.
- **Typography**: Strong headline, optional subheadline, concise body text. Short headings, 1–3 line descriptions, compact bullets.
- **Visual hierarchy**: Clear sections, boxed content, scannable structure. Each card/panel should have a clear purpose.

## Requirements
- CRITICAL: Use ONLY data and facts explicitly stated in the surrounding article content. Do NOT invent statistics, dates, fees, or any information not present in the article.
- The infographic must be useful and directly related to the article; every fact must come from the provided content.
- Avoid generic or filler content; every element should add value and be supported by the article text.
- Use simple semantic HTML: <figure>, <figcaption>, <div>, <table>. No external assets or images.
- Dark background (e.g. gradient or slate) with high-contrast text and accent colors.
- Design as a single coherent visual, not unrelated mini-blocks.
- Do not use "heatmap" or "heat-map" in the title unless the infographic is an actual heatmap. Use accurate terms like "Breakdown", "Comparison", "Guide", "Timeline", "Checklist", or "Summary".
- Do not include any markdown or text outside the code block. Output ONLY the block in the format above.${keywordNote}`;
}

export function buildInfographicRegenerationPrompt(
  context: InfographicReplacementContext
): string {
  return buildInfographicPrompt(context);
}

/**
 * Replaces the Nth infographic block (1-based) in content with new HTML.
 * Returns the modified content. If index is invalid, returns original content.
 */
export function replaceInfographicAt(
  content: string,
  infographicIndex: number,
  newTitle: string,
  newHtml: string
): string {
  const block = getInfographicBlockAt(content, infographicIndex);
  if (!block) return content;

  const replacement = `\n\nInfographic: ${newTitle}\n\`\`\`html\n${newHtml.trim()}\n\`\`\``;
  const before = content.slice(0, block.index);
  const after = content.slice(block.index + block.length);
  return before + replacement + after;
}

/**
 * Replaces the Nth infographic block (1-based) in content with new image block.
 * Returns the modified content. If index is invalid, returns original content.
 */
export function replaceInfographicAtWithImage(
  content: string,
  infographicIndex: number,
  newTitle: string,
  newBase64: string
): string {
  const block = getInfographicBlockAt(content, infographicIndex);
  if (!block) return content;

  const replacement = `\n\nInfographic: ${newTitle}\n\`\`\`data:image/png;base64\n${newBase64}\n\`\`\``;
  const before = content.slice(0, block.index);
  const after = content.slice(block.index + block.length);
  return before + replacement + after;
}

/**
 * Extract the title and HTML from the LLM response.
 * Expected format: "Infographic: Title\n```html\n...\n```"
 */
export function parseInfographicBlockResponse(response: string): {
  title: string;
  html: string;
} | null {
  const blockMatch = response.match(
    /(?:Infographic:\s*(.+?)\n)?```html\s*([\s\S]*?)```/i
  );
  if (!blockMatch) return null;
  const title = blockMatch[1]?.trim() ?? "Infographic";
  const html = blockMatch[2]?.trim() ?? "";
  if (!html) return null;
  return { title, html };
}

/**
 * Get surrounding content for context (markdown before and after the infographic).
 * Works for both HTML and image infographic blocks.
 */
export function getSurroundingContentForInfographic(
  content: string,
  infographicIndex: number,
  maxChars = 2500
): string {
  const block = getInfographicBlockAt(content, infographicIndex);
  if (!block) return "";
  const before = content.slice(Math.max(0, block.index - maxChars), block.index);
  const after = content.slice(
    block.index + block.length,
    block.index + block.length + maxChars
  );
  return before + "\n[... infographic ...]\n" + after;
}
