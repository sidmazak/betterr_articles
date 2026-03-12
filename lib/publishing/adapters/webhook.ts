import type { PublisherAdapter } from "../types";
import { getJsonPathValue, renderTemplate, requireString } from "../utils";

export const webhookAdapter: PublisherAdapter = {
  async publish(config, payload) {
    const webhookUrl = requireString(config, "webhookUrl");
    const method = (requireString(config, "method") || "POST").toUpperCase();
    if (!webhookUrl) {
      return { success: false, error: "Webhook requires a target URL." };
    }

    try {
      const body = buildWebhookBody(config, payload);
      const res = await fetch(webhookUrl, {
        method,
        headers: buildWebhookHeaders(config),
        body: method === "GET" || method === "HEAD" ? undefined : body,
      });
      const rawText = await res.text();
      let parsed: unknown = null;
      try {
        parsed = rawText ? JSON.parse(rawText) : null;
      } catch {
        parsed = rawText || null;
      }

      if (!res.ok) {
        return { success: false, error: `Webhook returned ${res.status}`, details: { response: parsed } };
      }

      const publishedUrlPath = requireString(config, "publishedUrlPath");
      const urlValue = typeof parsed === "object" ? getJsonPathValue(parsed, publishedUrlPath || undefined) : undefined;

      return {
        success: true,
        url: typeof urlValue === "string" ? urlValue : undefined,
        details: typeof parsed === "object" ? (parsed as Record<string, unknown>) : { response: parsed },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Webhook publish failed",
      };
    }
  },

  async testConnection(config) {
    const webhookUrl = requireString(config, "webhookUrl");
    if (!webhookUrl) {
      return { success: false, message: "Missing webhook URL." };
    }

    try {
      const res = await fetch(webhookUrl, {
        method: "HEAD",
        headers: buildWebhookHeaders(config),
      });
      return res.ok
        ? { success: true, message: "Webhook endpoint responded successfully." }
        : { success: false, message: `Webhook test failed with status ${res.status}.` };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "Webhook test failed",
      };
    }
  },
};

function buildWebhookBody(
  config: Record<string, unknown>,
  payload: {
    title: string;
    content: string;
    metadata?: {
      excerpt?: string;
      tags?: string[];
      slug?: string;
      seoTitle?: string;
      metaDescription?: string;
      category?: string;
      canonicalUrl?: string | null;
      socialHashtags?: string[];
      coverImageBase64?: string | null;
      coverImageMimeType?: string | null;
      coverImageAlt?: string | null;
    };
  }
) {
  const payloadTemplate = requireString(config, "payloadTemplate");
  const basePayload = {
    title: payload.title,
    content: payload.content,
    excerpt: payload.metadata?.excerpt ?? "",
    tags: payload.metadata?.tags ?? [],
    slug: payload.metadata?.slug ?? "",
    seoTitle: payload.metadata?.seoTitle ?? "",
    metaDescription: payload.metadata?.metaDescription ?? "",
    category: payload.metadata?.category ?? "",
    canonicalUrl: payload.metadata?.canonicalUrl ?? "",
    socialHashtags: payload.metadata?.socialHashtags ?? [],
    coverImageBase64: payload.metadata?.coverImageBase64 ?? "",
    coverImageMimeType: payload.metadata?.coverImageMimeType ?? "",
    coverImageAlt: payload.metadata?.coverImageAlt ?? "",
  };

  if (!payloadTemplate) {
    return JSON.stringify(basePayload);
  }

  return renderTemplate(payloadTemplate, basePayload);
}

function buildWebhookHeaders(config: Record<string, unknown>) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const authType = requireString(config, "authType") || "none";
  const authToken = requireString(config, "authToken");
  const authHeaderName = requireString(config, "authHeaderName") || "Authorization";
  const username = requireString(config, "username");
  const password = requireString(config, "password");
  const headersJson = requireString(config, "headersJson");

  if (authType === "bearer" && authToken) {
    headers[authHeaderName] = `Bearer ${authToken}`;
  }
  if (authType === "header" && authToken) {
    headers[authHeaderName] = authToken;
  }
  if (authType === "basic" && username && password) {
    headers.Authorization = `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
  }

  if (headersJson) {
    try {
      const parsed = JSON.parse(headersJson) as Record<string, string>;
      for (const [key, value] of Object.entries(parsed)) {
        if (typeof value === "string" && key) headers[key] = value;
      }
    } catch {
      // ignore invalid extra headers during runtime; validation endpoint surfaces this earlier
    }
  }

  return headers;
}
