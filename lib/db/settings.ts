import { v4 as uuid } from "uuid";
import {
  getDb,
  type ProjectPublishingRow,
  type PublishingAttemptRow,
} from "./index";

export type LLMProvider =
  | "nvidia"
  | "openai"
  | "anthropic"
  | "openrouter"
  | "google"
  | "litellm"
  | "together"
  | "groq";

export interface LLMSettings {
  id: string;
  provider: LLMProvider;
  api_key: string | null;
  model: string;
  base_url: string | null;
  is_default: number;
  enable_thinking?: number;
  created_at: string;
  updated_at: string;
}

export type ImageGenerationProvider =
  | "openai"
  | "openrouter"
  | "together"
  | "litellm"
  | "google"
  | "stability"
  | "horde"
  | "custom";

export interface ImageGenerationSettings {
  provider: ImageGenerationProvider;
  api_key: string | null;
  model: string;
  base_url: string | null;
  style_prompt: string | null;
  enabled: number;
}

export interface PromptOptimizationSettings {
  structured_data_format: "toon" | "json";
}

export function hasConfiguredLLMSettings(
  settings: Pick<LLMSettings, "provider" | "api_key" | "model"> | null | undefined
): boolean {
  return !!(
    settings?.provider &&
    settings.model?.trim() &&
    settings.api_key?.trim()
  );
}

export function getLLMSettings(): LLMSettings | null {
  const db = getDb();
  return db
    .prepare(
      "SELECT * FROM llm_settings WHERE is_default = 1 ORDER BY updated_at DESC LIMIT 1"
    )
    .get() as LLMSettings | null;
}

export function getAllLLMSettings(): LLMSettings[] {
  const db = getDb();
  return db.prepare("SELECT * FROM llm_settings ORDER BY is_default DESC, updated_at DESC").all() as LLMSettings[];
}

function looksLikeModelId(s: string): boolean {
  const t = s.trim();
  return t.includes("/") || /::/.test(t) || /^[\w.-]+\/[\w.-]+$/i.test(t);
}

export function hasConfiguredDefaultLLM(): boolean {
  return hasConfiguredLLMSettings(getLLMSettings());
}

export function getImageGenerationSettings(): ImageGenerationSettings | null {
  const raw = getAppSetting("image_generation_settings");
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<ImageGenerationSettings>;
    if (!parsed.provider || !parsed.model) return null;
    let stylePrompt = parsed.style_prompt ?? null;
    if (stylePrompt && looksLikeModelId(stylePrompt)) {
      stylePrompt = null;
    }
    return {
      provider: parsed.provider,
      api_key: parsed.api_key ?? null,
      model: parsed.model,
      base_url: parsed.base_url ?? null,
      style_prompt: stylePrompt,
      enabled: parsed.enabled === 0 ? 0 : 1,
    };
  } catch {
    return null;
  }
}

export function isImageGenerationConfigured(): boolean {
  const settings = getImageGenerationSettings();
  if (!settings || settings.enabled === 0 || !settings.model?.trim()) return false;
  if (settings.provider === "horde") return true;
  return !!settings.api_key?.trim();
}

export function saveImageGenerationSettings(
  settings: Partial<ImageGenerationSettings> & Pick<ImageGenerationSettings, "provider" | "model">
) {
  const current = getImageGenerationSettings();
  const next: ImageGenerationSettings = {
    provider: settings.provider,
    api_key: settings.api_key ?? current?.api_key ?? null,
    model: settings.model,
    base_url: settings.base_url ?? current?.base_url ?? null,
    style_prompt: (() => {
      const v = settings.style_prompt ?? current?.style_prompt ?? null;
      return v && !looksLikeModelId(v) ? v : null;
    })(),
    enabled: settings.enabled === 0 ? 0 : 1,
  };

  setAppSetting("image_generation_settings", JSON.stringify(next));
  return getImageGenerationSettings();
}

export function getPromptOptimizationSettings(): PromptOptimizationSettings {
  const raw = getAppSetting("prompt_optimization_settings");
  if (!raw) {
    return {
      structured_data_format: "toon",
    };
  }

  try {
    const parsed = JSON.parse(raw) as Partial<PromptOptimizationSettings>;
    return {
      structured_data_format:
        parsed.structured_data_format === "json" ? "json" : "toon",
    };
  } catch {
    return {
      structured_data_format: "toon",
    };
  }
}

export function savePromptOptimizationSettings(
  settings: Partial<PromptOptimizationSettings>
) {
  const current = getPromptOptimizationSettings();
  const next: PromptOptimizationSettings = {
    structured_data_format:
      settings.structured_data_format === "json"
        ? "json"
        : settings.structured_data_format === "toon"
          ? "toon"
          : current.structured_data_format,
  };

  setAppSetting("prompt_optimization_settings", JSON.stringify(next));
  return getPromptOptimizationSettings();
}

export function saveLLMSettings(settings: {
  provider: LLMProvider;
  api_key: string;
  model: string;
  base_url?: string;
  is_default?: boolean;
  enable_thinking?: boolean;
}): LLMSettings {
  const db = getDb();
  const id = uuid();
  const now = new Date().toISOString();
  if (settings.is_default) {
    db.prepare("UPDATE llm_settings SET is_default = 0").run();
  }
  db.prepare(
    `INSERT INTO llm_settings (id, provider, api_key, model, base_url, is_default, enable_thinking, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    settings.provider,
    settings.api_key,
    settings.model,
    settings.base_url ?? null,
    settings.is_default ? 1 : 0,
    settings.enable_thinking ? 1 : 0,
    now,
    now
  );
  return getLLMSettings()!;
}

export function updateLLMSettings(
  id: string,
  updates: Partial<{ api_key: string; provider: LLMProvider; model: string; base_url: string; is_default: boolean; enable_thinking: boolean }>
): void {
  const db = getDb();
  const now = new Date().toISOString();
  if (updates.is_default) {
    db.prepare("UPDATE llm_settings SET is_default = 0").run();
  }
  const current = db.prepare("SELECT * FROM llm_settings WHERE id = ?").get(id) as LLMSettings | null;
  if (!current) return;
  const provider = updates.provider ?? current.provider;
  const apiKey = updates.api_key ?? current.api_key;
  const model = updates.model ?? current.model;
  const baseUrl = updates.base_url !== undefined ? updates.base_url : current.base_url;
  const isDefault = updates.is_default !== undefined ? (updates.is_default ? 1 : 0) : current.is_default;
  const enableThinking = updates.enable_thinking !== undefined ? (updates.enable_thinking ? 1 : 0) : (current.enable_thinking ?? 0);
  db.prepare(
    `UPDATE llm_settings SET
     api_key = COALESCE(?, api_key),
     provider = ?,
     model = COALESCE(?, model),
     base_url = COALESCE(?, base_url),
     is_default = ?,
     enable_thinking = ?,
     updated_at = ? WHERE id = ?`
  ).run(apiKey, provider, model, baseUrl, isDefault, enableThinking, now, id);
}

export function deleteLLMSettings(id: string): void {
  const db = getDb();
  db.prepare("DELETE FROM llm_settings WHERE id = ?").run(id);
}

export type PublishingPlatform = "wordpress" | "wix" | "odoo" | "webhook" | "medium" | "ghost";

export type PublishingConfig = ProjectPublishingRow;

export function listProjectPublishingConfigs(projectId: string): PublishingConfig[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT * FROM project_publishing
       WHERE project_id = ?
       ORDER BY enabled DESC, auto_publish DESC, updated_at DESC`
    )
    .all(projectId) as PublishingConfig[];
}

export function getProjectPublishingConfig(configId: string): PublishingConfig | null {
  const db = getDb();
  return db
    .prepare("SELECT * FROM project_publishing WHERE id = ?")
    .get(configId) as PublishingConfig | null;
}

export function listEnabledProjectPublishingConfigs(projectId: string): PublishingConfig[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT * FROM project_publishing
       WHERE project_id = ? AND enabled = 1
       ORDER BY auto_publish DESC, updated_at DESC`
    )
    .all(projectId) as PublishingConfig[];
}

export function listAutoPublishProjectPublishingConfigs(projectId: string): PublishingConfig[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT * FROM project_publishing
       WHERE project_id = ? AND enabled = 1 AND auto_publish = 1
       ORDER BY updated_at DESC`
    )
    .all(projectId) as PublishingConfig[];
}

export function getProjectPublishing(projectId: string): PublishingConfig | null {
  return listEnabledProjectPublishingConfigs(projectId)[0] ?? null;
}

export function saveProjectPublishingConfig(
  projectId: string,
  input: {
    platform: PublishingPlatform;
    label?: string;
    config: Record<string, unknown>;
    enabled?: boolean;
    auto_publish?: boolean;
  }
): PublishingConfig {
  const db = getDb();
  const id = uuid();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO project_publishing
     (id, project_id, platform, label, config, enabled, auto_publish, last_tested_at, last_error, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?)`
  ).run(
    id,
    projectId,
    input.platform,
    input.label?.trim() || input.platform,
    JSON.stringify(input.config),
    input.enabled === false ? 0 : 1,
    input.auto_publish ? 1 : 0,
    now,
    now
  );
  return getProjectPublishingConfig(id)!;
}

export function updateProjectPublishingConfig(
  configId: string,
  updates: Partial<{
    platform: PublishingPlatform;
    label: string;
    config: Record<string, unknown>;
    enabled: boolean;
    auto_publish: boolean;
    last_tested_at: string | null;
    last_error: string | null;
  }>
): PublishingConfig | null {
  const db = getDb();
  const now = new Date().toISOString();
  const current = getProjectPublishingConfig(configId);
  if (!current) return null;

  db.prepare(
    `UPDATE project_publishing SET
     platform = ?,
     label = ?,
     config = ?,
     enabled = ?,
     auto_publish = ?,
     last_tested_at = ?,
     last_error = ?,
     updated_at = ?
     WHERE id = ?`
  ).run(
    updates.platform ?? current.platform,
    updates.label?.trim() || current.label,
    updates.config ? JSON.stringify(updates.config) : current.config,
    updates.enabled !== undefined ? (updates.enabled ? 1 : 0) : current.enabled,
    updates.auto_publish !== undefined ? (updates.auto_publish ? 1 : 0) : current.auto_publish,
    updates.last_tested_at !== undefined ? updates.last_tested_at : current.last_tested_at,
    updates.last_error !== undefined ? updates.last_error : current.last_error,
    now,
    configId
  );
  return getProjectPublishingConfig(configId);
}

export function deleteProjectPublishingConfig(configId: string): boolean {
  const db = getDb();
  const result = db.prepare("DELETE FROM project_publishing WHERE id = ?").run(configId);
  return result.changes > 0;
}

export function recordPublishingAttempt(input: {
  projectId: string;
  articleId?: string | null;
  calendarItemId?: string | null;
  publishingConfigId?: string | null;
  platform: string;
  label?: string | null;
  status: "success" | "failed";
  title: string;
  publishedUrl?: string | null;
  errorMessage?: string | null;
  response?: Record<string, unknown> | null;
}): PublishingAttemptRow {
  const db = getDb();
  const id = uuid();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO publishing_attempts
     (id, project_id, article_id, calendar_item_id, publishing_config_id, platform, label, status, title, published_url, error_message, response_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    input.projectId,
    input.articleId ?? null,
    input.calendarItemId ?? null,
    input.publishingConfigId ?? null,
    input.platform,
    input.label ?? null,
    input.status,
    input.title,
    input.publishedUrl ?? null,
    input.errorMessage ?? null,
    input.response ? JSON.stringify(input.response) : null,
    now
  );
  return db.prepare("SELECT * FROM publishing_attempts WHERE id = ?").get(id) as PublishingAttemptRow;
}

export function listPublishingAttempts(projectId: string, limit = 20): PublishingAttemptRow[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT * FROM publishing_attempts
       WHERE project_id = ?
       ORDER BY created_at DESC
       LIMIT ?`
    )
    .all(projectId, limit) as PublishingAttemptRow[];
}

export function saveProjectPublishing(
  projectId: string,
  platform: PublishingPlatform,
  config: Record<string, unknown>
): PublishingConfig {
  return saveProjectPublishingConfig(projectId, { platform, config });
}

export interface NotificationSettings {
  id: string;
  email: string;
  smtp_host: string | null;
  smtp_port: number | null;
  smtp_user: string | null;
  smtp_pass: string | null;
  use_gmail: number;
  notify_on_crawl: number;
  notify_on_calendar: number;
  notify_on_article: number;
  created_at: string;
  updated_at: string;
}

export function getNotificationSettings(): NotificationSettings | null {
  const db = getDb();
  return db
    .prepare("SELECT * FROM notification_settings ORDER BY updated_at DESC LIMIT 1")
    .get() as NotificationSettings | null;
}

export function saveNotificationSettings(settings: {
  email: string;
  smtp_host?: string;
  smtp_port?: number;
  smtp_user?: string;
  smtp_pass?: string;
  use_gmail?: boolean;
  notify_on_crawl?: boolean;
  notify_on_calendar?: boolean;
  notify_on_article?: boolean;
}): NotificationSettings {
  const db = getDb();
  const id = uuid();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO notification_settings (
      id, email, smtp_host, smtp_port, smtp_user, smtp_pass, use_gmail,
      notify_on_crawl, notify_on_calendar, notify_on_article, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    settings.email,
    settings.smtp_host ?? null,
    settings.smtp_port ?? null,
    settings.smtp_user ?? null,
    settings.smtp_pass ?? null,
    settings.use_gmail ? 1 : 0,
    settings.notify_on_crawl !== false ? 1 : 0,
    settings.notify_on_calendar !== false ? 1 : 0,
    settings.notify_on_article !== false ? 1 : 0,
    now,
    now
  );
  return getNotificationSettings()!;
}

export function updateNotificationSettings(
  id: string,
  updates: Partial<NotificationSettings>
): void {
  const db = getDb();
  const now = new Date().toISOString();
  const cols: string[] = [];
  const vals: unknown[] = [];
  if (updates.email !== undefined) {
    cols.push("email = ?");
    vals.push(updates.email);
  }
  if (updates.smtp_host !== undefined) {
    cols.push("smtp_host = ?");
    vals.push(updates.smtp_host);
  }
  if (updates.smtp_port !== undefined) {
    cols.push("smtp_port = ?");
    vals.push(updates.smtp_port);
  }
  if (updates.smtp_user !== undefined) {
    cols.push("smtp_user = ?");
    vals.push(updates.smtp_user);
  }
  if (updates.smtp_pass !== undefined) {
    cols.push("smtp_pass = ?");
    vals.push(updates.smtp_pass);
  }
  if (updates.use_gmail !== undefined) {
    cols.push("use_gmail = ?");
    vals.push(updates.use_gmail ? 1 : 0);
  }
  if (updates.notify_on_crawl !== undefined) {
    cols.push("notify_on_crawl = ?");
    vals.push(updates.notify_on_crawl ? 1 : 0);
  }
  if (updates.notify_on_calendar !== undefined) {
    cols.push("notify_on_calendar = ?");
    vals.push(updates.notify_on_calendar ? 1 : 0);
  }
  if (updates.notify_on_article !== undefined) {
    cols.push("notify_on_article = ?");
    vals.push(updates.notify_on_article ? 1 : 0);
  }
  if (cols.length > 0) {
    cols.push("updated_at = ?");
    vals.push(now, id);
    db.prepare(`UPDATE notification_settings SET ${cols.join(", ")} WHERE id = ?`).run(...vals);
  }
}

export function getAppSetting(key: string): string | null {
  const db = getDb();
  const row = db.prepare("SELECT value FROM app_settings WHERE key = ?").get(key) as
    | { value: string }
    | undefined;
  return row?.value ?? null;
}

export function setAppSetting(key: string, value: string): void {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = ?`
  ).run(key, value, now, value, now);
}
