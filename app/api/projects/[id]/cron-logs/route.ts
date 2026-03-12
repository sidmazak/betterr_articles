import { NextRequest, NextResponse } from "next/server";
import { getProject } from "@/lib/db/projects";
import { listCronLogs } from "@/lib/db/cron-logs";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const project = getProject(projectId);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") as "crawl" | "article_schedule" | undefined;
    const limit = parseInt(searchParams.get("limit") ?? "50", 10);
    const logs = listCronLogs({ projectId, type, limit });
    return NextResponse.json(logs);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to get cron logs";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
