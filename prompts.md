# Prompts Documentation

This document describes every AI prompt **actually used** in the Better Articles codebase. Each prompt is designed for a specific task in the article generation, SEO, and content planning pipeline.

---

## Table of Contents

1. [Structured Data Format (TOON / JSON)](#structured-data-format-toon--json)
2. [SEO Rules (Shared Block)](#seo-rules-shared-block)
3. [Research Decision Prompt](#research-decision-prompt)
4. [Research Prompt](#research-prompt)
5. [Content Prompt](#content-prompt)
6. [Metadata Prompt](#metadata-prompt)
7. [Content Calendar Prompt](#content-calendar-prompt)
8. [Keyword Extraction Prompt](#keyword-extraction-prompt)
9. [Infographic Regeneration Prompt](#infographic-regeneration-prompt)
10. [Article Defaults Inference Prompt](#article-defaults-inference-prompt)
11. [Fact Check Prompt](#fact-check-prompt)
12. [Humanize Prompt](#humanize-prompt)
13. [SEO Prompt (Full Optimization)](#seo-prompt-full-optimization)

---

## Structured Data Format (TOON / JSON)

**Location:** `lib/prompts/toon.ts`

**What it does:** The app sends structured context to the LLM in two formats:

- **TOON** – Compact, token-efficient format (from `@toon-format/toon`)
- **JSON** – Standard JSON

Controlled by **Prompt Optimizations** setting (`structured_data_format`) in the database. The code adds:

- TOON mode: *"Structured context may appear in TOON format. Read fields, arrays, and rows directly."*
- JSON mode: *"Structured context may appear in compact JSON format. Read fields, arrays, and objects directly."*

---

## SEO Rules (Shared Block)

**Location:** `lib/seo-rules.ts` → `SEO_RULES_PROMPT_BLOCK`

**Used in:** Research, Content, Metadata prompts.

**Target score:** `SEO_TARGET_SCORE` is 90; prompt copy uses "91+" as aspirational minimum. Optimization loop runs until score ≥ 90 or max passes.

**Rules (from code):**

```
- Put the primary keyword or a close semantic variant in the title and keep it near the beginning.
- Use the primary keyword naturally in the meta description, introduction, at least one H2 or H3, the slug, and the article body.
- Keep keyword density natural, roughly within 0.5% to 1.5%.
- Write a comprehensive article that is usually at least 1,500 words unless the topic genuinely requires less.
- Use a clear H1/H2/H3 hierarchy: one H1 for the title, H2 for major sections, H3 for subsections. Never repeat the full title as plain text. Each section must have a proper heading.
- Keep paragraphs readable and scannable. Prefer short paragraphs, bullet lists, comparison tables, and practical examples where useful.
- Include a dedicated FAQ section with question-style headings when the topic supports it.
- Format the FAQ section in markdown using ## FAQ or ## Frequently Asked Questions, followed by at least 3 ### Question? subheadings when the topic supports it.
- Include at least one meaningful list.
- Use a concluding section or closing summary only when it improves the article format and reader experience. Do not force a conclusion when the format would feel unnatural without it.
- Keep formatting clean. Do not leave broken HTML, unfinished code fences, dangling bullets, or orphaned tokens.
- Include a featured image concept and descriptive alt text tied to the topic.
- If infographics are enabled, include exactly one rich self-contained infographic HTML block that matches the topic and includes the exact primary keyword phrase in at least one infographic title, caption, or visible label.
- Make the infographic feel editorial and premium rather than generic: strong heading/subheading, modular panels, concise text, clear hierarchy, and purposeful accent colors.
- Use descriptive internal links when relevant.
- Use high-authority external sources when external linking is enabled or factual claims need support.
```

---

## Research Decision Prompt

**Location:** `lib/article-pipeline.ts` → `decideArticleResearch()` (inline)

**When it runs:** Before the research step. Decides whether a separate research brief is needed.

**Real prompt (from code):**

```
Decide whether this article needs a separate research brief before writing.

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
- If the topic looks evergreen and the provided project context is already enough to draft a useful article, set needsResearch: false.
- Keep reason under 24 words.
- Keep focusAreas to 0-4 short items.

Article context:
- Keyword: {keyword}
- Title: {title}
- Category: {category}
- Audience: {targetAudience}
...
```

**Heuristic skip:** `shouldSkipResearchByHeuristic()` can bypass the LLM call when context is obviously sufficient.

---

## Research Prompt

**Location:** `lib/prompts/research.ts` → `buildResearchPrompt()`

**When it runs:** Before writing the article body (when research decision is true).

**Input:** `ResearchPromptParams` – keyword, category, targetAudience, geoFocus, url, includeTrendingTopics, contentFreshness, articleType, contentIntent, customInstructions, domainKnowledge.

**Real prompt structure (from code):**

```
# Research Brief

Produce a professional markdown research brief that supports high-quality article creation.

## Context
{TOON/JSON instruction}
{Research context block: topic, currentDate, currentYear, sourceUrl, category, geoFocus, audience, articleType, contentIntent, freshnessPreference, includeTrendingTopics}

## Non-negotiable requirements
- Stay factual, useful, and domain-appropriate
- Gather material that helps the final article satisfy these SEO rules:
{SEO_RULES_PROMPT_BLOCK}

## Required markdown sections
### 1. Executive summary – 5-8 key takeaways
### 2. Topic fundamentals – Definition, why it matters, important terms
### 3. Audience intelligence – Pain points, questions, search intents
### 4. Competitive and content gap insights
### 5. Evidence and source guidance
### 6. Article strategy recommendations
### 7. Risks and watchouts
```

---

## Content Prompt

**Location:** `lib/prompts/content.ts` → `buildContentPrompt()`

**When it runs:** Main article generation step. Used by `article-pipeline.ts` and `article-generation-runner.ts`.

**Input:** `ContentPromptParams` – keyword, category, targetAudience, title, length, tone, style, readingLevel, articleType, articleFormat, pointOfView, contentIntent, citationStyle, existingPages, publishedArticles, internalLinks, externalLinking, internalLinking, useCrawledUrlsAsInternalLinks, requireInfographics, language, customInstructions, domainKnowledge.

**Real prompt structure (from `lib/prompts/content.ts`):**

```
# Article Writing Brief

Write a high-quality article in markdown.

## Context
{TOON/JSON instruction}
{Article context: primaryKeyword, contextDate, contextYear, category, audience, tone, style, readingLevel, length, authorVoice, articleType, articleFormat, pointOfView, contentIntent, citationStyle, outputLanguage, requireInfographics}

## Core requirements
- Make the article specific, useful, and publication-ready
- Use a clear H1/H2/H3 hierarchy: one # H1 at the top, then ## H2 for each major section, ### H3 for subsections. Never repeat the full title as plain text.
- MANDATORY: Include at least 3 internal links when a list is provided
- MANDATORY: Add at least 1 high-authority external link (.gov, .edu, wikipedia.org, nih.gov, cdc.gov, etc.)
- Aim for approximately {targetWordCount}+ words (Short: 1000, Medium: 1500, Long: 1800, Ultra-long: 2500)

## Linking and authority
{Internal links block – MANDATORY when provided}
{Published articles block}

## Article structure
- H1 at the top only. Introduction must start with the hook, not a repeat of the title.
- MANDATORY: Include at least one markdown bullet list or numbered list
- Include one FAQ section with question-style subheadings when the topic supports it (## FAQ or ## Frequently Asked Questions, followed by ### Question? subheadings)
- Key Takeaways and Table of Contents sections when article length/type warrants (Long/Ultra-long, guide, how-to, comparison, etc.)

## SEO and editorial standards
{SEO_RULES_PROMPT_BLOCK}

## Infographic requirement (when requireInfographics)
- Use **placeholders only**, not HTML blocks. Format: [Infographic: Clear infographic title]
- Infographic count by length: Short/Medium = 1, Long = 2, Ultra-long = 2–3
- Place each at the most relevant points (after comparison, step-by-step guide, timeline, key stats). Infographics are auto-generated as modular editorial visuals.
- Do NOT output ```html blocks. Prefer editorial titles: "Breakdown", "Comparison", "Guide", "Timeline", "Checklist", "Summary". Do not use "heatmap" unless it will be an actual heatmap.
- Include the exact primary keyword phrase in at least one placeholder title for SEO

## CRITICAL – NEVER include these in your output
- Do NOT append Meta Data, Metadata, Research brief, or SEO section at the end.
- Do NOT output SEO Title, Meta Description, Canonical URL, Tags, Social Hashtags, Featured Image Concept, or Alt Text in the article body.
- Metadata is generated separately and shown in the SEO tab. Your output must be the article content ONLY.
```

**System prompt used:** `You are a senior editorial writer. Follow the prompt exactly, stay compliant with all requirements, and output publication-ready markdown only. {structured instruction}`

---

## Metadata Prompt

**Location:** `lib/prompts/metadata.ts` → `buildMetadataPrompt()`

**When it runs:** After the article body is written. Used by `article-pipeline.ts`, `article-assets.ts`, `article-generation-runner.ts`.

**Input:** `MetadataPromptParams` – keyword, category, targetAudience, title, authorName, articleType, articleFormat, content, researchContent, secondaryKeywords, language.

**Real prompt (from code):**

```
You are generating publish-ready article metadata.

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
- SEO title: 45-100 characters
- Meta description: 120-160 characters
- Tags: 4-8 tags
- Slug: lowercase, hyphenated, no path prefix
- coverImagePrompt must be detailed enough for text-to-image generation

SEO rules:
{SEO_RULES_PROMPT_BLOCK}

Context:
{Metadata context block}

Research brief:
{researchContent}

Final article markdown:
{content}
```

---

## Content Calendar Prompt

**Location:** `lib/prompts/content-calendar.ts` → `buildContentCalendarPrompt()`

**When it runs:** When generating a content calendar or topic suggestions. Used by `app/api/calendar/route.ts`, `lib/calendar-generation-runner.ts`, `app/api/projects/[id]/calendar/route.ts`.

**Input:** `ContentCalendarPromptParams` – homepageUrl, existingPages, internalLinks, usedSitemap, suggestionCount, publishingFrequency, extractedKeywords, seoReference, wholeMonth, startDate, endDate, userFeedback, existingItems, publishedItems, domainKnowledge, contentIdeaCustomInstructions.

**Real prompt structure (from code):**

```
# Content Calendar & Topic Planning

## Objective
Analyze the website and existing content to produce a content calendar. Use the crawled site pages only as research context for topic selection, audience understanding, and content gap analysis.

**Domain-Agnostic Scope**: This applies to ANY website in ANY industry. Adapt suggestions to the site's domain, audience, and existing content.

## Input Data
{TOON/JSON instruction}
- Homepage URL
- URL Discovery (sitemap note, extracted keywords, SEO reference, domain knowledge, content idea custom instructions)
- Existing Pages (site context only - do not treat as internal link targets)
- Internal Links From Settings (ONLY use these for internalLinkTargets)
- User Feedback (when provided)
- Existing items to avoid duplicating (when provided)
- Published articles to avoid duplicating (when provided)

## Output Requirements
Generate a content calendar with {count} article suggestions. Target publishing frequency: {freq}. Date range: {startDate} to {endDate}.

### For Each Suggestion Provide:
1. Suggested Title – Compelling, SEO-friendly headline
2. Primary Keyword – Main target keyword for ranking
3. Secondary Keywords (3-5)
4. Suggested Publish Date – Spread across the calendar
5. Content Gap Rationale – Why this topic fills a gap
6. Internal Link Opportunities – ONLY from user-provided internal links list
7. Estimated Ranking Potential (Low/Medium/High) with brief justification

### Content Guidelines
- All suggested articles must be informative
- Only add years/dates to titles when domain supports time-sensitive content (tax, news, compliance). For evergreen domains, prefer timeless titles.
- Every article must include exactly 1 infographic concept when infographics are enabled
- internalLinkTargets must come only from user-provided internal links; if none, return []
- Suggestions must be unique – no duplicate title or primaryKeyword combinations

### Output Format
Return a bare JSON array. Do NOT wrap in an object, code fences, or include targetUrl. infographicConcepts must contain exactly 1 string.
```

**Critical:** `internalLinkTargets` may only use URLs from the user-provided internal links list. Crawled pages are context only.

---

## Keyword Extraction Prompt

**Location:** `lib/prompts/keyword-extraction.ts` → `buildKeywordExtractionPrompt()`

**When it runs:** During SEO extraction when crawl results are processed. Used by `lib/seo-extraction.ts`.

**Input:** `KeywordExtractionInput` – homepageUrl, pages (url, title, meta_description, content_preview), maxKeywords (default 200).

**Real prompt structure (from code):**

```
# Topic & Keyword Extraction from Website

## Objective
Analyze the crawled website content and extract:
1. Topics – Main themes, subject areas
2. Keywords – SEO-relevant search terms
3. Entities – Products, services, concepts
4. Questions – Audience questions
5. Pain points – Problems the content addresses
6. Content angles – Article directions
7. Search intents – Dominant intents
8. Products/services – Offerings mentioned

## Crawled Content
{TOON/JSON instruction}
{Crawled page samples}

## Output
Return a JSON object only:
{
  "topics": ["..."],
  "keywords": ["..."],
  "entities": ["..."],
  "questions": ["..."],
  "painPoints": ["..."],
  "contentAngles": ["..."],
  "searchIntents": ["..."],
  "productsServices": ["..."],
  "summary": "One short summary"
}

Rules:
- topics: 2-4 (single page) or 2-8 (multi-page)
- keywords: up to maxKeywords
- entities, questions, painPoints, etc.: limits vary by batch size
```

---

## Infographic Regeneration Prompt

**Location:** `lib/infographic-regeneration.ts` → `buildInfographicRegenerationPrompt()`

**When it runs:** When regenerating a specific infographic block. Used by `app/api/projects/[id]/articles/[articleId]/regenerate-infographic/route.ts`.

**Input:** `InfographicReplacementContext` – articleTitle, articleExcerpt, primaryKeyword, infographicConcepts, surroundingContent.

**Real prompt (from code):**

```
You are a designer creating a single HTML infographic for an article. Aim for a polished, editorial style like professional industry guides: modular cards, clear flows, comparisons, and feature lists—not generic bar or pie charts.

## Article context
- Title: {articleTitle}
- Excerpt: {articleExcerpt}
- Primary keyword: {primaryKeyword}
- Infographic concepts: {conceptsStr}

## Surrounding article content (for context)
{surroundingContent slice 0-1500}

## Task
Generate exactly ONE self-contained HTML infographic block. Output ONLY the infographic block in this exact format:

Infographic: Clear infographic title
```html
<figure>...</figure>
```

## Design style (Gold Coast / editorial guide)
- Layout: Modular cards, vertical flow, or section-based layout. Use distinct panels with thin borders (1px) and subtle backgrounds.
- Content types: Prefer flow diagrams (cause → effect → solution), comparisons (Option A vs Option B), feature lists, checklists, timelines, decision guides, or breakdowns—not simple bar/pie charts.
- Colors: Semantic accents—teal/cyan for info, green for positive/success, amber/gold for caution or highlights, red for warnings or critical items. Use sparingly for emphasis.
- Typography: Strong headline, optional subheadline, concise body text. Short headings, 1–3 line descriptions, compact bullets.
- Visual hierarchy: Clear sections, boxed content, scannable structure. Each card/panel should have a clear purpose.

## Requirements
- CRITICAL: Use ONLY data and facts explicitly stated in the surrounding article content. Do NOT invent statistics, dates, fees, or any information not present in the article.
- The infographic must be useful and directly related to the article; every fact must come from the provided content.
- Avoid generic or filler content; every element should add value and be supported by the article text.
- Use simple semantic HTML: <figure>, <figcaption>, <div>, <table>. No external assets or images.
- Dark background (e.g. gradient or slate) with high-contrast text and accent colors.
- Design as a single coherent visual, not unrelated mini-blocks.
- Do not use "heatmap" or "heat-map" in the title unless the infographic is an actual heatmap. Use accurate terms like "Breakdown", "Comparison", "Guide", "Timeline", "Checklist", or "Summary".
- Include the exact primary keyword phrase in the title, figcaption, or visible label (when provided).
```

---

## Article Defaults Inference Prompt

**Location:** `lib/article-default-inference.ts` → `inferArticleDefaultsFromSEOInsightWithAI()`

**When it runs:** After a crawl or when loading optimal article defaults. Used by `lib/db/article-defaults.ts`, `app/api/projects/[id]/article-defaults/load-optimal/route.ts`.

**Input:** Project name, homepage URL, heuristic defaults, existing saved defaults, extracted SEO data (summary, topics, keywords, entities, questions, pain points, content angles, search intents, products/services).

**Real prompt (from code):**

```
Infer the best site-wide article content defaults from crawl-extracted SEO data.

Return JSON only with this shape:
{
  "category": "broad editorial category for the site",
  "targetAudience": "clear audience description",
  "geoFocus": "specific location target or Global",
  "articleType": "best default article type",
  "articleFormat": "best default publication format",
  "tone": "best default tone",
  "style": "best default style",
  "readingLevel": "best default reading level",
  "length": "best default content length",
  "targetWordCount": 1800,
  "contentIntent": "best default intent",
  "contentFreshness": "best default freshness",
  "pointOfView": "best default point of view",
  "citationStyle": "best default citation style or null",
  "includeSubtopics": true,
  "internalLinking": true,
  "useCrawledUrlsAsInternalLinks": true,
  "externalLinking": true,
  "socialMediaOptimization": true,
  "requireInfographics": true,
  "customInstructions": "short SEO-safe site-wide writing instruction"
}

Rules:
- Category must describe the site's real subject area, not the brand/domain
- Geo focus must not be empty; use "Global" when not regional
- Keep customInstructions under 35 words
```

---

## Fact Check Prompt

**Location:** `lib/prompts/fact-check.ts` → `buildFactCheckPrompt()`

**When it runs:** Available via `buildAllPrompts()`. Used for post-processing content verification when wired into the pipeline.

**Input:** `FactCheckPromptParams` – keyword, category, targetAudience, citationStyle, articleType.

**Real prompt structure (from code):**

```
# Content Verification & Accuracy Enhancement

## Verification Parameters
- Primary Keyword, Content Category, Citation Style, Article Type

**Domain-Agnostic Scope**: Fact-check content from ANY domain or industry. Use domain-appropriate authoritative sources.

## Critical Verification Requirements
- Statistical Accuracy: Verify all numbers, percentages, dates, quantitative claims
- Source Credibility: Cross-reference with authoritative, recent sources
- Attribution Verification: Confirm quotes, citations, references
- Timeline Accuracy: Ensure dates, sequences, chronological info correct
- Technical Accuracy: Verify domain-specific terms, processes, details

## Output Requirements
- Deliver the complete corrected article with clean markdown
- Add numerical footnotes [^1] after verified claims
- Include a References & Fact-Check Sources section at the end
- Optional Correction Summary in a <details> block if changes were made
- NO fact-check sections, verification labels, or meta-comments in the main article
```

---

## Humanize Prompt

**Location:** `lib/prompts/humanize.ts` → `buildHumanizePrompt()`

**When it runs:** Available via `buildAllPrompts()`. Used for post-processing to make content more engaging and human-sounding when wired into the pipeline.

**Input:** `HumanizePromptParams` – keyword, category, targetAudience, tone, readingLevel, articleType, pointOfView.

**Real prompt structure (from code):**

```
# Advanced Content Humanization & Engagement Enhancement

## Humanization Parameters
- Target Tone, Primary Audience, Reading Level, Content Category, Article Type, Point of View

**Domain-Agnostic Scope**: Humanize content from ANY domain or industry.

## Comprehensive Humanization Objectives
- Voice & Tone Optimization: Active voice, conversational flow, audience-appropriate language, emotional resonance
- Engagement Amplification: Strategic questions, reader involvement, relatable examples, storytelling elements
- Structural & Flow Enhancement: Varied sentence length, rhythm, transitions, readability
- Personality & Authenticity: Personal touch, domain expertise, balanced formality, curiosity triggers

## Critical Output Requirements
- Natural reading experience, maintained accuracy, enhanced engagement, SEO preservation
- Clean markdown without meta-comments or "humanized" labels
- Output only the final humanized article content
```

---

## SEO Prompt (Full Optimization)

**Location:** `lib/prompts/seo.ts` → `buildSEOPrompt()`

**When it runs:** Available via `buildAllPrompts()`. A comprehensive SEO optimization prompt for full-article enhancement (distinct from the patch-based `optimizeArticleForSeoSignals` used in the main pipeline).

**Input:** `SEOPromptParams` – keyword, category, targetAudience, geoFocus, socialMediaOptimization, articleType.

**Real prompt structure (from code):**

```
# Advanced SEO Content Optimization & Search Engine Mastery

## Strategic SEO Parameters
- Primary Target Keyword, Audience Demographic, Geographic Market Focus, Social Media Amplification (optional), Article Type

**Domain-Agnostic Scope**: Optimize content from ANY domain or industry.

## Comprehensive SEO Enhancement Protocol
- Advanced Keyword Strategy: Primary keyword integration (1-2% density), LSI keywords, long-tail targeting, search intent alignment
- Technical SEO Architecture: Header hierarchy, meta tags, URL structure, internal linking, schema markup
- Social Media SEO Integration (when enabled): Platform-specific titles, shareable elements, hashtag strategy
- Content Quality Signals: E-A-T, authority building, content depth, UX optimization

## Output Requirements
- SEO-Optimized Article Content: Enhanced structure, meta title/description options, URL slug recommendations, image alt text
- Advanced SEO Intelligence Report: Keyword analysis, content optimization metrics, performance prediction
- No meta-comments about optimization in the article content itself
```

---

## Pipeline Flow Summary

| Step | Prompt | Used by |
|------|--------|---------|
| 0 | Research Decision | `article-pipeline.ts` |
| 1 | Research | `article-pipeline.ts` (when needed) |
| 2 | Content | `article-pipeline.ts`, `article-generation-runner.ts` |
| 3 | Metadata | `article-pipeline.ts`, `article-assets.ts`, `article-generation-runner.ts` |
| 3b | SEO Optimization (patch-based) | `article-pipeline.ts` → `optimizeArticleForSeoSignals`, `article-generation-runner.ts` |
| — | Content Calendar | `calendar/route.ts`, `calendar-generation-runner.ts` |
| — | Keyword Extraction | `seo-extraction.ts` |
| — | Infographic Regeneration | `regenerate-infographic/route.ts` |
| — | Article Defaults Inference | `article-defaults.ts`, `load-optimal/route.ts` |
| — | Fact Check, Humanize, SEO (full) | `lib/prompts/pipeline.ts` → `buildAllPrompts()` – available for post-processing workflows |

---

## Importing Prompts

```typescript
import {
  buildResearchPrompt,
  buildContentPrompt,
  buildMetadataPrompt,
  buildContentCalendarPrompt,
  buildFactCheckPrompt,
  buildHumanizePrompt,
  buildSEOPrompt,
  toResearchParams,
  toContentParams,
  toMetadataParams,
  toFactCheckParams,
  toHumanizeParams,
  toSEOParams,
  buildAllPrompts,
} from "@/lib/prompts";

import { buildKeywordExtractionPrompt } from "@/lib/prompts/keyword-extraction";
import { buildInfographicRegenerationPrompt } from "@/lib/infographic-regeneration";
```

---

## Test Script

`scripts/direct-content-provider-test.mjs` contains a standalone test that builds a Content prompt and calls an external LLM (NVIDIA). The real prompts used in the app are in `lib/prompts/content.ts` and `lib/seo-rules.ts`. The test input object is a good example of `ContentPromptParams`.

```bash
$ node scripts/direct-content-provider-test.mjs
```

The script outputs config, system prompt, user prompt, and streamed article output. **Note:** The Content prompt now uses infographic placeholders `[Infographic: Title]` instead of HTML blocks; infographics are auto-generated separately.
