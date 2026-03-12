import { NextRequest, NextResponse } from "next/server";
import { getProject } from "@/lib/db/projects";
import {
  getCalendarGenerationJob,
  listCalendarGenerationJobLogs,
} from "@/lib/db/calendar-generation-jobs";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; jobId: string }> }
) {
  try {
    const { id: projectId, jobId } = await params;
    const project = getProject(projectId);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const job = getCalendarGenerationJob(jobId);
    if (!job || job.project_id !== projectId) {
      return NextResponse.json({ error: "Calendar generation job not found" }, { status: 404 });
    }

    return NextResponse.json({
      ...job,
      logs: listCalendarGenerationJobLogs(jobId),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load calendar generation job";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
