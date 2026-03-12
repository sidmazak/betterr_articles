import type { PublisherAdapter } from "../types";
import { markdownToHtml, requireString } from "../utils";

export const odooAdapter: PublisherAdapter = {
  async publish(config, payload) {
    const baseUrl = requireString(config, "baseUrl");
    const database = requireString(config, "database");
    const username = requireString(config, "username");
    const password = requireString(config, "password");
    const blogId = Number(config.blogId);

    if (!baseUrl || !database || !username || !password || !Number.isFinite(blogId)) {
      return {
        success: false,
        error: "Odoo requires base URL, database, username, password, and numeric blog ID.",
      };
    }

    try {
      const uid = await odooLogin(baseUrl, database, username, password);
      const createdId = await odooExecuteKw<number>(baseUrl, {
        db: database,
        uid,
        password,
        model: "blog.post",
        method: "create",
        args: [
          {
            name: payload.title,
            subtitle: payload.metadata?.excerpt ?? payload.title,
            content: markdownToHtml(payload.content),
            blog_id: blogId,
          },
        ],
      });

      return {
        success: true,
        details: { id: createdId },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Odoo publish failed",
      };
    }
  },

  async testConnection(config) {
    const baseUrl = requireString(config, "baseUrl");
    const database = requireString(config, "database");
    const username = requireString(config, "username");
    const password = requireString(config, "password");

    if (!baseUrl || !database || !username || !password) {
      return {
        success: false,
        message: "Missing required Odoo connection fields.",
      };
    }

    try {
      const uid = await odooLogin(baseUrl, database, username, password);
      return {
        success: true,
        message: "Odoo connection verified.",
        details: { uid },
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "Odoo test failed",
      };
    }
  },
};

async function odooLogin(baseUrl: string, db: string, username: string, password: string) {
  const result = await odooJsonRpc<number>(`${baseUrl.replace(/\/$/, "")}/jsonrpc`, {
    service: "common",
    method: "login",
    args: [db, username, password],
  });

  if (!result || typeof result !== "number") {
    throw new Error("Odoo login failed.");
  }
  return result;
}

async function odooExecuteKw<T>(
  baseUrl: string,
  input: {
    db: string;
    uid: number;
    password: string;
    model: string;
    method: string;
    args: unknown[];
  }
) {
  return odooJsonRpc<T>(`${baseUrl.replace(/\/$/, "")}/jsonrpc`, {
    service: "object",
    method: "execute_kw",
    args: [input.db, input.uid, input.password, input.model, input.method, input.args],
  });
}

async function odooJsonRpc<T>(url: string, params: Record<string, unknown>) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "call",
      params,
      id: Date.now(),
    }),
  });

  const data = (await res.json()) as { result?: T; error?: { message?: string; data?: { message?: string } } };
  if (!res.ok || data.error) {
    throw new Error(data.error?.data?.message || data.error?.message || `Odoo request failed with ${res.status}`);
  }
  return data.result as T;
}
