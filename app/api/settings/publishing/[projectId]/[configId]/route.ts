import { NextRequest, NextResponse } from "next/server";
import { getProject } from "@/lib/db/projects";
import {
  deleteProjectPublishingConfig,
  getProjectPublishingConfig,
  updateProjectPublishingConfig,
} from "@/lib/db/settings";
import {
  mergePublishingConfigWithSecrets,
  sanitizePublishingConfig,
  validatePublishingConfig,
} from "@/lib/publishing/config";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; configId: string }> }
) {
  try {
    const { projectId, configId } = await params;
    const project = getProject(projectId);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const current = getProjectPublishingConfig(configId);
    if (!current || current.project_id !== projectId) {
      return NextResponse.json({ error: "Publishing config not found" }, { status: 404 });
    }

    const body = await request.json();
    const nextPlatform = body.platform ?? current.platform;
    const mergedConfig = mergePublishingConfigWithSecrets(
      nextPlatform,
      current.config,
      (body.config ?? {}) as Record<string, unknown>
    );
    const validation = validatePublishingConfig(nextPlatform, mergedConfig);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const updated = updateProjectPublishingConfig(configId, {
      platform: nextPlatform,
      label: typeof body.label === "string" ? body.label : current.label,
      config: mergedConfig,
      enabled: typeof body.enabled === "boolean" ? body.enabled : current.enabled === 1,
      auto_publish: typeof body.auto_publish === "boolean" ? body.auto_publish : current.auto_publish === 1,
      last_error: current.last_error,
      last_tested_at: current.last_tested_at,
    });

    return NextResponse.json(updated ? sanitizePublishingConfig(updated) : null);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update publishing config";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string; configId: string }> }
) {
  try {
    const { projectId, configId } = await params;
    const project = getProject(projectId);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const current = getProjectPublishingConfig(configId);
    if (!current || current.project_id !== projectId) {
      return NextResponse.json({ error: "Publishing config not found" }, { status: 404 });
    }

    deleteProjectPublishingConfig(configId);
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to delete publishing config";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
