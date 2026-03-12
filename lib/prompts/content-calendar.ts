import type { ContentCalendarPromptParams } from "./types";
import {
  getStructuredPromptInstruction,
  serializeStructuredPromptBlock,
  serializeStructuredPromptInline,
} from "./toon";

export function buildContentCalendarPrompt(body: ContentCalendarPromptParams): string {
  const freq = body.publishingFrequency ?? "2 per week";
  const startDate = body.startDate ?? new Date().toISOString().split("T")[0];
  const endDate = body.endDate ?? (() => {
    const d = new Date(startDate);
    d.setMonth(d.getMonth() + 1);
    d.setDate(0);
    return d.toISOString().split("T")[0];
  })();
  const daysInRange = Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (24 * 60 * 60 * 1000)) + 1;
  const count = body.wholeMonth ? Math.min(daysInRange, 31) : (body.suggestionCount ?? 12);
  const sitemapNote = body.usedSitemap
    ? "A sitemap was found and used for URL discovery."
    : "No sitemap was found; URLs were discovered by crawling the homepage and following internal links.";

  const keywordsNote =
    body.extractedKeywords && body.extractedKeywords.length > 0
      ? `\n${serializeStructuredPromptInline(
          "Extracted Keywords (prioritize these for primary_keyword)",
          body.extractedKeywords.slice(0, 40)
        )}\n`
      : "";
  const seoReferenceNote = body.seoReference
    ? `\n${serializeStructuredPromptBlock("SEO Research Reference", {
        summary: body.seoReference.summary ?? null,
        topics: body.seoReference.topics?.slice(0, 20) ?? [],
        questions: body.seoReference.questions?.slice(0, 15) ?? [],
        painPoints: body.seoReference.painPoints?.slice(0, 12) ?? [],
        contentAngles: body.seoReference.contentAngles?.slice(0, 12) ?? [],
        productsServices: body.seoReference.productsServices?.slice(0, 15) ?? [],
      })}`
    : "";

  const existingPagesList =
    body.existingPages.length > 0
      ? serializeStructuredPromptBlock(
          "Existing Pages (site context only - do not treat these as internal link targets)",
          body.existingPages.slice(0, 40).map((p) => ({
            title: p.title,
            url: p.url,
          }))
        )
      : "No existing pages discovered.";
  const internalLinksNote =
    body.internalLinks && body.internalLinks.length > 0
      ? serializeStructuredPromptBlock(
          "User-provided Internal Links (from project settings) - ONLY use these for internalLinkTargets",
          body.internalLinks.slice(0, 40).map((p) => ({
            title: p.title,
            url: p.url,
          }))
        )
      : "No user-provided internal links were added in project settings. Return an empty internalLinkTargets array.";

  const feedbackNote = body.userFeedback
    ? `\n### User Feedback (MUST incorporate)\n${body.userFeedback}\n`
    : "";

  const domainKnowledgeNote =
    body.domainKnowledge?.trim()
      ? `\n### Domain Knowledge (use throughout idea generation)\n${body.domainKnowledge.trim()}\n`
      : "";
  const contentIdeaInstructionsNote =
    body.contentIdeaCustomInstructions?.trim()
      ? `\n### Content Idea Custom Instructions (MUST follow)\n${body.contentIdeaCustomInstructions.trim()}\n`
      : "";

  const avoidNote =
    body.existingItems && body.existingItems.length > 0
      ? `\n### CRITICAL: Uniqueness & New Keywords\nThese items already exist. You MUST:\n- Use completely NEW primary keywords - do NOT reuse any primary or secondary keyword from the list below\n- Avoid duplicate topics, titles, or targetUrl+keyword combinations\n- Spread suggestions across different URLs and fresh keyword angles\n\n${serializeStructuredPromptBlock(
          "Existing items to avoid duplicating",
          body.existingItems.slice(0, 50).map((i) => ({
            title: i.title ?? null,
            targetUrl: i.targetUrl ?? null,
            primaryKeyword: i.primaryKeyword ?? null,
            secondaryKeywords:
              (i as { secondaryKeywords?: string[] }).secondaryKeywords ?? [],
          }))
        )}\n`
      : "";
  const publishedNote =
    body.publishedItems && body.publishedItems.length > 0
      ? `\n### CRITICAL: Already Published Articles\nThese articles are already live. You MUST:\n- Avoid reusing or closely paraphrasing these titles\n- Avoid reusing their primary keywords as the new primary keyword\n- Avoid proposing near-duplicate article angles\n- Prefer fresh subtopics, adjacent intents, and missing content gaps\n\n${serializeStructuredPromptBlock(
          "Published articles to avoid duplicating",
          body.publishedItems.slice(0, 50).map((i) => ({
            title: i.title ?? null,
            targetUrl: i.targetUrl ?? null,
            primaryKeyword: i.primaryKeyword ?? null,
          }))
        )}\n`
      : "";

  return `# Content Calendar & Topic Planning

## Objective
Analyze the website and existing content to produce a content calendar. Use the crawled site pages only as research context for topic selection, audience understanding, and content gap analysis.

**Domain-Agnostic Scope**: This applies to ANY website in ANY industry. Adapt suggestions to the site's domain, audience, and existing content.

## Input Data
${getStructuredPromptInstruction()}
Read any TOON or JSON structured blocks below as direct input data. Do not comment on the format, do not explain limitations, and do not return an error object.

**Current date**: ${new Date().toISOString().slice(0, 10)} (use for year consistency in titles when relevant).

### Website
- **Homepage URL**: ${body.homepageUrl}

### URL Discovery
${sitemapNote}
${keywordsNote}
${seoReferenceNote}
${domainKnowledgeNote}
${contentIdeaInstructionsNote}
${feedbackNote}
${avoidNote}
${publishedNote}

### Existing Pages
${existingPagesList}
${body.existingPages.length > 40 ? `\n... and ${body.existingPages.length - 40} more pages` : ""}

### Internal Links From Settings
${internalLinksNote}
${body.internalLinks && body.internalLinks.length > 40 ? `\n... and ${body.internalLinks.length - 40} more internal links` : ""}

## Output Requirements

Generate a content calendar with **${count}** article suggestions. Target publishing frequency: **${freq}**.
**Date range**: ${startDate} to ${endDate}. Spread suggestedDate across this range. Each date should have at most 1-2 articles.

**UNIQUENESS**: Every suggestion must be unique - no duplicate title or primaryKeyword combinations. Do not duplicate existing calendar items or already published articles.

### For Each Suggestion Provide:

1. **Suggested Title** - Compelling, SEO-friendly headline
2. **Primary Keyword** - Main target keyword for ranking
3. **Secondary Keywords** - 3-5 supporting keywords
4. **Suggested Publish Date** - Spread across the calendar based on frequency
5. **Content Gap Rationale** - Why this topic fills a gap or is strategically valuable
6. **Internal Link Opportunities** - ONLY use URLs from the user-provided internal links list above. If none were provided, return an empty array.
7. **Estimated Ranking Potential** - Low / Medium / High with brief justification

### Content Guidelines
- All suggested articles must be **informative**
- Only add years or dates to titles when the domain clearly supports time-sensitive content (e.g. tax, news, compliance, policy). For evergreen domains (how-to, guides, tutorials), prefer timeless titles without year spam.
- Every article must include **exactly 1 infographic** when infographics are enabled (specify exactly 1 infographic concept per article)
- Internal linking must come **only** from the user-provided internal links list in project settings
- Never use crawled site pages as internalLinkTargets unless that same URL also appears in the user-provided internal links list
- If no user-provided internal links are available, return \`[]\` for internalLinkTargets
- Suggestions should complement, not duplicate, existing content
- Prioritize topics with clear search intent and ranking opportunity
- Use the SEO research reference to identify audience problems, missing subtopics, adjacent angles, and article opportunities

### Output Format
Return a bare JSON array. Example shape:
[
  {
    "title": "Article title",
    "primaryKeyword": "main keyword",
    "secondaryKeywords": ["kw1", "kw2", "kw3"],
    "suggestedDate": "YYYY-MM-DD",
    "contentGapRationale": "Why this topic",
    "internalLinkTargets": [
      { "url": "existing-page-url", "title": "Existing Page Title", "reason": "Why link" }
    ],
    "infographicConcepts": ["Concept 1"],
    "rankingPotential": "high|medium|low",
    "rankingJustification": "Brief explanation"
  }
]

**CRITICAL**:
- Output ONLY the JSON array
- Do NOT wrap it in an object
- Do NOT return keys like "error", "note", "message", or "explanation"
- Do NOT use markdown code fences
- Start with [ and end with ]
- Do NOT include targetUrl in the response
- internalLinkTargets must only contain URLs from the user-provided internal links list above
- infographicConcepts must contain exactly 1 string
- If constraints are tight, still return the best valid array you can`;
}
