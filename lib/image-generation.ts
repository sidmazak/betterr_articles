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

const AI_HORDE_BASE = "https://aihorde.net/api";

function isKudosUpfrontError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /KudosUpfront|rc["\s:]+["']?KudosUpfront/i.test(msg) || /kudos.*required|required.*kudos/i.test(msg);
}

async function submitAndPollHorde(
  key: string,
  model: string,
  prompt: string,
  width: number,
  height: number
): Promise<GeneratedImageAsset | null> {
  const startMs = Date.now();
  console.log(`[AI Horde] Submitting request: model=${model}, ${width}x${height}`);
  const initRes = await fetch(`${AI_HORDE_BASE}/v2/generate/async`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: key,
    },
    body: JSON.stringify({
      prompt,
      params: {
        width,
        height,
        steps: 20,
        sampler_name: "k_euler",
        n: 1,
      },
      models: [model],
    }),
  });

  const initText = await initRes.text();
  if (!initRes.ok) {
    const err = new Error(`AI Horde init failed: ${initText}`);
    (err as Error & { rc?: string }).rc = (() => {
      try {
        return (JSON.parse(initText) as { rc?: string }).rc;
      } catch {
        return undefined;
      }
    })();
    throw err;
  }

  const initData = JSON.parse(initText) as { id?: string; message?: string; rc?: string; kudos?: number };
  const requestId = initData.id;
  if (!requestId) {
    throw new Error(initData.message || "AI Horde did not return a request ID");
  }
  console.log(`[AI Horde] Request queued: id=${requestId}, kudos=${initData.kudos ?? "?"}`);

  const maxAttempts = 120;
  const pollIntervalMs = 1000;
  for (let i = 0; i < maxAttempts; i++) {
    const checkRes = await fetch(`${AI_HORDE_BASE}/v2/generate/check/${requestId}`);
    if (!checkRes.ok) throw new Error(`AI Horde check failed: ${await checkRes.text()}`);
    const checkData = (await checkRes.json()) as { done?: boolean; finished?: number; processing?: number; waiting?: number };
    const elapsed = ((Date.now() - startMs) / 1000).toFixed(1);
    if (i % 10 === 0 || checkData.done || (checkData.finished ?? 0) > 0) {
      console.log(`[AI Horde] Poll ${i + 1}: done=${checkData.done}, finished=${checkData.finished ?? 0}, processing=${checkData.processing ?? 0}, waiting=${checkData.waiting ?? 0}, elapsed=${elapsed}s`);
    }
    if (checkData.done || (checkData.finished ?? 0) > 0) break;
    await new Promise((r) => setTimeout(r, pollIntervalMs));
  }

  const statusRes = await fetch(`${AI_HORDE_BASE}/v2/generate/status/${requestId}`);
  if (!statusRes.ok) throw new Error(`AI Horde status failed: ${await statusRes.text()}`);
  const statusData = (await statusRes.json()) as {
    generations?: Array<{ img?: string }>;
    faulted?: boolean;
  };
  if (statusData.faulted) throw new Error("AI Horde generation faulted");
  const img = statusData.generations?.[0]?.img;
  if (!img) {
    console.log(`[AI Horde] No image in response after ${((Date.now() - startMs) / 1000).toFixed(1)}s`);
    return null;
  }

  let base64: string;
  let mimeType = "image/png";
  if (img.startsWith("http://") || img.startsWith("https://")) {
    console.log(`[AI Horde] Fetching image from URL...`);
    const imgRes = await fetch(img);
    if (!imgRes.ok) throw new Error("AI Horde: failed to fetch generated image");
    const contentType = imgRes.headers.get("content-type");
    if (contentType?.includes("webp")) mimeType = "image/webp";
    else if (contentType?.includes("jpeg") || contentType?.includes("jpg")) mimeType = "image/jpeg";
    else if (contentType?.includes("png")) mimeType = "image/png";
    else if (img.includes(".webp")) mimeType = "image/webp";
    const buf = await imgRes.arrayBuffer();
    base64 = Buffer.from(buf).toString("base64");
  } else {
    base64 = img;
  }
  const totalSec = ((Date.now() - startMs) / 1000).toFixed(1);
  console.log(`[AI Horde] Done in ${totalSec}s, mimeType=${mimeType}`);
  return { base64, mimeType };
}

async function generateWithHorde(
  apiKey: string | null,
  model: string,
  prompt: string
): Promise<GeneratedImageAsset | null> {
  const key = apiKey?.trim() || "0000000000";
  try {
    return await submitAndPollHorde(key, model, prompt, 576, 320);
  } catch (err) {
    const isKudos = isKudosUpfrontError(err) || (err as Error & { rc?: string }).rc === "KudosUpfront";
    if (isKudos) {
      console.log(`[AI Horde] KudosUpfront, retrying with 512x320`);
      return await submitAndPollHorde(key, model, prompt, 512, 320);
    }
    throw err;
  }
}

async function generateWithStability(
  apiKey: string,
  engineId: string,
  prompt: string
): Promise<GeneratedImageAsset | null> {
  const isSdxl = /stable-diffusion-xl|sdxl/i.test(engineId);
  const { width, height } = isSdxl
    ? { width: 1344, height: 768 }
    : { width: 896, height: 512 };

  const res = await fetch(
    `https://api.stability.ai/v1/generation/${engineId}/text-to-image`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        text_prompts: [{ text: prompt, weight: 1 }],
        cfg_scale: 7,
        width,
        height,
        steps: 30,
        samples: 1,
        style_preset: "photographic",
      }),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Stability AI image generation failed: ${text}`);
  }

  const data = (await res.json()) as {
    artifacts?: Array<{ base64?: string; finishReason?: string } | Array<{ base64?: string; finishReason?: string }>>;
  };
  const flat = (data.artifacts ?? []).flat();
  const artifact = flat.find(
    (a) => typeof a === "object" && a?.finishReason === "SUCCESS" && a?.base64
  ) ?? flat[0];
  if (!artifact || typeof artifact !== "object" || !artifact.base64) return null;

  return {
    base64: artifact.base64,
    mimeType: "image/png",
  };
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
  const needsKey = settings?.provider !== "horde";
  if (
    !settings ||
    settings.enabled !== 1 ||
    !settings.model?.trim() ||
    (needsKey && !settings.api_key?.trim())
  ) {
    return null;
  }

  const styleAndPrompt = [settings.style_prompt?.trim(), prompt].filter(Boolean).join("\n\n");
  const finalPrompt =
    settings.provider === "google"
      ? `${styleAndPrompt}\n\nGenerate a landscape image in 16:9 aspect ratio.`
      : settings.provider === "horde"
        ? `${styleAndPrompt}\n\nLandscape, 16:9 aspect ratio, professional editorial style, no text overlay.`
        : styleAndPrompt;

  if (settings.provider === "google") {
    return generateWithGemini(settings.api_key!, settings.model, finalPrompt);
  }

  if (settings.provider === "stability") {
    return generateWithStability(settings.api_key!, settings.model, finalPrompt);
  }

  if (settings.provider === "horde") {
    console.log(`[Image gen] Using AI Horde, model=${settings.model}`);
    return generateWithHorde(settings.api_key, settings.model, finalPrompt);
  }

  /** OpenRouter Gemini image models use chat completions, not /images/generations */
  const isOpenRouterGeminiImage =
    settings.provider === "openrouter" &&
    /^google\/gemini.*(?:flash-image|image)/i.test(settings.model);
  if (isOpenRouterGeminiImage) {
    const truncatedPrompt = finalPrompt.slice(0, 500);
    return generateWithOpenRouterChat(settings.api_key!, settings.model, truncatedPrompt);
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
    settings.api_key!,
    settings.model,
    finalPrompt
  );
}
