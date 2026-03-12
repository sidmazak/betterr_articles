import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import {
  getAppSetting,
  getImageGenerationSettings,
  saveImageGenerationSettings,
  setAppSetting,
  type ImageGenerationProvider,
} from "@/lib/db/settings";

function maskApiKey(key: string | null) {
  if (!key || key.length < 8) return key ? "••••••••" : null;
  return "••••••••" + key.slice(-4);
}

function toSafeSettings(includeSecrets = false) {
  const settings = getImageGenerationSettings();
  if (!settings) return null;

  return {
    ...settings,
    api_key: includeSecrets ? settings.api_key : undefined,
    api_key_set: !!settings.api_key,
    api_key_masked: maskApiKey(settings.api_key),
    is_configured: !!(settings.enabled && settings.api_key?.trim() && settings.model?.trim()),
  };
}

export async function GET(request: NextRequest) {
  const includeSecrets = request.nextUrl.searchParams.get("includeSecrets") === "1";
  return NextResponse.json(toSafeSettings(includeSecrets));
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const current = getImageGenerationSettings();

    if (!body.provider || !body.model) {
      return NextResponse.json(
        { error: "provider and model are required" },
        { status: 400 }
      );
    }

    if (!current?.api_key && !body.api_key?.trim()) {
      return NextResponse.json(
        { error: "API key is required for image generation setup." },
        { status: 400 }
      );
    }

    if (body.provider === "custom" && !body.base_url?.trim()) {
      return NextResponse.json(
        { error: "Base URL is required for custom image provider." },
        { status: 400 }
      );
    }

    saveImageGenerationSettings({
      provider: body.provider as ImageGenerationProvider,
      api_key: body.api_key !== undefined && body.api_key !== "" ? body.api_key : current?.api_key ?? null,
      model: body.model,
      base_url: body.base_url || null,
      style_prompt: body.style_prompt || null,
      enabled: body.enabled === false ? 0 : 1,
    });

    const apiKeySet = (body.api_key !== undefined && body.api_key !== "" ? body.api_key : current?.api_key ?? "")?.trim();
    if (apiKeySet && body.enabled !== false) {
      const defaultsKey = "default_site_settings";
      const raw = getAppSetting(defaultsKey);
      const defaults = raw ? (JSON.parse(raw) as Record<string, number>) : {};
      setAppSetting(defaultsKey, JSON.stringify({ ...defaults, auto_images: 1 }));
      getDb().prepare("UPDATE project_site_settings SET auto_images = 1").run();
    }

    return NextResponse.json(toSafeSettings());
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to save image settings";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
