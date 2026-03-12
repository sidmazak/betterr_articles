import { NextRequest, NextResponse } from "next/server";
import {
  getLLMSettings,
  getAllLLMSettings,
  hasConfiguredLLMSettings,
  saveLLMSettings,
  updateLLMSettings,
  deleteLLMSettings,
} from "@/lib/db/settings";
import type { LLMProvider } from "@/lib/db/settings";

function maskApiKey(key: string | null): string | null {
  if (!key || key.length < 8) return key ? "••••••••" : null;
  return "••••••••" + key.slice(-4);
}

function toSafeLLMSetting<T extends { api_key: string | null; provider: string; model: string | null }>(
  setting: T,
  includeSecret = false
) {
  return {
    ...setting,
    api_key: includeSecret ? setting.api_key : undefined,
    api_key_masked: maskApiKey(setting.api_key),
    api_key_set: !!setting.api_key,
    is_configured: hasConfiguredLLMSettings({
      provider: setting.provider as LLMProvider,
      api_key: setting.api_key,
      model: setting.model ?? "",
    }),
  };
}

export async function GET(request: NextRequest) {
  try {
    const includeSecrets = request.nextUrl.searchParams.get("includeSecrets") === "1";
    const all = getAllLLMSettings();
    const defaultSetting = getLLMSettings();
    const settings = all.map((setting) => toSafeLLMSetting(setting, includeSecrets));
    const defaultSafe = defaultSetting ? toSafeLLMSetting(defaultSetting, includeSecrets) : null;
    return NextResponse.json({ settings, default: defaultSafe });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to get LLM settings";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { provider, api_key, model, base_url, is_default, enable_thinking } = body;

    if (!provider || !api_key || !model) {
      return NextResponse.json(
        { error: "provider, api_key, and model are required" },
        { status: 400 }
      );
    }

    const saved = saveLLMSettings({
      provider,
      api_key,
      model,
      base_url,
      is_default: is_default ?? true,
      enable_thinking: enable_thinking ?? false,
    });
    return NextResponse.json(toSafeLLMSetting(saved));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to save LLM settings";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, api_key, provider, model, base_url, is_default, enable_thinking } = body;

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const updates: Partial<{ api_key: string; provider: LLMProvider; model: string; base_url: string; is_default: boolean; enable_thinking: boolean }> = {
      model,
      base_url,
      is_default,
      enable_thinking,
    };
    if (provider !== undefined) updates.provider = provider as LLMProvider;
    if (api_key !== undefined && api_key !== "") updates.api_key = api_key;
    updateLLMSettings(id, updates);
    const updated = getLLMSettings();
    const safe = updated ? toSafeLLMSetting(updated) : null;
    return NextResponse.json(safe);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update LLM settings";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }
    deleteLLMSettings(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to delete LLM settings";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
