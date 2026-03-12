import { v4 as uuid } from "uuid";
import { getDb } from "@/lib/db";
import { buildKeywordExtractionPrompt } from "@/lib/prompts/keyword-extraction";
import { getStructuredPromptInstruction } from "@/lib/prompts/toon";
import { chat } from "@/lib/llm";
import { saveProjectSEOInsight, type SEOReference } from "@/lib/db/seo-insights";

type ExtractionPage = {
  url: string;
  title: string | null;
  meta_description: string | null;
  content_preview: string | null;
};

export interface SEOExtractionResult {
  keywords: string[];
  topics: string[];
  summary: string;
  reference: SEOReference;
  batchCount: number;
}

export interface SEOExtractionOptions {
  crawlJobId?: string | null;
  maxKeywords?: number;
  save?: boolean;
  onBatchProgress?: (progress: { completedBatches: number; totalBatches: number; keywordsFound: number }) => Promise<void> | void;
  shouldStop?: () => Promise<"continue" | "pause" | "cancel"> | "continue" | "pause" | "cancel";
}

interface ParsedExtractionResponse {
  valid: boolean;
  parseError: string | null;
  topics: string[];
  keywords: string[];
  entities: string[];
  questions: string[];
  painPoints: string[];
  contentAngles: string[];
  searchIntents: string[];
  productsServices: string[];
  summary: string;
}

const BATCH_SIZE = 12;
const EXTRACTION_DELAY_MS = 1500;
const EXTRACTION_MAX_ATTEMPTS = 3;
const EXTRACTION_REPAIR_SOURCE_LIMIT = 4000;

export async function extractSEOInsights(
  projectId: string,
  homepageUrl: string,
  pages: ExtractionPage[],
  options: SEOExtractionOptions = {}
): Promise<SEOExtractionResult> {
  const maxKeywords = options.maxKeywords ?? 100;
  const totalBatches = Math.max(1, Math.ceil(pages.length / BATCH_SIZE));
  const allKeywords = new Set<string>();
  const allTopics = new Set<string>();
  const allEntities = new Set<string>();
  const allQuestions = new Set<string>();
  const allPainPoints = new Set<string>();
  const allContentAngles = new Set<string>();
  const allSearchIntents = new Set<string>();
  const allProductsServices = new Set<string>();
  const summaries: string[] = [];

  for (let i = 0; i < pages.length; i += BATCH_SIZE) {
    const control = await options.shouldStop?.();
    if (control === "pause") {
      throw new Error("CRAWL_PAUSED");
    }
    if (control === "cancel") {
      throw new Error("CRAWL_CANCELLED");
    }

    const batch = pages.slice(i, i + BATCH_SIZE);
    const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
    const targetKeywords = Math.max(6, Math.ceil(maxKeywords / totalBatches));
    const parsed = await extractBatchWithRetry({
      projectId,
      homepageUrl,
      batch,
      batchNumber,
      totalBatches,
      targetKeywords,
    });
    parsed.keywords.forEach((keyword) => allKeywords.add(keyword));
    parsed.topics.forEach((topic) => allTopics.add(topic));
    parsed.entities.forEach((entity) => allEntities.add(entity));
    parsed.questions.forEach((question) => allQuestions.add(question));
    parsed.painPoints.forEach((painPoint) => allPainPoints.add(painPoint));
    parsed.contentAngles.forEach((angle) => allContentAngles.add(angle));
    parsed.searchIntents.forEach((intent) => allSearchIntents.add(intent));
    parsed.productsServices.forEach((item) => allProductsServices.add(item));
    if (parsed.summary) summaries.push(parsed.summary);

    if (process.env.NODE_ENV !== "test") {
      console.log(
        `[SEO] Parsed batch ${batchNumber}/${totalBatches}: topics=${parsed.topics.length}, keywords=${parsed.keywords.length}, entities=${parsed.entities.length}, questions=${parsed.questions.length}, painPoints=${parsed.painPoints.length}, intents=${parsed.searchIntents.length}, products=${parsed.productsServices.length}, summary=${parsed.summary ? "yes" : "no"}`
      );
      if (
        parsed.topics.length === 0 &&
        parsed.keywords.length === 0 &&
        parsed.entities.length === 0 &&
        parsed.questions.length === 0 &&
        parsed.painPoints.length === 0 &&
        parsed.contentAngles.length === 0 &&
        parsed.searchIntents.length === 0 &&
        parsed.productsServices.length === 0 &&
        !parsed.summary
      ) {
        console.warn(
          `[SEO] Batch ${batchNumber}/${totalBatches} completed but returned no structured extraction data.`
        );
      }
    }

    const completedBatches = batchNumber;
    await options.onBatchProgress?.({
      completedBatches,
      totalBatches,
      keywordsFound: allKeywords.size,
    });

    if (completedBatches < totalBatches) {
      await delay(EXTRACTION_DELAY_MS);
    }
  }

  const keywords = [...allKeywords].slice(0, maxKeywords);
  const topics = [...allTopics].slice(0, 20);
  const summary = summaries[0] ?? "";
  const reference: SEOReference = {
    entities: [...allEntities].slice(0, 30),
    questions: [...allQuestions].slice(0, 30),
    painPoints: [...allPainPoints].slice(0, 20),
    contentAngles: [...allContentAngles].slice(0, 24),
    searchIntents: [...allSearchIntents].slice(0, 12),
    productsServices: [...allProductsServices].slice(0, 24),
  };

  if (options.save !== false) {
    persistSEOInsights(projectId, options.crawlJobId ?? null, {
      keywords,
      topics,
      summary,
      reference,
      batchCount: totalBatches,
    });
  }

  if (process.env.NODE_ENV !== "test") {
    console.log(
      `[SEO] Final merged extraction for project ${projectId}: topics=${topics.length}, keywords=${keywords.length}, entities=${reference.entities.length}, questions=${reference.questions.length}, painPoints=${reference.painPoints.length}, intents=${reference.searchIntents.length}, products=${reference.productsServices.length}, summary=${summary ? "yes" : "no"}`
    );
  }

  return {
    keywords,
    topics,
    summary,
    reference,
    batchCount: totalBatches,
  };
}

async function extractBatchWithRetry({
  projectId,
  homepageUrl,
  batch,
  batchNumber,
  totalBatches,
  targetKeywords,
}: {
  projectId: string;
  homepageUrl: string;
  batch: ExtractionPage[];
  batchNumber: number;
  totalBatches: number;
  targetKeywords: number;
}) {
  let lastParsed = emptyParsedExtraction();

  for (let attempt = 1; attempt <= EXTRACTION_MAX_ATTEMPTS; attempt += 1) {
    const reducedKeywords =
      attempt === 1 ? targetKeywords : Math.max(6, Math.min(targetKeywords, 10 - (attempt - 2) * 2));
    const retryInstruction =
      attempt === 1
        ? ""
        : `\n\nIMPORTANT RETRY INSTRUCTION:\nYour previous response was invalid or truncated JSON. Return FEWER items so the response stays short and complete.\nCap output to: topics <= 6, keywords <= ${reducedKeywords}, entities/questions/painPoints/contentAngles/productsServices <= 6 each, searchIntents <= 4, summary <= 1 sentence. Output one complete JSON object only.`;
    const prompt = `${buildKeywordExtractionPrompt({
      homepageUrl,
      pages: batch,
      maxKeywords: reducedKeywords,
    })}${retryInstruction}`;

    if (process.env.NODE_ENV !== "test") {
      console.log(
        `[SEO] Starting extraction batch ${batchNumber}/${totalBatches}, attempt ${attempt}/${EXTRACTION_MAX_ATTEMPTS}, maxKeywords=${reducedKeywords}, pages=${batch
          .map((page) => page.url)
          .join(", ")}`
      );
    }

    const result = await chat(
      [
        {
          role: "system",
          content:
            `You are an SEO strategist. Extract structured SEO research signals for planning future content. Return only valid JSON. ${getStructuredPromptInstruction()}`,
        },
        { role: "user", content: prompt },
      ],
      undefined,
      {
        requestLabel: `seo-batch-${batchNumber}-attempt-${attempt}`,
        projectId,
        temperature: 0,
        maxOutputTokens: null,
        responseFormat: "json",
        enableThinking: false,
      }
    );

    const rawContent = result.content?.trim() ?? "{}";
    if (process.env.NODE_ENV !== "test") {
      console.log(
        `[SEO] Raw response for batch ${batchNumber}/${totalBatches}, attempt ${attempt}: ${rawContent.slice(0, 600)}`
      );
    }

    const parsed = parseExtractionResponse(rawContent);
    lastParsed = parsed;

    if (process.env.NODE_ENV !== "test") {
      console.log(
        `[SEO] Parsed batch ${batchNumber}/${totalBatches}, attempt ${attempt}: topics=${parsed.topics.length}, keywords=${parsed.keywords.length}, entities=${parsed.entities.length}, questions=${parsed.questions.length}, painPoints=${parsed.painPoints.length}, intents=${parsed.searchIntents.length}, products=${parsed.productsServices.length}, summary=${parsed.summary ? "yes" : "no"}, valid=${parsed.valid ? "yes" : "no"}`
      );
    }

    if (parsed.valid) {
      if (
        process.env.NODE_ENV !== "test" &&
        parsed.topics.length === 0 &&
        parsed.keywords.length === 0 &&
        parsed.entities.length === 0 &&
        parsed.questions.length === 0 &&
        parsed.painPoints.length === 0 &&
        parsed.contentAngles.length === 0 &&
        parsed.searchIntents.length === 0 &&
        parsed.productsServices.length === 0 &&
        !parsed.summary
      ) {
        console.warn(
          `[SEO] Batch ${batchNumber}/${totalBatches} completed with valid JSON but no structured extraction data.`
        );
      }
      return parsed;
    }

    const repaired = await repairExtractionResponse({
      projectId,
      batchNumber,
      totalBatches,
      attempt,
      rawContent,
      targetKeywords: reducedKeywords,
    });

    if (repaired?.valid) {
      if (process.env.NODE_ENV !== "test") {
        console.log(
          `[SEO] Repair succeeded for batch ${batchNumber}/${totalBatches} on attempt ${attempt}: topics=${repaired.topics.length}, keywords=${repaired.keywords.length}, entities=${repaired.entities.length}, questions=${repaired.questions.length}, painPoints=${repaired.painPoints.length}, intents=${repaired.searchIntents.length}, products=${repaired.productsServices.length}, summary=${repaired.summary ? "yes" : "no"}`
        );
      }
      return repaired;
    }

    if (process.env.NODE_ENV !== "test") {
      console.warn(
        `[SEO] Invalid JSON for batch ${batchNumber}/${totalBatches} on attempt ${attempt}/${EXTRACTION_MAX_ATTEMPTS}: ${parsed.parseError ?? "unknown parse error"}`
      );
    }
  }

  if (process.env.NODE_ENV !== "test") {
    console.error(
      `[SEO] All extraction attempts failed for batch ${batchNumber}/${totalBatches}. Falling back to empty structured data.`
    );
  }

  return lastParsed;
}

async function repairExtractionResponse({
  projectId,
  batchNumber,
  totalBatches,
  attempt,
  rawContent,
  targetKeywords,
}: {
  projectId: string;
  batchNumber: number;
  totalBatches: number;
  attempt: number;
  rawContent: string;
  targetKeywords: number;
}): Promise<ParsedExtractionResponse | null> {
  if (!rawContent.trim()) return null;

  const repairPrompt = `Repair the malformed or truncated SEO extraction JSON below.

Return exactly one valid JSON object with this shape:
{
  "topics": ["topic"],
  "keywords": ["keyword"],
  "entities": ["entity"],
  "questions": ["question"],
  "painPoints": ["pain point"],
  "contentAngles": ["content angle"],
  "searchIntents": ["intent"],
  "productsServices": ["product or service"],
  "summary": "one short sentence"
}

Rules:
- Recover only information already present in the source response
- Do not invent missing items
- If a field cannot be recovered, use []
- Keep the response concise
- keywords: up to ${targetKeywords}
- topics: up to 6
- entities/questions/painPoints/contentAngles/productsServices: up to 6 each
- searchIntents: up to 4
- summary: exactly 1 short sentence or ""

Malformed source response:
${rawContent.slice(0, EXTRACTION_REPAIR_SOURCE_LIMIT)}`;

  if (process.env.NODE_ENV !== "test") {
    console.warn(
      `[SEO] Attempting JSON repair for batch ${batchNumber}/${totalBatches}, attempt ${attempt}.`
    );
  }

  try {
    const repairResult = await chat(
      [
        {
          role: "system",
          content:
            "You repair malformed JSON. Return only valid JSON matching the requested shape. Never add explanation.",
        },
        { role: "user", content: repairPrompt },
      ],
      undefined,
      {
        requestLabel: `seo-batch-${batchNumber}-repair-${attempt}`,
        projectId,
        temperature: 0,
        maxOutputTokens: null,
        responseFormat: "json",
        enableThinking: false,
      }
    );

    const repairedContent = repairResult.content?.trim() ?? "{}";
    if (process.env.NODE_ENV !== "test") {
      console.log(
        `[SEO] Repair raw response for batch ${batchNumber}/${totalBatches}, attempt ${attempt}: ${repairedContent.slice(0, 600)}`
      );
    }

    return parseExtractionResponse(repairedContent);
  } catch (error) {
    if (process.env.NODE_ENV !== "test") {
      const message = error instanceof Error ? error.message : String(error);
      console.error(
        `[SEO] Repair failed for batch ${batchNumber}/${totalBatches}, attempt ${attempt}: ${message}`
      );
    }
    return null;
  }
}

function saveKeywords(projectId: string, crawlJobId: string | null, keywords: string[]) {
  const db = getDb();
  const now = new Date().toISOString();
  const stmt = db.prepare(
    `INSERT OR IGNORE INTO project_keywords (id, project_id, keyword, source, crawl_job_id, created_at)
     VALUES (?, ?, ?, 'extracted', ?, ?)`
  );
  db.transaction(() => {
    for (const keyword of keywords) {
      stmt.run(uuid(), projectId, keyword, crawlJobId, now);
    }
  })();
}

function parseExtractionResponse(raw: string): {
  valid: boolean;
  parseError: string | null;
  topics: string[];
  keywords: string[];
  entities: string[];
  questions: string[];
  painPoints: string[];
  contentAngles: string[];
  searchIntents: string[];
  productsServices: string[];
  summary: string;
} {
  const cleaned = raw.replace(/^```json\s*|\s*```$/g, "");

  try {
    const parsed = JSON.parse(cleaned);

    if (Array.isArray(parsed)) {
      const values = normalizeStringArray(parsed);
      return {
        valid: true,
        parseError: null,
        topics: values.slice(0, 8),
        keywords: values,
        entities: [],
        questions: [],
        painPoints: [],
        contentAngles: [],
        searchIntents: [],
        productsServices: [],
        summary: "",
      };
    }

    return {
      valid: true,
      parseError: null,
      topics: normalizeStringArray(parsed?.topics),
      keywords: normalizeStringArray(parsed?.keywords),
      entities: normalizeStringArray(parsed?.entities),
      questions: normalizeStringArray(parsed?.questions),
      painPoints: normalizeStringArray(parsed?.painPoints),
      contentAngles: normalizeStringArray(parsed?.contentAngles),
      searchIntents: normalizeStringArray(parsed?.searchIntents),
      productsServices: normalizeStringArray(parsed?.productsServices),
      summary: typeof parsed?.summary === "string" ? parsed.summary.trim() : "",
    };
  } catch (error) {
    if (process.env.NODE_ENV !== "test") {
      const message = error instanceof Error ? error.message : String(error);
      console.error(
        `[SEO] Failed to parse extraction response: ${message}. Raw payload preview: ${cleaned.slice(0, 600)}`
      );
    }
    return {
      valid: false,
      parseError: error instanceof Error ? error.message : String(error),
      topics: [],
      keywords: [],
      entities: [],
      questions: [],
      painPoints: [],
      contentAngles: [],
      searchIntents: [],
      productsServices: [],
      summary: "",
    };
  }
}

function emptyParsedExtraction(): ParsedExtractionResponse {
  return {
    valid: false,
    parseError: null,
    topics: [],
    keywords: [],
    entities: [],
    questions: [],
    painPoints: [],
    contentAngles: [],
    searchIntents: [],
    productsServices: [],
    summary: "",
  };
}

export function mergeSEOExtractionResults(results: SEOExtractionResult[]): SEOExtractionResult {
  const keywords = new Set<string>();
  const topics = new Set<string>();
  const entities = new Set<string>();
  const questions = new Set<string>();
  const painPoints = new Set<string>();
  const contentAngles = new Set<string>();
  const searchIntents = new Set<string>();
  const productsServices = new Set<string>();
  const summaries: string[] = [];

  for (const result of results) {
    result.keywords.forEach((item) => keywords.add(item));
    result.topics.forEach((item) => topics.add(item));
    result.reference.entities.forEach((item) => entities.add(item));
    result.reference.questions.forEach((item) => questions.add(item));
    result.reference.painPoints.forEach((item) => painPoints.add(item));
    result.reference.contentAngles.forEach((item) => contentAngles.add(item));
    result.reference.searchIntents.forEach((item) => searchIntents.add(item));
    result.reference.productsServices.forEach((item) => productsServices.add(item));
    if (result.summary) summaries.push(result.summary);
  }

  return {
    keywords: [...keywords].slice(0, 150),
    topics: [...topics].slice(0, 24),
    summary: summaries[0] ?? "",
    reference: {
      entities: [...entities].slice(0, 40),
      questions: [...questions].slice(0, 40),
      painPoints: [...painPoints].slice(0, 24),
      contentAngles: [...contentAngles].slice(0, 30),
      searchIntents: [...searchIntents].slice(0, 12),
      productsServices: [...productsServices].slice(0, 30),
    },
    batchCount: results.reduce((sum, result) => sum + result.batchCount, 0),
  };
}

export function persistSEOInsights(
  projectId: string,
  crawlJobId: string | null,
  insights: SEOExtractionResult,
  source = crawlJobId ? "crawl" : "manual"
) {
  if (insights.keywords.length > 0) {
    saveKeywords(projectId, crawlJobId, insights.keywords);
  }

  return saveProjectSEOInsight(projectId, crawlJobId, {
    topics: insights.topics,
    keywords: insights.keywords,
    reference: insights.reference,
    summary: insights.summary,
    source,
  });
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim().toLowerCase())
    .filter((item, index, arr) => item.length > 1 && arr.indexOf(item) === index);
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
