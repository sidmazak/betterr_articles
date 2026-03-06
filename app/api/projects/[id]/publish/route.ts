import { NextRequest, NextResponse } from "next/server";
import { getProject } from "@/lib/db/projects";
import { publishArticle } from "@/lib/publishing";
import { sendNotification } from "@/lib/notifications";
import { upsertArticle } from "@/lib/db/articles";
import { updateCalendarItemStatus } from "@/lib/db/calendar";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const project = getProject(projectId);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const body = await request.json();
    const { title, content, excerpt, tags, calendarItemId } = body as {
      title: string;
      content: string;
      excerpt?: string;
      tags?: string[];
      calendarItemId?: string;
    };

    if (!title || !content) {
      return NextResponse.json(
        { error: "title and content are required" },
        { status: 400 }
      );
    }

    const result = await publishArticle(projectId, title, content, {
      excerpt,
      tags,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error ?? "Publish failed" },
        { status: 500 }
      );
    }

    if (calendarItemId) {
      upsertArticle(projectId, calendarItemId, {
        content,
        status: "published",
        published_url: result.url ?? undefined,
      });
      updateCalendarItemStatus(calendarItemId, "completed");
    }

    sendNotification(
      "article_published",
      "Article published",
      `"${title}" was published successfully.${result.url ? ` URL: ${result.url}` : ""}`,
      project.name
    ).catch(() => {});

    return NextResponse.json({
      success: true,
      url: result.url,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Publish failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
