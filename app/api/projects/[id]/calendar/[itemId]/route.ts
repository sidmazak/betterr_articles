import { NextRequest, NextResponse } from "next/server";
import { getProject } from "@/lib/db/projects";
import { getCalendarItem, deleteCalendarItem, updateCalendarItem } from "@/lib/db/calendar";

function formatDateOnly(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export async function PATCH(
  request: NextRequest,
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
    const body = await request.json().catch(() => ({}));
    const todayValue = formatDateOnly(new Date());
    const updates: Record<string, unknown> = {};
    if (typeof body.title === "string") updates.title = body.title;
    if (typeof body.primaryKeyword === "string") updates.primary_keyword = body.primaryKeyword;
    if (body.secondaryKeywords !== undefined) updates.secondary_keywords = Array.isArray(body.secondaryKeywords) ? JSON.stringify(body.secondaryKeywords) : body.secondaryKeywords;
    if (typeof body.suggestedDate === "string" || body.suggestedDate === null) {
      if (typeof body.suggestedDate === "string" && body.suggestedDate < todayValue) {
        return NextResponse.json(
          { error: "Scheduled articles can only be moved to today or a future date." },
          { status: 400 }
        );
      }
      updates.suggested_date = body.suggestedDate;
    }
    if (typeof body.targetUrl === "string" || body.targetUrl === null) updates.target_url = body.targetUrl;
    if (typeof body.contentGapRationale === "string" || body.contentGapRationale === null) updates.content_gap_rationale = body.contentGapRationale;
    if (body.internalLinkTargets !== undefined) updates.internal_link_targets = Array.isArray(body.internalLinkTargets) ? JSON.stringify(body.internalLinkTargets) : body.internalLinkTargets;
    if (body.infographicConcepts !== undefined) updates.infographic_concepts = Array.isArray(body.infographicConcepts) ? JSON.stringify(body.infographicConcepts) : body.infographicConcepts;
    if (typeof body.rankingPotential === "string" || body.rankingPotential === null) updates.ranking_potential = body.rankingPotential;
    if (typeof body.rankingJustification === "string" || body.rankingJustification === null) updates.ranking_justification = body.rankingJustification;
    const updated = updateCalendarItem(itemId, updates as Parameters<typeof updateCalendarItem>[1]);
    if (!updated) return NextResponse.json({ error: "Failed to update" }, { status: 500 });
    return NextResponse.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update calendar item";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

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
