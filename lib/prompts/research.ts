import type { ResearchPromptParams } from "./types";
import {
  getStructuredPromptInstruction,
  serializeStructuredPromptBlock,
} from "./toon";
import { SEO_RULES_PROMPT_BLOCK } from "@/lib/seo-rules";

export function buildResearchPrompt(body: ResearchPromptParams): string {
  const currentDate = new Date().toISOString().slice(0, 10);
  const currentYear = new Date().getUTCFullYear();
  const articleTypeNote = body.articleType
    ? `\n- Article type: ${body.articleType}`
    : "";
  const intentNote = body.contentIntent
    ? `\n- Content intent: ${body.contentIntent}`
    : "";
  const contextBlock = serializeStructuredPromptBlock("Research context", {
    topic: body.keyword,
    contextDate: currentDate,
    contextYear: currentYear,
    sourceUrl: body.url ?? null,
    category: body.category,
    geoFocus: body.geoFocus,
    audience: body.targetAudience,
    articleType: body.articleType ?? null,
    contentIntent: body.contentIntent ?? null,
    freshnessPreference: body.contentFreshness ?? "Current, reliable information",
    includeTrendingTopics: body.includeTrendingTopics ?? false,
    domainKnowledge: body.domainKnowledge?.trim() || null,
  });

  return `# Research Brief

Produce a professional markdown research brief that supports high-quality article creation.

## Context
${getStructuredPromptInstruction()}
${contextBlock}${articleTypeNote}${intentNote}
- Trending coverage: ${body.includeTrendingTopics ? "Include recent developments when materially relevant" : "Focus on durable, reliable insights"}

## Non-negotiable requirements
${body.customInstructions ? `- ${body.customInstructions}` : "- Stay factual, useful, and domain-appropriate"}
- Avoid filler and generic commentary
- Prioritize information that can directly improve content quality, relevance, and ranking potential
- If uncertain, say so instead of inventing specifics
- Treat years, dates, deadlines, fees, age thresholds, legal requirements, and policy timelines as facts that must be verified or explicitly marked uncertain.
- Gather material that helps the final article satisfy these SEO rules:
${SEO_RULES_PROMPT_BLOCK}

## Required markdown sections
### 1. Executive summary
- 5-8 key takeaways

### 2. Topic fundamentals
- Definition or framing
- Why it matters now
- Important terms, entities, or concepts

### 3. Audience intelligence
- Main pain points
- Main questions
- Search intents
- Decision factors

### 4. Competitive and content gap insights
- What existing content usually covers
- What is under-covered or missing
- Angles worth owning

### 5. Evidence and source guidance
- Useful statistics, claims, or proof points to validate
- Recommended source types to cite
- Any freshness or compliance cautions

### 6. Article strategy recommendations
- Best angle for this audience
- Suggested structure direction
- Recommended supporting examples
- Internal/external evidence ideas
- FAQ ideas, list ideas, and infographic opportunities tied to the topic

### 7. Risks and watchouts
- Sensitive claims
- Overused framing to avoid
- Accuracy or compliance concerns

Keep the response concise but substantive.`;
}
