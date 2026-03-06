import type { ContentCalendarPromptParams } from "./types";

export function buildContentCalendarPrompt(body: ContentCalendarPromptParams): string {
  const count = body.suggestionCount ?? 12;
  const freq = body.publishingFrequency ?? "2 per week";
  const sitemapNote = body.usedSitemap
    ? "A sitemap was found and used for URL discovery."
    : "No sitemap was found; URLs were discovered by crawling the homepage and following internal links.";

  const existingPagesList =
    body.existingPages.length > 0
      ? body.existingPages
          .slice(0, 50)
          .map((p) => `- ${p.title}: ${p.url}`)
          .join("\n")
      : "No existing pages discovered.";

  return `# Content Calendar & Topic Planning

## Objective
Analyze the website and existing content to produce a content calendar. **Each article suggestion must be based on ONE URL from the crawled list** - the article expands, complements, or links to that target URL. Scheduling is based on crawl URLs.

**Domain-Agnostic Scope**: This applies to ANY website in ANY industry. Adapt suggestions to the site's domain, audience, and existing content.

## Input Data

### Website
- **Homepage URL**: ${body.homepageUrl}

### URL Discovery
${sitemapNote}

### Existing Pages (crawled from site) - USE THESE AS TARGET URLS
${existingPagesList}
${body.existingPages.length > 50 ? `\n... and ${body.existingPages.length - 50} more pages` : ""}

## Output Requirements

Generate a content calendar with **${count}** article suggestions. Target publishing frequency: **${freq}**.

**CRITICAL**: Each suggestion MUST have a **targetUrl** - exactly one URL from the existing pages list above. The article is based on/for that URL (expands the topic, provides backlinks, or complements it). Spread suggestions across different URLs; do not repeat the same targetUrl.

### For Each Suggestion Provide:

1. **targetUrl** - MUST be a URL from the existing pages list (the crawl URL this article is based on)
2. **Suggested Title** - Compelling, SEO-friendly headline
3. **Primary Keyword** - Main target keyword for ranking
4. **Secondary Keywords** - 3-5 supporting keywords
5. **Suggested Publish Date** - Spread across the calendar based on frequency
6. **Content Gap Rationale** - Why this topic fills a gap or complements the target URL
7. **Internal Link Opportunities** - Which existing pages this article should link to (include targetUrl), and why
8. **Estimated Ranking Potential** - Low / Medium / High with brief justification

### Content Guidelines
- All suggested articles must be **informative**
- Every article must include **infographics** (specify 2-3 infographic concepts per article)
- Internal linking is **mandatory** - each article must link to 3-5 relevant existing pages including its targetUrl
- Suggestions should complement, not duplicate, existing content
- Prioritize topics with clear search intent and ranking opportunity

### Output Format
Return a JSON array with this structure:

\`\`\`json
[
  {
    "targetUrl": "https://example.com/page-from-crawl",
    "title": "Article title",
    "primaryKeyword": "main keyword",
    "secondaryKeywords": ["kw1", "kw2", "kw3"],
    "suggestedDate": "YYYY-MM-DD",
    "contentGapRationale": "Why this topic",
    "internalLinkTargets": [
      { "url": "existing-page-url", "title": "Existing Page Title", "reason": "Why link" }
    ],
    "infographicConcepts": ["Concept 1", "Concept 2", "Concept 3"],
    "rankingPotential": "high|medium|low",
    "rankingJustification": "Brief explanation"
  }
]
\`\`\`

**CRITICAL**: Output ONLY valid JSON. No markdown code blocks, no explanatory text. Start with [ and end with ]. Every item MUST have targetUrl from the existing pages list.`;
}
