import { chat } from "@/lib/llm";

export type InfographicChartType = "bar" | "pie" | "comparison" | "list";

/** Lucide icon name for semantic rendering (e.g. "alert-triangle", "gauge", "eye") */
export type InfographicIconHint =
  | "alert-triangle"
  | "gauge"
  | "eye"
  | "x-circle"
  | "hash"
  | "minus-circle"
  | "check-circle"
  | "car"
  | "shield"
  | "clock"
  | "list-checks"
  | "file-text"
  | "trending-up"
  | "percent"
  | "info"
  | "cloud"
  | "droplets"
  | "package"
  | "scale"
  | "zap"
  | "lightbulb";

/** Semantic category for styling (critical=red, standard=amber, info=cyan, success=green) */
export type InfographicCategory = "critical" | "standard" | "info" | "success";

/** Reusable item with optional icon/category */
export interface InfographicItem {
  label: string;
  value?: string | number;
  icon?: InfographicIconHint;
  category?: InfographicCategory;
}

/** Section types for dynamic, comprehensive infographics */
export type InfographicSectionType =
  | "heading"
  | "description"
  | "flow"
  | "equation"
  | "comparison-pair"
  | "list"
  | "status"
  | "comparison"
  | "bar"
  | "pie";

export interface InfographicSection {
  type: InfographicSectionType;
  title?: string;
  content?: string;
  /** Flow: A → B → C with icons (e.g. Salt Air → Corrosion) */
  flow?: Array<InfographicItem | "arrow">;
  /** Equation: A + B = C (e.g. Trailer + Load = ATM) */
  equation?: Array<InfographicItem | "plus" | "equals">;
  /** Good vs bad comparison */
  pair?: { good: InfographicItem; bad: InfographicItem };
  /** Status badge (e.g. SAFE, REQUIRED) */
  status?: { label: string; value: string; category?: InfographicCategory };
  /** List items */
  items?: InfographicItem[];
  /** Comparison rows */
  rows?: Array<Array<InfographicItem & { value: string | number }>>;
  /** Bar/pie data */
  labels?: string[];
  values?: number[];
}

export interface InfographicSpec {
  title: string;
  subtitle?: string;
  /** Legacy: single chart. Ignored when sections is present. */
  chartType?: InfographicChartType;
  data?: {
    labels: string[];
    values?: number[];
    rows?: Array<Array<InfographicItem & { value: string | number }>>;
    items?: InfographicItem[];
  };
  /** New: multi-section layout. When present, renders comprehensive infographic. */
  sections?: InfographicSection[];
  /** Site URL for watermark/footer (e.g. https://example.com). Added by renderer callers. */
  siteUrl?: string;
}

export interface InfographicPlacement {
  insertAfterHeading: string;
  spec: InfographicSpec;
}

const EXTRACT_PROMPT = `You extract structured data for a dynamic, comprehensive editorial infographic from article content. The goal is a visually rich guide like a professional magazine spread—with multiple sections, flow diagrams, comparisons, and clear storytelling. Support ANY content type.

Output a JSON object. Prefer the multi-section format when content has 2+ distinct topics, cause-effect flows, good-vs-bad comparisons, or step-by-step processes.

**Multi-section format (preferred for rich content):**
{
  "title": "Clear infographic title including primary keyword",
  "subtitle": "Optional tagline (e.g. Built to Last: Durability & Compliance)",
  "sections": [
    { "type": "heading", "title": "Section headline" },
    { "type": "description", "content": "Explanatory paragraph..." },
    { "type": "flow", "flow": [{"icon": "cloud", "label": "Salt Air"}, "arrow", {"icon": "x-circle", "label": "Corrosion"}] },
    { "type": "equation", "equation": [{"icon": "car", "label": "Trailer"}, "plus", {"icon": "package", "label": "Load"}, "equals", {"icon": "scale", "label": "ATM"}] },
    { "type": "comparison-pair", "pair": {"good": {"icon": "check-circle", "label": "Galvanised", "value": "Corrosion-resistant"}, "bad": {"icon": "x-circle", "label": "Standard Steel", "value": "Rusts quickly"}} },
    { "type": "status", "title": "Up to 750kg", "status": {"label": "Brakes", "value": "Not Required", "category": "success"} },
    { "type": "list", "title": "Components", "items": [{"icon": "shield", "label": "Axles", "value": "Heavy-duty"}, ...] },
    { "type": "comparison", "rows": [[{"label": "A", "value": "x"}, ...]] },
    { "type": "bar", "labels": [...], "values": [...] },
    { "type": "pie", "labels": [...], "values": [...] }
  ]
}

**Legacy single-chart format (use only for simple, single-topic content):**
{
  "chartType": "bar" | "pie" | "comparison" | "list",
  "title": "Title",
  "data": { "labels": [...], "values": [...], "rows": [...], "items": [...] }
}

Section types:
- **heading**: Section headline only
- **description**: Paragraph of explanatory text
- **flow**: Cause → effect chain. flow array: items with icon/label, interspersed with "arrow"
- **equation**: A + B = C. equation array: items with icon/label, "plus", "equals"
- **comparison-pair**: Good vs bad (e.g. recommended vs avoid). pair.good and pair.bad each have icon, label, value
- **status**: Badge (SAFE, REQUIRED, etc). status: {label, value, category}
- **list**: Items with icon/label/value. Use for checklists, components, steps
- **comparison**: Rows of label-value pairs
- **bar** / **pie**: Charts with labels and values

Icon hints: alert-triangle, gauge, eye, x-circle, hash, minus-circle, check-circle, car, shield, clock, list-checks, file-text, trending-up, percent, info, cloud, droplets, package, scale, zap, lightbulb
Category: "critical" (danger), "standard" (warning), "info" (neutral), "success" (safe/approved)

CRITICAL - Data accuracy (must follow strictly):
- Extract ONLY from the provided article content. Do NOT invent, assume, or add any data not explicitly stated.
- Every statistic, number, date, fee, and fact MUST appear verbatim or be directly derivable from the article text.
- If the article does not contain enough data for a section type, OMIT that section. Do NOT fill with placeholder, generic, or made-up content.
- Do NOT use example data from this prompt (e.g. "Salt Air", "Galvanised", "750kg")—replace with actual article content only.
- When in doubt, include less. A minimal accurate infographic is better than one with false or assumed information.

Rules:
- Use multi-section when content has: challenges, processes, comparisons, requirements, component lists, before/after.
- Each section should add value; avoid redundant sections.
- Title and subtitle must include primary keyword when provided.
- Output ONLY valid JSON, no markdown or explanation.`;

const EXTRACT_PLACEMENTS_PROMPT = `You analyze an article and decide where to place infographics. Each infographic should be dynamic and comprehensive—like a magazine spread with multiple sections, flow diagrams, comparisons, and lists.

Output a JSON array of objects, each with:
- "insertAfterHeading": the exact ## H2 heading text (without ##) after which to insert the infographic
- "spec": an infographic spec object. Prefer multi-section format with "sections" array when content supports it (headings, descriptions, flow, equation, comparison-pair, list, status, comparison, bar, pie). Use legacy chartType+data for simple single-topic content.

CRITICAL - Data accuracy:
- Extract ONLY from the provided article. Do NOT invent statistics, dates, fees, or facts.
- Every piece of data in each spec MUST appear in the article text. Omit sections if the article lacks the data.
- Do NOT use placeholder or example data. When in doubt, include less.

Placement rules:
- Return 1–3 placements based on article length and structure.
- Choose sections with rich content: challenges, processes, good-vs-bad, requirements, component lists, before/after.
- Each spec must extract data from the section near insertAfterHeading.
- Do not reuse data across infographics; each must have distinct content.
- Prefer comprehensive multi-section infographics when the article section has 2+ distinct topics or flows.
- insertAfterHeading must match an existing ## H2 exactly.
- Output ONLY valid JSON array, no markdown or explanation.`;

const validTypes: InfographicChartType[] = ["bar", "pie", "comparison", "list"];

function createFallbackSpec(primaryKeyword: string | null): InfographicSpec {
  const keyword = (primaryKeyword ?? "").trim();
  const title = keyword ? `${keyword} – Key Summary` : "Key Summary";
  return {
    chartType: "list",
    title,
    data: {
      labels: [],
      items: [{ label: "Summary", value: "See article for details" }],
    },
  };
}

const VALID_SECTION_TYPES: InfographicSectionType[] = [
  "heading",
  "description",
  "flow",
  "equation",
  "comparison-pair",
  "list",
  "status",
  "comparison",
  "bar",
  "pie",
];

function parseAndValidateSpec(cleaned: string): InfographicSpec {
  const parsed = JSON.parse(cleaned) as InfographicSpec;
  if (!parsed.title) {
    throw new Error("Invalid infographic spec: missing title");
  }
  if (parsed.sections && Array.isArray(parsed.sections) && parsed.sections.length > 0) {
    parsed.sections = parsed.sections.map((s: InfographicSection) => {
      if (!s.type || !VALID_SECTION_TYPES.includes(s.type)) {
        return { ...s, type: "description" as const };
      }
      return s;
    });
    return parsed;
  }
  if (!parsed.chartType || !parsed.data) {
    throw new Error("Invalid infographic spec: missing chartType/data (and no sections)");
  }
  if (!validTypes.includes(parsed.chartType)) {
    parsed.chartType = "list";
  }
  return parsed;
}

export async function extractInfographicSpec(
  articleContent: string,
  primaryKeyword: string | null
): Promise<InfographicSpec> {
  const keywordNote = primaryKeyword
    ? `\nPrimary keyword to include in title: "${primaryKeyword}"`
    : "";
  const prompt = `${EXTRACT_PROMPT}${keywordNote}

Article content (extract ONLY from this—do not invent any data):
${articleContent.slice(0, 10000)}`;

  const maxAttempts = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await chat(
        [
          {
            role: "system",
            content:
              "You output only valid JSON. No markdown, no code fences, no explanation. CRITICAL: Extract only data that appears in the article. Do not invent, assume, or add any statistics, dates, or facts not explicitly stated.",
          },
          { role: "user", content: prompt },
        ],
        undefined,
        {
          requestLabel: "infographic-extract",
          temperature: 0.2,
          maxOutputTokens: 3000,
          responseFormat: "json",
          enableThinking: false,
        }
      );

      const raw = response.content?.trim() ?? "{}";
      const cleaned = raw.replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim();
      return parseAndValidateSpec(cleaned);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt === maxAttempts) break;
    }
  }

  return createFallbackSpec(primaryKeyword);
}

export async function extractInfographicSpecFromContext(
  contentSlice: string,
  primaryKeyword: string | null
): Promise<InfographicSpec> {
  return extractInfographicSpec(contentSlice, primaryKeyword);
}

export async function extractInfographicSpecsWithPlacements(
  articleContent: string,
  primaryKeyword: string | null,
  options: { count?: number; existingPlaceholders?: Array<{ index: number; title: string }> }
): Promise<InfographicPlacement[]> {
  const { count = 2, existingPlaceholders } = options;

  if (existingPlaceholders && existingPlaceholders.length > 0) {
    const placements: InfographicPlacement[] = [];
    const CONTEXT_RADIUS = 800;
    for (const ph of existingPlaceholders) {
      const start = Math.max(0, ph.index - CONTEXT_RADIUS);
      const end = Math.min(articleContent.length, ph.index + ph.title.length + CONTEXT_RADIUS);
      const slice = articleContent.slice(start, end);
      const spec = await extractInfographicSpec(slice, primaryKeyword);
      const heading = inferHeadingNearIndex(articleContent, ph.index);
      placements.push({ insertAfterHeading: heading, spec });
    }
    return placements;
  }

  const keywordNote = primaryKeyword
    ? `\nPrimary keyword to include in at least one title: "${primaryKeyword}"`
    : "";
  const prompt = `${EXTRACT_PLACEMENTS_PROMPT}

Return ${count} placement(s).${keywordNote}

Article content (extract ONLY from this—do not invent any data):
${articleContent.slice(0, 12000)}`;

  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await chat(
        [
          {
            role: "system",
            content:
              "You output only valid JSON array. No markdown, no code fences, no explanation. CRITICAL: Extract only data that appears in the article. Do not invent statistics, dates, or facts.",
          },
          { role: "user", content: prompt },
        ],
        undefined,
        {
          requestLabel: "infographic-extract-placements",
          temperature: 0.2,
          maxOutputTokens: 3000,
          responseFormat: "json",
          enableThinking: false,
        }
      );

      const raw = response.content?.trim() ?? "[]";
      const cleaned = raw.replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim();
      const parsed = JSON.parse(cleaned) as Array<{ insertAfterHeading?: string; spec?: InfographicSpec }>;
      if (!Array.isArray(parsed) || parsed.length === 0) {
        throw new Error("Expected non-empty array");
      }
      const placements: InfographicPlacement[] = [];
      for (const p of parsed.slice(0, count)) {
        const heading = (p.insertAfterHeading ?? "").trim() || "Key Takeaways";
        let spec: InfographicSpec;
        try {
          spec = p.spec && p.spec.chartType && p.spec.title && p.spec.data
            ? parseAndValidateSpec(JSON.stringify(p.spec))
            : createFallbackSpec(primaryKeyword);
        } catch {
          spec = createFallbackSpec(primaryKeyword);
        }
        placements.push({ insertAfterHeading: heading, spec });
      }
      return placements;
    } catch {
      if (attempt === maxAttempts) break;
    }
  }

  const fallbackSpec = createFallbackSpec(primaryKeyword);
  const heading = getFirstMainHeading(articleContent) ?? "Key Takeaways";
  return [{ insertAfterHeading: heading, spec: fallbackSpec }];
}

function inferHeadingNearIndex(content: string, index: number): string {
  const before = content.slice(0, index);
  const match = before.match(/^##\s+(.+)$/gm);
  return match?.length ? match[match.length - 1].replace(/^##\s+/, "").trim() : "Key Takeaways";
}

function getFirstMainHeading(content: string): string | null {
  const LEAD = /^(key takeaways|table of contents)$/i;
  for (const m of content.matchAll(/^##\s+(.+)$/gm)) {
    const h = (m[1] ?? "").trim();
    if (!LEAD.test(h)) return h;
  }
  return null;
}
