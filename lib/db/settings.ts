import { v4 as uuid } from "uuid";
import { getDb } from "./index";

export type LLMProvider =
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
  created_at: string;
  updated_at: string;
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

export function saveLLMSettings(settings: {
  provider: LLMProvider;
  api_key: string;
  model: string;
  base_url?: string;
  is_default?: boolean;
}): LLMSettings {
  const db = getDb();
  const id = uuid();
  const now = new Date().toISOString();
  if (settings.is_default) {
    db.prepare("UPDATE llm_settings SET is_default = 0").run();
  }
  db.prepare(
    `INSERT INTO llm_settings (id, provider, api_key, model, base_url, is_default, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    settings.provider,
    settings.api_key,
    settings.model,
    settings.base_url ?? null,
    settings.is_default ? 1 : 0,
    now,
    now
  );
  return getLLMSettings()!;
}

export function updateLLMSettings(
  id: string,
  updates: Partial<{ api_key: string; model: string; base_url: string; is_default: boolean }>
): void {
  const db = getDb();
  const now = new Date().toISOString();
  if (updates.is_default) {
    db.prepare("UPDATE llm_settings SET is_default = 0").run();
  }
  const current = db.prepare("SELECT * FROM llm_settings WHERE id = ?").get(id) as LLMSettings | null;
  if (!current) return;
  db.prepare(
    `UPDATE llm_settings SET
     api_key = COALESCE(?, api_key),
     model = COALESCE(?, model),
     base_url = COALESCE(?, base_url),
     is_default = COALESCE(?, is_default),
     updated_at = ? WHERE id = ?`
  ).run(
    updates.api_key ?? current.api_key,
    updates.model ?? current.model,
    updates.base_url !== undefined ? updates.base_url : current.base_url,
    updates.is_default !== undefined ? (updates.is_default ? 1 : 0) : current.is_default,
    now,
    id
  );
}

export function deleteLLMSettings(id: string): void {
  const db = getDb();
  db.prepare("DELETE FROM llm_settings WHERE id = ?").run(id);
}

export type PublishingPlatform = "wordpress" | "wix" | "odoo" | "webhook" | "medium" | "ghost";

export interface PublishingConfig {
  id: string;
  project_id: string;
  platform: PublishingPlatform;
  config: string;
  is_default: number;
  created_at: string;
  updated_at: string;
}

export function getProjectPublishing(projectId: string): PublishingConfig | null {
  const db = getDb();
  return db
    .prepare(
      "SELECT * FROM project_publishing WHERE project_id = ? AND is_default = 1 LIMIT 1"
    )
    .get(projectId) as PublishingConfig | null;
}

export function saveProjectPublishing(
  projectId: string,
  platform: PublishingPlatform,
  config: Record<string, unknown>
): PublishingConfig {
  const db = getDb();
  const id = uuid();
  const now = new Date().toISOString();
  db.prepare("UPDATE project_publishing SET is_default = 0 WHERE project_id = ?").run(projectId);
  db.prepare(
    `INSERT INTO project_publishing (id, project_id, platform, config, is_default, created_at, updated_at)
     VALUES (?, ?, ?, ?, 1, ?, ?)`
  ).run(id, projectId, platform, JSON.stringify(config), now, now);
  return getProjectPublishing(projectId)!;
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
