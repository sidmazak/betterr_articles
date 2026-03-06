import { getLLMSettings } from "@/lib/db/settings";

const PROVIDER_CONFIG: Record<
  string,
  { baseUrl: string; defaultModel: string; headerKey: string }
> = {
  openai: {
    baseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-4o",
    headerKey: "Authorization",
  },
  anthropic: {
    baseUrl: "https://api.anthropic.com/v1",
    defaultModel: "claude-3-5-sonnet-20241022",
    headerKey: "x-api-key",
  },
  openrouter: {
    baseUrl: "https://openrouter.ai/api/v1",
    defaultModel: "openai/gpt-4o",
    headerKey: "Authorization",
  },
  google: {
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    defaultModel: "gemini-1.5-pro",
    headerKey: "x-goog-api-key",
  },
  litellm: {
    baseUrl: "", // user provides
    defaultModel: "gpt-4o",
    headerKey: "Authorization",
  },
  together: {
    baseUrl: "https://api.together.xyz/v1",
    defaultModel: "meta-llama/Llama-3.1-70B-Instruct-Turbo",
    headerKey: "Authorization",
  },
  groq: {
    baseUrl: "https://api.groq.com/openai/v1",
    defaultModel: "llama-3.1-70b-versatile",
    headerKey: "Authorization",
  },
};

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMResponse {
  content: string;
  model?: string;
}

export async function chat(messages: ChatMessage[], model?: string): Promise<LLMResponse> {
  const settings = getLLMSettings();
  if (!settings || !settings.api_key) {
    throw new Error(
      "No LLM configured. Go to Settings to add your API key and choose a provider."
    );
  }

  const config = PROVIDER_CONFIG[settings.provider] ?? PROVIDER_CONFIG.openai;
  const baseUrl = settings.base_url || config.baseUrl;
  const modelId = model || settings.model || config.defaultModel;

  if (settings.provider === "litellm" && !baseUrl) {
    throw new Error("LiteLLM requires a base URL. Set it in Settings.");
  }

  const url = `${baseUrl}/chat/completions`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    [config.headerKey]:
      config.headerKey === "Authorization"
        ? `Bearer ${settings.api_key}`
        : settings.api_key,
  };

  const body: Record<string, unknown> = {
    model: modelId,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
    temperature: 0.7,
  };

  if (settings.provider === "anthropic") {
    const anthropicUrl = "https://api.anthropic.com/v1/messages";
    const anthropicBody = {
      model: modelId,
      max_tokens: 8192,
      messages: messages
        .filter((m) => m.role !== "system")
        .map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
      system: messages.find((m) => m.role === "system")?.content ?? "",
    };
    const res = await fetch(anthropicUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": settings.api_key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(anthropicBody),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Anthropic API error: ${err}`);
    }
    const data = await res.json();
    const content =
      data.content?.[0]?.text ?? data.content ?? "";
    return { content, model: modelId };
  }

  if (settings.provider === "google") {
    const googleUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${settings.api_key}`;
    const parts = messages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));
    const res = await fetch(googleUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: parts }),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Google AI error: ${err}`);
    }
    const data = await res.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    return { content, model: modelId };
  }

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`LLM API error: ${err}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content ?? "";
  return { content, model: modelId };
}

export { LLM_PROVIDERS, SUPPORTED_LANGUAGES } from "./llm-constants";
