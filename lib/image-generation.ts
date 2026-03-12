import { getImageGenerationSettings } from "@/lib/db/settings";

export interface GeneratedImageAsset {
  base64: string;
  mimeType: string;
  revisedPrompt?: string;
}

async function generateWithGemini(
  apiKey: string,
  model: string,
  prompt: string,
  maxRetries = 3
): Promise<GeneratedImageAsset | null> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  let lastError: string | null = null;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          responseModalities: ["IMAGE", "TEXT"],
        },
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      lastError = text;
      const is429 = res.status === 429 || /RESOURCE_EXHAUSTED|quota|rate.?limit/i.test(text);
      const retryMatch = text.match(/retry in (\d+(?:\.\d+)?)s/i) ?? text.match(/retryDelay["\s:]+"?(\d+)/i);
      const delayMs = retryMatch ? Math.ceil(parseFloat(retryMatch[1]) * 1000) : 6000;
      if (is429 && attempt < maxRetries - 1) {
        await new Promise((r) => setTimeout(r, Math.min(delayMs, 15000)));
        continue;
      }
      throw new Error(`Gemini image generation failed: ${text}`);
    }

    lastError = null;

    const data = (await res.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ inlineData?: { mimeType?: string; data?: string } }> };
      }>;
    };

    const parts = data.candidates?.[0]?.content?.parts ?? [];
    for (const part of parts) {
      const inline = part.inlineData;
      if (inline?.data) {
        return {
          base64: inline.data,
          mimeType: inline.mimeType ?? "image/png",
        };
      }
    }
    return null;
  }
  return null;
}

async function generateWithOpenRouterChat(
  apiKey: string,
  model: string,
  prompt: string
): Promise<GeneratedImageAsset | null> {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 1024,
    }),
  });

  if (!res.ok) {
    throw new Error(`OpenRouter image generation failed: ${await res.text()}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{
      message?: {
        images?: Array<{ type?: string; image_url?: { url?: string } }>;
      };
    }>;
  };

  const images = data.choices?.[0]?.message?.images ?? [];
  for (const img of images) {
    const url = img.image_url?.url;
    if (!url || !url.startsWith("data:image/")) continue;
    const match = url.match(/^data:image\/(\w+);base64,(.+)$/);
    if (match) {
      return {
        base64: match[2],
        mimeType: `image/${match[1]}`,
      };
    }
  }
  return null;
}

async function generateWithOpenAICompatible(
  baseUrl: string,
  apiKey: string,
  model: string,
  prompt: string
): Promise<GeneratedImageAsset | null> {
  const COVER_IMAGE_SIZE = "1792x1024";
  const res = await fetch(`${baseUrl.replace(/\/$/, "")}/images/generations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      prompt,
      size: COVER_IMAGE_SIZE,
      response_format: "b64_json",
    }),
  });

  if (!res.ok) {
    throw new Error(`Image generation failed: ${await res.text()}`);
  }

  const data = (await res.json()) as {
    data?: Array<{ b64_json?: string; revised_prompt?: string }>;
  };
  const image = data.data?.[0];
  if (!image?.b64_json) return null;

  return {
    base64: image.b64_json,
    mimeType: "image/png",
    revisedPrompt: image.revised_prompt,
  };
}

export async function generateArticleImage(
  prompt: string
): Promise<GeneratedImageAsset | null> {
  const settings = getImageGenerationSettings();
  if (!settings || settings.enabled !== 1 || !settings.api_key?.trim() || !settings.model?.trim()) {
    return null;
  }

  const styleAndPrompt = [settings.style_prompt?.trim(), prompt].filter(Boolean).join("\n\n");
  const finalPrompt =
    settings.provider === "google"
      ? `${styleAndPrompt}\n\nGenerate a landscape image in 16:9 aspect ratio.`
      : styleAndPrompt;

  if (settings.provider === "google") {
    return generateWithGemini(settings.api_key, settings.model, finalPrompt);
  }

  /** OpenRouter Gemini image models use chat completions, not /images/generations */
  const isOpenRouterGeminiImage =
    settings.provider === "openrouter" &&
    /^google\/gemini.*(?:flash-image|image)/i.test(settings.model);
  if (isOpenRouterGeminiImage) {
    const truncatedPrompt = finalPrompt.slice(0, 500);
    return generateWithOpenRouterChat(settings.api_key, settings.model, truncatedPrompt);
  }

  const baseUrl =
    settings.base_url?.trim() ||
    (settings.provider === "openai"
      ? "https://api.openai.com/v1"
      : settings.provider === "openrouter"
        ? "https://openrouter.ai/api/v1"
        : settings.provider === "together"
          ? "https://api.together.xyz/v1"
          : "");

  if (!baseUrl) return null;

  return generateWithOpenAICompatible(
    baseUrl,
    settings.api_key,
    settings.model,
    finalPrompt
  );
}
