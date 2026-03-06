import { NextRequest, NextResponse } from "next/server";
import { getProject } from "@/lib/db/projects";
import { getCalendarItem, deleteCalendarItem } from "@/lib/db/calendar";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const { id: projectId, itemId } = await params;
    const project = getProject(projectId);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    const item = getCalendarItem(itemId);
    if (!item || item.project_id !== projectId) {
      return NextResponse.json({ error: "Calendar item not found" }, { status: 404 });
    }
    const ok = deleteCalendarItem(itemId);
    if (!ok) return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
    return NextResponse.json({ deleted: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to delete calendar item";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
