import type { PublisherAdapter } from "../types";
import { markdownToHtml, requireString, splitTags } from "../utils";

export const wordPressAdapter: PublisherAdapter = {
  async publish(config, payload) {
    const siteUrl = requireString(config, "siteUrl");
    const username = requireString(config, "username");
    const appPassword = requireString(config, "appPassword");
    const status = requireString(config, "status") || "draft";

    if (!siteUrl || !username || !appPassword) {
      return { success: false, error: "WordPress requires site URL, username, and app password." };
    }

    const auth = Buffer.from(`${username}:${appPassword}`).toString("base64");
    try {
      const mediaId = await uploadWordPressMedia(
        siteUrl,
        auth,
        payload.metadata?.coverImageBase64,
        payload.metadata?.coverImageMimeType,
        payload.metadata?.slug || payload.title
      );
      const res = await fetch(`${siteUrl.replace(/\/$/, "")}/wp-json/wp/v2/posts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${auth}`,
        },
        body: JSON.stringify({
          title: payload.title,
          content: markdownToHtml(payload.content),
          status,
          excerpt: payload.metadata?.excerpt ?? "",
          slug: payload.metadata?.slug ?? undefined,
          tags: splitTags(payload.metadata?.tags),
          featured_media: mediaId ?? undefined,
        }),
      });

      if (!res.ok) {
        return { success: false, error: `WordPress API: ${await res.text()}` };
      }

      const data = (await res.json()) as Record<string, unknown>;
      return {
        success: true,
        url: typeof data.link === "string" ? data.link : undefined,
        details: data,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "WordPress publish failed",
      };
    }
  },

  async testConnection(config) {
    const siteUrl = requireString(config, "siteUrl");
    const username = requireString(config, "username");
    const appPassword = requireString(config, "appPassword");

    if (!siteUrl || !username || !appPassword) {
      return { success: false, message: "Missing required WordPress credentials." };
    }

    const auth = Buffer.from(`${username}:${appPassword}`).toString("base64");
    try {
      const res = await fetch(`${siteUrl.replace(/\/$/, "")}/wp-json/wp/v2/users/me`, {
        headers: { Authorization: `Basic ${auth}` },
      });
      if (!res.ok) {
        return { success: false, message: `WordPress test failed: ${await res.text()}` };
      }
      const data = (await res.json()) as Record<string, unknown>;
      return {
        success: true,
        message: "WordPress connection verified.",
        details: {
          user: data.name,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "WordPress test failed",
      };
    }
  },
};

async function uploadWordPressMedia(
  siteUrl: string,
  auth: string,
  base64: string | null | undefined,
  mimeType: string | null | undefined,
  fileStem: string
) {
  if (!base64 || !mimeType) return null;

  const res = await fetch(`${siteUrl.replace(/\/$/, "")}/wp-json/wp/v2/media`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": mimeType,
      "Content-Disposition": `attachment; filename="${sanitizeFilename(fileStem)}.${mimeType.split("/")[1] || "png"}"`,
    },
    body: Buffer.from(base64, "base64"),
  });

  if (!res.ok) return null;
  const data = (await res.json()) as Record<string, unknown>;
  return typeof data.id === "number" ? data.id : null;
}

function sanitizeFilename(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "article-image";
}
