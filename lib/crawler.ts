import * as cheerio from "cheerio";
import type { ExistingPage } from "@/lib/prompts/types";

const DEFAULT_MAX_PAGES = 10;
const REQUEST_DELAY_MS = 350;
const REQUEST_DELAY_JITTER_MS = 250;
const CONTENT_PREVIEW_LENGTH = 2000;
const FETCH_TIMEOUT_MS = 15000;
const FETCH_RETRIES = 2;

/** User-Agent fallback order: Google first, then Bing, then generic */
const USER_AGENTS = [
  "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
  "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
  "Mozilla/5.0 (compatible; YandexBot/3.0; +http://yandex.com/bots)",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
];

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

function sanitizeText(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .replace(/\u00a0/g, " ")
    .replace(/[\r\n\t]+/g, " ")
    .trim();
}

function extractPageData(html: string, fallbackTitle: string): {
  title: string;
  meta_description: string | null;
  content_preview: string | null;
} {
  const $ = cheerio.load(html);
  // Remove noise
  $("script, style, noscript, iframe, nav, header, footer, aside, [role='navigation'], [role='banner']").remove();
  const title = sanitizeText($("title").text()) || fallbackTitle;
  const metaDesc =
    $('meta[name="description"]').attr("content")?.trim() ||
    $('meta[property="og:description"]').attr("content")?.trim() ||
    null;
  const bodyText = sanitizeText($("body").text());
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

export type CrawlProgressCallback = (
  progress: number,
  totalPages: number,
  currentUrl?: string,
  page?: CrawlPageResult
) => void | Promise<void>;

export interface CrawlOptions {
  maxPages?: number;
  /** Custom sitemap URL. If provided, uses this instead of auto-discovery. */
  sitemapUrl?: string;
  requestDelayMs?: number;
  requestDelayJitterMs?: number;
  shouldStop?: () => Promise<"continue" | "pause" | "cancel"> | "continue" | "pause" | "cancel";
}

/** Fetch a single URL and extract page data. For recrawl per URL. */
export async function crawlSingleUrl(url: string): Promise<CrawlPageResult> {
  const normalized = normalizeUrl(url, "https://example.com");
  if (!normalized.startsWith("http")) {
    throw new Error("Invalid URL. Must start with http:// or https://");
  }
  const res = await fetchWithRetry(normalized);
  const html = res.ok ? await res.text() : "";
  const fallbackTitle = new URL(normalized).pathname.split("/").filter(Boolean).pop() || "page";
  const data = extractPageData(html, fallbackTitle);
  if (process.env.NODE_ENV !== "test") {
    console.log(`[Crawl] SEO: ${normalized} | title="${(data.title || "").slice(0, 60)}" | meta=${!!data.meta_description} | content=${(data.content_preview?.length ?? 0)} chars`);
  }
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
  const requestDelayMs = options.requestDelayMs ?? REQUEST_DELAY_MS;
  const requestDelayJitterMs = options.requestDelayJitterMs ?? REQUEST_DELAY_JITTER_MS;
  const customSitemap = options.sitemapUrl?.trim();
  const normalized = normalizeUrl(homepageUrl, "https://example.com");
  if (!normalized.startsWith("http")) {
    throw new Error("Invalid URL. Must start with http:// or https://");
  }

  const origin = getOrigin(normalized);
  const seen = new Set<string>();
  const pages: CrawlPageResult[] = [];

  // Try sitemap first: custom URL if provided, else auto-discovery
  const sitemapUrls = customSitemap
    ? [normalizeUrl(customSitemap, origin)]
    : [
        `${origin}/sitemap.xml`,
        `${origin}/sitemap_index.xml`,
        `${origin}/sitemap-index.xml`,
        `${origin}/sitemap_index.xml.gz`,
        `${origin}/sitemap.xml.gz`,
      ];

  let usedSitemap = false;
  if (process.env.NODE_ENV !== "test") {
    console.log(`[Crawl] Starting: ${normalized} (max ${maxPages} pages)`);
  }
  for (const sitemapUrl of sitemapUrls) {
    await ensureNotStopped(options.shouldStop);
    try {
      const res = await fetchWithRetry(sitemapUrl);
      if (res.ok) {
        const text = await res.text();
        const urls = parseSitemap(text, origin, maxPages);
        for (const url of urls) {
          await ensureNotStopped(options.shouldStop);
          if (isSameOrigin(url, origin) && !seen.has(url) && pages.length < maxPages) {
            seen.add(url);
            const discoveredPage = {
              url,
              title: extractPathFromUrl(url),
              meta_description: null,
              content_preview: null,
              status_code: null,
            };
            pages.push(discoveredPage);
            await onProgress?.(pages.length, urls.length, url, discoveredPage);
          }
        }
        if (pages.length > 0) {
          usedSitemap = true;
          if (process.env.NODE_ENV !== "test") {
            console.log(`[Crawl] Sitemap found: ${sitemapUrl} → ${urls.length} URLs`);
          }
          break;
        }
      }
    } catch {
      continue;
    }
  }

  // If no sitemap or empty, crawl homepage for links
  if (pages.length === 0) {
    if (process.env.NODE_ENV !== "test") {
      console.log(`[Crawl] No sitemap, crawling homepage for links`);
    }
    await ensureNotStopped(options.shouldStop);
    const homepageRes = await fetchWithRetry(normalized);
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
    await onProgress?.(1, 1, normalized, pages[0]);

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
    });

    for (let i = 1; i < pages.length; i++) {
      await onProgress?.(i + 1, Math.min(pages.length + 50, maxPages), pages[i].url, pages[i]);
    }

    // Optionally crawl one level deeper for more pages (blog, /blog/, etc.)
    const toCrawl = pages.slice(1, 20);
    for (const page of toCrawl) {
      if (pages.length >= maxPages) break;
      await ensureNotStopped(options.shouldStop);
      await delayWithJitter(requestDelayMs, requestDelayJitterMs);
      try {
        const res = await fetchWithRetry(page.url);
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
        });
        await onProgress?.(idx + 1, pages.length, page.url, pages[idx]);
        for (let discoveredIdx = 0; discoveredIdx < pages.length; discoveredIdx++) {
          const discovered = pages[discoveredIdx];
          if (discovered.url !== page.url && discovered.status_code == null && !discovered.meta_description) {
            await onProgress?.(pages.length, pages.length + 20, discovered.url, discovered);
          }
        }
      } catch {
        // Skip failed pages
      }
    }
  } else {
    // Enrich sitemap URLs with full page data (title, meta, content_preview, status_code)
    for (let i = 0; i < pages.length; i++) {
      await ensureNotStopped(options.shouldStop);
      if (i > 0) await delayWithJitter(requestDelayMs, requestDelayJitterMs);
      try {
        const res = await fetchWithRetry(pages[i].url);
        pages[i].status_code = res.status;
        if (res.ok) {
          const html = await res.text();
          const data = extractPageData(html, pages[i].title);
          pages[i].title = data.title;
          pages[i].meta_description = data.meta_description;
          pages[i].content_preview = data.content_preview;
          if (process.env.NODE_ENV !== "test") {
            console.log(`[Crawl] SEO[${i + 1}/${pages.length}] ${pages[i].url} | title="${(data.title || "").slice(0, 50)}" | meta=${!!data.meta_description} | ${(data.content_preview?.length ?? 0)} chars`);
          }
        }
        await onProgress?.(i + 1, pages.length, pages[i].url, pages[i]);
      } catch {
        // Keep fallback data
      }
    }
  }

  if (process.env.NODE_ENV !== "test") {
    console.log(`[Crawl] Done: ${pages.length} pages | sitemap=${usedSitemap}`);
  }
  await onProgress?.(pages.length, pages.length);

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

async function delayWithJitter(baseMs: number, jitterMs: number): Promise<void> {
  const offset = jitterMs > 0 ? Math.round(Math.random() * jitterMs) : 0;
  await delay(baseMs + offset);
}

async function ensureNotStopped(
  shouldStop?: CrawlOptions["shouldStop"]
): Promise<void> {
  const state = await shouldStop?.();
  if (state === "pause") {
    throw new Error("CRAWL_PAUSED");
  }
  if (state === "cancel") {
    throw new Error("CRAWL_CANCELLED");
  }
}

async function fetchWithRetry(
  url: string,
  onLog?: (msg: string) => void
): Promise<{ ok: boolean; status: number; text: () => Promise<string> }> {
  let lastErr: Error | null = null;
  for (let uaIdx = 0; uaIdx < USER_AGENTS.length; uaIdx++) {
    for (let attempt = 0; attempt <= FETCH_RETRIES; attempt++) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
        const res = await fetch(url, {
          headers: { "User-Agent": USER_AGENTS[uaIdx] },
          signal: controller.signal,
        });
        clearTimeout(timeout);
        const uaName = uaIdx === 0 ? "Googlebot" : uaIdx === 1 ? "Bingbot" : uaIdx === 2 ? "YandexBot" : "Chrome";
        if (onLog) onLog(`[${uaName}] ${res.status} ${url}`);
        if (process.env.NODE_ENV !== "test") {
          console.log(`[Crawl] ${url} → ${res.status} (${uaName}${attempt > 0 ? ` retry ${attempt}` : ""})`);
        }
        return res;
      } catch (err) {
        lastErr = err instanceof Error ? err : new Error(String(err));
        const uaName = uaIdx === 0 ? "Googlebot" : uaIdx === 1 ? "Bingbot" : uaIdx === 2 ? "YandexBot" : "Chrome";
        if (process.env.NODE_ENV !== "test") {
          console.warn(`[Crawl] ${url} failed (${uaName} attempt ${attempt + 1}):`, lastErr.message);
        }
        if (attempt < FETCH_RETRIES) await delay(500 * (attempt + 1));
      }
    }
  }
  throw lastErr ?? new Error(`Failed to fetch ${url}`);
}
