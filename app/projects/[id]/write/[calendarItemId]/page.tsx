"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ArrowLeft, ChevronDown, ChevronRight } from "lucide-react";
import type { Project } from "@/lib/db";
import type { CalendarItemRow } from "@/lib/db";
import type { ExistingPage } from "@/lib/prompts/types";
import type { ArticlePipelineInput } from "@/lib/prompts/types";
import { SUPPORTED_LANGUAGES } from "@/lib/llm-constants";
import {
  CONTENT_LENGTHS,
  TONES,
  STYLES,
  READING_LEVELS,
  ARTICLE_TYPES,
} from "@/lib/article-defaults-constants";

type Step = "research" | "outline" | "content";

export default function WritePage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;
  const calendarItemId = params.calendarItemId as string;
  const [project, setProject] = useState<Project | null>(null);
  const [calendarItem, setCalendarItem] = useState<CalendarItemRow | null>(null);
  const [existingPages, setExistingPages] = useState<ExistingPage[]>([]);
  const [publishedArticles, setPublishedArticles] = useState<ExistingPage[]>([]);
  const [projectDefaults, setProjectDefaults] = useState<Partial<ArticlePipelineInput>>({});
  const [step, setStep] = useState<Step>("research");
  const [output, setOutput] = useState("");
  const [language, setLanguage] = useState("en");
  const [requireInfographics, setRequireInfographics] = useState(true);
  const [length, setLength] = useState<ArticlePipelineInput["length"]>("Long");
  const [tone, setTone] = useState<ArticlePipelineInput["tone"]>("Professional");
  const [style, setStyle] = useState<ArticlePipelineInput["style"]>("Informative");
  const [readingLevel, setReadingLevel] = useState<ArticlePipelineInput["readingLevel"]>("Intermediate");
  const [articleType, setArticleType] = useState<ArticlePipelineInput["articleType"]>("");
  const [internalLinking, setInternalLinking] = useState(true);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/projects/${projectId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setProject)
      .catch(() => setProject(null));
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return;
    fetch(`/api/projects/${projectId}/crawl-results`)
      .then((r) => r.json())
      .then((d) => setExistingPages(d.pages ?? []))
      .catch(() => setExistingPages([]));
    fetch(`/api/projects/${projectId}/published-articles`)
      .then((r) => r.json())
      .then((d) => setPublishedArticles(d.articles ?? []))
      .catch(() => setPublishedArticles([]));
  }, [projectId]);

  useEffect(() => {
    if (!projectId || !calendarItemId) return;
    fetch(`/api/projects/${projectId}/calendar`)
      .then((r) => (r.ok ? r.json() : []))
      .then((items: CalendarItemRow[]) => {
        const found = items.find((i) => i.id === calendarItemId);
        setCalendarItem(found ?? null);
      })
      .catch(() => setCalendarItem(null));
  }, [projectId, calendarItemId]);

  useEffect(() => {
    if (!projectId) return;
    fetch(`/api/projects/${projectId}/article-defaults`)
      .then((r) => (r.ok ? r.json() : {}))
      .then((d: Partial<ArticlePipelineInput>) => {
        setProjectDefaults(d);
        if (d.language) setLanguage(d.language);
        if (d.requireInfographics !== undefined) setRequireInfographics(d.requireInfographics);
        if (d.length) setLength(d.length);
        if (d.tone) setTone(d.tone);
        if (d.style) setStyle(d.style);
        if (d.readingLevel) setReadingLevel(d.readingLevel);
        if (d.articleType) setArticleType(d.articleType);
        if (d.internalLinking !== undefined) setInternalLinking(d.internalLinking);
      })
      .catch(() => setProjectDefaults({}));
  }, [projectId]);

  async function generate() {
    if (!calendarItem) return;
    setLoading(true);
    setError("");
    try {
      const input: ArticlePipelineInput = {
        keyword: calendarItem.primary_keyword,
        category: projectDefaults.category ?? "General",
        targetAudience: projectDefaults.targetAudience ?? "General audience",
        title: calendarItem.title,
        length: length ?? projectDefaults.length ?? "Long",
        style: style ?? projectDefaults.style ?? "Informative",
        tone: tone ?? projectDefaults.tone ?? "Professional",
        readingLevel: readingLevel ?? projectDefaults.readingLevel ?? "Intermediate",
        contentIntent: projectDefaults.contentIntent ?? "inform",
        internalLinking,
        requireInfographics,
        existingPages,
        publishedArticles,
        language,
        ...(articleType ? { articleType } : {}),
        ...(projectDefaults.geoFocus ? { geoFocus: projectDefaults.geoFocus } : {}),
        ...(projectDefaults.customInstructions ? { customInstructions: projectDefaults.customInstructions } : {}),
        ...(calendarItem.target_url ? { url: calendarItem.target_url } : {}),
      };
      if (calendarItem.infographic_concepts) {
        try {
          const concepts = JSON.parse(calendarItem.infographic_concepts) as string[];
          const conceptsStr = Array.isArray(concepts) ? concepts.join(", ") : calendarItem.infographic_concepts;
          const parts = [input.customInstructions, `Infographic concepts from calendar: ${conceptsStr}`].filter(Boolean);
          input.customInstructions = parts.join("\n\n");
        } catch {
          const parts = [input.customInstructions, `Infographic concepts: ${calendarItem.infographic_concepts}`].filter(Boolean);
          input.customInstructions = parts.join("\n\n");
        }
      }
      const res = await fetch("/api/article", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          step,
          calendarItemId,
          projectId,
          input,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Generation failed");
      }
      setOutput(data.content ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function publish() {
    if (!output || step !== "content") return;
    setPublishing(true);
    setError("");
    try {
      const res = await fetch(`/api/projects/${projectId}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: calendarItem?.title,
          content: output,
          calendarItemId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Publish failed");
      setError("");
      alert(data.url ? `Published! URL: ${data.url}` : "Published successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Publish failed");
    } finally {
      setPublishing(false);
    }
  }

  if (!project || !calendarItem) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const steps: Step[] = ["research", "outline", "content"];
  const stepLabels: Record<Step, string> = {
    research: "Research",
    outline: "Outline",
    content: "Article",
  };

  return (
    <div className="w-full">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{calendarItem.title}</h1>
          <p className="mt-1 text-muted-foreground">{calendarItem.primary_keyword}</p>
        </div>
        <Button variant="outline" onClick={() => router.push(`/projects/${projectId}/calendar`)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to calendar
        </Button>
      </div>

      <div className="mb-6 space-y-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Label htmlFor="lang" className="text-sm">Language</Label>
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger id="lang" className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SUPPORTED_LANGUAGES.map((l) => (
                  <SelectItem key={l.code} value={l.code}>
                    {l.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-4 rounded-lg border px-4 py-2">
            <Label htmlFor="infographics" className="text-sm">Infographics</Label>
            <Switch
              id="infographics"
              checked={requireInfographics}
              onCheckedChange={setRequireInfographics}
            />
            <span className="text-sm text-muted-foreground">
              {requireInfographics ? "Required" : "Optional"}
            </span>
          </div>
          <div className="flex gap-2">
            {steps.map((s) => (
              <Button
                key={s}
                variant={step === s ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setStep(s);
                  setOutput("");
                }}
              >
                {stepLabels[s]}
              </Button>
            ))}
          </div>
        </div>
        <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-2">
              {advancedOpen ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
              Article parameters
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-4 grid gap-4 rounded-lg border bg-muted/20 p-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <Label className="text-xs">Length</Label>
                <Select value={length ?? ""} onValueChange={(v) => setLength(v as ArticlePipelineInput["length"])}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {CONTENT_LENGTHS.map((l) => (
                      <SelectItem key={l} value={l}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Tone</Label>
                <Select value={tone ?? ""} onValueChange={(v) => setTone(v as ArticlePipelineInput["tone"])}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {TONES.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Style</Label>
                <Select value={style ?? ""} onValueChange={(v) => setStyle(v as ArticlePipelineInput["style"])}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {STYLES.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Reading level</Label>
                <Select value={readingLevel ?? ""} onValueChange={(v) => setReadingLevel(v as ArticlePipelineInput["readingLevel"])}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {READING_LEVELS.map((r) => (
                      <SelectItem key={r} value={r}>{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Article type</Label>
                <Select value={articleType ?? ""} onValueChange={setArticleType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Any" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Any</SelectItem>
                    {ARTICLE_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between rounded-lg border px-4 py-2 sm:col-span-2">
                <Label htmlFor="internal" className="text-xs">Internal linking</Label>
                <Switch id="internal" checked={internalLinking} onCheckedChange={setInternalLinking} />
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{stepLabels[step]}</CardTitle>
          <CardDescription>
            {step === "research" && "Comprehensive research and topic analysis"}
            {step === "outline" && "Article structure and section blueprint"}
            {step === "content" && "Full article with infographics and internal links"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
              {error}
            </div>
          )}
          <Button onClick={generate} disabled={loading}>
            {loading ? "Generating..." : `Generate ${stepLabels[step]}`}
          </Button>
          {output && (
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between">
                <Label>Output</Label>
                {step === "content" && (
                  <Button variant="secondary" size="sm" onClick={publish} disabled={publishing}>
                    {publishing ? "Publishing..." : "Publish to site"}
                  </Button>
                )}
              </div>
              <Textarea
                value={output}
                onChange={(e) => setOutput(e.target.value)}
                className="min-h-[400px] font-mono text-sm"
                readOnly={false}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
