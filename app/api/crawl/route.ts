import { NextRequest, NextResponse } from "next/server";
import { crawlWebsite } from "@/lib/crawler";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url } = body;

    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid url" },
        { status: 400 }
      );
    }

    const result = await crawlWebsite(url);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Crawl failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
