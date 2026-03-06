import type { ExistingPage } from "@/lib/prompts/types";

/** Single item in the content calendar (from LLM output) */
export interface CalendarItem {
  title: string;
  primaryKeyword: string;
  secondaryKeywords: string[];
  suggestedDate: string;
  targetUrl: string;
  contentGapRationale: string;
  internalLinkTargets: {
    url: string;
    title: string;
    reason: string;
  }[];
  infographicConcepts: string[];
  rankingPotential: "high" | "medium" | "low";
  rankingJustification: string;
}

/** Crawl session stored in client/state */
export interface CrawlSession {
  id: string;
  homepageUrl: string;
  usedSitemap: boolean;
  pages: ExistingPage[];
  totalFound: number;
  createdAt: string;
}
