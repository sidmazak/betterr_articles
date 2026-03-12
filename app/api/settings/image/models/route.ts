import { NextRequest, NextResponse } from "next/server";
import { getImageGenerationSettings } from "@/lib/db/settings";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const provider = searchParams.get("provider");
    const apiKey = searchParams.get("api_key");
    const baseUrl = searchParams.get("base_url");

    if (!provider) {
      return NextResponse.json(
        { error: "provider is required" },
        { status: 400 }
      );
    }

    const settings = getImageGenerationSettings();
    const key = apiKey || settings?.api_key;
    const url = baseUrl || settings?.base_url;

    const models = await fetchImageModelsForProvider(provider, key ?? "", url ?? "");
    return NextResponse.json({ models });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch image models";
    return NextResponse.json(
      { error: message, models: [] },
      { status: 500 }
    );
  }
}

async function fetchImageModelsForProvider(
  provider: string,
  apiKey: string,
  baseUrl: string
): Promise<string[]> {
  switch (provider) {
    case "openai": {
      return ["gpt-image-1", "dall-e-3"];
    }
    case "google": {
      if (!apiKey) return [];
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
      );
      if (!res.ok) throw new Error("Google AI API error");
      const data = await res.json();
      const imageModels = ["gemini-2.5-flash-image", "gemini-3.1-flash-image-preview"];
      const fromApi = (data.models ?? [])
        .filter((m: { name?: string }) => {
          const name = (m.name ?? "").replace("models/", "");
          return /image|flash-image|nano/i.test(name);
        })
        .map((m: { name: string }) => m.name.replace("models/", ""));
      return [...new Set([...imageModels, ...fromApi])].slice(0, 20);
    }
    case "openrouter": {
      const res = await fetch("https://openrouter.ai/api/v1/models?output_modality=image");
      if (!res.ok) throw new Error("OpenRouter API error");
      const data = await res.json();
      const models: string[] = (data.data ?? [])
        .filter((m: { id?: string }) => m.id)
        .map((m: { id: string }) => m.id)
        .sort();
      return [...new Set(models)].slice(0, 80);
    }
    case "together": {
      if (!apiKey) return [];
      const res = await fetch("https://api.together.xyz/v1/models", {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (!res.ok) throw new Error("Together AI API error");
      const data = await res.json();
      const imageKeywords = ["flux", "image", "dall-e", "stable-diffusion", "schnell", "dev", "pro", "max", "flex", "klein"];
      const models: string[] = (data ?? [])
        .filter((m: { id?: string; type?: string }) => {
          const id = (m.id ?? "").toLowerCase();
          const type = (m.type ?? "").toLowerCase();
          return m.id && (imageKeywords.some((k) => id.includes(k)) || type.includes("image"));
        })
        .map((m: { id: string }) => m.id)
        .sort();
      return [...new Set(models)].slice(0, 50);
    }
    case "litellm": {
      if (!baseUrl || !apiKey) return [];
      const url = baseUrl.replace(/\/$/, "");
      const res = await fetch(`${url}/models`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (!res.ok) throw new Error("LiteLLM API error");
      const data = await res.json();
      const models: string[] = (data.data ?? data.models ?? [])
        .map((m: { id?: string }) => m.id)
        .filter(Boolean)
        .slice(0, 50);
      return [...new Set(models)];
    }
    case "custom":
      if (!baseUrl || !apiKey) return [];
      try {
        const url = baseUrl.replace(/\/$/, "");
        const res = await fetch(`${url}/models`, {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        if (!res.ok) return [];
        const data = await res.json();
        const models: string[] = (data.data ?? data.models ?? [])
          .map((m: { id?: string }) => m.id)
          .filter(Boolean)
          .slice(0, 80);
        return [...new Set(models)];
      } catch {
        return [];
      }
    default:
      return [];
  }
}
