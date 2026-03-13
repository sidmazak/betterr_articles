/**
 * Image generation providers. Supports OpenAI, OpenRouter, Together, LiteLLM, Google Gemini, Stability AI, AI Horde, and Custom URL.
 * Custom allows any OpenAI-compatible /images/generations endpoint.
 */
export const IMAGE_PROVIDERS = [
  { id: "openai", name: "OpenAI", models: ["gpt-image-1", "dall-e-3"] },
  { id: "openrouter", name: "OpenRouter", models: ["google/gemini-2.5-flash-image", "google/gemini-2.5-flash-image-preview", "openai/gpt-image-1", "openai/dall-e-3"] },
  { id: "together", name: "Together AI", models: ["black-forest-labs/FLUX.1-schnell-Free", "black-forest-labs/FLUX.1-dev"] },
  { id: "litellm", name: "LiteLLM", models: ["gpt-image-1", "black-forest-labs/FLUX.1-schnell"] },
  { id: "google", name: "Google Gemini", models: ["gemini-2.5-flash-image", "gemini-3.1-flash-image-preview"] },
  { id: "stability", name: "Stability AI", models: ["stable-diffusion-xl-1024-v1-0", "stable-diffusion-xl-1024-v0-9", "stable-diffusion-v1-6"] },
  { id: "horde", name: "AI Horde", models: ["Deliberate", "DreamShaper", "SDXL_beta::stability.ai/stable-diffusion-xl-base-1.0"] },
  { id: "custom", name: "Custom URL", models: [] },
] as const;
