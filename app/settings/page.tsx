"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
import { ArticleDefaultsForm, type ArticleDefaultsFormValues } from "@/components/article-defaults-form";

export default function SettingsPage() {
  const router = useRouter();
  const [llmSettings, setLlmSettings] = useState<{ settings: unknown[]; default: unknown } | null>(null);
  const [notifSettings, setNotifSettings] = useState<Record<string, unknown> | null>(null);
  const [provider, setProvider] = useState("openai");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("gpt-4o");
  const [customModel, setCustomModel] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [fetchedModels, setFetchedModels] = useState<string[]>([]);
  const [fetchingModels, setFetchingModels] = useState(false);
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

  useEffect(() => {
    fetch("/api/settings/llm")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        setLlmSettings(d);
        if (d?.default) {
          const def = d.default as { provider: string; model: string; base_url?: string };
          setProvider(def.provider);
          setModel(def.model);
          setBaseUrl(def.base_url ?? "");
          setCustomModel(def.model);
        }
      })
      .catch(() => setLlmSettings(null));
    fetch("/api/settings/notifications")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.email) {
          setNotifSettings(d);
          setEmail(d.email);
          setSmtpUser(d.smtp_user ?? "");
          setSmtpPass("");
          setUseGmail(d.use_gmail === 1);
          setNotifyCrawl(d.notify_on_crawl !== 0);
          setNotifyCalendar(d.notify_on_calendar !== 0);
          setNotifyArticle(d.notify_on_article !== 0);
        }
      })
      .catch(() => setNotifSettings(null));
    fetch("/api/settings/article-defaults")
      .then((r) => (r.ok ? r.json() : {}))
      .then(setArticleDefaults)
      .catch(() => setArticleDefaults({}));
  }, []);

  async function saveLLM() {
    setSaving(true);
    setMessage("");
    try {
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
        setApiKey("");
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

  async function saveArticleDefaults() {
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/settings/article-defaults", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(articleDefaults),
      });
      if (res.ok) {
        setMessage("App article defaults saved. Projects can load these as a starting point.");
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

  return (
    <div className="w-full px-4 py-8 lg:px-8">
      <div className="mx-auto w-full max-w-[900px]">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
            <p className="mt-1 text-sm text-muted-foreground">Configure LLM, notifications, and publishing.</p>
          </div>
          <Button variant="outline" onClick={() => router.push("/")}>
            Back to projects
          </Button>
        </div>

        {message && (
          <div className="mb-6 rounded-lg border border-primary/30 bg-primary/10 p-4 text-sm text-primary">
            {message}
          </div>
        )}

        <Tabs defaultValue="llm">
          <TabsList className="mb-6 grid w-full grid-cols-3">
            <TabsTrigger value="llm">LLM Provider</TabsTrigger>
            <TabsTrigger value="article-defaults">Article defaults</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
          </TabsList>

          <TabsContent value="llm">
            <Card>
              <CardHeader>
                <CardTitle>Model provider</CardTitle>
                <CardDescription>
                  Configure your AI provider. API keys are stored locally and never sent elsewhere.
                  Supports OpenAI, Anthropic, OpenRouter, Google AI, LiteLLM, Together, Groq.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Provider</Label>
                  <Select
                    value={provider}
                    onValueChange={(v) => {
                      setProvider(v);
                      const p = LLM_PROVIDERS.find((x) => x.id === v);
                      if (p) {
                        setModel(p.models[0]);
                        setCustomModel("");
                        setFetchedModels([]);
                      }
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
                  <Input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="sk-... or your API key"
                  />
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
                      disabled={fetchingModels || (provider !== "openrouter" && !apiKey) || useCustomModel}
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
                <Button onClick={saveLLM} disabled={saving || !apiKey}>
                  {saving ? "Saving..." : "Save LLM settings"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="article-defaults">
            <Card>
              <CardHeader>
                <CardTitle>App-wide article defaults</CardTitle>
                <CardDescription>
                  Default parameters for article generation. Projects can use these as a starting
                  point or set their own. Full control over type, tone, infographics, linking, and more.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <ArticleDefaultsForm values={articleDefaults} onChange={setArticleDefaults} />
                <Button onClick={saveArticleDefaults} disabled={saving}>
                  {saving ? "Saving..." : "Save article defaults"}
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
                  Use Gmail with an App Password, or configure SMTP.
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
              Configure publishing per project. Go to a project, then add publishing config.
              Supports WordPress, Ghost, Medium, and generic webhooks (Odoo, Wix, custom).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Supported: WordPress, Ghost, Medium, Webhook. Configure in each project.
            </p>
          </CardContent>
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
