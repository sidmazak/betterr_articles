"use client";

import type { ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ARTICLE_TYPES,
  ARTICLE_FORMATS,
  CONTENT_LENGTHS,
  TONES,
  STYLES,
  READING_LEVELS,
  POINTS_OF_VIEW,
  CONTENT_INTENTS,
  CONTENT_FRESHNESS,
  CITATION_STYLES,
} from "@/lib/article-defaults-constants";
import { SUPPORTED_LANGUAGES } from "@/lib/llm-constants";
import type { ArticlePipelineInput } from "@/lib/prompts/types";

export type ArticleDefaultsFormValues = Partial<ArticlePipelineInput>;

interface ArticleDefaultsFormProps {
  values: ArticleDefaultsFormValues;
  onChange: (values: ArticleDefaultsFormValues) => void;
  showProjectContext?: boolean;
  crawledLinksContent?: ReactNode;
}

export function ArticleDefaultsForm({
  values,
  onChange,
  showProjectContext = false,
  crawledLinksContent,
}: ArticleDefaultsFormProps) {
  const update = (key: keyof ArticlePipelineInput, value: unknown) => {
    onChange({ ...values, [key]: value === "" || value === undefined ? undefined : value });
  };

  return (
    <div className="space-y-8">
      {/* Core / Audience */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold">Audience & context</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Category</Label>
            <Input
              value={values.category ?? ""}
              onChange={(e) => update("category", e.target.value)}
              placeholder="e.g. Technology, Finance, Health"
            />
          </div>
          <div className="space-y-2">
            <Label>Target audience</Label>
            <Input
              value={values.targetAudience ?? ""}
              onChange={(e) => update("targetAudience", e.target.value)}
              placeholder="e.g. General audience, Developers"
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Geo focus</Label>
            <Input
              value={values.geoFocus ?? ""}
              onChange={(e) => update("geoFocus", e.target.value)}
              placeholder="e.g. Global, US, UK"
            />
          </div>
        </div>
      </div>

      {/* Content structure */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold">Content structure</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Article type</Label>
            <Select
              value={values.articleType ?? ""}
              onValueChange={(v) => update("articleType", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select..." />
              </SelectTrigger>
              <SelectContent>
                {ARTICLE_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Publication format</Label>
            <Select
              value={values.articleFormat ?? ""}
              onValueChange={(v) => update("articleFormat", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select..." />
              </SelectTrigger>
              <SelectContent>
                {ARTICLE_FORMATS.map((f) => (
                  <SelectItem key={f} value={f}>
                    {f}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Content length</Label>
            <Select
              value={values.length ?? ""}
              onValueChange={(v) => update("length", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select..." />
              </SelectTrigger>
              <SelectContent>
                {CONTENT_LENGTHS.map((l) => (
                  <SelectItem key={l} value={l}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Target word count</Label>
            <Input
              type="number"
              min={200}
              max={10000}
              value={values.targetWordCount ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                update("targetWordCount", v ? parseInt(v, 10) : undefined);
              }}
              placeholder="e.g. 1500"
            />
          </div>
          <div className="space-y-2">
            <Label>Point of view</Label>
            <Select
              value={values.pointOfView ?? ""}
              onValueChange={(v) => update("pointOfView", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select..." />
              </SelectTrigger>
              <SelectContent>
                {POINTS_OF_VIEW.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Content intent</Label>
            <Select
              value={values.contentIntent ?? ""}
              onValueChange={(v) => update("contentIntent", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select..." />
              </SelectTrigger>
              <SelectContent>
                {CONTENT_INTENTS.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Voice & style */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold">Voice & style</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Tone</Label>
            <Select value={values.tone ?? ""} onValueChange={(v) => update("tone", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select..." />
              </SelectTrigger>
              <SelectContent>
                {TONES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Editorial style</Label>
            <Select value={values.style ?? ""} onValueChange={(v) => update("style", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select..." />
              </SelectTrigger>
              <SelectContent>
                {STYLES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Reading level</Label>
            <Select
              value={values.readingLevel ?? ""}
              onValueChange={(v) => update("readingLevel", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select..." />
              </SelectTrigger>
              <SelectContent>
                {READING_LEVELS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Citation style</Label>
            <Select
              value={values.citationStyle ?? ""}
              onValueChange={(v) => update("citationStyle", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select..." />
              </SelectTrigger>
              <SelectContent>
                {CITATION_STYLES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Research */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold">Research options</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Content freshness</Label>
            <Select
              value={values.contentFreshness ?? ""}
              onValueChange={(v) => update("contentFreshness", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select..." />
              </SelectTrigger>
              <SelectContent>
                {CONTENT_FRESHNESS.map((f) => (
                  <SelectItem key={f} value={f}>
                    {f}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between rounded-lg border p-4 sm:col-span-2">
            <div>
              <Label htmlFor="trending">Include trending topics</Label>
              <p className="text-sm text-muted-foreground">Add real-time social sentiment</p>
            </div>
            <Switch
              id="trending"
              checked={values.includeTrendingTopics ?? false}
              onCheckedChange={(v) => update("includeTrendingTopics", v)}
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-4 sm:col-span-2">
            <div>
              <Label htmlFor="subtopics">Include subtopics</Label>
              <p className="text-sm text-muted-foreground">Multi-layered subtopic development</p>
            </div>
            <Switch
              id="subtopics"
              checked={values.includeSubtopics ?? false}
              onCheckedChange={(v) => update("includeSubtopics", v)}
            />
          </div>
        </div>
      </div>

      {/* Linking & infographics */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold">Linking & infographics</h3>
        <div className="flex flex-col gap-3 rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="internal">Internal linking</Label>
              <p className="text-sm text-muted-foreground">Allow internal links in generated articles</p>
            </div>
            <Switch
              id="internal"
              checked={values.internalLinking ?? true}
              onCheckedChange={(v) => update("internalLinking", v)}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="use-crawled-internal">Use crawled URLs as internal links</Label>
              <p className="text-sm text-muted-foreground">
                Let AI link to URLs discovered during crawl in addition to saved internal links
              </p>
            </div>
            <Switch
              id="use-crawled-internal"
              checked={values.useCrawledUrlsAsInternalLinks ?? true}
              onCheckedChange={(v) => update("useCrawledUrlsAsInternalLinks", v)}
              disabled={values.internalLinking === false}
            />
          </div>
          {(values.useCrawledUrlsAsInternalLinks ?? true) && crawledLinksContent}
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="external">External linking</Label>
              <p className="text-sm text-muted-foreground">Strategic external links</p>
            </div>
            <Switch
              id="external"
              checked={values.externalLinking ?? false}
              onCheckedChange={(v) => update("externalLinking", v)}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="infographics">Require infographics</Label>
              <p className="text-sm text-muted-foreground">
                Every article MUST include infographic concepts (2–3 per article)
              </p>
            </div>
            <Switch
              id="infographics"
              checked={values.requireInfographics ?? true}
              onCheckedChange={(v) => update("requireInfographics", v)}
            />
          </div>
        </div>
      </div>

      {/* Language & custom */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold">Language & custom</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Default language</Label>
            <Select value={values.language ?? ""} onValueChange={(v) => update("language", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select..." />
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
          <div className="space-y-2 sm:col-span-2">
            <Label>Custom instructions (article writing)</Label>
            <Textarea
              value={values.customInstructions ?? ""}
              onChange={(e) => update("customInstructions", e.target.value)}
              placeholder="Additional instructions for the AI (e.g. brand voice, specific style rules)"
              rows={4}
            />
          </div>
        </div>
      </div>

      {/* Content idea & domain */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold">Content idea generation & domain knowledge</h3>
        <div className="grid gap-4 sm:grid-cols-1">
          <div className="space-y-2">
            <Label>Content idea custom instructions</Label>
            <Textarea
              value={values.contentIdeaCustomInstructions ?? ""}
              onChange={(e) => update("contentIdeaCustomInstructions", e.target.value)}
              placeholder="Instructions for content calendar / idea generation (e.g. prefer how-to topics, avoid product comparisons)"
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              Applied when generating content ideas in the calendar. Auto-filled from crawl when you click Load optimal settings.
            </p>
          </div>
          <div className="space-y-2">
            <Label>Domain knowledge</Label>
            <Textarea
              value={values.domainKnowledge ?? ""}
              onChange={(e) => update("domainKnowledge", e.target.value)}
              placeholder="What this site does, its niche, audience, products/services. Auto-filled from crawl when you click Load optimal settings."
              rows={4}
            />
            <p className="text-xs text-muted-foreground">
              Used throughout article and idea generation. Auto-filled from crawl data when you run Load optimal settings.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
