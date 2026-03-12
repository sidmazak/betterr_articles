import { NextRequest, NextResponse } from "next/server";
import { getProject } from "@/lib/db/projects";
import {
  listPublishingAttempts,
  listProjectPublishingConfigs,
  saveProjectPublishingConfig,
} from "@/lib/db/settings";
import { sanitizePublishingConfig, validatePublishingConfig } from "@/lib/publishing/config";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const project = getProject(projectId);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    const configs = listProjectPublishingConfigs(projectId).map(sanitizePublishingConfig);
    const attempts = listPublishingAttempts(projectId, 20);
    return NextResponse.json({ configs, attempts });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to get publishing config";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const project = getProject(projectId);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const body = await request.json();
    const { platform, label, config, enabled = true, auto_publish = false } = body;

    if (!platform || !config || typeof config !== "object") {
      return NextResponse.json(
        { error: "platform and config are required" },
        { status: 400 }
      );
    }

    const validation = validatePublishingConfig(platform, config as Record<string, unknown>);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const saved = saveProjectPublishingConfig(projectId, {
      platform,
      label,
      config: config as Record<string, unknown>,
      enabled,
      auto_publish,
    });
    return NextResponse.json(sanitizePublishingConfig(saved));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to save publishing config";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
