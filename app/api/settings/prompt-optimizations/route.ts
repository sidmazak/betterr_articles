import { NextRequest, NextResponse } from "next/server";
import {
  getPromptOptimizationSettings,
  savePromptOptimizationSettings,
} from "@/lib/db/settings";

export async function GET() {
  return NextResponse.json(getPromptOptimizationSettings());
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const format =
      body?.structured_data_format === "json" ? "json" : "toon";

    const saved = savePromptOptimizationSettings({
      structured_data_format: format,
    });

    return NextResponse.json(saved);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to save prompt optimization settings";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
