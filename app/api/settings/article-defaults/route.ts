import { NextRequest, NextResponse } from "next/server";
import { getAppSetting, setAppSetting } from "@/lib/db/settings";
import type { ArticlePipelineInput } from "@/lib/prompts/types";

const KEY = "article_defaults";

export async function GET() {
  try {
    const raw = getAppSetting(KEY);
    if (!raw) return NextResponse.json({});
    const config = JSON.parse(raw) as Partial<ArticlePipelineInput>;
    return NextResponse.json(config);
  } catch {
    return NextResponse.json({});
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = (await request.json()) as Partial<ArticlePipelineInput>;
    setAppSetting(KEY, JSON.stringify(body));
    const raw = getAppSetting(KEY);
    return NextResponse.json(raw ? JSON.parse(raw) : {});
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to save app article defaults";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
