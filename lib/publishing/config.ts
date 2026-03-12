import { PUBLISHING_PLATFORMS, PUBLISHING_SECRET_FIELD_IDS } from "@/lib/publishing-constants";
import type { PublishingConfig } from "@/lib/db/settings";

export function getPublishingPlatformDefinition(platformId: string) {
  return PUBLISHING_PLATFORMS.find((platform) => platform.id === platformId);
}

export function validatePublishingConfig(platformId: string, config: Record<string, unknown>) {
  const platform = getPublishingPlatformDefinition(platformId);
  if (!platform) {
    return { valid: false, error: `Unsupported platform: ${platformId}` };
  }

  for (const field of platform.fields) {
    if (!field.required) continue;
    const value = config[field.id];
    if (typeof value !== "string" || !value.trim()) {
      return { valid: false, error: `${platform.name}: ${field.label} is required.` };
    }
  }

  const headersJson = config.headersJson;
  if (typeof headersJson === "string" && headersJson.trim()) {
    try {
      JSON.parse(headersJson);
    } catch {
      return { valid: false, error: `${platform.name}: Extra headers JSON must be valid JSON.` };
    }
  }

  return { valid: true };
}

export function sanitizePublishingConfig(configRow: PublishingConfig) {
  const parsed = safeParseConfig(configRow.config);
  const secretFields: string[] = [];
  const maskedConfig: Record<string, string> = {};

  for (const [key, value] of Object.entries(parsed)) {
    if (PUBLISHING_SECRET_FIELD_IDS.has(key)) {
      secretFields.push(key);
      maskedConfig[key] = "";
      continue;
    }
    maskedConfig[key] = typeof value === "string" ? value : JSON.stringify(value);
  }

  return {
    id: configRow.id,
    project_id: configRow.project_id,
    platform: configRow.platform,
    label: configRow.label,
    enabled: !!configRow.enabled,
    auto_publish: !!configRow.auto_publish,
    config: maskedConfig,
    secret_fields_set: secretFields,
    last_tested_at: configRow.last_tested_at,
    last_error: configRow.last_error,
    created_at: configRow.created_at,
    updated_at: configRow.updated_at,
  };
}

export function mergePublishingConfigWithSecrets(
  platformId: string,
  currentConfigJson: string,
  incomingConfig: Record<string, unknown>
) {
  const currentConfig = safeParseConfig(currentConfigJson);
  const platform = getPublishingPlatformDefinition(platformId);
  if (!platform) return incomingConfig;

  const merged: Record<string, unknown> = {};
  for (const field of platform.fields) {
    const incoming = incomingConfig[field.id];
    if (field.secret) {
      if (typeof incoming === "string" && incoming.trim()) {
        merged[field.id] = incoming.trim();
      } else if (typeof currentConfig[field.id] === "string" && currentConfig[field.id]) {
        merged[field.id] = currentConfig[field.id];
      }
      continue;
    }

    if (typeof incoming === "string") {
      merged[field.id] = incoming;
    } else if (typeof currentConfig[field.id] === "string") {
      merged[field.id] = currentConfig[field.id];
    }
  }

  return merged;
}

export function safeParseConfig(value: string) {
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    return typeof parsed === "object" && parsed ? parsed : {};
  } catch {
    return {};
  }
}
