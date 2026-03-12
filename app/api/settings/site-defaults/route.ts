import { NextRequest, NextResponse } from "next/server";
import { getAppSetting, setAppSetting } from "@/lib/db/settings";

const KEY = "default_site_settings";
const DEFAULTS = {
  auto_publish: 0,
  auto_internal_links: 1,
  auto_external_links: 1,
  auto_infographics: 1,
  auto_images: 0,
  eeat_optimization: 1,
};

export async function GET() {
  try {
    const raw = getAppSetting(KEY);
    if (!raw) return NextResponse.json(DEFAULTS);
    const parsed = JSON.parse(raw) as Record<string, number>;
    return NextResponse.json({
      auto_publish: parsed.auto_publish ?? DEFAULTS.auto_publish,
      auto_internal_links: parsed.auto_internal_links ?? DEFAULTS.auto_internal_links,
      auto_external_links: parsed.auto_external_links ?? DEFAULTS.auto_external_links,
      auto_infographics: parsed.auto_infographics ?? DEFAULTS.auto_infographics,
      auto_images: parsed.auto_images ?? DEFAULTS.auto_images,
      eeat_optimization: parsed.eeat_optimization ?? DEFAULTS.eeat_optimization,
    });
  } catch {
    return NextResponse.json(DEFAULTS);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      auto_publish,
      auto_internal_links,
      auto_external_links,
      auto_infographics,
      auto_images,
      eeat_optimization,
    } = body;
    const value = JSON.stringify({
      auto_publish: auto_publish ?? DEFAULTS.auto_publish,
      auto_internal_links: auto_internal_links ?? DEFAULTS.auto_internal_links,
      auto_external_links: auto_external_links ?? DEFAULTS.auto_external_links,
      auto_infographics: auto_infographics ?? DEFAULTS.auto_infographics,
      auto_images: auto_images ?? DEFAULTS.auto_images,
      eeat_optimization: eeat_optimization ?? DEFAULTS.eeat_optimization,
    });
    setAppSetting(KEY, value);
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to save";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
