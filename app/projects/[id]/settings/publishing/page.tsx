"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, Plus, Send, ShieldCheck, TestTube2, Trash2 } from "lucide-react";
import { PUBLISHING_PLATFORMS } from "@/lib/publishing-constants";

type PublishingConfigResponse = {
  id: string;
  project_id: string;
  platform: string;
  label: string;
  enabled: boolean;
  auto_publish: boolean;
  config: Record<string, string>;
  secret_fields_set: string[];
  last_tested_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

type PublishingAttempt = {
  id: string;
  platform: string;
  label: string | null;
  status: "success" | "failed";
  title: string;
  published_url: string | null;
  error_message: string | null;
  created_at: string;
};

const emptyDraft = {
  platform: "wordpress",
  label: "",
  enabled: true,
  auto_publish: false,
  config: {} as Record<string, string>,
};

export default function PublishingSettingsPage() {
  const params = useParams();
  const id = params.id as string;
  const [configs, setConfigs] = useState<PublishingConfigResponse[]>([]);
  const [attempts, setAttempts] = useState<PublishingAttempt[]>([]);
  const [draft, setDraft] = useState(emptyDraft);
  const [message, setMessage] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);

  const draftPlatform = PUBLISHING_PLATFORMS.find((platform) => platform.id === draft.platform) ?? PUBLISHING_PLATFORMS[0];

  useEffect(() => {
    if (!id) return;
    loadConfigs();
  }, [id]);

  async function loadConfigs() {
    const res = await fetch(`/api/settings/publishing/${id}`);
    const data = res.ok ? await res.json() : { configs: [], attempts: [] };
    setConfigs(data.configs ?? []);
    setAttempts(data.attempts ?? []);
  }

  function updateDraftField(fieldId: string, value: string) {
    setDraft((current) => ({
      ...current,
      config: {
        ...current.config,
        [fieldId]: value,
      },
    }));
  }

  async function createConfig() {
    setCreating(true);
    setMessage("");
    try {
      const res = await fetch(`/api/settings/publishing/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error ?? "Failed to create publishing destination.");
        return;
      }
      setConfigs((current) => [data, ...current]);
      setDraft(emptyDraft);
      setMessage("Publishing destination added.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to create publishing destination.");
    } finally {
      setCreating(false);
    }
  }

  async function saveConfig(config: PublishingConfigResponse) {
    setSavingId(config.id);
    setMessage("");
    try {
      const res = await fetch(`/api/settings/publishing/${id}/${config.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error ?? "Failed to save publishing config.");
        return;
      }
      setConfigs((current) => current.map((item) => (item.id === config.id ? data : item)));
      setMessage(`${config.label || config.platform} saved.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to save publishing config.");
    } finally {
      setSavingId(null);
    }
  }

  async function testConfig(configId: string) {
    setTestingId(configId);
    setMessage("");
    try {
      const res = await fetch(`/api/settings/publishing/${id}/${configId}/test`, {
        method: "POST",
      });
      const data = await res.json();
      setMessage(data.message ?? data.error ?? "Connection test finished.");
      await loadConfigs();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to test publishing config.");
    } finally {
      setTestingId(null);
    }
  }

  async function deleteConfig(configId: string) {
    setSavingId(configId);
    setMessage("");
    try {
      const res = await fetch(`/api/settings/publishing/${id}/${configId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error ?? "Failed to delete publishing config.");
        return;
      }
      setConfigs((current) => current.filter((item) => item.id !== configId));
      setMessage("Publishing destination removed.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to delete publishing config.");
    } finally {
      setSavingId(null);
    }
  }

  function updateExistingConfig(configId: string, updater: (config: PublishingConfigResponse) => PublishingConfigResponse) {
    setConfigs((current) => current.map((item) => (item.id === configId ? updater(item) : item)));
  }

  return (
    <div className="space-y-6">
      {message && (
        <div className="rounded-lg border border-primary/30 bg-primary/10 p-4 text-sm text-primary">
          {message}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Publishing overview</CardTitle>
          <CardDescription>
            Add multiple destinations for this project, test each connection, choose which platforms stay enabled, and decide which ones should receive auto-published articles.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 lg:grid-cols-3">
          <div className="rounded-lg border bg-muted/30 p-4">
            <p className="text-sm font-medium">Multiple destinations</p>
            <p className="mt-1 text-sm text-muted-foreground">
              This project can publish to several platforms at once instead of relying on one default destination.
            </p>
          </div>
          <div className="rounded-lg border bg-muted/30 p-4">
            <p className="text-sm font-medium">Auto-publish aware</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Each destination has its own auto-publish toggle, so you can keep some destinations manual and others automated.
            </p>
          </div>
          <div className="rounded-lg border bg-muted/30 p-4">
            <p className="text-sm font-medium">Connection testing</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Save a destination, then run a connection test to verify credentials before relying on auto-publish.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Add publishing destination</CardTitle>
          <CardDescription>
            Create a new destination for WordPress, Ghost, Medium, Wix, Odoo, or a custom webhook. Each destination stays scoped to this project only.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <Label>Platform</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={draft.platform}
                onChange={(event) =>
                  setDraft({
                    platform: event.target.value,
                    label: "",
                    enabled: true,
                    auto_publish: false,
                    config: {},
                  })
                }
              >
                {PUBLISHING_PLATFORMS.map((platform) => (
                  <option key={platform.id} value={platform.id}>
                    {platform.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Label</Label>
              <Input
                value={draft.label}
                onChange={(event) => setDraft((current) => ({ ...current, label: event.target.value }))}
                placeholder={`${draftPlatform.name} primary destination`}
              />
            </div>
          </div>

          <div className="rounded-lg border bg-muted/30 p-4">
            <p className="text-sm font-medium">{draftPlatform.name}</p>
            <p className="mt-1 text-sm text-muted-foreground">{draftPlatform.description}</p>
            <p className="mt-2 text-xs text-muted-foreground">{draftPlatform.docs}</p>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {draftPlatform.fields.map((field) => (
              <div key={field.id} className={field.type === "textarea" ? "space-y-2 lg:col-span-2" : "space-y-2"}>
                <Label htmlFor={`draft-${field.id}`}>{field.label}</Label>
                {field.type === "textarea" ? (
                  <Textarea
                    id={`draft-${field.id}`}
                    value={draft.config[field.id] ?? ""}
                    onChange={(event) => updateDraftField(field.id, event.target.value)}
                    placeholder={field.placeholder}
                    className="min-h-[120px] font-mono text-xs"
                  />
                ) : (
                  <Input
                    id={`draft-${field.id}`}
                    type={field.secret ? "password" : "text"}
                    value={draft.config[field.id] ?? ""}
                    onChange={(event) => updateDraftField(field.id, event.target.value)}
                    placeholder={field.placeholder}
                  />
                )}
                {field.help && <p className="text-xs text-muted-foreground">{field.help}</p>}
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-4 rounded-lg border p-4">
            <div className="flex items-center gap-3">
              <Switch
                checked={draft.enabled}
                onCheckedChange={(checked) => setDraft((current) => ({ ...current, enabled: checked }))}
              />
              <div>
                <p className="text-sm font-medium">Enabled</p>
                <p className="text-xs text-muted-foreground">Allow this destination to receive manual publish actions.</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={draft.auto_publish}
                onCheckedChange={(checked) => setDraft((current) => ({ ...current, auto_publish: checked }))}
              />
              <div>
                <p className="text-sm font-medium">Auto-publish destination</p>
                <p className="text-xs text-muted-foreground">Use this destination when project auto-publishing is enabled.</p>
              </div>
            </div>
          </div>

          <Button onClick={createConfig} disabled={creating}>
            <Plus className="mr-2 h-4 w-4" />
            {creating ? "Adding..." : "Add destination"}
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {configs.map((config) => {
          const platform = PUBLISHING_PLATFORMS.find((item) => item.id === config.platform);
          if (!platform) return null;

          return (
            <Card key={config.id}>
              <CardHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle>{config.label || platform.name}</CardTitle>
                  <Badge variant="outline">{platform.name}</Badge>
                  {config.enabled && <Badge>Enabled</Badge>}
                  {config.auto_publish && <Badge variant="secondary">Auto-publish</Badge>}
                  {config.last_error ? (
                    <Badge variant="destructive">Needs attention</Badge>
                  ) : config.last_tested_at ? (
                    <Badge variant="outline" className="gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Tested
                    </Badge>
                  ) : null}
                </div>
                <CardDescription>
                  {platform.description}
                  {" "}This destination belongs only to this project.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Label</Label>
                    <Input
                      value={config.label}
                      onChange={(event) =>
                        updateExistingConfig(config.id, (current) => ({ ...current, label: event.target.value }))
                      }
                      placeholder={`${platform.name} destination`}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Platform</Label>
                    <select
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      value={config.platform}
                      onChange={(event) =>
                        updateExistingConfig(config.id, (current) => ({
                          ...current,
                          platform: event.target.value,
                          config: {},
                          secret_fields_set: [],
                        }))
                      }
                    >
                      {PUBLISHING_PLATFORMS.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="rounded-lg border bg-muted/30 p-4">
                  <div className="flex items-start gap-3">
                    <ShieldCheck className="mt-0.5 h-4 w-4 text-muted-foreground" />
                    <div className="space-y-1">
                      <p className="text-sm font-medium">Setup notes</p>
                      <p className="text-sm text-muted-foreground">{platform.docs}</p>
                      {config.last_tested_at && (
                        <p className="text-xs text-muted-foreground">
                          Last tested: {new Date(config.last_tested_at).toLocaleString()}
                        </p>
                      )}
                      {config.last_error && (
                        <p className="text-xs text-destructive">{config.last_error}</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  {platform.fields.map((field) => {
                    const isSecret = config.secret_fields_set.includes(field.id);
                    return (
                      <div key={field.id} className={field.type === "textarea" ? "space-y-2 lg:col-span-2" : "space-y-2"}>
                        <Label htmlFor={`${config.id}-${field.id}`}>{field.label}</Label>
                        {field.type === "textarea" ? (
                          <Textarea
                            id={`${config.id}-${field.id}`}
                            value={config.config[field.id] ?? ""}
                            onChange={(event) =>
                              updateExistingConfig(config.id, (current) => ({
                                ...current,
                                config: {
                                  ...current.config,
                                  [field.id]: event.target.value,
                                },
                              }))
                            }
                            placeholder={field.placeholder}
                            className="min-h-[120px] font-mono text-xs"
                          />
                        ) : (
                          <Input
                            id={`${config.id}-${field.id}`}
                            type={field.secret ? "password" : "text"}
                            value={config.config[field.id] ?? ""}
                            onChange={(event) =>
                              updateExistingConfig(config.id, (current) => ({
                                ...current,
                                config: {
                                  ...current.config,
                                  [field.id]: event.target.value,
                                },
                              }))
                            }
                            placeholder={field.placeholder}
                          />
                        )}
                        {field.secret && isSecret && (
                          <p className="text-xs text-muted-foreground">A secret is already saved. Leave this blank to keep the current value.</p>
                        )}
                        {field.help && <p className="text-xs text-muted-foreground">{field.help}</p>}
                      </div>
                    );
                  })}
                </div>

                <div className="flex flex-wrap gap-4 rounded-lg border p-4">
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={config.enabled}
                      onCheckedChange={(checked) =>
                        updateExistingConfig(config.id, (current) => ({ ...current, enabled: checked }))
                      }
                    />
                    <div>
                      <p className="text-sm font-medium">Enabled</p>
                      <p className="text-xs text-muted-foreground">Manual publish can target this destination.</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={config.auto_publish}
                      onCheckedChange={(checked) =>
                        updateExistingConfig(config.id, (current) => ({ ...current, auto_publish: checked }))
                      }
                    />
                    <div>
                      <p className="text-sm font-medium">Auto-publish</p>
                      <p className="text-xs text-muted-foreground">Include this destination during automatic publishing.</p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => saveConfig(config)} disabled={savingId === config.id}>
                    <Send className="mr-2 h-4 w-4" />
                    {savingId === config.id ? "Saving..." : "Save destination"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => testConfig(config.id)}
                    disabled={testingId === config.id}
                  >
                    <TestTube2 className="mr-2 h-4 w-4" />
                    {testingId === config.id ? "Testing..." : "Test connection"}
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => deleteConfig(config.id)}
                    disabled={savingId === config.id}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {configs.length === 0 && (
          <Card>
            <CardContent className="py-8">
              <p className="text-sm text-muted-foreground">
                No publishing destinations are configured yet. Add one above to enable manual publishing and auto-publish flows for this project.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent publishing activity</CardTitle>
          <CardDescription>
            Review the latest destination-level publish outcomes for this project so failures are visible and easy to diagnose.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {attempts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No publishing attempts recorded yet.</p>
          ) : (
            <ul className="space-y-3">
              {attempts.map((attempt) => (
                <li key={attempt.id} className="rounded-lg border p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{attempt.label || attempt.platform}</p>
                    <Badge variant={attempt.status === "success" ? "default" : "destructive"}>{attempt.status}</Badge>
                    <span className="text-xs text-muted-foreground">{new Date(attempt.created_at).toLocaleString()}</span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{attempt.title}</p>
                  {attempt.published_url ? (
                    <a
                      href={attempt.published_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-block text-sm text-primary hover:underline"
                    >
                      {attempt.published_url}
                    </a>
                  ) : null}
                  {attempt.error_message ? (
                    <p className="mt-2 text-sm text-destructive">{attempt.error_message}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
