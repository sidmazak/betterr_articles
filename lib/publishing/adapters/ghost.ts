import crypto from "crypto";
import type { PublisherAdapter } from "../types";
import { markdownToHtml, requireString, splitTags } from "../utils";

export const ghostAdapter: PublisherAdapter = {
  async publish(config, payload) {
    const adminUrl = requireString(config, "adminUrl");
    const apiKey = requireString(config, "apiKey");
    const status = requireString(config, "status") || "draft";

    if (!adminUrl || !apiKey) {
      return { success: false, error: "Ghost requires admin URL and admin API key." };
    }

    try {
      const token = createGhostAdminToken(apiKey);
      const featureImage = await uploadGhostImage(
        adminUrl,
        token,
        payload.metadata?.coverImageBase64,
        payload.metadata?.coverImageMimeType,
        payload.metadata?.slug || payload.title
      );
      const res = await fetch(`${adminUrl.replace(/\/$/, "")}/ghost/api/admin/posts/?source=html`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Ghost ${token}`,
        },
        body: JSON.stringify({
          posts: [
            {
              title: payload.title,
              html: markdownToHtml(payload.content),
              slug: payload.metadata?.slug ?? undefined,
              status,
              custom_excerpt: payload.metadata?.excerpt ?? undefined,
              feature_image: featureImage ?? undefined,
              tags: splitTags(payload.metadata?.tags).map((name) => ({ name })),
            },
          ],
        }),
      });

      if (!res.ok) {
        return { success: false, error: `Ghost API: ${await res.text()}` };
      }

      const data = (await res.json()) as Record<string, unknown>;
      const post = Array.isArray(data.posts) ? (data.posts[0] as Record<string, unknown> | undefined) : undefined;
      return {
        success: true,
        url: typeof post?.url === "string" ? post.url : undefined,
        details: data,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Ghost publish failed",
      };
    }
  },

  async testConnection(config) {
    const adminUrl = requireString(config, "adminUrl");
    const apiKey = requireString(config, "apiKey");

    if (!adminUrl || !apiKey) {
      return { success: false, message: "Missing required Ghost credentials." };
    }

    try {
      const token = createGhostAdminToken(apiKey);
      const res = await fetch(`${adminUrl.replace(/\/$/, "")}/ghost/api/admin/site/`, {
        headers: {
          Authorization: `Ghost ${token}`,
        },
      });
      if (!res.ok) {
        return { success: false, message: `Ghost test failed: ${await res.text()}` };
      }
      const data = (await res.json()) as Record<string, unknown>;
      return {
        success: true,
        message: "Ghost connection verified.",
        details: data,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "Ghost test failed",
      };
    }
  },
};

function createGhostAdminToken(apiKey: string) {
  const [id, secret] = apiKey.split(":");
  if (!id || !secret) {
    throw new Error("Ghost admin API key must use the '<id>:<secret>' format.");
  }

  const header = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT", kid: id }));
  const now = Math.floor(Date.now() / 1000);
  const payload = base64UrlEncode(
    JSON.stringify({
      iat: now,
      exp: now + 5 * 60,
      aud: "/admin/",
    })
  );
  const unsigned = `${header}.${payload}`;
  const signature = crypto
    .createHmac("sha256", Buffer.from(secret, "hex"))
    .update(unsigned)
    .digest("base64url");

  return `${unsigned}.${signature}`;
}

function base64UrlEncode(value: string) {
  return Buffer.from(value).toString("base64url");
}

async function uploadGhostImage(
  adminUrl: string,
  token: string,
  base64: string | null | undefined,
  mimeType: string | null | undefined,
  fileStem: string
) {
  if (!base64 || !mimeType) return null;

  const formData = new FormData();
  const extension = mimeType.split("/")[1] || "png";
  formData.append(
    "file",
    new Blob([Buffer.from(base64, "base64")], { type: mimeType }),
    `${sanitizeFilename(fileStem)}.${extension}`
  );

  const res = await fetch(`${adminUrl.replace(/\/$/, "")}/ghost/api/admin/images/upload/`, {
    method: "POST",
    headers: {
      Authorization: `Ghost ${token}`,
    },
    body: formData,
  });

  if (!res.ok) return null;
  const data = (await res.json()) as { images?: Array<{ url?: string }> };
  return data.images?.[0]?.url ?? null;
}

function sanitizeFilename(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "article-image";
}
