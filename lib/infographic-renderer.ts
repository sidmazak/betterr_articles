import type { InfographicSpec } from "@/lib/infographic-extractor";

/** Normalize URL to https. Returns undefined if invalid or empty. */
export function ensureHttpsUrl(url: string | null | undefined): string | undefined {
  const trimmed = url?.trim();
  if (!trimmed) return undefined;
  try {
    const parsed = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
    return parsed.protocol === "https:" ? parsed.href.replace(/\/$/, "") : `https://${parsed.host}${parsed.pathname}`.replace(/\/$/, "");
  } catch {
    return undefined;
  }
}

const INF_WIDTH = 800;
const VIEWPORT_WIDTH = 1000;
/** Tall viewport so full infographic renders without clipping; element.screenshot captures full element */
const VIEWPORT_HEIGHT = 6000;

function getInfographicBaseUrl(): string {
  // if (process.env.VERCEL_URL) {
  //   return `https://${process.env.VERCEL_URL}`;
  // }
  const port = process.env.PORT || "3000";
  return `http://localhost:${port}`;
}

export async function renderInfographicToBase64(
  spec: InfographicSpec,
  options?: { siteUrl?: string }
): Promise<string> {
  const specToSend: InfographicSpec = {
    ...spec,
    ...(options?.siteUrl ? { siteUrl: options.siteUrl } : {}),
  };
  const specB64 = Buffer.from(JSON.stringify(specToSend), "utf-8").toString("base64");
  const url = `${getInfographicBaseUrl()}/infographic/render?spec=${encodeURIComponent(specB64)}`;

  const { chromium: playwrightChromium } = await import("playwright-core");
  const isProd = process.env.NODE_ENV === "production";

  let executablePath: string | undefined;
  let args: string[];

  if (isProd) {
    const sparticuzChromium = await import("@sparticuz/chromium");
    executablePath = await sparticuzChromium.default.executablePath();
    args = sparticuzChromium.default.args;
  } else {
    executablePath = undefined;
    args = ["--no-sandbox", "--disable-setuid-sandbox"];
  }

  const browser = await playwrightChromium.launch({
    headless: true,
    executablePath,
    args,
  });

  try {
    const page = await browser.newPage();
    await page.setViewportSize({ width: VIEWPORT_WIDTH, height: VIEWPORT_HEIGHT });
    await page.goto(url, { waitUntil: "networkidle", timeout: 15000 });
    await page.waitForSelector("figure", { timeout: 5000 });
    await new Promise((r) => setTimeout(r, 500));
    const figure = await page.$("figure");
    if (!figure) {
      throw new Error("Infographic figure not found");
    }
    await figure.scrollIntoViewIfNeeded();
    await new Promise((r) => setTimeout(r, 200));
    const buffer = await figure.screenshot({
      type: "png",
    });
    return buffer.toString("base64");
  } finally {
    await browser.close();
  }
}
