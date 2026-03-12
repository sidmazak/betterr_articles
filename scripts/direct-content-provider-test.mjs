import { encode as encodeToon } from "@toon-format/toon";

const SEO_TARGETS = {
  keywordDensity: { min: 0.5, max: 1.5 },
  minimumInternalLinks: 3,
  minimumAuthorityLinks: 1,
};

const SEO_RULES_PROMPT_BLOCK = `Follow these SEO rules exactly. Articles must score at least 91+/100:
- Put the primary keyword or a close semantic variant in the title and keep it near the beginning.
- Use the primary keyword naturally in the meta description, introduction, at least one H2 or H3, the slug, and the article body.
- Keep keyword density natural, roughly within 0.5% to 1.5%.
- Write a comprehensive article that is usually at least 1,500 words unless the topic genuinely requires less.
- Use a clear H1/H2/H3 hierarchy: one H1 for the title, H2 for major sections, H3 for subsections. Never repeat the full title as plain text. Each section must have a proper heading.
- Keep paragraphs readable and scannable. Prefer short paragraphs, bullet lists, comparison tables, and practical examples where useful.
- Include a dedicated FAQ section with question-style headings when the topic supports it.
- Format the FAQ section in markdown using \`## FAQ\` or \`## Frequently Asked Questions\`, followed by at least 3 \`### Question?\` subheadings when the topic supports it.
- Include at least one meaningful list.
- Use a concluding section or closing summary only when it improves the article format and reader experience. Do not force a conclusion when the format would feel unnatural without it.
- Keep formatting clean. Do not leave broken HTML, unfinished code fences, dangling bullets, or orphaned tokens.
- Include a featured image concept and descriptive alt text tied to the topic.
- If infographics are enabled, include exactly one rich self-contained infographic HTML block that matches the topic and includes the exact primary keyword phrase in at least one infographic title, caption, or visible label.
- Make the infographic feel editorial and premium rather than generic: strong heading/subheading, modular panels, concise text, clear hierarchy, and purposeful accent colors.
- Use descriptive internal links when relevant.
- Use high-authority external sources when external linking is enabled or factual claims need support.`;

const ARTICLE_TYPES_WITHOUT_LEAD_BOXES = new Set([
  "news",
  "opinion",
  "editorial",
  "story",
  "profile",
  "interview",
]);

function getStructuredPromptInstruction(mode) {
  return mode === "toon"
    ? "Structured context may appear in TOON format. Read fields, arrays, and rows directly."
    : "Structured context may appear in compact JSON format. Read fields, arrays, and objects directly.";
}

function stringifyStructuredValue(value, mode) {
  return mode === "toon" ? encodeToon(value) : JSON.stringify(value);
}

function serializeStructuredPromptBlock(label, value, mode) {
  return `### ${label} [${mode.toUpperCase()}]\n${stringifyStructuredValue(value, mode)}`;
}

function normalizeArticleType(articleType) {
  return articleType?.trim().toLowerCase() ?? "";
}

function buildContentPrompt(body, mode = "toon") {
  const linkingStrategy = [];
  if (body.externalLinking) {
    linkingStrategy.push("Strategic external link integration for authority building and user value");
  }
  if (body.internalLinking) {
    linkingStrategy.push("Comprehensive internal linking architecture for SEO optimization and user journey enhancement");
  }

  const currentDate = new Date().toISOString().slice(0, 10);
  const currentYear = new Date().getUTCFullYear();
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
    body.internalLinking && (body.useCrawledUrlsAsInternalLinks ?? true) ? (body.existingPages ?? []) : [];
  const configuredInternal = body.internalLinking ? (body.internalLinks ?? []) : [];
  const allInternal = [...crawledInternal, ...configuredInternal];

  const existingPagesNote =
    allInternal.length > 0
      ? `\n\n${serializeStructuredPromptBlock(
          "Internal links – you MUST use these (crawled site pages)",
          allInternal.slice(0, 20).map((page) => ({
            title: page.title,
            url: page.url,
          })),
          mode
        )}\nMANDATORY: Include at least ${SEO_TARGETS.minimumInternalLinks} internal links from this list. Use markdown format [anchor text](url). Weave them naturally into relevant sections. Do not skip linking.`
      : "";

  const publishedNote =
    body.publishedArticles && body.publishedArticles.length > 0
      ? `\n\n${serializeStructuredPromptBlock(
          "Published articles – link to these when relevant",
          body.publishedArticles.slice(0, 12).map((page) => ({
            title: page.title,
            url: page.url,
          })),
          mode
        )}\nInclude links to relevant published articles where they add value.`
      : "";

  const languageNote =
    body.language && body.language !== "en"
      ? `\n- **Output Language**: Write the ENTIRE article in ${body.language.toUpperCase()}. All content, headings, and body text must be in this language.`
      : "";

  const normalizedArticleType = normalizeArticleType(body.articleType);
  const shouldUseLeadBoxes = !ARTICLE_TYPES_WITHOUT_LEAD_BOXES.has(normalizedArticleType);
  const shouldRequireKeyTakeaways =
    shouldUseLeadBoxes && (body.length === "Long" || body.length === "Ultra-long");
  const shouldRequireTableOfContents =
    shouldUseLeadBoxes &&
    (body.length === "Long" ||
      body.length === "Ultra-long" ||
      ["guide", "how-to", "tutorial", "comparison", "explainer", "report", "research", "analysis", "case-study"].includes(
        normalizedArticleType
      ));

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

  const contextBlock = serializeStructuredPromptBlock(
    "Article context",
    {
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
    },
    mode
  );

  const targetWordCount =
    body.length === "Short" ? 1000 : body.length === "Medium" ? 1500 : body.length === "Ultra-long" ? 2500 : 1800;

  return `# Article Writing Brief

Write a high-quality article in markdown.

## Context
${getStructuredPromptInstruction(mode)}
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
- Body organized into distinct \`## H2\` sections. Use \`### H3\` for subsections within each H2. Avoid long unbroken paragraphs without subheadings.
- Practical examples, evidence, or comparisons where useful
- Structure the article in a way that matches the article type instead of forcing one generic template
- MANDATORY: Include at least one markdown bullet list (using \`-\` or \`*\`) or numbered list (using \`1. 2. 3.\`) in the article body. Place it in a relevant section.
- Include one FAQ section with question-style subheadings whenever the topic supports it
- When you include FAQs, format them as real markdown headings, not plain text. Use either \`## FAQ\` or \`## Frequently Asked Questions\`, then \`### Question?\` subheadings.
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

function getEnv(name, fallback = "") {
  return process.env[name] ?? fallback;
}

const provider =  "nvidia";
const model =  "openai/gpt-oss-120b";
const apiKey = getEnv("API_KEY", process.env.API_KEY);
const structuredMode = getEnv("STRUCTURED_MODE", "toon").toLowerCase() === "json" ? "json" : "toon";
const temperature = Number(getEnv("TEMPERATURE", "0.25"));
const topP = Number(getEnv("TOP_P", "0.9"));
const showReasoning = getEnv("SHOW_REASONING", "1") !== "0";
const enableThinking = getEnv("ENABLE_THINKING", "0") === "1";
const clearThinking = getEnv("CLEAR_THINKING", "0") === "1";
const maxTokensRaw = getEnv("MAX_TOKENS", "");
const maxTokens = maxTokensRaw ? Number(maxTokensRaw) : null;

if (!apiKey) {
  throw new Error("Missing API_KEY environment variable.");
}

if (provider !== "nvidia") {
  throw new Error("This test script currently supports PROVIDER=nvidia only.");
}

const input = {
  keyword: "difficulty passing florida driving test",
  category: "Dmv Test Prep Guides",
  targetAudience: "Decision-makers and buyers evaluating solutions",
  title: "Mastering the Florida Road Test: Common Failures and How to Avoid Them",
  length: "Ultra-long",
  style: "Analytical",
  tone: "Conversational",
  readingLevel: "Intermediate",
  contentIntent: "sell",
  internalLinking: true,
  useCrawledUrlsAsInternalLinks: true,
  requireInfographics: true,
  existingPages: [
    { url: "https://xdrivingtests.com", title: "XDriving Tests — DMV & State Guides" },
    { url: "https://xdrivingtests.com/florida", title: "Florida | XDriving Tests" },
    { url: "https://xdrivingtests.com/georgia", title: "Georgia | XDriving Tests" },
    { url: "https://xdrivingtests.com/hawaii", title: "Hawaii | XDriving Tests" },
    { url: "https://xdrivingtests.com/idaho", title: "Idaho | XDriving Tests" },
    { url: "https://xdrivingtests.com/illinois", title: "Illinois | XDriving Tests" },
    { url: "https://xdrivingtests.com/indiana", title: "Indiana | XDriving Tests" },
    { url: "https://xdrivingtests.com/iowa", title: "Iowa | XDriving Tests" },
    { url: "https://xdrivingtests.com/kansas", title: "Kansas | XDriving Tests" },
    { url: "https://xdrivingtests.com/kentucky", title: "Kentucky | XDriving Tests" },
  ],
  publishedArticles: [],
  internalLinks: [],
  externalLinking: true,
  articleFormat: "blog",
  pointOfView: "third-person",
  contentFreshness: "Evergreen",
  includeSubtopics: true,
  socialMediaOptimization: true,
  language: "en",
  articleType: "comparison",
  geoFocus: "Florida, United States",
  customInstructions:
    "Prioritize SEO-safe structure: unique headings, FAQ coverage when relevant, strong list formatting, concise paragraphs, and a conclusion that satisfies the project SEO rules.\n\nInfographic concepts from calendar: Top 10 Reasons Drivers Fail the Florida Road Test, Visual Guide to Proper Parallel Parking Angles in Florida, Decision Tree: What to Do When Approaching a 4-Way Stop",
  secondaryKeywords: [
    "florida road test guide",
    "driving test tips",
    "florida driving conditions",
    "how to pass dmv test",
  ],
};

const systemPrompt =
  `You are a senior editorial writer. Follow the prompt exactly, stay compliant with all requirements, and output publication-ready markdown only. ${getStructuredPromptInstruction(structuredMode)}`;

const userPrompt = buildContentPrompt(input, structuredMode);

console.error("=== CONFIG ===");
console.error(
  JSON.stringify(
    { provider, model, structuredMode, temperature, topP, enableThinking, clearThinking, maxTokens, showReasoning },
    null,
    2
  )
);
console.error("\n=== SYSTEM PROMPT ===\n");
console.error(systemPrompt);
console.error("\n=== USER PROMPT ===\n");
console.error(userPrompt);
console.error("\n=== STREAMED OUTPUT ===\n");

const startedAt = Date.now();
let lastVisibleOutputAt = null;
let waitingHeartbeat = null;

waitingHeartbeat = setInterval(() => {
  if (lastVisibleOutputAt !== null) return;
  console.error(`[waiting ${(Date.now() - startedAt) / 1000}s] no visible reasoning/content tokens yet`);
}, 5000);

const response = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model,
    stream: true,
    temperature,
    top_p: topP,
    ...(maxTokens !== null ? { max_tokens: maxTokens } : {}),
    ...(enableThinking || clearThinking
      ? {
          chat_template_kwargs: {
            enable_thinking: enableThinking,
            clear_thinking: clearThinking,
          },
        }
      : {}),
    stream_options: { include_usage: true },
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  }),
});

if (!response.ok || !response.body) {
  const text = await response.text();
  throw new Error(`Provider request failed: ${response.status} ${text}`);
}

const reader = response.body.getReader();
const decoder = new TextDecoder();
let buffer = "";
let firstTokenAt = null;
let firstReasoningAt = null;
let firstContentAt = null;

while (true) {
  const { value, done } = await reader.read();
  buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });

  const lines = buffer.split("\n");
  buffer = lines.pop() ?? "";

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) continue;

    const data = trimmed.slice(5).trim();
    if (data === "[DONE]") {
      console.error(`\n\n[DONE] total ${((Date.now() - startedAt) / 1000).toFixed(2)}s`);
      process.exit(0);
    }

    try {
      const json = JSON.parse(data);
      const delta = json.choices?.[0]?.delta?.content ?? "";
      const reasoning = json.choices?.[0]?.delta?.reasoning_content ?? "";

      if (!delta && !reasoning) continue;

      if (firstTokenAt === null) {
        firstTokenAt = Date.now();
        lastVisibleOutputAt = firstTokenAt;
        console.error(`\n[first visible token in ${((firstTokenAt - startedAt) / 1000).toFixed(2)}s]\n`);
      }

      if (reasoning && showReasoning) {
        if (firstReasoningAt === null) {
          firstReasoningAt = Date.now();
          console.error(`\n[first reasoning token in ${((firstReasoningAt - startedAt) / 1000).toFixed(2)}s]\n`);
        }
        lastVisibleOutputAt = Date.now();
        process.stdout.write(reasoning);
      }

      if (delta) {
        if (firstContentAt === null) {
          firstContentAt = Date.now();
          console.error(`\n[first content token in ${((firstContentAt - startedAt) / 1000).toFixed(2)}s]\n`);
        }
        lastVisibleOutputAt = Date.now();
        process.stdout.write(delta);
      }
    } catch {
      // Ignore keepalives and non-standard chunks.
    }
  }

  if (done) break;
}

if (waitingHeartbeat) {
  clearInterval(waitingHeartbeat);
}
