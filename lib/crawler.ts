import * as cheerio from "cheerio";
import type { ExistingPage } from "@/lib/prompts/types";

const DEFAULT_MAX_PAGES = 150;
const REQUEST_DELAY_MS = 200;
const CONTENT_PREVIEW_LENGTH = 2000;

export interface CrawlPageResult {
  url: string;
  title: string;
  meta_description: string | null;
  content_preview: string | null;
  status_code: number | null;
}

function normalizeUrl(input: string, base: string): string {
  try {
    if (input.startsWith("http://") || input.startsWith("https://")) {
      return new URL(input).href;
    }
    return new URL(input, base).href;
  } catch {
    return "";
  }
}

function getOrigin(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return "";
  }
}

function isSameOrigin(url: string, origin: string): boolean {
  try {
    return new URL(url).origin === origin;
  } catch {
    return false;
  }
}

function extractPathFromUrl(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname.replace(/\/$/, "") || "/";
    return path.split("/").pop() || "page";
  } catch {
    return "page";
  }
}

function extractPageData(html: string, fallbackTitle: string): {
  title: string;
  meta_description: string | null;
  content_preview: string | null;
} {
  const $ = cheerio.load(html);
  const title = $("title").text().trim() || fallbackTitle;
  const metaDesc =
    $('meta[name="description"]').attr("content")?.trim() ||
    $('meta[property="og:description"]').attr("content")?.trim() ||
    null;
  const bodyText = $("body").text().replace(/\s+/g, " ").trim();
  const content_preview =
    bodyText.length > 0 ? bodyText.slice(0, CONTENT_PREVIEW_LENGTH) : null;
  return { title, meta_description: metaDesc, content_preview };
}

export interface CrawlResult {
  homepageUrl: string;
  usedSitemap: boolean;
  pages: CrawlPageResult[];
  totalFound: number;
}

/** Convert CrawlPageResult to ExistingPage for backward compatibility */
export function toExistingPage(p: CrawlPageResult): ExistingPage {
  return { url: p.url, title: p.title };
}

export type CrawlProgressCallback = (progress: number, totalPages: number, currentUrl?: string) => void;

export interface CrawlOptions {
  maxPages?: number;
}

/** Fetch a single URL and extract page data. For recrawl per URL. */
export async function crawlSingleUrl(url: string): Promise<CrawlPageResult> {
  const normalized = normalizeUrl(url, "https://example.com");
  if (!normalized.startsWith("http")) {
    throw new Error("Invalid URL. Must start with http:// or https://");
  }
  const res = await fetch(normalized, {
    headers: { "User-Agent": "BetterArticles/1.0 (Content Planning)" },
  });
  const html = res.ok ? await res.text() : "";
  const fallbackTitle = new URL(normalized).pathname.split("/").filter(Boolean).pop() || "page";
  const data = extractPageData(html, fallbackTitle);
  return {
    url: normalized,
    title: data.title,
    meta_description: data.meta_description,
    content_preview: data.content_preview,
    status_code: res.status,
  };
}

export async function crawlWebsite(
  homepageUrl: string,
  onProgress?: CrawlProgressCallback,
  options: CrawlOptions = {}
): Promise<CrawlResult> {
  const maxPages = options.maxPages ?? DEFAULT_MAX_PAGES;
  const normalized = normalizeUrl(homepageUrl, "https://example.com");
  if (!normalized.startsWith("http")) {
    throw new Error("Invalid URL. Must start with http:// or https://");
  }

  const origin = getOrigin(normalized);
  const seen = new Set<string>();
  const pages: CrawlPageResult[] = [];

  // Try sitemap first
  const sitemapUrls = [
    `${origin}/sitemap.xml`,
    `${origin}/sitemap_index.xml`,
    `${origin}/sitemap-index.xml`,
    `${origin}/sitemap_index.xml.gz`,
    `${origin}/sitemap.xml.gz`,
  ];

  let usedSitemap = false;
  for (const sitemapUrl of sitemapUrls) {
    try {
      const res = await fetch(sitemapUrl, {
        headers: { "User-Agent": "BetterArticles/1.0 (Content Planning)" },
      });
      if (res.ok) {
        const text = await res.text();
        const urls = parseSitemap(text, origin, maxPages);
        for (const url of urls) {
          if (isSameOrigin(url, origin) && !seen.has(url) && pages.length < maxPages) {
            seen.add(url);
            pages.push({
              url,
              title: extractPathFromUrl(url),
              meta_description: null,
              content_preview: null,
              status_code: null,
            });
            onProgress?.(pages.length, urls.length, url);
          }
        }
        if (pages.length > 0) {
          usedSitemap = true;
          break;
        }
      }
    } catch {
      continue;
    }
  }

  // If no sitemap or empty, crawl homepage for links
  if (pages.length === 0) {
    const homepageRes = await fetch(normalized, {
      headers: { "User-Agent": "BetterArticles/1.0 (Content Planning)" },
    });
    if (!homepageRes.ok) {
      throw new Error(`Failed to fetch homepage: ${homepageRes.status}`);
    }

    const html = await homepageRes.text();
    const $ = cheerio.load(html);
    const homeData = extractPageData(html, "Homepage");
    pages.push({
      url: normalized,
      title: homeData.title,
      meta_description: homeData.meta_description,
      content_preview: homeData.content_preview,
      status_code: homepageRes.status,
    });
    seen.add(normalized);
    onProgress?.(1, 1, normalized);

    $("a[href]").each((_, el) => {
      const href = $(el).attr("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) {
        return;
      }
      const absolute = normalizeUrl(href, normalized);
      if (!absolute || !isSameOrigin(absolute, origin) || seen.has(absolute)) {
        return;
      }
      if (pages.length >= maxPages) return;

      seen.add(absolute);
      const linkText = $(el).text().trim();
      pages.push({
        url: absolute,
        title: linkText || extractPathFromUrl(absolute),
        meta_description: null,
        content_preview: null,
        status_code: null,
      });
      onProgress?.(pages.length, Math.min(pages.length + 50, maxPages), absolute);
    });

    // Optionally crawl one level deeper for more pages (blog, /blog/, etc.)
    const toCrawl = pages.slice(1, 20);
    for (const page of toCrawl) {
      if (pages.length >= maxPages) break;
      await delay(REQUEST_DELAY_MS);
      try {
        const res = await fetch(page.url, {
          headers: { "User-Agent": "BetterArticles/1.0 (Content Planning)" },
        });
        const idx = pages.findIndex((p) => p.url === page.url);
        if (idx >= 0) pages[idx].status_code = res.status;
        if (!res.ok) continue;
        const html = await res.text();
        const $ = cheerio.load(html);
        const data = extractPageData(html, page.title);
        if (idx >= 0) {
          pages[idx].title = data.title;
          pages[idx].meta_description = data.meta_description;
          pages[idx].content_preview = data.content_preview;
        }

        $("a[href]").each((_, el) => {
          const href = $(el).attr("href");
          if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) {
            return;
          }
          const absolute = normalizeUrl(href, normalized);
          if (!absolute || !isSameOrigin(absolute, origin) || seen.has(absolute)) {
            return;
          }
          if (pages.length >= maxPages) return;

          seen.add(absolute);
          const linkText = $(el).text().trim();
          pages.push({
            url: absolute,
            title: linkText || extractPathFromUrl(absolute),
            meta_description: null,
            content_preview: null,
            status_code: null,
          });
          onProgress?.(pages.length, pages.length + 20, absolute);
        });
      } catch {
        // Skip failed pages
      }
    }
  } else {
    // Enrich sitemap URLs with full page data (title, meta, content_preview, status_code)
    for (let i = 0; i < pages.length; i++) {
      if (i > 0) await delay(REQUEST_DELAY_MS);
      try {
        const res = await fetch(pages[i].url, {
          headers: { "User-Agent": "BetterArticles/1.0 (Content Planning)" },
        });
        pages[i].status_code = res.status;
        if (res.ok) {
          const html = await res.text();
          const data = extractPageData(html, pages[i].title);
          pages[i].title = data.title;
          pages[i].meta_description = data.meta_description;
          pages[i].content_preview = data.content_preview;
        }
        onProgress?.(i + 1, pages.length, pages[i].url);
      } catch {
        // Keep fallback data
      }
    }
  }

  onProgress?.(pages.length, pages.length);

  return {
    homepageUrl: normalized,
    usedSitemap,
    pages,
    totalFound: pages.length,
  };
}

function parseSitemap(xml: string, origin: string, limit = DEFAULT_MAX_PAGES): string[] {
  const urls: string[] = [];
  const locRegex = /<loc>([^<]+)<\/loc>/gi;
  let match;
  while ((match = locRegex.exec(xml)) !== null && urls.length < limit) {
    const url = match[1].trim();
    if (url && isSameOrigin(url, origin)) {
      urls.push(url);
    }
  }
  return urls;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
