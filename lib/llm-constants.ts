/**
 * Client-safe LLM constants. Import this from client components.
 * Do not import lib/llm.ts from client - it uses the database.
 */

export const LLM_PROVIDERS = [
  { id: "nvidia", name: "NVIDIA NIM", models: ["qwen/qwen3.5-122b-a10b", "qwen/qwen3.5-397b-a17b", "meta/llama-4-405b-a17b", "deepseek/deepseek-r1"] },
  { id: "openai", name: "OpenAI", models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"] },
  { id: "anthropic", name: "Anthropic", models: ["claude-3-5-sonnet-20241022", "claude-3-opus-20240229", "claude-3-haiku-20240307"] },
  { id: "openrouter", name: "OpenRouter", models: ["openai/gpt-4o", "anthropic/claude-3.5-sonnet", "google/gemini-pro", "meta-llama/llama-3.1-70b-instruct"] },
  { id: "google", name: "Google AI", models: ["gemini-1.5-pro", "gemini-1.5-flash", "gemini-pro"] },
  { id: "litellm", name: "LiteLLM", models: ["gpt-4o", "claude-3-5-sonnet", "custom"] },
  { id: "together", name: "Together AI", models: ["meta-llama/Llama-3.1-70B-Instruct-Turbo", "mistralai/Mixtral-8x7B-Instruct-v0.1"] },
  { id: "groq", name: "Groq", models: ["llama-3.1-70b-versatile", "llama-3.1-8b-instant"] },
];

export const SUPPORTED_LANGUAGES = [
  { code: "en", name: "English" },
  { code: "es", name: "Spanish" },
  { code: "fr", name: "French" },
  { code: "de", name: "German" },
  { code: "it", name: "Italian" },
  { code: "pt", name: "Portuguese" },
  { code: "nl", name: "Dutch" },
  { code: "pl", name: "Polish" },
  { code: "ru", name: "Russian" },
  { code: "ja", name: "Japanese" },
  { code: "zh", name: "Chinese" },
  { code: "ko", name: "Korean" },
  { code: "ar", name: "Arabic" },
  { code: "hi", name: "Hindi" },
];
