import { NextResponse } from "next/server";
import { getProject } from "@/lib/db/projects";
import { getProjectPublishingConfig, updateProjectPublishingConfig } from "@/lib/db/settings";
import { testPublishingConfigConnection } from "@/lib/publishing";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ projectId: string; configId: string }> }
) {
  try {
    const { projectId, configId } = await params;
    const project = getProject(projectId);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const config = getProjectPublishingConfig(configId);
    if (!config || config.project_id !== projectId) {
      return NextResponse.json({ error: "Publishing config not found" }, { status: 404 });
    }

    const result = await testPublishingConfigConnection(configId);
    updateProjectPublishingConfig(configId, {
      last_tested_at: new Date().toISOString(),
      last_error: result.success ? null : result.message,
    });

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to test publishing config";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
