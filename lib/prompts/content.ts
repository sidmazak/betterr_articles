import type { ContentPromptParams } from "./types";
import {
  getStructuredPromptInstruction,
  serializeStructuredPromptBlock,
} from "./toon";
import { SEO_RULES_PROMPT_BLOCK, SEO_TARGETS } from "@/lib/seo-rules";

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

export function buildContentPrompt(body: ContentPromptParams): string {
  const currentDate = new Date().toISOString().slice(0, 10);
  const currentYear = new Date().getUTCFullYear();
  const linkingStrategy: string[] = [];
  if (body.externalLinking) {
    linkingStrategy.push("Strategic external link integration for authority building and user value");
  }
  if (body.internalLinking) {
    linkingStrategy.push("Comprehensive internal linking architecture for SEO optimization and user journey enhancement");
  }

  const articleTypeNote = body.articleType
    ? `\n- **Article Type**: ${body.articleType} (structure and conventions must match this format)`
    : "";
  const titleNote = body.title ? `\n- **Required Title / H1**: ${body.title}` : "";
  const formatNote = body.articleFormat ? `\n- **Publication Format**: ${body.articleFormat}` : "";
  const povNote = body.pointOfView ? `\n- **Point of View**: ${body.pointOfView}` : "";
  const intentNote = body.contentIntent ? `\n- **Content Intent**: ${body.contentIntent}` : "";
  const citationNote = body.citationStyle ? `\n- **Citation Style**: ${body.citationStyle}` : "";
  const infographicCount =
    body.length === "Ultra-long" ? "2–3" : body.length === "Long" ? "2" : "1";
  const infographicsNote = body.requireInfographics
    ? `\n- **Infographics**: CRITICAL – You MUST include ${infographicCount} infographic placeholder(s). Use ONLY this format: [Infographic: Clear infographic title]. Place each at the most relevant point (e.g. after a comparison, step-by-step guide, timeline, or key stats). Prefer editorial-style titles: "Breakdown", "Comparison", "Guide", "Timeline", "Checklist". Do NOT output \`\`\`html blocks. Infographics will be auto-generated. Never skip this.`
    : "";
  const crawledInternal =
    body.internalLinking && (body.useCrawledUrlsAsInternalLinks ?? true)
      ? (body.existingPages ?? [])
      : [];
  const configuredInternal = body.internalLinking ? (body.internalLinks ?? []) : [];
  const allInternal = [...crawledInternal, ...configuredInternal];
  const existingPagesNote =
    allInternal.length > 0
      ? `\n\n${serializeStructuredPromptBlock(
          "Internal links – you MUST use these (crawled site pages)",
          allInternal.slice(0, 20).map((p) => ({
            title: p.title,
            url: p.url,
          }))
        )}\nMANDATORY: Include at least ${SEO_TARGETS.minimumInternalLinks} internal links from this list. Use markdown format [anchor text](url). Weave them naturally into relevant sections. Do not skip linking.`
      : "";
  const publishedNote =
    body.publishedArticles && body.publishedArticles.length > 0
      ? `\n\n${serializeStructuredPromptBlock(
          "Published articles – link to these when relevant",
          body.publishedArticles.slice(0, 12).map((p) => ({
            title: p.title,
            url: p.url,
          }))
        )}\nInclude links to relevant published articles where they add value.`
      : "";
  // External links: AI finds authoritative sources automatically when externalLinking is enabled. No user-provided list.
  const languageNote = body.language && body.language !== "en"
    ? `\n- **Output Language**: Write the ENTIRE article in ${body.language.toUpperCase()}. All content, headings, and body text must be in this language.`
    : "";
  const normalizedArticleType = normalizeArticleType(body.articleType);
  const shouldUseLeadBoxes = !ARTICLE_TYPES_WITHOUT_LEAD_BOXES.has(normalizedArticleType);
  const shouldRequireKeyTakeaways =
    shouldUseLeadBoxes &&
    (body.length === "Long" || body.length === "Ultra-long");
  const shouldRequireTableOfContents =
    shouldUseLeadBoxes &&
    (body.length === "Long" ||
      body.length === "Ultra-long" ||
      ["guide", "how-to", "tutorial", "comparison", "explainer", "report", "research", "analysis", "case-study"].includes(normalizedArticleType));
  const leadSectionRules = [
    shouldRequireKeyTakeaways
      ? "MANDATORY: Include a `## Key Takeaways` section near the top, immediately after the introduction and before the main body. Use 3-5 crisp bullets that summarize the article's value. Do not skip this."
      : "Skip a `## Key Takeaways` box when the article format would feel templated or overly rigid.",
    shouldRequireTableOfContents
      ? "MANDATORY: Include a `## Table of Contents` section near the top, right after Key Takeaways (or after the intro if no Key Takeaways). List the actual H2 section headings as clickable anchors. Mirror the real structure of the article."
      : "Do not force a `## Table of Contents` section for short, newsy, opinion-led, interview, profile, or story-style formats.",
    "When both are used, place `## Key Takeaways` first and `## Table of Contents` immediately after it.",
  ]
    .map((rule) => `- ${rule}`)
    .join("\n");
  const contextBlock = serializeStructuredPromptBlock("Article context", {
    primaryKeyword: body.keyword,
    contextDate: currentDate,
    contextYear: currentYear,
    category: body.category,
    domainKnowledge: body.domainKnowledge?.trim() || null,
    audience: body.targetAudience,
    tone: body.tone,
    style: body.style,
    readingLevel: body.readingLevel,
    length: body.length,
    authorVoice: body.authorName ?? "Brand-aligned editorial voice",
    articleType: body.articleType ?? null,
    articleFormat: body.articleFormat ?? null,
    pointOfView: body.pointOfView ?? null,
    contentIntent: body.contentIntent ?? null,
    citationStyle: body.citationStyle ?? null,
    outputLanguage: body.language ?? "en",
    requireInfographics: body.requireInfographics ?? false,
  });
  const targetWordCount = body.length === "Short"
    ? 1000
    : body.length === "Medium"
      ? 1500
      : body.length === "Ultra-long"
        ? 2500
        : 1800;

  return `# Article Writing Brief

Write a high-quality article in markdown.

## Context
${getStructuredPromptInstruction()}
${contextBlock}${titleNote}${articleTypeNote}${formatNote}${povNote}${intentNote}${citationNote}${infographicsNote}${languageNote}

## Core requirements
${body.customInstructions ? `- ${body.customInstructions}` : "- Follow strong editorial best practices"}
- Make the article specific, useful, and publication-ready
- Match search intent and fully answer the core topic
- Use a clear H1/H2/H3 hierarchy: one \`# H1\` at the top, then \`## H2\` for each major section, and \`### H3\` for subsections. Never repeat the full title as plain text in the intro or body—the H1 is the only place for it. Start the introduction with the hook, not the title again.
- ${body.title
    ? `Use the exact H1 title \`${body.title}\` at the top of the article as \`# ${body.title}\`. Do not change the year, date, or wording. Do NOT repeat this full title in the first paragraph or elsewhere.`
    : "Write a strong H1 title that matches the topic and search intent."}
- Treat years, dates, ages, fees, timelines, holding periods, and compliance details as factual claims, not decoration.
- If the title, research brief, or provided context contains a specific year or date, keep those references consistent across the full article.
- Use contextDate/contextYear from the context block for year consistency. Do not introduce a different current year, deadline, or timeline unless clearly labeled as historical or explicitly supported by research.
- Keep the writing concrete, accurate, and non-generic
- Prefer active voice and crisp paragraphs
- Do not include process commentary or mention the prompt
- Aim for approximately ${targetWordCount}+ words unless the topic genuinely calls for less

## Linking and authority
${existingPagesNote}${publishedNote}
${linkingStrategy.length > 0 ? linkingStrategy.map((strategy) => `- ${strategy}`).join("\n") : ""}
- MANDATORY: Include at least ${SEO_TARGETS.minimumInternalLinks} internal links when a list is provided above. Use the exact URLs from the list.
- MANDATORY: Add at least ${SEO_TARGETS.minimumAuthorityLinks} high-authority external link. Use domains like .gov, .edu, wikipedia.org, nih.gov, cdc.gov, or reputable news (reuters.com, nytimes.com). Format as [anchor text](https://...). Required for every article.
- Use descriptive anchor text: minimum 4 characters, never "click here", "learn more", "read more", or bare URLs
- Favor credible, recent, authoritative external sources

## Article structure
- H1 at the top only. Introduction must start with the hook, not a repeat of the title. Weave the primary keyword naturally into the first paragraph without restating the full title.
- Clear introduction that frames the reader problem and value
- Body organized into distinct \`## H2\` sections (e.g. \`## Key Concepts\`, \`## Step-by-Step Guide\`, \`## Common Mistakes\`). Use \`### H3\` for subsections within each H2. Avoid long unbroken paragraphs without subheadings.
- Practical examples, evidence, or comparisons where useful
- Structure the article in a way that matches the article type instead of forcing one generic template
- MANDATORY: Include at least one markdown bullet list (using \`-\` or \`*\`) or numbered list (using \`1. 2. 3.\`) in the article body. Place it in a relevant section.
- Include one FAQ section with question-style subheadings whenever the topic supports it
- When you include FAQs, format them as real markdown headings, not plain text
- Use either \`## FAQ\` or \`## Frequently Asked Questions\` for the section heading
- Put each FAQ item under that section as its own markdown subheading such as \`### What documents are required?\`
- Do not write FAQ questions as plain paragraphs or standalone lines without heading markers
- Add a conclusion or closing summary only when it suits the article format and improves the reading experience
- Do not force a \`## Conclusion\` section for formats where a strong final section, checklist, FAQ ending, or direct close works better
${leadSectionRules}

## SEO and editorial standards
- ${SEO_RULES_PROMPT_BLOCK}
- Cover meaningful semantic variations where relevant
- Use scannable formatting: lists, short paragraphs, and clear subheads
- Anticipate and answer reader objections or common questions
- Avoid repetition and filler
- Keep the exact primary keyword density natural and within roughly ${SEO_TARGETS.keywordDensity.min}% to ${SEO_TARGETS.keywordDensity.max}%
- Aim for a reliable target band around 0.7% to 1.2% so the finished article passes SEO validation cleanly
- Use unique H2/H3 headings only
- Include descriptive internal links where relevant and at least ${SEO_TARGETS.minimumInternalLinks} internal links when quality allows
- Add at least one high-authority external reference when factual claims, compliance, or statistics are involved

${body.requireInfographics ? `## Infographic requirement (CRITICAL – do not skip)
- You MUST include ${infographicCount} infographic placeholder(s). This is mandatory.
- Use ONLY this format: [Infographic: Clear infographic title]
- Place each at the most relevant points (e.g. after a comparison, step-by-step guide, timeline, or key stats). Each should summarize a different section—comparison, timeline, checklist, or breakdown.
- Infographics will be auto-generated as modular editorial visuals (cards, flows, comparisons)—do NOT output \`\`\`html blocks
- The title should describe what the infographic will show (e.g. "DMV Practice Test Breakdown—Question Distribution & Pass Rates", "Trailer Parts Comparison—Axles vs Brakes vs Couplers")
- Prefer editorial terms: "Breakdown", "Comparison", "Guide", "Timeline", "Checklist", "Summary". Do not use "heatmap" unless it will be an actual heatmap.
- Include the exact primary keyword phrase in at least one placeholder title for SEO` : ""}

## Final output rules
- Output clean markdown only. No code fences around the full article.
- Do not include notes like "here is the article" or any meta-commentary.
- Deliver a finished draft, not an outline. Never stop mid-section, mid-list, or with a dangling number or fragment.
- Do not include an explicit outline section or planning notes.

## CRITICAL – NEVER include these in your output
- Do NOT append a Meta Data, Metadata, Research brief, or SEO section at the end.
- Do NOT output SEO Title, Meta Description, Canonical URL, Tags, Social Hashtags, Featured Image Concept, or Alt Text in the article body.
- Metadata is generated separately and shown in the SEO tab. Your output must be the article content ONLY.
- The finished draft should be able to score 100/100 against the provided SEO rules when it truly satisfies them.`;
}
