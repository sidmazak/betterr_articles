import {
  getProjectPublishingConfig,
  listAutoPublishProjectPublishingConfigs,
  listEnabledProjectPublishingConfigs,
  listProjectPublishingConfigs,
  recordPublishingAttempt,
  updateProjectPublishingConfig,
  type PublishingPlatform,
} from "@/lib/db/settings";
import { wordPressAdapter } from "./adapters/wordpress";
import { ghostAdapter } from "./adapters/ghost";
import { mediumAdapter } from "./adapters/medium";
import { webhookAdapter } from "./adapters/webhook";
import { wixAdapter } from "./adapters/wix";
import { odooAdapter } from "./adapters/odoo";
import type {
  PublishMetadata,
  PublishPayload,
  PublishResult,
  PublisherAdapter,
  PublisherConnectionResult,
  PublishTargetResult,
} from "./types";

const PUBLISHER_REGISTRY: Record<PublishingPlatform, PublisherAdapter> = {
  wordpress: wordPressAdapter,
  ghost: ghostAdapter,
  medium: mediumAdapter,
  webhook: webhookAdapter,
  wix: wixAdapter,
  odoo: odooAdapter,
};

export async function publishArticle(
  projectId: string,
  title: string,
  content: string,
  metadata?: PublishMetadata
): Promise<PublishResult> {
  const result = await publishArticleToPlatforms(projectId, { title, content, metadata });
  const firstSuccess = result.results.find((item) => item.success);
  return firstSuccess
    ? { success: true, url: firstSuccess.url, details: { results: result.results } }
    : {
        success: false,
        error: result.results.map((item) => `${item.label}: ${item.error ?? "Unknown error"}`).join(" | "),
        details: { results: result.results },
      };
}

export async function publishArticleToPlatforms(
  projectId: string,
  payload: PublishPayload,
  options?: {
    articleId?: string | null;
    calendarItemId?: string | null;
    publishingConfigIds?: string[];
    autoPublishOnly?: boolean;
  }
) {
  const configs = options?.publishingConfigIds?.length
    ? options.publishingConfigIds
        .map((id) => getProjectPublishingConfig(id))
        .filter((config): config is NonNullable<typeof config> => !!config && config.project_id === projectId && config.enabled === 1)
    : options?.autoPublishOnly
      ? listAutoPublishProjectPublishingConfigs(projectId)
      : listEnabledProjectPublishingConfigs(projectId);

  if (configs.length === 0) {
    return {
      results: [
        {
          configId: "none",
          platform: "none",
          label: "No configured publisher",
          success: false,
          error: options?.autoPublishOnly
            ? "No enabled auto-publish destinations are configured for this project."
            : "No enabled publishing destinations are configured for this project.",
        },
      ] satisfies PublishTargetResult[],
    };
  }

  const results: PublishTargetResult[] = [];
  for (const config of configs) {
    const adapter = PUBLISHER_REGISTRY[config.platform as PublishingPlatform];
    if (!adapter) {
      results.push({
        configId: config.id,
        platform: config.platform,
        label: config.label,
        success: false,
        error: `Platform ${config.platform} is not supported.`,
      });
      continue;
    }

    const parsedConfig = JSON.parse(config.config) as Record<string, unknown>;
    const publishResult = await adapter.publish(parsedConfig, payload);
    updateProjectPublishingConfig(config.id, {
      last_error: publishResult.success ? null : publishResult.error ?? "Publish failed",
    });
    results.push({
      configId: config.id,
      platform: config.platform,
      label: config.label,
      ...publishResult,
    });

    recordPublishingAttempt({
      projectId,
      articleId: options?.articleId ?? null,
      calendarItemId: options?.calendarItemId ?? null,
      publishingConfigId: config.id,
      platform: config.platform,
      label: config.label,
      status: publishResult.success ? "success" : "failed",
      title: payload.title,
      publishedUrl: publishResult.url ?? null,
      errorMessage: publishResult.error ?? null,
      response: publishResult.details ?? null,
    });
  }

  return { results };
}

export async function testPublishingConfigConnection(configId: string): Promise<PublisherConnectionResult> {
  const config = getProjectPublishingConfig(configId);
  if (!config) {
    return { success: false, message: "Publishing config not found." };
  }

  const adapter = PUBLISHER_REGISTRY[config.platform as PublishingPlatform];
  if (!adapter) {
    return { success: false, message: `Platform ${config.platform} is not supported.` };
  }

  const parsedConfig = JSON.parse(config.config) as Record<string, unknown>;
  return adapter.testConnection(parsedConfig);
}

export function listConfiguredPublishingPlatforms(projectId: string) {
  return listProjectPublishingConfigs(projectId).map((config) => ({
    id: config.id,
    platform: config.platform,
    label: config.label,
    enabled: config.enabled === 1,
    auto_publish: config.auto_publish === 1,
    last_error: config.last_error,
    last_tested_at: config.last_tested_at,
  }));
}

export { PUBLISHING_PLATFORMS } from "@/lib/publishing-constants";
