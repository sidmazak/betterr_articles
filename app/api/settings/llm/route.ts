import { NextRequest, NextResponse } from "next/server";
import {
  getLLMSettings,
  getAllLLMSettings,
  saveLLMSettings,
  updateLLMSettings,
  deleteLLMSettings,
} from "@/lib/db/settings";

export async function GET() {
  try {
    const settings = getAllLLMSettings();
    const defaultSetting = getLLMSettings();
    return NextResponse.json({ settings, default: defaultSetting });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to get LLM settings";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { provider, api_key, model, base_url, is_default } = body;

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
    });
    return NextResponse.json(saved);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to save LLM settings";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, api_key, model, base_url, is_default } = body;

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    updateLLMSettings(id, { api_key, model, base_url, is_default });
    return NextResponse.json(getLLMSettings());
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
