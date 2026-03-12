import type { CalendarItem } from "@/lib/app-types";

type UnknownRecord = Record<string, unknown>;

export function parseCalendarItemsFromLlmContent(content: string): {
  items: CalendarItem[];
  meta: {
    rootType: string;
    candidateCount: number;
    objectKeys: string[];
  };
} {
  const cleaned = content.replace(/^```json\s*|\s*```$/g, "").trim();
  const parsed = JSON.parse(cleaned) as unknown;
  const rootType = Array.isArray(parsed) ? "array" : parsed === null ? "null" : typeof parsed;
  const objectKeys =
    parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? Object.keys(parsed as UnknownRecord)
      : [];

  const rawItems = extractCalendarItemCandidates(parsed);
  const items = rawItems
    .map(normalizeCalendarItemCandidate)
    .filter((item): item is CalendarItem => item !== null);

  return {
    items,
    meta: {
      rootType,
      candidateCount: rawItems.length,
      objectKeys,
    },
  };
}

function extractCalendarItemCandidates(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return [];

  const record = value as UnknownRecord;
  const candidateKeys = [
    "items",
    "suggestions",
    "calendar",
    "calendarItems",
    "contentCalendar",
    "ideas",
    "articleIdeas",
    "results",
    "data",
  ];

  for (const key of candidateKeys) {
    if (Array.isArray(record[key])) {
      return record[key] as unknown[];
    }
  }

  return [];
}

function normalizeCalendarItemCandidate(candidate: unknown): CalendarItem | null {
  if (!candidate || typeof candidate !== "object") return null;
  const item = candidate as UnknownRecord;

  const title = firstString(item.title, item.suggestedTitle, item.headline, item.name);
  const primaryKeyword = firstString(
    item.primaryKeyword,
    item.primary_keyword,
    item.keyword,
    item.mainKeyword
  );

  if (!title || !primaryKeyword) return null;

  return {
    title,
    primaryKeyword,
    secondaryKeywords: normalizeStringArray(
      item.secondaryKeywords ?? item.secondary_keywords ?? item.supportingKeywords
    ),
    suggestedDate: firstString(
      item.suggestedDate,
      item.suggested_date,
      item.publishDate,
      item.date
    ) ?? "",
    targetUrl: firstString(item.targetUrl, item.target_url, item.url),
    contentGapRationale: firstString(
      item.contentGapRationale,
      item.content_gap_rationale,
      item.rationale,
      item.reason
    ) ?? "",
    internalLinkTargets: normalizeInternalLinkTargets(
      item.internalLinkTargets ?? item.internal_link_targets ?? item.links
    ),
    infographicConcepts: normalizeStringArray(
      item.infographicConcepts ?? item.infographic_concepts ?? item.infographics
    ),
    rankingPotential: (firstString(
      item.rankingPotential,
      item.ranking_potential,
      item.rankPotential
    ) ?? "medium") as "high" | "medium" | "low",
    rankingJustification: firstString(
      item.rankingJustification,
      item.ranking_justification,
      item.rankJustification
    ) ?? "",
  };
}

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return undefined;
}

function normalizeStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((entry): entry is string => typeof entry === "string")
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(/[\n,|]/)
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  return [];
}

function normalizeInternalLinkTargets(
  value: unknown
): Array<{ url: string; title: string; reason: string }> {
  if (!Array.isArray(value)) {
    return normalizeStringArray(value).map((url) => ({
      url,
      title: url,
      reason: "",
    }));
  }

  return value
    .map((entry): { url: string; title: string; reason: string } | null => {
      if (typeof entry === "string") {
        const url = entry.trim();
        return url ? { url, title: url, reason: "" } : null;
      }
      if (!entry || typeof entry !== "object") return null;
      const record = entry as UnknownRecord;
      const url = firstString(record.url, record.href, record.targetUrl);
      if (!url) return null;
      const title = firstString(record.title, record.label) ?? url;
      const reason = firstString(record.reason, record.description) ?? "";
      return { url, title, reason };
    })
    .filter((entry): entry is { url: string; title: string; reason: string } => entry !== null);
}
