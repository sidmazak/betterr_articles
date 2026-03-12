import type { PublisherAdapter } from "../types";
import { requireString, splitTags } from "../utils";

export const mediumAdapter: PublisherAdapter = {
  async publish(config, payload) {
    const token = requireString(config, "integrationToken");
    const userId = requireString(config, "userId");
    const publishStatus = requireString(config, "publishStatus") || "draft";
    if (!token || !userId) {
      return { success: false, error: "Medium requires integration token and user ID." };
    }

    try {
      const res = await fetch(`https://api.medium.com/v1/users/${userId}/posts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: payload.title,
          contentFormat: "markdown",
          content: payload.content,
          publishStatus,
          notifyFollowers: false,
          tags: splitTags(payload.metadata?.tags),
        }),
      });
      if (!res.ok) {
        return { success: false, error: `Medium API: ${await res.text()}` };
      }
      const data = (await res.json()) as { data?: { url?: string } } & Record<string, unknown>;
      return {
        success: true,
        url: data.data?.url,
        details: data,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Medium publish failed",
      };
    }
  },

  async testConnection(config) {
    const token = requireString(config, "integrationToken");
    if (!token) {
      return { success: false, message: "Missing Medium integration token." };
    }

    try {
      const res = await fetch("https://api.medium.com/v1/me", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) {
        return { success: false, message: `Medium test failed: ${await res.text()}` };
      }
      const data = (await res.json()) as Record<string, unknown>;
      return {
        success: true,
        message: "Medium connection verified.",
        details: data,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "Medium test failed",
      };
    }
  },
};
