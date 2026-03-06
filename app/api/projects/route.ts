import { NextRequest, NextResponse } from "next/server";
import { createProject, listProjects, getProjectStats } from "@/lib/db/projects";

export async function GET() {
  try {
    const projects = listProjects();
    const withStats = projects.map((p) => ({
      ...p,
      ...getProjectStats(p.id),
    }));
    return NextResponse.json(withStats);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to list projects";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, homepageUrl } = body;

    if (!name || typeof name !== "string") {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const project = createProject(name, homepageUrl);
    return NextResponse.json(project);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create project";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
