import { NextRequest, NextResponse } from "next/server";
import { extractInfographicSpec } from "@/lib/infographic-extractor";
import { renderInfographicToBase64 } from "@/lib/infographic-renderer";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { articleContent, primaryKeyword } = body as {
      articleContent?: string;
      primaryKeyword?: string | null;
    };

    if (!articleContent || typeof articleContent !== "string") {
      return NextResponse.json(
        { error: "articleContent is required" },
        { status: 400 }
      );
    }

    const spec = await extractInfographicSpec(
      articleContent,
      primaryKeyword ?? null
    );

    const base64 = await renderInfographicToBase64(spec);

    return NextResponse.json({
      base64,
      mimeType: "image/png",
      title: spec.title,
      spec,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Infographic generation failed";
    console.error("[Infographic] Generate failed:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
