import { getProjectPublishing } from "@/lib/db/settings";
import type { PublishingPlatform } from "@/lib/db/settings";

export interface PublishResult {
  success: boolean;
  url?: string;
  error?: string;
}

export async function publishArticle(
  projectId: string,
  title: string,
  content: string,
  metadata?: { excerpt?: string; tags?: string[] }
): Promise<PublishResult> {
  const config = getProjectPublishing(projectId);
  if (!config) {
    return { success: false, error: "No publishing platform configured for this project" };
  }

  const parsed = JSON.parse(config.config) as Record<string, unknown>;

  switch (config.platform as PublishingPlatform) {
    case "wordpress":
      return publishToWordPress(parsed, title, content, metadata);
    case "webhook":
      return publishToWebhook(parsed, title, content, metadata);
    case "ghost":
      return publishToGhost(parsed, title, content, metadata);
    case "medium":
      return publishToMedium(parsed, title, content, metadata);
    default:
      return { success: false, error: `Platform ${config.platform} not yet supported` };
  }
}

async function publishToWordPress(
  config: Record<string, unknown>,
  title: string,
  content: string,
  metadata?: { excerpt?: string; tags?: string[] }
): Promise<PublishResult> {
  const siteUrl = config.siteUrl as string;
  const username = config.username as string;
  const appPassword = config.appPassword as string;

  if (!siteUrl || !username || !appPassword) {
    return { success: false, error: "WordPress: siteUrl, username, appPassword required" };
  }

  const auth = Buffer.from(`${username}:${appPassword}`).toString("base64");

  try {
    const res = await fetch(`${siteUrl.replace(/\/$/, "")}/wp-json/wp/v2/posts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify({
        title,
        content,
        status: "draft",
        excerpt: metadata?.excerpt ?? "",
        tags: metadata?.tags ?? [],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return { success: false, error: `WordPress API: ${err}` };
    }

    const data = await res.json();
    return { success: true, url: data.link };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "WordPress publish failed",
    };
  }
}

async function publishToWebhook(
  config: Record<string, unknown>,
  title: string,
  content: string,
  metadata?: { excerpt?: string; tags?: string[] }
): Promise<PublishResult> {
  const url = config.webhookUrl as string;
  if (!url) {
    return { success: false, error: "Webhook: webhookUrl required" };
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, content, ...metadata }),
    });

    if (!res.ok) {
      return { success: false, error: `Webhook returned ${res.status}` };
    }
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Webhook failed",
    };
  }
}

async function publishToGhost(
  config: Record<string, unknown>,
  title: string,
  content: string,
  metadata?: { excerpt?: string; tags?: string[] }
): Promise<PublishResult> {
  const adminUrl = config.adminUrl as string;
  const apiKey = config.apiKey as string;

  if (!adminUrl || !apiKey) {
    return { success: false, error: "Ghost: adminUrl, apiKey required" };
  }

  try {
    const res = await fetch(
      `${adminUrl.replace(/\/$/, "")}/ghost/api/admin/posts/?source=html`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Ghost ${apiKey}`,
        },
        body: JSON.stringify({
          posts: [
            {
              title,
              html: content,
              status: "draft",
              custom_excerpt: metadata?.excerpt,
              tags: (metadata?.tags ?? []).map((name) => ({ name })),
            },
          ],
        }),
      }
    );

    if (!res.ok) {
      const err = await res.text();
      return { success: false, error: `Ghost API: ${err}` };
    }

    const data = await res.json();
    const post = data.posts?.[0];
    return { success: true, url: post?.url };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Ghost publish failed",
    };
  }
}

async function publishToMedium(
  config: Record<string, unknown>,
  title: string,
  content: string,
  metadata?: { excerpt?: string; tags?: string[] }
): Promise<PublishResult> {
  const token = config.integrationToken as string;
  const userId = config.userId as string;

  if (!token || !userId) {
    return { success: false, error: "Medium: integrationToken, userId required" };
  }

  try {
    const res = await fetch(`https://api.medium.com/v1/users/${userId}/posts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        title,
        contentFormat: "markdown",
        content,
        license: "all-rights-reserved",
        publishStatus: "draft",
        notifyFollowers: false,
        tags: metadata?.tags ?? [],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return { success: false, error: `Medium API: ${err}` };
    }

    const data = await res.json();
    return { success: true, url: data.data?.url };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Medium publish failed",
    };
  }
}

export { PUBLISHING_PLATFORMS } from "@/lib/publishing-constants";
