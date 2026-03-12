import type { PublisherAdapter } from "../types";
import { requireString, splitTags, toParagraphRichContent } from "../utils";

export const wixAdapter: PublisherAdapter = {
  async publish(config, payload) {
    const apiKey = requireString(config, "apiKey");
    const siteId = requireString(config, "siteId");
    const language = requireString(config, "language");

    if (!apiKey || !siteId) {
      return { success: false, error: "Wix requires an API key and site ID." };
    }

    try {
      const res = await fetch("https://www.wixapis.com/blog/v3/draft-posts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: apiKey,
          "wix-site-id": siteId,
        },
        body: JSON.stringify({
          draftPost: {
            title: payload.title,
            excerpt: payload.metadata?.excerpt ?? "",
            language: language || undefined,
            hashtags: splitTags(payload.metadata?.tags),
            richContent: toParagraphRichContent(payload.content),
          },
        }),
      });

      if (!res.ok) {
        return { success: false, error: `Wix API: ${await res.text()}` };
      }

      const data = (await res.json()) as Record<string, unknown>;
      const draftPost = (data.draftPost ?? data) as Record<string, unknown>;
      return {
        success: true,
        url: typeof draftPost?.url === "string" ? draftPost.url : undefined,
        details: data,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Wix publish failed",
      };
    }
  },

  async testConnection(config) {
    const apiKey = requireString(config, "apiKey");
    const siteId = requireString(config, "siteId");
    if (!apiKey || !siteId) {
      return { success: false, message: "Missing Wix API key or site ID." };
    }

    try {
      const res = await fetch("https://www.wixapis.com/v3/posts?paging.limit=1", {
        headers: {
          Authorization: apiKey,
          "wix-site-id": siteId,
        },
      });
      if (!res.ok) {
        return { success: false, message: `Wix test failed: ${await res.text()}` };
      }
      const data = (await res.json()) as Record<string, unknown>;
      return {
        success: true,
        message: "Wix connection verified.",
        details: data,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "Wix test failed",
      };
    }
  },
};
