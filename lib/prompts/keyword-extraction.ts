/**
 * Prompt for AI to extract SEO reference data from crawled site content.
 * Output: structured research signals that can power planning, article briefs, and internal knowledge.
 */

import {
  getStructuredPromptInstruction,
  serializeStructuredPromptBlock,
} from "./toon";

export interface KeywordExtractionInput {
  homepageUrl: string;
  pages: Array<{
    url: string;
    title: string | null;
    meta_description: string | null;
    content_preview: string | null;
  }>;
  maxKeywords?: number;
}

const PAGES_PER_BATCH = 12;
const CHARS_PER_PAGE = 320;

export function buildKeywordExtractionPrompt(input: KeywordExtractionInput): string {
  const maxKeywords = input.maxKeywords ?? 200;
  const isSinglePage = input.pages.length === 1;
  const topicsLimit = isSinglePage ? 4 : 8;
  const entitiesLimit = isSinglePage ? 4 : 6;
  const questionsLimit = isSinglePage ? 3 : 5;
  const painPointsLimit = isSinglePage ? 3 : 5;
  const anglesLimit = isSinglePage ? 3 : 5;
  const intentsLimit = isSinglePage ? 3 : 4;
  const productsLimit = isSinglePage ? 3 : 5;
  const pageSamples = input.pages.slice(0, PAGES_PER_BATCH).map((p) => ({
    url: p.url,
    title: p.title,
    meta_description: p.meta_description,
    content_preview: p.content_preview?.slice(0, CHARS_PER_PAGE) ?? null,
  }));

  return `# Topic & Keyword Extraction from Website

## Objective
Analyze the crawled website content and extract:
1. **Topics** – Main themes, subject areas, and content categories the site covers
2. **Keywords** – SEO-relevant search terms users might use to find this content
3. **Entities** – Important products, services, solutions, audiences, or named concepts mentioned
4. **Questions** – Questions the audience likely has based on the content
5. **Pain points** – Problems, needs, or friction points the content appears to address
6. **Content angles** – Useful article or editorial directions implied by the source material
7. **Search intents** – The dominant search intents present in the content
8. **Products/services** – Offerings, categories, or capabilities explicitly suggested by the content

These will power content planning and article generation. Be thorough and capture the site's actual focus.

## Website
- **Homepage**: ${input.homepageUrl}
- **Pages analyzed**: ${input.pages.length}

## Crawled Content
${getStructuredPromptInstruction()}
${serializeStructuredPromptBlock("Crawled page samples", pageSamples)}

## Output Requirements
Keep the response concise and high-signal. Each item should:
- Be a phrase users might search for (2-5 words typical) or a clear topic label
- Relate directly to the site's content, business, and expertise
- Be suitable for article titles or target search terms
- Avoid generic terms like "home", "contact", "about"
- Normalize: remove year suffixes, consolidate plurals/singulars
- Include niche terms, product names, and domain-specific phrases

Return a JSON object only with this shape:
\`\`\`json
{
  "topics": ["main topic one", "supporting theme"],
  "keywords": ["keyword phrase", "specific concept", "search term"],
  "entities": ["brand concept", "service line"],
  "questions": ["how does x work", "what is y"],
  "painPoints": ["problem the audience faces"],
  "contentAngles": ["practical comparison angle", "implementation guide angle"],
  "searchIntents": ["informational", "commercial investigation"],
  "productsServices": ["managed seo service", "content operations platform"],
  "summary": "One short summary of what the site appears to focus on."
}
\`\`\`

Rules:
- "topics": 2-${topicsLimit} high-level topic clusters
- "keywords": up to ${maxKeywords} specific keyword phrases
- "entities": up to ${entitiesLimit}
- "questions": up to ${questionsLimit}
- "painPoints": up to ${painPointsLimit}
- "contentAngles": up to ${anglesLimit}
- "searchIntents": up to ${intentsLimit}
- "productsServices": up to ${productsLimit}
- "summary": exactly 1 short sentence
- Keep every item specific to the crawled content
- Prefer phrases that could directly inform future content briefs, topic clusters, or article ideas
- Do not repeat near-duplicate items across arrays
- Prefer fewer, stronger items over long lists

Output ONLY valid JSON. No markdown, no explanation.`;
}
