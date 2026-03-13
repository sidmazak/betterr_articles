"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LLM_PROVIDERS, SUPPORTED_LANGUAGES } from "@/lib/llm-constants";
import { IMAGE_PROVIDERS } from "@/lib/image-model-constants";
import { ArticleDefaultsForm, type ArticleDefaultsFormValues } from "@/components/article-defaults-form";
import { Globe, Cpu, Bell, Eye, EyeOff, ExternalLink } from "lucide-react";

type SiteDefaults = {
  auto_publish: number;
  auto_internal_links: number;
  auto_external_links: number;
  auto_infographics: number;
  auto_images: number;
  eeat_optimization: number;
};

type PromptOptimizationSettings = {
  structured_data_format: "toon" | "json";
};

type SavedLlmSetting = {
  id: string;
  provider: string;
  model: string;
  base_url?: string;
  enable_thinking?: number;
  api_key?: string;
  api_key_masked?: string;
  api_key_set?: boolean;
  is_configured?: boolean;
};

function SettingsPageContent() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") ?? "global";
  const [llmSettings, setLlmSettings] = useState<SavedLlmSetting[]>([]);
  const [apiKeySet, setApiKeySet] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [provider, setProvider] = useState("openai");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("gpt-4o");
  const [customModel, setCustomModel] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [fetchedModels, setFetchedModels] = useState<string[]>([]);
  const [fetchingModels, setFetchingModels] = useState(false);
  const [imageApiKeySet, setImageApiKeySet] = useState(false);
  const [showImageApiKey, setShowImageApiKey] = useState(false);
  const [imageProvider, setImageProvider] = useState("openai");
  const [imageApiKey, setImageApiKey] = useState("");
  const [imageModel, setImageModel] = useState("gpt-image-1");
  const [fetchedImageModels, setFetchedImageModels] = useState<string[]>([]);
  const [fetchingImageModels, setFetchingImageModels] = useState(false);
  const [imageBaseUrl, setImageBaseUrl] = useState("");
  const [imageStylePrompt, setImageStylePrompt] = useState("");
  const [imageEnabled, setImageEnabled] = useState(true);
  const [email, setEmail] = useState("");
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPass, setSmtpPass] = useState("");
  const [useGmail, setUseGmail] = useState(true);
  const [notifyCrawl, setNotifyCrawl] = useState(true);
  const [notifyCalendar, setNotifyCalendar] = useState(true);
  const [notifyArticle, setNotifyArticle] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [articleDefaults, setArticleDefaults] = useState<ArticleDefaultsFormValues>({});
  const [siteDefaults, setSiteDefaults] = useState<SiteDefaults | null>(null);
  const [promptOptimizationSettings, setPromptOptimizationSettings] =
    useState<PromptOptimizationSettings>({
      structured_data_format: "toon",
    });

  const applyLlmSetting = useCallback((setting: SavedLlmSetting | null, nextProvider: string) => {
    const providerConfig = LLM_PROVIDERS.find((item) => item.id === nextProvider);
    const providerModels = providerConfig?.models ?? [];
    const resolvedModel = setting?.model ?? providerModels[0] ?? "";
    const useCustom = !!resolvedModel && !providerModels.includes(resolvedModel);

    setApiKeySet(!!setting?.is_configured || !!setting?.api_key_set);
    setApiKey(setting?.api_key ?? "");
    setProvider(nextProvider);
    setModel(useCustom ? "" : resolvedModel);
    setCustomModel(useCustom ? resolvedModel : "");
    setBaseUrl(setting?.base_url ?? "");
    setFetchedModels([]);
  }, []);

  const loadLlmSettings = useCallback(async (preferredProvider?: string) => {
    const response = await fetch("/api/settings/llm?includeSecrets=1");
    const data = response.ok ? await response.json() : null;
    const settings = (data?.settings ?? []) as SavedLlmSetting[];
    const defaultSetting = (data?.default ?? null) as SavedLlmSetting | null;

    setLlmSettings(settings);

    const selectedProvider =
      preferredProvider ??
      defaultSetting?.provider ??
      settings[0]?.provider ??
      "openai";
    const selectedSetting =
      settings.find((item) => item.provider === selectedProvider) ??
      (defaultSetting?.provider === selectedProvider ? defaultSetting : null);

    applyLlmSetting(selectedSetting, selectedProvider);
  }, [applyLlmSetting]);

  useEffect(() => {
    loadLlmSettings()
      .catch(() => {});
    fetch("/api/settings/notifications")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.email) {
          setEmail(d.email);
          setSmtpUser(d.smtp_user ?? "");
          setSmtpPass("");
          setUseGmail(d.use_gmail === 1);
          setNotifyCrawl(d.notify_on_crawl !== 0);
          setNotifyCalendar(d.notify_on_calendar !== 0);
          setNotifyArticle(d.notify_on_article !== 0);
        }
      })
      .catch(() => {});
    fetch("/api/settings/article-defaults")
      .then((r) => (r.ok ? r.json() : {}))
      .then(setArticleDefaults)
      .catch(() => setArticleDefaults({}));
    fetch("/api/settings/site-defaults")
      .then((r) => (r.ok ? r.json() : null))
      .then(setSiteDefaults)
      .catch(() => setSiteDefaults(null));
    fetch("/api/settings/image?includeSecrets=1")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setImageApiKeySet(!!d.is_configured || !!d.api_key_set);
        setImageApiKey(d.api_key ?? "");
        setImageProvider(d.provider ?? "openai");
        setImageModel(d.model ?? "gpt-image-1");
        setImageBaseUrl(d.base_url ?? "");
        setImageStylePrompt(d.style_prompt ?? "");
        setImageEnabled(d.enabled !== 0);
      })
      .catch(() => {});
    fetch("/api/settings/prompt-optimizations")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setPromptOptimizationSettings({
          structured_data_format:
            d.structured_data_format === "json" ? "json" : "toon",
        });
      })
      .catch(() => {});
  }, [loadLlmSettings]);

  async function saveLLM() {
    const hasKey = apiKey.trim().length > 0;
    const providerSetting = llmSettings.find((item) => item.provider === provider) ?? null;
    if (!providerSetting && !hasKey) {
      setMessage("API key is required for new setup.");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      if (providerSetting) {
        const res = await fetch("/api/settings/llm", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: providerSetting.id,
            api_key: hasKey ? apiKey : undefined,
            provider,
            model: effectiveModel,
            base_url: baseUrl || undefined,
            is_default: true,
          }),
        });
        if (res.ok) {
          setMessage("LLM settings saved.");
          await loadLlmSettings(provider);
        } else {
          const d = await res.json();
          setMessage(d.error || "Failed to save");
        }
      } else {
        const res = await fetch("/api/settings/llm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            provider,
            api_key: apiKey,
            model: effectiveModel,
            base_url: baseUrl || undefined,
            is_default: true,
          }),
        });
        if (res.ok) {
          setMessage("LLM settings saved.");
          await loadLlmSettings(provider);
        } else {
          const d = await res.json();
          setMessage(d.error || "Failed to save");
        }
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  async function saveImageSettings() {
    const hasKey = imageApiKey.trim().length > 0;
    const providerNeedsKey = imageProvider !== "horde";
    if (providerNeedsKey && !imageApiKeySet && !hasKey) {
      setMessage("Image API key is required for new setup.");
      return;
    }
    if (imageProvider === "custom" && !imageBaseUrl.trim()) {
      setMessage("Base URL is required for custom image provider.");
      return;
    }
    if (!imageModel.trim()) {
      setMessage("Model is required.");
      return;
    }

    setSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/settings/image", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: imageProvider,
          api_key: hasKey ? imageApiKey : undefined,
          model: imageModel,
          base_url: imageBaseUrl || undefined,
          style_prompt: imageStylePrompt || undefined,
          enabled: imageEnabled,
        }),
      });

      if (res.ok) {
        setMessage("Image generation settings saved.");
        setImageApiKeySet(true);
      } else {
        const d = await res.json();
        setMessage(d.error || "Failed to save");
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  async function saveGlobal() {
    setSaving(true);
    setMessage("");
    try {
      const [siteRes, articleRes, promptRes] = await Promise.all([
        fetch("/api/settings/site-defaults", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(siteDefaults ?? {}),
        }),
        fetch("/api/settings/article-defaults", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(articleDefaults),
        }),
        fetch("/api/settings/prompt-optimizations", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(promptOptimizationSettings),
        }),
      ]);
      if (siteRes.ok && articleRes.ok && promptRes.ok) {
        setMessage("Global defaults saved. New sites will use these as starting points.");
      } else {
        const failingResponse = !siteRes.ok ? siteRes : !articleRes.ok ? articleRes : promptRes;
        const d = await failingResponse.json();
        setMessage(d.error || "Failed to save");
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  async function saveNotifications() {
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/settings/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          smtp_user: smtpUser || undefined,
          smtp_pass: smtpPass || undefined,
          use_gmail: useGmail,
          notify_on_crawl: notifyCrawl,
          notify_on_calendar: notifyCalendar,
          notify_on_article: notifyArticle,
        }),
      });
      if (res.ok) {
        setMessage("Notification settings saved.");
        setSmtpPass("");
      } else {
        const d = await res.json();
        setMessage(d.error || "Failed to save");
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  const providerConfig = LLM_PROVIDERS.find((p) => p.id === provider);

  async function fetchModels() {
    setFetchingModels(true);
    try {
      const params = new URLSearchParams({ provider });
      if (apiKey) params.set("api_key", apiKey);
      if (baseUrl && provider === "litellm") params.set("base_url", baseUrl);
      const res = await fetch(`/api/settings/llm/models?${params}`);
      const data = await res.json();
      setFetchedModels(data.models ?? []);
    } catch {
      setFetchedModels([]);
    } finally {
      setFetchingModels(false);
    }
  }

  const modelOptions = fetchedModels.length > 0
    ? fetchedModels
    : (providerConfig?.models ?? []);
  const useCustomModel = customModel.trim().length > 0;
  const effectiveModel = useCustomModel ? customModel : model;
  const imageProviderConfig = IMAGE_PROVIDERS.find((p) => p.id === imageProvider);
  const baseImageModelOptions = fetchedImageModels.length > 0
    ? fetchedImageModels
    : (imageProviderConfig?.models ?? []);
  const imageModelOptions =
    imageModel && !baseImageModelOptions.includes(imageModel)
      ? [imageModel, ...baseImageModelOptions]
      : baseImageModelOptions;

  async function fetchImageModels() {
    setFetchingImageModels(true);
    try {
      const params = new URLSearchParams({ provider: imageProvider });
      if (imageApiKey) params.set("api_key", imageApiKey);
      if (imageBaseUrl && (imageProvider === "litellm" || imageProvider === "custom")) params.set("base_url", imageBaseUrl);
      const res = await fetch(`/api/settings/image/models?${params}`);
      const data = await res.json();
      const models = data.models ?? [];
      setFetchedImageModels(models);
      if (models.length > 0 && !models.includes(imageModel)) {
        setImageModel(models[0]);
      }
    } catch {
      setFetchedImageModels([]);
    } finally {
      setFetchingImageModels(false);
    }
  }

  return (
    <div className="w-full px-4 py-8 lg:px-8">
      <div className="mx-auto w-full max-w-[900px]">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight">App settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Global defaults, LLM provider, and notifications.
          </p>
        </div>

        {message && (
          <div className="mb-6 rounded-lg border border-primary/30 bg-primary/10 p-4 text-sm text-primary">
            {message}
          </div>
        )}

        <Tabs defaultValue={initialTab}>
          <TabsList className="mb-6 grid w-full grid-cols-4">
            <TabsTrigger value="global" className="flex items-center gap-2">
              <Globe className="h-4 w-4" />
              Global
            </TabsTrigger>
            <TabsTrigger value="llm" className="flex items-center gap-2">
              <Cpu className="h-4 w-4" />
              LLM Provider
            </TabsTrigger>
            <TabsTrigger value="images" className="flex items-center gap-2">
              <Eye className="h-4 w-4" />
              Article Images
            </TabsTrigger>
            <TabsTrigger value="notifications" className="flex items-center gap-2">
              <Bell className="h-4 w-4" />
              Notifications
            </TabsTrigger>
          </TabsList>

          <TabsContent value="global">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Default site settings</CardTitle>
                  <CardDescription>
                    Default automation for new sites. Internal linking, external linking, and infographics are in Content defaults below.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {siteDefaults && (
                    <>
                      <div className="flex items-center justify-between rounded-lg border p-4">
                        <div>
                          <Label>Auto-publish</Label>
                          <p className="text-sm text-muted-foreground">Automatically publish articles when ready</p>
                        </div>
                        <Switch
                          checked={!!siteDefaults.auto_publish}
                          onCheckedChange={(v) => setSiteDefaults((s) => s ? { ...s, auto_publish: v ? 1 : 0 } : null)}
                        />
                      </div>
                      <div className="flex items-center justify-between rounded-lg border p-4">
                        <div>
                          <Label>Auto images</Label>
                          <p className="text-sm text-muted-foreground">Add AI-generated images</p>
                        </div>
                        <Switch
                          checked={!!siteDefaults.auto_images}
                          onCheckedChange={(v) => setSiteDefaults((s) => s ? { ...s, auto_images: v ? 1 : 0 } : null)}
                        />
                      </div>
                      <div className="flex items-center justify-between rounded-lg border p-4">
                        <div>
                          <Label>E-E-A-T optimization</Label>
                          <p className="text-sm text-muted-foreground">Follow Google E-E-A-T guidelines</p>
                        </div>
                        <Switch
                          checked={!!siteDefaults.eeat_optimization}
                          onCheckedChange={(v) => setSiteDefaults((s) => s ? { ...s, eeat_optimization: v ? 1 : 0 } : null)}
                        />
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Default content settings</CardTitle>
                  <CardDescription>
                    Default parameters for article generation. Sites can load these as a starting point.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <ArticleDefaultsForm values={articleDefaults} onChange={setArticleDefaults} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Prompt optimizations</CardTitle>
                  <CardDescription>
                    Control how structured context is serialized for AI prompts throughout the app.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div>
                      <Label>TOON optimizations</Label>
                      <p className="text-sm text-muted-foreground">
                        When enabled, structured prompt data uses compact TOON blocks. When disabled,
                        the app falls back to compact JSON blocks.
                      </p>
                    </div>
                    <Switch
                      checked={promptOptimizationSettings.structured_data_format === "toon"}
                      onCheckedChange={(checked) =>
                        setPromptOptimizationSettings({
                          structured_data_format: checked ? "toon" : "json",
                        })
                      }
                    />
                  </div>

                  <div className="rounded-lg border p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <Label>Structured data format</Label>
                      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {promptOptimizationSettings.structured_data_format}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      This setting affects structured prompt inputs used in crawl SEO extraction,
                      calendar generation, article generation context, and related AI workflows.
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Button onClick={saveGlobal} disabled={saving}>
                {saving ? "Saving..." : "Save global defaults"}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="llm">
            <Card>
              <CardHeader>
                <CardTitle>Model provider</CardTitle>
                <CardDescription>
                  Configure your AI provider. API keys are stored locally. Supports NVIDIA NIM, OpenAI, Anthropic, OpenRouter, Google AI, LiteLLM, Together, Groq.
                </CardDescription>
                <a
                  href="https://eqbench.com/creative_writing.html"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 flex items-center gap-2 rounded-md border border-border/80 bg-muted/50 px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <ExternalLink className="h-4 w-4 shrink-0" />
                  <span>
                    For better article quality, check the{" "}
                    <strong className="font-medium text-foreground">EQ-Bench Creative Writing</strong>{" "}
                    leaderboard to compare models.
                  </span>
                </a>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Provider</Label>
                  <Select
                    value={provider}
                    onValueChange={(v) => {
                      const matchedSetting =
                        llmSettings.find((item) => item.provider === v) ?? null;
                      applyLlmSetting(matchedSetting, v);
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LLM_PROVIDERS.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>API key</Label>
                  <div className="flex gap-2">
                    <Input
                      type={showApiKey ? "text" : "password"}
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder={
                        apiKeySet
                          ? "Enter new key to overwrite (leave blank to keep current)"
                          : "sk-... or your API key"
                      }
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => setShowApiKey((v) => !v)}
                      aria-label={showApiKey ? "Hide key" : "Show key"}
                      title={showApiKey ? "Hide key" : "Show key"}
                    >
                      {showApiKey ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  {apiKeySet && !apiKey && (
                    <p className="text-xs text-muted-foreground">
                      Key is configured for {LLM_PROVIDERS.find((p) => p.id === provider)?.name ?? provider}. Enter a new key above to overwrite.
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Model</Label>
                  <div className="flex gap-2">
                    {useCustomModel ? (
                      <div className="flex flex-1 items-center gap-2 rounded-md border px-3 py-2 text-sm text-muted-foreground">
                        Using custom: {customModel}
                      </div>
                    ) : (
                      <Select
                        value={model}
                        onValueChange={(v) => {
                          setModel(v);
                          setCustomModel("");
                        }}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Select..." />
                        </SelectTrigger>
                        <SelectContent>
                          {modelOptions.map((m) => (
                            <SelectItem key={m} value={m}>
                              {m}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={fetchModels}
                      disabled={
                        fetchingModels ||
                        (provider !== "openrouter" && !apiKey && !apiKeySet) ||
                        useCustomModel
                      }
                    >
                      {fetchingModels ? "Fetching..." : "Fetch models"}
                    </Button>
                  </div>
                  <Input
                    placeholder="Or enter custom model name"
                    value={customModel}
                    onChange={(e) => {
                      setCustomModel(e.target.value);
                      if (e.target.value) setModel("");
                    }}
                    className="mt-1"
                  />
                </div>
                {provider === "litellm" && (
                  <div className="space-y-2">
                    <Label>Base URL (LiteLLM proxy)</Label>
                    <Input
                      value={baseUrl}
                      onChange={(e) => setBaseUrl(e.target.value)}
                      placeholder="https://your-litellm-proxy.com/v1"
                    />
                  </div>
                )}
                <Button
                  onClick={saveLLM}
                  disabled={saving || (!apiKeySet && !apiKey.trim())}
                >
                  {saving ? "Saving..." : "Save LLM settings"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="images">
            <Card>
              <CardHeader>
                <CardTitle>Article image generation</CardTitle>
                <CardDescription>
                  Configure the global text-to-image provider for article cover images. Supports OpenAI, OpenRouter, Together AI, LiteLLM, Stability AI, AI Horde (free, community-powered), and custom URLs. Cover images use 16:9 aspect ratio.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div>
                    <Label>Enable image generation</Label>
                    <p className="text-sm text-muted-foreground">
                      Used only when project or global article image automation is turned on.
                    </p>
                  </div>
                  <Switch checked={imageEnabled} onCheckedChange={setImageEnabled} />
                </div>
                <div className="space-y-2">
                  <Label>Provider</Label>
                  <Select
                    value={imageProvider}
                    onValueChange={(value) => {
                      setImageProvider(value);
                      setFetchedImageModels([]);
                      const config = IMAGE_PROVIDERS.find((item) => item.id === value);
                      setImageModel(config?.models[0] ?? (value === "custom" ? "" : "gpt-image-1"));
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {IMAGE_PROVIDERS.map((providerOption) => (
                        <SelectItem key={providerOption.id} value={providerOption.id}>
                          {providerOption.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>API key</Label>
                  <div className="flex gap-2">
                    <Input
                      type={showImageApiKey ? "text" : "password"}
                      value={imageApiKey}
                      onChange={(e) => setImageApiKey(e.target.value)}
                      placeholder={
                        imageApiKeySet
                          ? "Enter new key to overwrite (leave blank to keep current)"
                          : imageProvider === "horde"
                            ? "Optional for AI Horde (leave blank for anonymous)"
                            : "Enter text-to-image API key"
                      }
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => setShowImageApiKey((value) => !value)}
                    >
                      {showImageApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Label>Model</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={fetchImageModels}
                      disabled={
                        fetchingImageModels ||
                        ((imageProvider === "together" || imageProvider === "litellm" || imageProvider === "custom" || imageProvider === "google" || imageProvider === "stability") &&
                          !imageApiKey &&
                          !imageApiKeySet)
                      }
                    >
                      {fetchingImageModels ? "Fetching..." : "Fetch models"}
                    </Button>
                  </div>
                  {imageModelOptions.length > 0 ? (
                    <Select value={imageModel} onValueChange={setImageModel}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select or fetch models" />
                      </SelectTrigger>
                      <SelectContent>
                        {imageModelOptions.map((modelOption) => (
                          <SelectItem key={modelOption} value={modelOption}>
                            {modelOption}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      value={imageModel}
                      onChange={(e) => setImageModel(e.target.value)}
                      placeholder="e.g. gpt-image-1 or openai/dall-e-3"
                    />
                  )}
                </div>
                {(imageProvider === "litellm" || imageProvider === "custom") && (
                  <div className="space-y-2">
                    <Label>Base URL {imageProvider === "custom" && "(required)"}</Label>
                    <Input
                      value={imageBaseUrl}
                      onChange={(e) => setImageBaseUrl(e.target.value)}
                      placeholder={
                        imageProvider === "custom"
                          ? "https://your-api.com/v1"
                          : "https://your-litellm-proxy.com/v1"
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      {imageProvider === "custom"
                        ? "Any OpenAI-compatible /images/generations endpoint."
                        : "Your LiteLLM proxy base URL."}
                    </p>
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Style guidance</Label>
                  <Input
                    value={imageStylePrompt}
                    onChange={(e) => setImageStylePrompt(e.target.value)}
                    placeholder="e.g. clean editorial style, navy corporate look, realistic lighting, no text overlay"
                  />
                  <p className="text-xs text-muted-foreground">
                    This guidance is prepended to every generated article thumbnail prompt.
                  </p>
                </div>
                <Button onClick={saveImageSettings} disabled={saving}>
                  {saving ? "Saving..." : "Save image settings"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notifications">
            <Card>
              <CardHeader>
                <CardTitle>Email notifications</CardTitle>
                <CardDescription>
                  Get notified when crawls complete, calendars are generated, or articles are published.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Notification email</Label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div>
                    <Label htmlFor="useGmail">Use Gmail (requires App Password)</Label>
                    <p className="text-sm text-muted-foreground">Use Gmail SMTP with an App Password</p>
                  </div>
                  <Switch id="useGmail" checked={useGmail} onCheckedChange={setUseGmail} />
                </div>
                {useGmail && (
                  <>
                    <div className="space-y-2">
                      <Label>Gmail address</Label>
                      <Input
                        type="email"
                        value={smtpUser}
                        onChange={(e) => setSmtpUser(e.target.value)}
                        placeholder="your@gmail.com"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>App Password</Label>
                      <Input
                        type="password"
                        value={smtpPass}
                        onChange={(e) => setSmtpPass(e.target.value)}
                        placeholder="Leave blank to keep existing"
                      />
                    </div>
                  </>
                )}
                <div className="space-y-3">
                  <Label>Notify on</Label>
                  <div className="flex flex-col gap-3 rounded-lg border p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Crawl complete</span>
                      <Switch checked={notifyCrawl} onCheckedChange={setNotifyCrawl} />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Calendar generated</span>
                      <Switch checked={notifyCalendar} onCheckedChange={setNotifyCalendar} />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Article published</span>
                      <Switch checked={notifyArticle} onCheckedChange={setNotifyArticle} />
                    </div>
                  </div>
                </div>
                <Button onClick={saveNotifications} disabled={saving}>
                  {saving ? "Saving..." : "Save notification settings"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Publishing</CardTitle>
            <CardDescription>
              Configure publishing per site in each site&apos;s Settings. Supports WordPress, Ghost, Medium, and webhooks.
            </CardDescription>
          </CardHeader>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Languages</CardTitle>
            <CardDescription>
              Article language can be set when writing. Supported: {SUPPORTED_LANGUAGES.map((l) => l.name).join(", ")}.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={
      <div className="w-full px-4 py-8 lg:px-8">
        <div className="mx-auto w-full max-w-[900px]">
          <div className="mb-8">
            <h1 className="text-2xl font-bold tracking-tight">App settings</h1>
            <p className="mt-1 text-sm text-muted-foreground">Loading...</p>
          </div>
        </div>
      </div>
    }>
      <SettingsPageContent />
    </Suspense>
  );
}
