import { NextRequest, NextResponse } from "next/server";
import { getLLMSettings } from "@/lib/db/settings";

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

    const settings = getLLMSettings();
    const key = apiKey || settings?.api_key;
    const url = baseUrl || settings?.base_url;

    const models = await fetchModelsForProvider(provider, key ?? "", url ?? "");
    return NextResponse.json({ models });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch models";
    return NextResponse.json(
      { error: message, models: [] },
      { status: 500 }
    );
  }
}

async function fetchModelsForProvider(
  provider: string,
  apiKey: string,
  baseUrl: string
): Promise<string[]> {
  switch (provider) {
    case "nvidia": {
      if (!apiKey) return [];
      const res = await fetch("https://integrate.api.nvidia.com/v1/models", {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      });
      if (!res.ok) throw new Error("NVIDIA API error");
      const data = await res.json();
      const models: string[] = (data.data ?? [])
        .filter((m: { id?: string }) => m.id)
        .map((m: { id: string }) => m.id)
        .sort();
      return [...new Set(models)].slice(0, 80);
    }
    case "openai": {
      if (!apiKey) return [];
      const res = await fetch("https://api.openai.com/v1/models", {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (!res.ok) throw new Error("OpenAI API error");
      const data = await res.json();
      const models: string[] = (data.data ?? [])
        .filter((m: { id: string }) => m.id?.includes("gpt") || m.id?.includes("o1"))
        .map((m: { id: string }) => m.id)
        .sort();
      return [...new Set(models)].slice(0, 50);
    }
    case "anthropic": {
      if (!apiKey) return [];
      const res = await fetch("https://api.anthropic.com/v1/models", {
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
      });
      if (!res.ok) throw new Error("Anthropic API error");
      const data = await res.json();
      return (data.models ?? []).map((m: { id: string }) => m.id).slice(0, 30);
    }
    case "openrouter": {
      const res = await fetch("https://openrouter.ai/api/v1/models");
      if (!res.ok) throw new Error("OpenRouter API error");
      const data = await res.json();
      return (data.data ?? [])
        .filter((m: { id?: string }) => m.id)
        .map((m: { id: string }) => m.id)
        .slice(0, 100);
    }
    case "google": {
      if (!apiKey) return [];
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
      );
      if (!res.ok) throw new Error("Google AI API error");
      const data = await res.json();
      return (data.models ?? [])
        .filter((m: { name?: string }) => m.name?.includes("generateContent"))
        .map((m: { name: string }) => m.name.replace("models/", ""))
        .slice(0, 30);
    }
    case "together": {
      if (!apiKey) return [];
      const res = await fetch("https://api.together.xyz/v1/models", {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (!res.ok) throw new Error("Together AI API error");
      const data = await res.json();
      return (data ?? [])
        .filter((m: { id?: string }) => m.id)
        .map((m: { id: string }) => m.id)
        .slice(0, 50);
    }
    case "groq": {
      if (!apiKey) return [];
      const res = await fetch("https://api.groq.com/openai/v1/models", {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (!res.ok) throw new Error("Groq API error");
      const data = await res.json();
      return (data.data ?? []).map((m: { id: string }) => m.id).slice(0, 30);
    }
    case "litellm": {
      if (!baseUrl || !apiKey) return [];
      const url = baseUrl.replace(/\/$/, "");
      const res = await fetch(`${url}/models`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (!res.ok) throw new Error("LiteLLM API error");
      const data = await res.json();
      return (data.data ?? []).map((m: { id: string }) => m.id).slice(0, 50);
    }
    default:
      return [];
  }
}
