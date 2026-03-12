import { getLLMSettings } from "@/lib/db/settings";
import { hasConfiguredLLMSettings } from "@/lib/db/settings";
import { recordLLMUsage } from "@/lib/db/llm-usage";

const PROVIDER_CONFIG: Record<
  string,
  { baseUrl: string; defaultModel: string; headerKey: string }
> = {
  nvidia: {
    baseUrl: "https://integrate.api.nvidia.com/v1",
    defaultModel: "qwen/qwen3.5-122b-a10b",
    headerKey: "Authorization",
  },
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
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface ChatOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  requestLabel?: string;
  projectId?: string | null;
  temperature?: number;
  maxOutputTokens?: number | null;
  responseFormat?: "text" | "json";
  enableThinking?: boolean;
}

export type ChatRunner = (
  messages: ChatMessage[],
  model?: string,
  options?: ChatOptions
) => Promise<LLMResponse>;

export interface ChatStreamCallbacks {
  onAttempt?: (info: {
    provider: string;
    model: string;
    requestLabel: string;
    attempt: number;
    maxAttempts: number;
  }) => void;
  onStart?: (info: { provider: string; model: string; requestLabel: string }) => void;
  onChunk?: (
    chunk: string,
    info: {
      provider: string;
      model: string;
      requestLabel: string;
      content: string;
      estimatedCompletionTokens: number;
    }
  ) => void;
  onReasoningChunk?: (
    chunk: string,
    info: {
      provider: string;
      model: string;
      requestLabel: string;
      reasoning: string;
      estimatedReasoningTokens: number;
    }
  ) => void;
  onUsage?: (
    usage: NonNullable<LLMResponse["usage"]>,
    info: { provider: string; model: string; requestLabel: string }
  ) => void;
  onRetry?: (info: {
    provider: string;
    model: string;
    requestLabel: string;
    attempt: number;
    maxAttempts: number;
    delayMs: number;
    error: string;
  }) => void;
}

const DEFAULT_CHAT_OPTIONS: Required<ChatOptions> = {
  maxRetries: 4,
  baseDelayMs: 1500,
  maxDelayMs: 12000,
  requestLabel: "llm",
  projectId: null,
  temperature: 0.2,
  maxOutputTokens: 1200,
  responseFormat: "text",
  enableThinking: false,
};

export async function chat(
  messages: ChatMessage[],
  model?: string,
  options?: ChatOptions
): Promise<LLMResponse> {
  const settings = getLLMSettings();
  if (!settings || !hasConfiguredLLMSettings(settings)) {
    throw new Error(
      "No LLM configured. Go to Settings to add your API key, choose a provider, and select a model."
    );
  }
  const configuredSettings = settings;

  const config = PROVIDER_CONFIG[configuredSettings.provider] ?? PROVIDER_CONFIG.openai;
  const baseUrl = configuredSettings.base_url || config.baseUrl;
  const modelId = model || configuredSettings.model || config.defaultModel;
  const retryOptions = { ...DEFAULT_CHAT_OPTIONS, ...options };

  if (configuredSettings.provider === "litellm" && !baseUrl) {
    throw new Error("LiteLLM requires a base URL. Set it in Settings.");
  }
  const response = await requestWithRetry(
    async () =>
      performProviderRequest(configuredSettings.provider, configuredSettings.api_key!, modelId, baseUrl, messages, retryOptions, retryOptions.enableThinking ?? false),
    retryOptions
  );
  if (response.usage && retryOptions.projectId) {
    recordLLMUsage({
      projectId: retryOptions.projectId,
      provider: configuredSettings.provider,
      model: response.model ?? modelId,
      requestLabel: retryOptions.requestLabel,
      promptTokens: response.usage.prompt_tokens,
      completionTokens: response.usage.completion_tokens,
      totalTokens: response.usage.total_tokens,
    });
  }
  return response;
}

export async function chatStream(
  messages: ChatMessage[],
  model?: string,
  options?: ChatOptions,
  callbacks?: ChatStreamCallbacks
): Promise<LLMResponse> {
  const settings = getLLMSettings();
  if (!settings || !hasConfiguredLLMSettings(settings)) {
    throw new Error(
      "No LLM configured. Go to Settings to add your API key, choose a provider, and select a model."
    );
  }
  const configuredSettings = settings;

  const config = PROVIDER_CONFIG[configuredSettings.provider] ?? PROVIDER_CONFIG.openai;
  const baseUrl = configuredSettings.base_url || config.baseUrl;
  const modelId = model || configuredSettings.model || config.defaultModel;
  const retryOptions = { ...DEFAULT_CHAT_OPTIONS, ...options };

  if (configuredSettings.provider === "litellm" && !baseUrl) {
    throw new Error("LiteLLM requires a base URL. Set it in Settings.");
  }

  let attempt = 0;
  let lastError: Error | null = null;

  while (attempt <= retryOptions.maxRetries) {
    let streamedAnyVisibleOutput = false;
    try {
      const attemptInfo = {
        provider: configuredSettings.provider,
        model: modelId,
        requestLabel: retryOptions.requestLabel,
        attempt: attempt + 1,
        maxAttempts: retryOptions.maxRetries + 1,
      };
      console.log(
        `[LLM] Starting ${attemptInfo.requestLabel} attempt ${attemptInfo.attempt}/${attemptInfo.maxAttempts} ` +
          `(provider=${attemptInfo.provider}, model=${attemptInfo.model})`
      );
      callbacks?.onAttempt?.(attemptInfo);
      const response = await performProviderStreamRequest(
        configuredSettings.provider,
        configuredSettings.api_key!,
        modelId,
        baseUrl,
        messages,
        retryOptions,
        retryOptions.enableThinking ?? false,
        {
          onStart: callbacks?.onStart,
          onChunk: (chunk, info) => {
            streamedAnyVisibleOutput = streamedAnyVisibleOutput || chunk.length > 0;
            callbacks?.onChunk?.(chunk, info);
          },
          onReasoningChunk: (chunk, info) => {
            streamedAnyVisibleOutput = streamedAnyVisibleOutput || chunk.length > 0;
            callbacks?.onReasoningChunk?.(chunk, info);
          },
          onUsage: callbacks?.onUsage,
        }
      );
      if (response.usage) {
        console.log(
          `[LLM] ${retryOptions.requestLabel} completed: ` +
            `prompt=${response.usage.prompt_tokens} completion=${response.usage.completion_tokens} total=${response.usage.total_tokens}`
        );
        if (retryOptions.projectId) {
          recordLLMUsage({
            projectId: retryOptions.projectId,
            provider: configuredSettings.provider,
            model: response.model ?? modelId,
            requestLabel: retryOptions.requestLabel,
            promptTokens: response.usage.prompt_tokens,
            completionTokens: response.usage.completion_tokens,
            totalTokens: response.usage.total_tokens,
          });
        }
      }
      return response;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      lastError = err;
      if (
        streamedAnyVisibleOutput ||
        attempt === retryOptions.maxRetries ||
        !isRetryableError(err)
      ) {
        break;
      }

      const retryAfterMs = getRetryAfterMs(err);
      const backoffMs = Math.min(
        retryOptions.maxDelayMs,
        retryAfterMs ??
          Math.round(
            retryOptions.baseDelayMs * Math.pow(2, attempt) * (1 + Math.random() * 0.25)
          )
      );
      callbacks?.onRetry?.({
        provider: configuredSettings.provider,
        model: modelId,
        requestLabel: retryOptions.requestLabel,
        attempt: attempt + 1,
        maxAttempts: retryOptions.maxRetries + 1,
        delayMs: backoffMs,
        error: err.message,
      });
      await delay(backoffMs);
      attempt += 1;
    }
  }

  throw lastError ?? new Error(`${retryOptions.requestLabel} streaming request failed`);
}

export { LLM_PROVIDERS, SUPPORTED_LANGUAGES } from "./llm-constants";

async function performProviderRequest(
  provider: string,
  apiKey: string,
  modelId: string,
  baseUrl: string,
  messages: ChatMessage[],
  options: Required<ChatOptions> & { enableThinking?: boolean },
  enableThinking?: boolean
): Promise<LLMResponse> {
  const config = PROVIDER_CONFIG[provider] ?? PROVIDER_CONFIG.openai;
  const url = `${baseUrl}/chat/completions`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    [config.headerKey]:
      config.headerKey === "Authorization"
        ? `Bearer ${apiKey}`
        : apiKey,
  };

  const body: Record<string, unknown> = {
    model: modelId,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
    temperature: options.temperature,
  };

  if (typeof options.maxOutputTokens === "number") {
    body.max_tokens = options.maxOutputTokens;
  }

  if (options.responseFormat === "json") {
    body.response_format = { type: "json_object" };
  }

  if (provider === "nvidia") {
    body.top_p = 0.9;
    if (!(enableThinking ?? false)) {
      body.chat_template_kwargs = { enable_thinking: false };
    }
  }

  if ((provider === "openai" || provider === "openrouter" || provider === "litellm") && enableThinking && /o1|o3/i.test(modelId)) {
    body.reasoning = { effort: "high" };
  }

  if (provider === "anthropic") {
    const anthropicBody: Record<string, unknown> = {
      model: modelId,
      messages: messages
        .filter((m) => m.role !== "system")
        .map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
      system: messages.find((m) => m.role === "system")?.content ?? "",
    };
    if (typeof options.maxOutputTokens === "number") {
      anthropicBody.max_tokens = options.maxOutputTokens;
    }
    return fetchJsonWithRetryHints(
      "https://api.anthropic.com/v1/messages",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify(anthropicBody),
      },
      (data) => ({
        content: extractAnthropicText(data),
        model: modelId,
        usage: normalizeUsage(data),
      }),
      "Anthropic API"
    );
  }

  if (provider === "google") {
    const googleUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;
    const parts = messages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));
    const generationConfig: Record<string, unknown> = {
      temperature: options.temperature,
      responseMimeType: options.responseFormat === "json" ? "application/json" : "text/plain",
    };
    if (typeof options.maxOutputTokens === "number") {
      generationConfig.maxOutputTokens = options.maxOutputTokens;
    }
    return fetchJsonWithRetryHints(
      googleUrl,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: parts,
          generationConfig,
        }),
      },
      (data) => ({
        content: extractGoogleText(data),
        model: modelId,
        usage: normalizeUsage(data),
      }),
      "Google AI"
    );
  }

  return fetchJsonWithRetryHints(
    url,
    {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    },
    (data) => ({
      content: extractOpenAIText(data),
      model: modelId,
      usage: normalizeUsage(data),
    }),
    "LLM API"
  );
}

async function performProviderStreamRequest(
  provider: string,
  apiKey: string,
  modelId: string,
  baseUrl: string,
  messages: ChatMessage[],
  options: Required<ChatOptions>,
  enableThinking?: boolean,
  callbacks?: ChatStreamCallbacks
): Promise<LLMResponse> {
  callbacks?.onStart?.({
    provider,
    model: modelId,
    requestLabel: options.requestLabel,
  });

  if (provider === "anthropic") {
    return streamAnthropicRequest(apiKey, modelId, messages, options, callbacks);
  }

  if (provider === "google") {
    return streamGoogleRequest(apiKey, modelId, messages, options, callbacks);
  }

  return streamOpenAICompatibleRequest(
    provider,
    apiKey,
    modelId,
    baseUrl,
    messages,
    options,
    enableThinking,
    callbacks
  );
}

async function streamOpenAICompatibleRequest(
  provider: string,
  apiKey: string,
  modelId: string,
  baseUrl: string,
  messages: ChatMessage[],
  options: Required<ChatOptions>,
  enableThinking?: boolean,
  callbacks?: ChatStreamCallbacks
): Promise<LLMResponse> {
  const config = PROVIDER_CONFIG[provider] ?? PROVIDER_CONFIG.openai;
  const url = `${baseUrl}/chat/completions`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    [config.headerKey]:
      config.headerKey === "Authorization"
        ? `Bearer ${apiKey}`
        : apiKey,
  };

  const body: Record<string, unknown> = {
    model: modelId,
    messages: messages.map((message) => ({ role: message.role, content: message.content })),
    temperature: options.temperature,
    stream: true,
    stream_options: { include_usage: true },
  };

  if (typeof options.maxOutputTokens === "number") {
    body.max_tokens = options.maxOutputTokens;
  }

  if (options.responseFormat === "json") {
    body.response_format = { type: "json_object" };
  }

  if (provider === "nvidia") {
    body.top_p = 0.9;
    if (!(enableThinking ?? false)) {
      body.chat_template_kwargs = { enable_thinking: false };
    }
  }

  if ((provider === "openai" || provider === "openrouter" || provider === "litellm") && enableThinking && /o1|o3/i.test(modelId)) {
    body.reasoning = { effort: "high" };
  }

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw withRetryMetadata(new Error(`LLM API error: ${text}`), res);
  }

  let content = "";
  let reasoning = "";
  let usage: LLMResponse["usage"];

  for await (const event of readSseEvents(res)) {
    if (event.data === "[DONE]") break;
    const data = safeParseSseJson(event.data);
    if (!data) continue;

    const delta = extractOpenAIStreamText(data);
    if (delta) {
      content += delta;
      callbacks?.onChunk?.(delta, {
        provider,
        model: modelId,
        requestLabel: options.requestLabel,
        content,
        estimatedCompletionTokens: estimateCompletionTokens(content),
      });
    }

    const reasoningDelta = extractOpenAIStreamReasoning(data);
    if (reasoningDelta) {
      reasoning += reasoningDelta;
      callbacks?.onReasoningChunk?.(reasoningDelta, {
        provider,
        model: modelId,
        requestLabel: options.requestLabel,
        reasoning,
        estimatedReasoningTokens: estimateCompletionTokens(reasoning),
      });
    }

    const nextUsage = normalizeUsage(data);
    if (nextUsage) {
      usage = nextUsage;
      callbacks?.onUsage?.(nextUsage, {
        provider,
        model: modelId,
        requestLabel: options.requestLabel,
      });
    }
  }

  return {
    content,
    model: modelId,
    usage,
  };
}

async function streamAnthropicRequest(
  apiKey: string,
  modelId: string,
  messages: ChatMessage[],
  options: Required<ChatOptions>,
  callbacks?: ChatStreamCallbacks
): Promise<LLMResponse> {
  const anthropicBody: Record<string, unknown> = {
    model: modelId,
    messages: messages
      .filter((message) => message.role !== "system")
      .map((message) => ({
        role: message.role as "user" | "assistant",
        content: message.content,
      })),
    system: messages.find((message) => message.role === "system")?.content ?? "",
    stream: true,
  };

  if (typeof options.maxOutputTokens === "number") {
    anthropicBody.max_tokens = options.maxOutputTokens;
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(anthropicBody),
  });

  if (!res.ok) {
    const text = await res.text();
    throw withRetryMetadata(new Error(`Anthropic API error: ${text}`), res);
  }

  let content = "";
  let usage: LLMResponse["usage"];

  for await (const event of readSseEvents(res)) {
    const data = safeParseSseJson(event.data);
    if (!data) continue;

    const delta = extractAnthropicStreamText(event.event, data);
    if (delta) {
      content += delta;
      callbacks?.onChunk?.(delta, {
        provider: "anthropic",
        model: modelId,
        requestLabel: options.requestLabel,
        content,
        estimatedCompletionTokens: estimateCompletionTokens(content),
      });
    }

    const nextUsage = normalizeUsage(data);
    if (nextUsage) {
      usage = nextUsage;
      callbacks?.onUsage?.(nextUsage, {
        provider: "anthropic",
        model: modelId,
        requestLabel: options.requestLabel,
      });
    }
  }

  return {
    content,
    model: modelId,
    usage,
  };
}

async function streamGoogleRequest(
  apiKey: string,
  modelId: string,
  messages: ChatMessage[],
  options: Required<ChatOptions>,
  callbacks?: ChatStreamCallbacks
): Promise<LLMResponse> {
  const googleUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:streamGenerateContent?alt=sse&key=${apiKey}`;
  const parts = messages.map((message) => ({
    role: message.role === "assistant" ? "model" : "user",
    parts: [{ text: message.content }],
  }));
  const generationConfig: Record<string, unknown> = {
    temperature: options.temperature,
    responseMimeType: options.responseFormat === "json" ? "application/json" : "text/plain",
  };
  if (typeof options.maxOutputTokens === "number") {
    generationConfig.maxOutputTokens = options.maxOutputTokens;
  }

  const res = await fetch(googleUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: parts,
      generationConfig,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw withRetryMetadata(new Error(`Google AI error: ${text}`), res);
  }

  let content = "";
  let usage: LLMResponse["usage"];

  for await (const event of readSseEvents(res)) {
    const data = safeParseSseJson(event.data);
    if (!data) continue;

    const delta = extractGoogleStreamText(data);
    if (delta) {
      content += delta;
      callbacks?.onChunk?.(delta, {
        provider: "google",
        model: modelId,
        requestLabel: options.requestLabel,
        content,
        estimatedCompletionTokens: estimateCompletionTokens(content),
      });
    }

    const nextUsage = normalizeUsage(data);
    if (nextUsage) {
      usage = nextUsage;
      callbacks?.onUsage?.(nextUsage, {
        provider: "google",
        model: modelId,
        requestLabel: options.requestLabel,
      });
    }
  }

  return {
    content,
    model: modelId,
    usage,
  };
}

function extractAnthropicText(data: Record<string, unknown>) {
  const content = data.content;
  if (Array.isArray(content)) {
    const first = content[0] as { text?: unknown } | undefined;
    return typeof first?.text === "string" ? first.text : "";
  }
  return typeof content === "string" ? content : "";
}

function extractGoogleText(data: Record<string, unknown>) {
  const candidates = data.candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) return "";
  const firstCandidate = candidates[0] as {
    content?: { parts?: Array<{ text?: unknown }> };
  };
  const firstPart = firstCandidate.content?.parts?.[0];
  return typeof firstPart?.text === "string" ? firstPart.text : "";
}

function extractAnthropicStreamText(event: string | undefined, data: Record<string, unknown>) {
  if (event !== "content_block_delta") return "";
  const delta = data.delta as { text?: unknown } | undefined;
  return typeof delta?.text === "string" ? delta.text : "";
}

function extractOpenAIText(data: Record<string, unknown>) {
  const choices = data.choices;
  if (!Array.isArray(choices) || choices.length === 0) return "";
  const firstChoice = choices[0] as {
    message?: { content?: unknown };
  };
  return typeof firstChoice.message?.content === "string"
    ? firstChoice.message.content
    : "";
}

function extractOpenAIStreamText(data: Record<string, unknown>) {
  const choices = data.choices;
  if (!Array.isArray(choices) || choices.length === 0) return "";
  const firstChoice = choices[0] as {
    delta?: {
      content?: unknown;
    };
  };
  const content = firstChoice.delta?.content;
  if (typeof content === "string") {
    return content;
  }
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object" && "text" in part) {
          const text = (part as { text?: unknown }).text;
          return typeof text === "string" ? text : "";
        }
        return "";
      })
      .join("");
  }
  return "";
}

function extractOpenAIStreamReasoning(data: Record<string, unknown>) {
  const choices = data.choices;
  if (!Array.isArray(choices) || choices.length === 0) return "";
  const firstChoice = choices[0] as {
    delta?: {
      reasoning_content?: unknown;
    };
  };
  const reasoning = firstChoice.delta?.reasoning_content;
  if (typeof reasoning === "string") {
    return reasoning;
  }
  if (Array.isArray(reasoning)) {
    return reasoning
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object" && "text" in part) {
          const text = (part as { text?: unknown }).text;
          return typeof text === "string" ? text : "";
        }
        return "";
      })
      .join("");
  }
  return "";
}

function extractGoogleStreamText(data: Record<string, unknown>) {
  const candidates = data.candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) return "";
  const firstCandidate = candidates[0] as {
    content?: { parts?: Array<{ text?: unknown }> };
  };
  const parts = firstCandidate.content?.parts ?? [];
  return parts
    .map((part) => (typeof part.text === "string" ? part.text : ""))
    .join("");
}

async function* readSseEvents(response: Response) {
  if (!response.body) {
    throw new Error("Streaming response body was empty.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
    buffer = buffer.replace(/\r\n/g, "\n");

    let boundary = buffer.indexOf("\n\n");
    while (boundary >= 0) {
      const rawEvent = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      boundary = buffer.indexOf("\n\n");

      const parsed = parseSseEvent(rawEvent);
      if (parsed) {
        yield parsed;
      }
    }

    if (done) {
      const parsed = parseSseEvent(buffer);
      if (parsed) {
        yield parsed;
      }
      break;
    }
  }
}

function parseSseEvent(rawEvent: string) {
  const trimmed = rawEvent.trim();
  if (!trimmed) return null;

  const lines = trimmed.split("\n");
  let event = "message";
  const data: string[] = [];

  for (const line of lines) {
    if (line.startsWith("event:")) {
      event = line.slice(6).trim();
      continue;
    }
    if (line.startsWith("data:")) {
      data.push(line.slice(5).trimStart());
    }
  }

  if (data.length === 0) return null;
  return {
    event,
    data: data.join("\n"),
  };
}

function safeParseSseJson(value: string) {
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function estimateCompletionTokens(content: string) {
  return Number((content.length / 4).toFixed(1));
}

async function fetchJsonWithRetryHints<T>(
  url: string,
  init: RequestInit,
  map: (data: Record<string, unknown>) => T,
  label: string
): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const text = await res.text();
    const error = new Error(`${label} error: ${text}`);
    throw withRetryMetadata(error, res);
  }
  return map((await res.json()) as Record<string, unknown>);
}

async function requestWithRetry<T>(
  fn: () => Promise<T>,
  options: Required<ChatOptions>
): Promise<T> {
  let attempt = 0;
  let lastError: Error | null = null;

  while (attempt <= options.maxRetries) {
    try {
      return await fn();
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      lastError = err;
      if (attempt === options.maxRetries || !isRetryableError(err)) {
        break;
      }

      const retryAfterMs = getRetryAfterMs(err);
      const backoffMs = Math.min(
        options.maxDelayMs,
        retryAfterMs ??
          Math.round(
            options.baseDelayMs * Math.pow(2, attempt) * (1 + Math.random() * 0.25)
          )
      );
      await delay(backoffMs);
      attempt += 1;
      continue;
    }
  }

  throw lastError ?? new Error(`${options.requestLabel} request failed`);
}

function isRetryableError(error: Error): boolean {
  const status = (error as Error & { status?: number }).status;
  if (status === 429) return true;
  if (status && status >= 500) return true;
  return /\b429\b|rate limit|temporar|timeout|ECONNRESET|fetch failed/i.test(error.message);
}

function withRetryMetadata(error: Error, response: Response) {
  const enhanced = error as Error & { status?: number; retryAfterMs?: number };
  enhanced.status = response.status;
  const retryAfterHeader = response.headers.get("retry-after");
  const retryAfterSeconds = retryAfterHeader ? Number(retryAfterHeader) : NaN;
  if (!Number.isNaN(retryAfterSeconds) && retryAfterSeconds > 0) {
    enhanced.retryAfterMs = retryAfterSeconds * 1000;
  }
  return enhanced;
}

function getRetryAfterMs(error: Error): number | null {
  const retryAfterMs = (error as Error & { retryAfterMs?: number }).retryAfterMs;
  return typeof retryAfterMs === "number" && retryAfterMs > 0 ? retryAfterMs : null;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeUsage(data: Record<string, unknown>) {
  const usage = (data.usage ?? data.usageMetadata) as Record<string, unknown> | undefined;
  if (!usage) return undefined;

  const promptTokens = numberOrZero(
    usage.prompt_tokens ?? usage.input_tokens ?? usage.promptTokenCount ?? usage.inputTokenCount
  );
  const completionTokens = numberOrZero(
    usage.completion_tokens ?? usage.output_tokens ?? usage.candidatesTokenCount ?? usage.outputTokenCount
  );
  const totalTokens = numberOrZero(
    usage.total_tokens ?? usage.totalTokenCount
  ) || promptTokens + completionTokens;

  return {
    prompt_tokens: promptTokens,
    completion_tokens: completionTokens,
    total_tokens: totalTokens,
  };
}

function numberOrZero(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}
