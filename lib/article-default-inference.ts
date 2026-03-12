import type { ArticleDefaultsConfig } from "@/lib/db/article-defaults";
import type { ProjectSEOInsightRow } from "@/lib/db";
import { chat } from "@/lib/llm";
import { parseSEOInsight } from "@/lib/db/seo-insights";
import { getStructuredPromptInstruction } from "@/lib/prompts/toon";
import { SEO_TARGETS } from "@/lib/seo-rules";

export interface ArticleDefaultsResearchSummary {
  headline: string;
  points: string[];
}

function normalizeTextList(values: string[] | undefined) {
  return (values ?? [])
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .map((value) => value.trim().toLowerCase());
}

function countMatches(haystack: string, patterns: string[]) {
  return patterns.reduce((count, pattern) => count + (haystack.includes(pattern) ? 1 : 0), 0);
}

function countQuestionStarters(questions: string[]) {
  return questions.reduce((count, question) => {
    return /^(how|what|why|when|which|who|can|should|is|are)\b/i.test(question) ? count + 1 : count;
  }, 0);
}

function toLabel(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function normalizeToken(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function getHostnameTokens(homepageUrl?: string | null) {
  if (!homepageUrl) return [];
  try {
    const hostname = new URL(homepageUrl).hostname.toLowerCase().replace(/^www\./, "");
    return hostname
      .split(/[.-]/)
      .map((part) => part.trim())
      .filter((part) => part.length > 2 && !["com", "net", "org", "co", "io", "ai"].includes(part));
  } catch {
    return [];
  }
}

function getBrandTokens(projectName?: string, homepageUrl?: string | null) {
  return [
    ...normalizeToken(projectName ?? "")
      .split(/\s+/)
      .filter((part) => part.length > 2),
    ...getHostnameTokens(homepageUrl),
  ];
}

function looksBrandLike(value: string, brandTokens: string[]) {
  const normalized = normalizeToken(value);
  if (!normalized) return true;
  if (normalized === "general") return true;
  return brandTokens.some((token) => normalized === token || normalized.includes(token) || token.includes(normalized));
}

function pickMeaningfulCategory(
  candidates: string[],
  brandTokens: string[],
  fallback: string
) {
  const genericTerms = new Set([
    "home",
    "blog",
    "news",
    "company",
    "services",
    "solutions",
    "products",
    "general",
  ]);
  const selected = candidates.find((candidate) => {
    const normalized = normalizeToken(candidate);
    if (!normalized || genericTerms.has(normalized)) return false;
    if (looksBrandLike(candidate, brandTokens)) return false;
    return normalized.split(/\s+/).length <= 5;
  });

  return toLabel(selected ?? fallback);
}

function inferGeoFocusFromSignals(corpus: string, homepageUrl?: string | null) {
  const geoPatterns: Array<[RegExp, string]> = [
    [/\bflorida\b/, "Florida, United States"],
    [/\btexas\b/, "Texas, United States"],
    [/\bcalifornia\b/, "California, United States"],
    [/\bnew york\b/, "New York, United States"],
    [/\bunited states\b|\busa\b|\bu\.s\.\b/, "United States"],
    [/\bcanada\b/, "Canada"],
    [/\bunited kingdom\b|\buk\b/, "United Kingdom"],
    [/\baustralia\b/, "Australia"],
    [/\bindia\b/, "India"],
  ];

  for (const [pattern, label] of geoPatterns) {
    if (pattern.test(corpus)) return label;
  }

  if (homepageUrl) {
    try {
      const hostname = new URL(homepageUrl).hostname.toLowerCase();
      if (hostname.endsWith(".co.uk") || hostname.endsWith(".uk")) return "United Kingdom";
      if (hostname.endsWith(".ca")) return "Canada";
      if (hostname.endsWith(".com.au") || hostname.endsWith(".au")) return "Australia";
      if (hostname.endsWith(".in")) return "India";
    } catch {
      return "Global";
    }
  }

  return "Global";
}

function normalizeStringField(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function normalizeBooleanField(value: unknown) {
  return typeof value === "boolean" ? value : undefined;
}

function normalizeNumberField(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function normalizeTypedField<T extends string>(value: unknown) {
  return (typeof value === "string" && value.trim() ? value.trim() : undefined) as T | undefined;
}

function parseAiDefaults(raw: unknown): ArticleDefaultsConfig {
  const source = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    category: normalizeStringField(source.category),
    targetAudience: normalizeStringField(source.targetAudience),
    geoFocus: normalizeStringField(source.geoFocus),
    articleType: normalizeStringField(source.articleType),
    articleFormat: normalizeStringField(source.articleFormat),
    tone: normalizeStringField(source.tone),
    style: normalizeStringField(source.style),
    readingLevel: normalizeStringField(source.readingLevel),
    length: normalizeStringField(source.length),
    targetWordCount: normalizeNumberField(source.targetWordCount),
    contentIntent: normalizeTypedField<NonNullable<ArticleDefaultsConfig["contentIntent"]>>(source.contentIntent),
    contentFreshness: normalizeStringField(source.contentFreshness),
    pointOfView: normalizeTypedField<NonNullable<ArticleDefaultsConfig["pointOfView"]>>(source.pointOfView),
    citationStyle: normalizeTypedField<NonNullable<ArticleDefaultsConfig["citationStyle"]>>(source.citationStyle),
    includeSubtopics: normalizeBooleanField(source.includeSubtopics),
    internalLinking: normalizeBooleanField(source.internalLinking),
    useCrawledUrlsAsInternalLinks: normalizeBooleanField(source.useCrawledUrlsAsInternalLinks),
    externalLinking: normalizeBooleanField(source.externalLinking),
    socialMediaOptimization: normalizeBooleanField(source.socialMediaOptimization),
    requireInfographics: normalizeBooleanField(source.requireInfographics),
    customInstructions: normalizeStringField(source.customInstructions),
    domainKnowledge: normalizeStringField(source.domainKnowledge),
    contentIdeaCustomInstructions: normalizeStringField(source.contentIdeaCustomInstructions),
  };
}

function inferTargetAudience({
  technicalScore,
  commercialScore,
  productsServices,
  questionCount,
}: {
  technicalScore: number;
  commercialScore: number;
  productsServices: string[];
  questionCount: number;
}) {
  if (technicalScore >= 5) {
    return "Technical practitioners and implementation teams";
  }
  if (commercialScore >= 5 || productsServices.length >= 3) {
    return "Decision-makers and buyers evaluating solutions";
  }
  if (questionCount >= 4) {
    return "Readers actively researching the topic";
  }
  return "General audience interested in the topic";
}

export function inferArticleDefaultsFromSEOInsight(
  row: ProjectSEOInsightRow | null,
  context?: { projectName?: string; homepageUrl?: string | null }
): ArticleDefaultsConfig | null {
  const insight = parseSEOInsight(row);
  if (!insight) return null;

  const topics = normalizeTextList(insight.topics);
  const keywords = normalizeTextList(insight.keywords);
  const questions = normalizeTextList(insight.reference.questions);
  const painPoints = normalizeTextList(insight.reference.painPoints);
  const contentAngles = normalizeTextList(insight.reference.contentAngles);
  const searchIntents = normalizeTextList(insight.reference.searchIntents);
  const productsServices = normalizeTextList(insight.reference.productsServices);
  const entities = normalizeTextList(insight.reference.entities);
  const summary = typeof insight.summary === "string" ? insight.summary.toLowerCase() : "";

  const corpus = [
    ...topics,
    ...keywords,
    ...questions,
    ...painPoints,
    ...contentAngles,
    ...searchIntents,
    ...productsServices,
    ...entities,
    summary,
  ]
    .filter(Boolean)
    .join(" ");

  if (!corpus.trim()) return null;

  const brandTokens = getBrandTokens(context?.projectName, context?.homepageUrl);

  const questionCount = questions.length;
  const questionStarterScore = countQuestionStarters(questions);
  const technicalScore =
    countMatches(corpus, [
      "api",
      "sdk",
      "integration",
      "developer",
      "developers",
      "engineering",
      "framework",
      "platform",
      "implementation",
      "workflow",
      "automation",
      "technical",
      "code",
      "software",
    ]) + (entities.length >= 8 ? 1 : 0);
  const commercialScore =
    countMatches(corpus, [
      "pricing",
      "cost",
      "quote",
      "service",
      "services",
      "solution",
      "solutions",
      "agency",
      "provider",
      "company",
      "software",
      "platform",
      "tool",
      "tools",
      "best",
      "vs",
      "versus",
      "alternative",
      "alternatives",
      "compare",
      "comparison",
      "buyer",
      "buyers",
      "demo",
      "trial",
    ]) + (productsServices.length >= 3 ? 2 : 0);
  const newsScore = countMatches(corpus, [
    "news",
    "latest",
    "update",
    "updates",
    "announcement",
    "announcements",
    "trend",
    "trends",
    "breaking",
    "current",
  ]);
  const researchScore = countMatches(corpus, [
    "research",
    "report",
    "analysis",
    "analytics",
    "benchmark",
    "statistics",
    "data",
    "study",
    "findings",
    "forecast",
    "market",
  ]);
  const educationalScore =
    questionStarterScore +
    countMatches(corpus, [
      "guide",
      "tutorial",
      "how to",
      "how-to",
      "learn",
      "explainer",
      "education",
      "educate",
      "best practices",
      "checklist",
      "step-by-step",
    ]);

  let articleType: ArticleDefaultsConfig["articleType"] = "guide";
  if (newsScore >= 3) {
    articleType = "news";
  } else if (researchScore >= 5) {
    articleType = "research";
  } else if (commercialScore >= 6 && countMatches(corpus, ["compare", "comparison", "vs", "versus", "alternative"]) >= 1) {
    articleType = "comparison";
  } else if (technicalScore >= 5 && questionCount >= 2) {
    articleType = "tutorial";
  } else if (educationalScore >= 5 || questionCount >= 4) {
    articleType = "how-to";
  } else if (commercialScore >= 4 && productsServices.length >= 2) {
    articleType = "guide";
  }

  let articleFormat: ArticleDefaultsConfig["articleFormat"] = "blog";
  if (articleType === "news") {
    articleFormat = "news";
  } else if (researchScore >= 8 && commercialScore >= 5) {
    articleFormat = "whitepaper";
  } else if (researchScore >= 6) {
    articleFormat = "report";
  } else if (commercialScore >= 7 && educationalScore <= 3) {
    articleFormat = "landing-page";
  }

  let tone: ArticleDefaultsConfig["tone"] = "Professional";
  if (articleType === "news") {
    tone = "Journalistic";
  } else if (technicalScore >= 4 || researchScore >= 4) {
    tone = "Authoritative";
  } else if (questionCount >= 4) {
    tone = "Conversational";
  }

  let style: ArticleDefaultsConfig["style"] = "Informative";
  if (articleType === "tutorial" || articleType === "how-to") {
    style = "Instructional";
  } else if (researchScore >= 4) {
    style = "Data-driven";
  } else if (commercialScore >= 6 && productsServices.length > 0) {
    style = "Analytical";
  }

  let readingLevel: ArticleDefaultsConfig["readingLevel"] = "Intermediate";
  if (technicalScore >= 6) {
    readingLevel = "Technical";
  } else if (technicalScore >= 4 || researchScore >= 4) {
    readingLevel = "Advanced";
  }

  let length: ArticleDefaultsConfig["length"] = "Long";
  if (technicalScore >= 5 || researchScore >= 5 || questionCount >= 6) {
    length = "Ultra-long";
  } else if (newsScore >= 4) {
    length = "Short";
  }

  let contentIntent: ArticleDefaultsConfig["contentIntent"] = "inform";
  if (commercialScore >= 7 && productsServices.length >= 2) {
    contentIntent = "sell";
  } else if (questionCount >= 3 || educationalScore >= 5) {
    contentIntent = "educate";
  }

  const inferred: ArticleDefaultsConfig = {
    category: pickMeaningfulCategory(
      [...productsServices, ...topics, ...contentAngles, ...keywords, ...entities],
      brandTokens,
      topics[0] ?? productsServices[0] ?? "General"
    ),
    targetAudience: inferTargetAudience({
      technicalScore,
      commercialScore,
      productsServices,
      questionCount,
    }),
    geoFocus: inferGeoFocusFromSignals(corpus, context?.homepageUrl),
    articleType,
    articleFormat,
    tone,
    style,
    readingLevel,
    length,
    targetWordCount:
      length === "Short"
        ? 1000
        : length === "Ultra-long"
          ? Math.max(2200, SEO_TARGETS.minimumWordCount + 700)
          : Math.max(1800, SEO_TARGETS.minimumWordCount),
    contentIntent,
    contentFreshness: newsScore >= 3 ? "Last month" : "Evergreen",
    pointOfView:
      articleType === "tutorial" || articleType === "how-to"
        ? "second-person"
        : "third-person",
    citationStyle: researchScore >= 4 ? "inline" : undefined,
    includeSubtopics:
      length === "Long" ||
      length === "Ultra-long" ||
      articleType === "guide" ||
      articleType === "research",
    internalLinking: true,
    useCrawledUrlsAsInternalLinks: true,
    externalLinking: researchScore >= 3 || technicalScore >= 4 || commercialScore >= 5,
    socialMediaOptimization: true,
    requireInfographics: articleType !== "news",
    customInstructions:
      "Prioritize SEO-safe structure: unique headings, FAQ coverage when relevant, strong list formatting, concise paragraphs, and a conclusion that satisfies the project SEO rules.",
    domainKnowledge:
      insight.summary?.trim() ||
      [topics[0], productsServices[0], contentAngles[0]].filter(Boolean).join(". ") ||
      undefined,
  };

  return inferred;
}

export function needsAiDefaultsRefresh(
  config: ArticleDefaultsConfig | null | undefined,
  context?: { projectName?: string; homepageUrl?: string | null }
) {
  if (!config) return true;
  const brandTokens = getBrandTokens(context?.projectName, context?.homepageUrl);
  return (
    !config.category ||
    looksBrandLike(config.category, brandTokens) ||
    !config.geoFocus ||
    !config.targetAudience ||
    !config.articleType ||
    !config.articleFormat ||
    !config.length
  );
}

export async function inferArticleDefaultsFromSEOInsightWithAI(args: {
  row: ProjectSEOInsightRow | null;
  projectName?: string;
  homepageUrl?: string | null;
  existingDefaults?: ArticleDefaultsConfig | null;
  projectId?: string | null;
}): Promise<ArticleDefaultsConfig | null> {
  const { row, projectName, homepageUrl, existingDefaults, projectId } = args;
  const insight = parseSEOInsight(row);
  const heuristic = inferArticleDefaultsFromSEOInsight(row, { projectName, homepageUrl });
  if (!insight) return heuristic;

  const prompt = `Infer the best site-wide article content defaults from crawl-extracted SEO data.

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
  "customInstructions": "short SEO-safe site-wide writing instruction",
  "domainKnowledge": "2-4 sentence summary of what this site does, its niche, audience, products/services—derived from crawl data",
  "contentIdeaCustomInstructions": "1-2 sentence instructions for content idea/calendar generation (e.g. prefer how-to topics, focus on product comparisons, avoid news)"
}

Rules:
- Figure out what kind of site this is from the crawl data.
- Category must describe the site's real subject area or service area, not the brand name, domain name, or homepage label.
- Geo focus must not be empty. Use a specific region when the site is geographically focused, otherwise use "Global".
- Pick the single best default article type for this site, not a random one.
- Prefer defaults that help produce SEO-safe, helpful articles for this site's likely audience.
- If the site appears local or regional, reflect that in geoFocus and audience.
- Keep customInstructions under 35 words.
- domainKnowledge: Write 2-4 concise sentences describing what this site does, its niche, target audience, and key products/services. Use only information from the crawl data. This will be used throughout article and idea generation.
- contentIdeaCustomInstructions: Infer 1-2 sentence instructions for content calendar/idea generation based on crawl signals. E.g. "Prioritize how-to and tutorial topics" for question-heavy sites, "Focus on product comparisons and decision guides" for commercial sites, "Prefer evergreen guides over news" for educational sites. Use only crawl-derived signals.
- Do not leave important fields blank.

Project:
- Project name: ${projectName ?? "Unknown"}
- Homepage URL: ${homepageUrl ?? "Unknown"}

Current heuristic recommendation:
${JSON.stringify(heuristic ?? {}, null, 2)}

Existing saved defaults:
${JSON.stringify(existingDefaults ?? {}, null, 2)}

Extracted SEO summary:
${insight.summary ?? "No summary"}

Topics:
${JSON.stringify(insight.topics.slice(0, 20))}

Keywords:
${JSON.stringify(insight.keywords.slice(0, 30))}

Reference signals:
${JSON.stringify(
    {
      entities: insight.reference.entities.slice(0, 20),
      questions: insight.reference.questions.slice(0, 20),
      painPoints: insight.reference.painPoints.slice(0, 20),
      contentAngles: insight.reference.contentAngles.slice(0, 20),
      searchIntents: insight.reference.searchIntents.slice(0, 12),
      productsServices: insight.reference.productsServices.slice(0, 20),
    },
    null,
    2
  )}`;

  try {
    const result = await chat(
      [
        {
          role: "system",
          content:
            `You are a senior SEO strategist and content systems planner. Infer strong site-wide content defaults and return valid JSON only. ${getStructuredPromptInstruction()}`,
        },
        { role: "user", content: prompt },
      ],
      undefined,
      {
        requestLabel: "article-defaults-inference",
        temperature: 0.1,
        maxOutputTokens: 1200,
        responseFormat: "json",
        projectId: projectId ?? null,
      }
    );
    const aiDefaults = parseAiDefaults(JSON.parse(result.content ?? "{}"));
    return {
      ...(heuristic ?? {}),
      ...aiDefaults,
      category: aiDefaults.category && !looksBrandLike(aiDefaults.category, getBrandTokens(projectName, homepageUrl))
        ? aiDefaults.category
        : heuristic?.category,
      geoFocus: aiDefaults.geoFocus ?? heuristic?.geoFocus ?? "Global",
    };
  } catch {
    return heuristic;
  }
}

export function buildArticleDefaultsResearchSummary(args: {
  row: ProjectSEOInsightRow | null;
  config: ArticleDefaultsConfig | null | undefined;
  projectName?: string;
  homepageUrl?: string | null;
}): ArticleDefaultsResearchSummary | null {
  const { row, config, projectName, homepageUrl } = args;
  const insight = parseSEOInsight(row);
  if (!insight || !config) return null;

  const brandTokens = getBrandTokens(projectName, homepageUrl);
  const candidateTopics = [...insight.topics, ...insight.reference.productsServices, ...insight.reference.contentAngles]
    .map((item) => item.trim())
    .filter((item) => item.length > 0 && !looksBrandLike(item, brandTokens))
    .slice(0, 3);
  const candidateQuestions = insight.reference.questions.slice(0, 2);
  const candidatePainPoints = insight.reference.painPoints.slice(0, 2);

  const points: string[] = [];

  if (config.category) {
    const support = candidateTopics.length > 0
      ? `because the crawled content clusters around ${candidateTopics.join(", ")}`
      : "because that best matches the strongest repeated topics across the site";
    points.push(`Category is set to ${config.category} ${support}.`);
  }

  if (config.articleType) {
    const support =
      config.articleType === "how-to" || config.articleType === "tutorial" || config.articleType === "guide"
        ? candidateQuestions.length > 0
          ? `since the site surfaces question-led search demand like ${candidateQuestions.join(" and ")}`
          : "because the site appears to benefit most from practical, search-friendly educational content"
        : config.articleType === "comparison"
          ? "because the extracted signals suggest decision-stage and evaluation intent"
          : config.articleType === "research"
            ? "because the site content leans on data, analysis, and evidence-backed positioning"
            : "because it best fits the dominant search intent found across the site";
    points.push(`Default article type is ${config.articleType} ${support}.`);
  }

  if (config.targetAudience) {
    const support = candidatePainPoints.length > 0
      ? `This matches the pain points repeatedly hinted at in the crawl, such as ${candidatePainPoints.join(" and ")}.`
      : "This reflects the likely reader profile implied by the site's topics, services, and search intent.";
    points.push(`Target audience is ${config.targetAudience}. ${support}`);
  }

  if (config.geoFocus) {
    const geoReason =
      config.geoFocus === "Global"
        ? "No strong local-only pattern was detected, so the defaults stay broad."
        : "Location-specific signals in the crawled content suggest a focused regional audience.";
    points.push(`Geo focus is ${config.geoFocus}. ${geoReason}`);
  }

  if (config.length && config.targetWordCount) {
    points.push(
      `Content length is tuned to ${config.length.toLowerCase()} articles at roughly ${config.targetWordCount} words so the site can cover topics thoroughly enough to compete in search.`
    );
  }

  return {
    headline:
      "These content defaults are the strongest site-fit settings based on the crawled pages, extracted search signals, and the content patterns most likely to perform well here.",
    points: points.slice(0, 4),
  };
}
