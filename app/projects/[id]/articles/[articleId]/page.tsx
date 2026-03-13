"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import html2canvas from "html2canvas";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getSeoScoreVariant } from "@/lib/seo-rules";
import { renderArticleAsHtml, renderArticleAsText, stripLeadingH1 } from "@/lib/article-content";
import {
  ArrowLeft,
  Check,
  Code,
  Copy,
  Download,
  ExternalLink,
  FileText,
  Megaphone,
  Pencil,
  RefreshCw,
  Search,
  Share2,
  Sparkles,
  TriangleAlert,
  ChevronDown,
  Trophy,
} from "lucide-react";

type ArticleResponse = {
  id: string;
  title: string;
  primaryKeyword: string | null;
  calendar_item_id: string | null;
  research_content: string | null;
  content: string | null;
  contentHtml: string;
  contentText: string;
  status: string;
  slug: string | null;
  seo_title: string | null;
  meta_description: string | null;
  excerpt: string | null;
  category: string | null;
  tags: string[];
  cover_image_base64: string | null;
  cover_image_mime_type: string | null;
  cover_image_alt: string | null;
  cover_image_prompt: string | null;
  published_url: string | null;
  publishMetadata: {
    socialHashtags?: string[];
    coverImageAlt?: string;
    coverImagePrompt?: string;
  } | null;
  articleSections: Array<
    | { type: "markdown"; html: string; markdown: string }
    | { type: "infographic"; title: string; html?: string; imageBase64?: string }
  >;
  articleQuality: {
    wordCount: number;
    hasConclusion: boolean;
    trailingOrphanToken: boolean;
    looksIncomplete: boolean;
  };
  generationModel: string | null;
  seoAudit: {
    score: number;
    passedChecks: number;
    totalChecks: number;
    categories: Array<{
      id: string;
      label: string;
      summary: string;
      score: number;
      passedChecks: number;
      totalChecks: number;
    }>;
    checks: Array<{
      id: string;
      category: string;
      label: string;
      passed: boolean;
      details: string;
    }>;
  };
  researchHtml: string;
  attempts: Array<{
    id: string;
    platform: string;
    label: string | null;
    status: string;
    published_url: string | null;
    error_message: string | null;
    created_at: string;
  }>;
};

type ContentFormat = "markdown" | "html" | "text";

const ARTICLE_BODY_PROSE_CLASSES =
  "prose prose-neutral max-w-none wrap-break-word text-[16px] leading-8 text-foreground dark:prose-invert lg:text-[1.05rem] lg:leading-8 lg:prose-lg prose-p:my-5 prose-p:leading-8 prose-headings:scroll-mt-24 prose-headings:font-semibold prose-headings:tracking-tight prose-headings:text-foreground prose-h1:mb-5 prose-h1:text-4xl prose-h2:mt-12 prose-h2:mb-5 prose-h2:text-3xl prose-h3:mt-10 prose-h3:mb-4 prose-h3:text-2xl prose-h4:mt-8 prose-h4:mb-3 prose-h4:text-xl prose-strong:font-semibold prose-strong:text-foreground prose-li:my-2 prose-li:leading-8 prose-blockquote:border-l-sky-300 prose-blockquote:text-foreground/80 prose-img:rounded-xl prose-img:border prose-pre:overflow-x-auto prose-table:w-full prose-table:border-collapse prose-table:overflow-x-auto prose-thead:border-b prose-th:border prose-th:border-border prose-th:bg-muted/50 prose-th:px-4 prose-th:py-3 prose-th:text-left prose-th:font-semibold prose-td:border prose-td:border-border prose-td:px-4 prose-td:py-3 prose-a:font-medium prose-a:text-blue-600 prose-a:underline prose-a:decoration-blue-500 prose-a:underline-offset-4 hover:prose-a:text-blue-800 prose-mark:rounded-sm prose-mark:bg-yellow-200 prose-mark:px-1 prose-mark:text-inherit";

function copyToClipboard(value: string) {
  if (!value) return Promise.resolve();
  return navigator.clipboard.writeText(value);
}

function downloadTextFile(filename: string, value: string, mimeType: string) {
  const blob = new Blob([value], { type: `${mimeType};charset=utf-8` });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(href);
}

function DropdownActionButton({
  label,
  icon,
  items,
}: {
  label: string;
  icon: "copy" | "download";
  items: Array<{ label: string; onSelect: () => void | Promise<void> }>;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          {copied ? (
            <Check className="mr-1 h-4 w-4" />
          ) : icon === "copy" ? (
            <Copy className="mr-1 h-4 w-4" />
          ) : (
            <Download className="mr-1 h-4 w-4" />
          )}
          {copied ? "Done" : label}
          <ChevronDown className="ml-2 h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {items.map((item) => (
          <DropdownMenuItem
            key={item.label}
            onSelect={async () => {
              await item.onSelect();
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1500);
            }}
          >
            {item.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function CoverImageRegenerateButton({
  projectId,
  articleId,
  onRegenerated,
  label = "Regenerate cover image",
}: {
  projectId: string;
  articleId: string;
  onRegenerated: (data: { cover_image_base64: string; cover_image_mime_type: string }) => void;
  label?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/articles/${articleId}/regenerate-cover-image`,
        { method: "POST" }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to regenerate");
      onRegenerated({
        cover_image_base64: data.cover_image_base64,
        cover_image_mime_type: data.cover_image_mime_type,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to regenerate");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <Button
        variant="outline"
        size="sm"
        onClick={handleClick}
        disabled={loading}
      >
        {loading ? (
          <RefreshCw className="mr-1 h-4 w-4 animate-spin" />
        ) : (
          <RefreshCw className="mr-1 h-4 w-4" />
        )}
        {loading ? "Generating..." : label}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function CoverImageDownloadButton({
  base64,
  mimeType,
  filename,
}: {
  base64: string;
  mimeType: string;
  filename: string;
}) {
  const handleClick = () => {
    const ext = mimeType.includes("png") ? "png" : mimeType.includes("webp") ? "webp" : "jpg";
    const blob = new Blob(
      [Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))],
      { type: mimeType }
    );
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = `${filename}.${ext}`;
    anchor.click();
    URL.revokeObjectURL(href);
  };

  return (
    <Button variant="outline" size="sm" onClick={handleClick}>
      <Download className="mr-1 h-4 w-4" />
      Download
    </Button>
  );
}

function getArticleFormatValue(article: ArticleResponse, format: ContentFormat) {
  if (format === "html") return article.contentHtml ?? "";
  if (format === "text") return article.contentText ?? "";
  return article.content ?? "";
}

function getSeoPayload(article: ArticleResponse, format: ContentFormat) {
  const payload = {
    seoTitle: article.seo_title,
    metaDescription: article.meta_description,
    excerpt: article.excerpt,
    slug: article.slug,
    tags: article.tags,
    socialHashtags: article.publishMetadata?.socialHashtags ?? [],
    coverImageAlt: article.publishMetadata?.coverImageAlt ?? article.cover_image_alt,
    score: article.seoAudit.score,
  };

  if (format === "html") {
    return `<div>
  <h1>SEO Summary</h1>
  <p><strong>SEO title:</strong> ${payload.seoTitle ?? ""}</p>
  <p><strong>Meta description:</strong> ${payload.metaDescription ?? ""}</p>
  <p><strong>Excerpt:</strong> ${payload.excerpt ?? ""}</p>
  <p><strong>Slug:</strong> ${payload.slug ?? ""}</p>
  <p><strong>Tags:</strong> ${payload.tags.join(", ")}</p>
  <p><strong>Social hashtags:</strong> ${payload.socialHashtags.join(" ")}</p>
  <p><strong>Cover image alt:</strong> ${payload.coverImageAlt ?? ""}</p>
  <p><strong>SEO score:</strong> ${payload.score}/100</p>
</div>`;
  }

  if (format === "text") {
    return [
      `SEO title: ${payload.seoTitle ?? ""}`,
      `Meta description: ${payload.metaDescription ?? ""}`,
      `Excerpt: ${payload.excerpt ?? ""}`,
      `Slug: ${payload.slug ?? ""}`,
      `Tags: ${payload.tags.join(", ")}`,
      `Social hashtags: ${payload.socialHashtags.join(" ")}`,
      `Cover image alt: ${payload.coverImageAlt ?? ""}`,
      `SEO score: ${payload.score}/100`,
    ].join("\n");
  }

  return `# SEO Summary

- SEO title: ${payload.seoTitle ?? ""}
- Meta description: ${payload.metaDescription ?? ""}
- Excerpt: ${payload.excerpt ?? ""}
- Slug: ${payload.slug ?? ""}
- Tags: ${payload.tags.join(", ")}
- Social hashtags: ${payload.socialHashtags.join(" ")}
- Cover image alt: ${payload.coverImageAlt ?? ""}
- SEO score: ${payload.score}/100`;
}

function getScoreToneClasses(score: number) {
  const variant = getSeoScoreVariant(score);
  if (variant === "excellent") return "border-emerald-300 bg-emerald-50 text-emerald-900";
  if (variant === "good") return "border-sky-300 bg-sky-50 text-sky-900";
  if (variant === "fair") return "border-amber-300 bg-amber-50 text-amber-900";
  return "border-rose-300 bg-rose-50 text-rose-900";
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlightKeywordInHtml(html: string, keyword: string | null) {
  const phrase = keyword?.trim();
  if (!html || !phrase) return html;

  const pattern = new RegExp(`\\b${escapeRegExp(phrase)}\\b`, "gi");

  return html
    .split(/(<[^>]+>)/g)
    .map((part) => {
      if (!part || part.startsWith("<")) return part;
      return part.replace(pattern, (match) => `<mark>${match}</mark>`);
    })
    .join("");
}

function InfographicBlock({
  html,
  title,
  imageBase64,
  infographicIndex,
  projectId,
  articleId,
  onRegenerated,
  showRegenerate = true,
}: {
  html?: string;
  title: string;
  imageBase64?: string;
  infographicIndex: number;
  projectId: string;
  articleId: string;
  onRegenerated?: (data: { content: string; articleSections: ArticleResponse["articleSections"] }) => void;
  showRegenerate?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [embedCopied, setEmbedCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const isImageInfographic = !!imageBase64;

  const embedHtml = isImageInfographic
    ? `<figure class="infographic"><img src="data:image/png;base64,${imageBase64}" alt="${title.replace(/"/g, "&quot;")}" /><figcaption>${title}</figcaption></figure>`
    : `<figure class="infographic"><div class="infographic-content">${html ?? ""}</div><figcaption>${title}</figcaption></figure>`;

  const handleEmbed = async () => {
    await copyToClipboard(embedHtml);
    setEmbedCopied(true);
    window.setTimeout(() => setEmbedCopied(false), 1500);
  };

  const handleDownload = async () => {
    if (isImageInfographic && imageBase64) {
      const link = document.createElement("a");
      link.download = `${title.replace(/[^a-z0-9]/gi, "-").toLowerCase() || "infographic"}.png`;
      link.href = `data:image/png;base64,${imageBase64}`;
      link.click();
      return;
    }
    if (!containerRef.current) return;
    try {
      const canvas = await html2canvas(containerRef.current, {
        backgroundColor: "#ffffff",
        scale: 2,
        useCORS: true,
      });
      const dataUrl = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.download = `${title.replace(/[^a-z0-9]/gi, "-").toLowerCase() || "infographic"}.png`;
      link.href = dataUrl;
      link.click();
    } catch {
      // ignore
    }
  };

  const handleRegenerate = async () => {
    if (regenerating) return;
    setRegenerating(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/articles/${articleId}/regenerate-infographic`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ infographicIndex }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Regenerate failed");
      }
      if (data.content !== undefined && data.articleSections && onRegenerated) {
        onRegenerated(data);
      }
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <figure className="my-10 w-full max-w-4xl mx-auto overflow-hidden rounded-xl border border-border/80 bg-muted/10 p-4">
      <div className={regenerating ? "opacity-40 transition-opacity duration-200" : "transition-opacity duration-200"}>
        {isImageInfographic ? (
          <div className="flex justify-center">
            <img
              src={`data:image/png;base64,${imageBase64}`}
              alt={title}
              className="w-full max-w-full h-auto object-contain rounded-lg"
            />
          </div>
        ) : (
          <div
            ref={containerRef}
            className="overflow-x-auto rounded-lg bg-muted/20 p-4 text-foreground"
            dangerouslySetInnerHTML={{ __html: html ?? "" }}
          />
        )}
        <figcaption className="px-2 pt-3 text-sm text-muted-foreground text-center">{title}</figcaption>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
        <Button variant="outline" size="sm" onClick={handleEmbed}>
          {embedCopied ? <Check className="mr-1 h-4 w-4" /> : <Code className="mr-1 h-4 w-4" />}
          {embedCopied ? "Copied" : "Embed"}
        </Button>
        <Button variant="outline" size="sm" onClick={handleDownload}>
          <Download className="mr-1 h-4 w-4" />
          Download
        </Button>
        {showRegenerate && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleRegenerate}
            disabled={regenerating}
          >
            <RefreshCw className={`mr-1 h-4 w-4 ${regenerating ? "animate-spin" : ""}`} />
            {regenerating ? "Regenerating…" : "Regenerate"}
          </Button>
        )}
      </div>
    </figure>
  );
}

export default function ArticleViewPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = params.id as string;
  const articleId = params.articleId as string;
  const [article, setArticle] = useState<ArticleResponse | null>(null);
  const [activeTab, setActiveTab] = useState("article");
  const [shareLinkCopied, setShareLinkCopied] = useState(false);

  useEffect(() => {
    if (!projectId || !articleId) return;
    fetch(`/api/projects/${projectId}/articles/${articleId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setArticle)
      .catch(() => setArticle(null));
  }, [projectId, articleId]);

  useEffect(() => {
    const requestedTab = searchParams.get("tab");
    const validTab = ["article", "score", "seo", "research", "publishing"].includes(requestedTab ?? "")
      ? (requestedTab as string)
      : "article";
    setActiveTab(validTab);
  }, [searchParams]);

  if (!article) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const articleCopyItems: Array<{ label: string; onSelect: () => Promise<void> }> = [
    {
      label: "Copy Markdown",
      onSelect: () => copyToClipboard(getArticleFormatValue(article, "markdown")),
    },
    {
      label: "Copy HTML",
      onSelect: () => copyToClipboard(getArticleFormatValue(article, "html")),
    },
    {
      label: "Copy Text",
      onSelect: () => copyToClipboard(getArticleFormatValue(article, "text")),
    },
  ];
  const articleExportItems = [
    {
      label: "Export Markdown",
      onSelect: () => downloadTextFile(`${article.slug ?? article.id}.md`, getArticleFormatValue(article, "markdown"), "text/markdown"),
    },
    {
      label: "Export HTML",
      onSelect: () => downloadTextFile(`${article.slug ?? article.id}.html`, getArticleFormatValue(article, "html"), "text/html"),
    },
    {
      label: "Export Text",
      onSelect: () => downloadTextFile(`${article.slug ?? article.id}.txt`, getArticleFormatValue(article, "text"), "text/plain"),
    },
  ];
  const seoCopyItems = [
    { label: "Copy Markdown", onSelect: () => copyToClipboard(getSeoPayload(article, "markdown")) },
    { label: "Copy HTML", onSelect: () => copyToClipboard(getSeoPayload(article, "html")) },
    { label: "Copy Text", onSelect: () => copyToClipboard(getSeoPayload(article, "text")) },
  ];
  const seoExportItems = [
    { label: "Export Markdown", onSelect: () => downloadTextFile(`${article.slug ?? article.id}-seo.md`, getSeoPayload(article, "markdown"), "text/markdown") },
    { label: "Export HTML", onSelect: () => downloadTextFile(`${article.slug ?? article.id}-seo.html`, getSeoPayload(article, "html"), "text/html") },
    { label: "Export Text", onSelect: () => downloadTextFile(`${article.slug ?? article.id}-seo.txt`, getSeoPayload(article, "text"), "text/plain") },
  ];
  const researchText = article.researchHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const scoreToneClasses = getScoreToneClasses(article.seoAudit.score);

  return (
    <div className="mx-auto flex w-full max-w-none flex-col gap-8">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
        {article.calendar_item_id && article.status !== "published" && !article.published_url && (
          <Link href={`/projects/${projectId}/write/${article.calendar_item_id}`}>
            <Button variant="ghost" size="sm">
              <Pencil className="h-4 w-4 mr-1" />
              Regenerate article
            </Button>
          </Link>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            const url = `${typeof window !== "undefined" ? window.location.origin : ""}/a/${article.id}`;
            copyToClipboard(url).then(() => {
              setShareLinkCopied(true);
              window.setTimeout(() => setShareLinkCopied(false), 2000);
            });
          }}
        >
          {shareLinkCopied ? <Check className="h-4 w-4 mr-1" /> : <Share2 className="h-4 w-4 mr-1" />}
          {shareLinkCopied ? "Link copied!" : "Share"}
        </Button>
      </div>
      <header className="space-y-6 border-b pb-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1 space-y-4">
            <div className="flex flex-wrap gap-2 text-sm">
              <Badge variant={article.status === "published" ? "default" : "secondary"}>
                {article.status}
              </Badge>
              {article.category ? <Badge variant="outline">{article.category}</Badge> : null}
              {article.slug ? (
                <span className="inline-block max-w-full break-all rounded-md border border-border px-2 py-0.5 text-xs font-medium">
                  /{article.slug}
                </span>
              ) : null}
              <Badge className={scoreToneClasses}>
                <Trophy className="mr-1 h-3.5 w-3.5" />
                {article.seoAudit.score}/100
              </Badge>
              <Badge variant="outline">{article.articleQuality.wordCount} words</Badge>
              {article.generationModel ? (
                <Badge variant="outline" className="font-normal">
                  {article.generationModel}
                </Badge>
              ) : null}
            </div>
            <div className="min-w-0 space-y-3">
              <h1 className="max-w-5xl wrap-break-word text-balance text-4xl font-semibold tracking-tight text-foreground lg:text-5xl">
                {article.title}
              </h1>
              {article.excerpt ? (
                <p className="max-w-4xl wrap-break-word text-lg leading-8 text-muted-foreground lg:text-[1.35rem]">
                  {article.excerpt}
                </p>
              ) : null}
            </div>
          </div>
          {article.published_url ? (
            <a href={article.published_url} target="_blank" rel="noopener noreferrer">
              <Button size="sm">
                <ExternalLink className="mr-1 h-4 w-4" />
                View live
              </Button>
            </a>
          ) : null}
        </div>

        {article.tags.length > 0 && (
          <div className="flex min-w-0 flex-wrap gap-2">
            {article.tags.map((tag) => (
              <Badge key={tag} variant="outline" className="max-w-full overflow-visible whitespace-normal wrap-break-word">
                {tag}
              </Badge>
            ))}
          </div>
        )}

        <div className="space-y-2">
          {article.cover_image_base64 && article.cover_image_mime_type ? (
            <>
              <div className="overflow-hidden rounded-2xl border bg-muted/20">
                <Image
                  src={`data:${article.cover_image_mime_type};base64,${article.cover_image_base64}`}
                  alt={article.cover_image_alt ?? article.title}
                  width={1600}
                  height={900}
                  unoptimized
                  className="h-auto max-h-[520px] w-full object-cover"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <CoverImageRegenerateButton
                  projectId={projectId}
                  articleId={articleId}
                  onRegenerated={(data) => setArticle((a) => (a ? { ...a, ...data } : a))}
                />
                <CoverImageDownloadButton
                  base64={article.cover_image_base64}
                  mimeType={article.cover_image_mime_type}
                  filename={`${article.slug ?? article.id}-cover`}
                />
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed bg-muted/20 px-6 py-12">
              <p className="text-sm text-muted-foreground">No cover image yet.</p>
              <CoverImageRegenerateButton
                projectId={projectId}
                articleId={articleId}
                onRegenerated={(data) => setArticle((a) => (a ? { ...a, ...data } : a))}
                label="Generate cover image"
              />
            </div>
          )}
        </div>
      </header>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList variant="line" className="w-full flex-wrap justify-start gap-2 border-b bg-transparent p-0">
          <TabsTrigger value="article" className="flex-none px-3 py-2">
            <FileText className="h-4 w-4" />
            Article
          </TabsTrigger>
          <TabsTrigger value="score" className="flex-none px-3 py-2">
            <Trophy className="h-4 w-4" />
            Score
          </TabsTrigger>
          <TabsTrigger value="seo" className="flex-none px-3 py-2">
            <Megaphone className="h-4 w-4" />
            SEO
          </TabsTrigger>
          <TabsTrigger value="research" className="flex-none px-3 py-2" disabled={!article.research_content}>
            <Search className="h-4 w-4" />
            Research
          </TabsTrigger>
          <TabsTrigger value="publishing" className="flex-none px-3 py-2">
            <ExternalLink className="h-4 w-4" />
            Publishing
          </TabsTrigger>
        </TabsList>

        <TabsContent value="article" className="pt-6">
          <div className="mb-6 flex flex-wrap items-center gap-2">
            <DropdownActionButton label="Copy article" icon="copy" items={articleCopyItems} />
            <DropdownActionButton label="Export article" icon="download" items={articleExportItems} />
            {article.slug ? (
              <DropdownActionButton
                label="Copy slug"
                icon="copy"
                items={[{ label: "Copy slug", onSelect: () => copyToClipboard(article.slug ?? "") }]}
              />
            ) : null}
          </div>

          {article.articleQuality.looksIncomplete && (
            <div className="mb-6 rounded-2xl border border-amber-300 bg-amber-50 px-5 py-4 text-amber-900">
              <div className="flex items-start gap-3">
                <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" />
                <div className="space-y-2">
                  <p className="font-medium">This draft looks incomplete.</p>
                  <p className="text-sm leading-6">
                    {article.articleQuality.hasConclusion
                      ? "The article has structural issues that should be reviewed."
                      : "The article may have been cut off early or needs a structural review."}
                    {article.articleQuality.trailingOrphanToken
                      ? " A trailing orphan token was also detected at the end of the content."
                      : ""}
                  </p>
                  {article.calendar_item_id && article.status !== "published" && !article.published_url ? (
                    <Link href={`/projects/${projectId}/write/${article.calendar_item_id}`}>
                      <Button size="sm" variant="outline">Regenerate article</Button>
                    </Link>
                  ) : null}
                </div>
              </div>
            </div>
          )}

          {article.articleSections.length > 0 ? (
            <article className="space-y-2">
              {article.articleSections.reduce<{ infographicCount: number; hasRenderedMarkdown: boolean; nodes: React.ReactNode[] }>(
                (acc, section, index) => {
                  if (section.type === "markdown") {
                    const html = highlightKeywordInHtml(section.html, article.primaryKeyword);
                    const isFirstMarkdown = !acc.hasRenderedMarkdown;
                    if (isFirstMarkdown) acc.hasRenderedMarkdown = true;
                    acc.nodes.push(
                      <div
                        key={`markdown-${index}`}
                        className={ARTICLE_BODY_PROSE_CLASSES}
                        dangerouslySetInnerHTML={{
                          __html: isFirstMarkdown ? stripLeadingH1(html) : html,
                        }}
                      />
                    );
                  } else {
                    acc.infographicCount += 1;
                    acc.nodes.push(
                      <InfographicBlock
                        key={`infographic-${index}`}
                        html={"html" in section ? section.html : undefined}
                        title={section.title}
                        imageBase64={"imageBase64" in section ? section.imageBase64 : undefined}
                        infographicIndex={acc.infographicCount}
                        projectId={projectId}
                        articleId={articleId}
                        showRegenerate={true}
                        onRegenerated={(data) =>
                          setArticle((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  content: data.content,
                                  articleSections: data.articleSections,
                                  contentHtml: renderArticleAsHtml(data.content),
                                  contentText: renderArticleAsText(data.content),
                                }
                              : null
                          )
                        }
                      />
                    );
                  }
                  return acc;
                },
                { infographicCount: 0, hasRenderedMarkdown: false, nodes: [] }
              ).nodes}
            </article>
          ) : (
            <div className="rounded-xl border border-dashed px-6 py-12 text-center text-muted-foreground">
              No article content yet.
            </div>
          )}
        </TabsContent>

        <TabsContent value="score" className="space-y-8 pt-6">
          {article.seoAudit.score < 90 && (
            <div className="rounded-2xl border border-amber-300 bg-amber-50 px-5 py-4 text-amber-900">
              <div className="flex items-start gap-3">
                <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" />
                <div className="space-y-2">
                  <p className="font-medium">SEO score below 90</p>
                  <p className="text-sm leading-6">
                    Consider switching to a more capable model in Settings (e.g. GPT-4, Claude Opus, or a stronger reasoning model) and regenerating the article for better results.
                  </p>
                  {article.calendar_item_id && article.status !== "published" && !article.published_url ? (
                    <Link href={`/projects/${projectId}/write/${article.calendar_item_id}`}>
                      <Button size="sm" variant="outline">Regenerate article</Button>
                    </Link>
                  ) : null}
                </div>
              </div>
            </div>
          )}

          <section className="rounded-2xl border bg-muted/20 p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">SEO quality score</p>
                <p className="mt-2 text-3xl font-semibold text-foreground">{article.seoAudit.score}/100</p>
                <p className="mt-1 text-sm text-muted-foreground">{article.articleQuality.wordCount} words in article body</p>
              </div>
              <div className="text-sm text-muted-foreground">
                {article.seoAudit.passedChecks} of {article.seoAudit.totalChecks} checks passed
              </div>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {article.seoAudit.categories.map((category) => (
                <div key={category.id} className={`rounded-xl border px-4 py-4 ${getScoreToneClasses(category.score)}`}>
                  <p className="font-medium">{category.label}</p>
                  <p className="mt-1 text-2xl font-semibold">{category.score}/100</p>
                  <p className="mt-1 text-sm opacity-80">
                    {category.passedChecks} of {category.totalChecks} checks passed
                  </p>
                  <p className="mt-2 text-sm opacity-80">{category.summary}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-6">
            {article.seoAudit.categories.map((category) => (
              <div key={category.id} className="space-y-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">{category.label}</p>
                  <p className="text-sm text-muted-foreground">{category.summary}</p>
                </div>
                <div className="grid gap-3 lg:grid-cols-2">
                  {article.seoAudit.checks
                    .filter((check) => check.category === category.id)
                    .map((check) => (
                      <div
                        key={check.id}
                        className={`rounded-xl border px-4 py-3 text-sm ${
                          check.passed
                            ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                            : "border-amber-300 bg-amber-50 text-amber-900"
                        }`}
                      >
                        <p className="font-medium">{check.label}</p>
                        <p className="mt-1 opacity-80">{check.details}</p>
                      </div>
                    ))}
                </div>
              </div>
            ))}
          </section>
        </TabsContent>

        <TabsContent value="seo" className="space-y-8 pt-6">
          <div className="flex flex-wrap items-center gap-2">
            <DropdownActionButton label="Copy SEO data" icon="copy" items={seoCopyItems} />
            <DropdownActionButton label="Export SEO data" icon="download" items={seoExportItems} />
            {article.seo_title ? (
              <DropdownActionButton
                label="Copy SEO title"
                icon="copy"
                items={[{ label: "Copy SEO title", onSelect: () => copyToClipboard(article.seo_title ?? "") }]}
              />
            ) : null}
            {article.meta_description ? (
              <DropdownActionButton
                label="Copy meta description"
                icon="copy"
                items={[{ label: "Copy meta description", onSelect: () => copyToClipboard(article.meta_description ?? "") }]}
              />
            ) : null}
          </div>

          <section className="grid gap-6 lg:grid-cols-2">
            <div className="min-w-0 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">SEO title</p>
              <p className="wrap-break-word text-base leading-7 text-foreground">
                {article.seo_title || "Not generated yet."}
              </p>
            </div>
            <div className="min-w-0 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Meta description</p>
              <p className="wrap-break-word text-base leading-7 text-foreground">
                {article.meta_description || "Not generated yet."}
              </p>
            </div>
          </section>
          <Separator />
          <section className="min-w-0 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Slug</p>
            <p className="break-all text-base leading-7 text-foreground">{article.slug || "Not generated yet."}</p>
          </section>
          <Separator />
          <section className="min-w-0 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Excerpt</p>
            <p className="wrap-break-word text-base leading-7 text-foreground">
              {article.excerpt || "Not generated yet."}
            </p>
          </section>
          <Separator />
          <section className="grid gap-6 lg:grid-cols-2">
            <div className="min-w-0 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Cover image alt</p>
              <p className="wrap-break-word text-base leading-7 text-foreground">
                {article.publishMetadata?.coverImageAlt || article.cover_image_alt || "Not generated yet."}
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Social hashtags</p>
              {article.publishMetadata?.socialHashtags?.length ? (
                <div className="flex flex-wrap gap-2">
                  {article.publishMetadata.socialHashtags.map((tag) => (
                    <Badge key={tag} variant="outline">{tag}</Badge>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">No hashtags available.</p>
              )}
            </div>
          </section>
          <Separator />
          <section className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Tags</p>
            {article.tags.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {article.tags.map((tag) => (
                  <Badge key={tag} variant="outline">{tag}</Badge>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">No tags available.</p>
            )}
          </section>
        </TabsContent>

        <TabsContent value="research" className="pt-6">
          <div className="mb-6 flex flex-wrap items-center gap-2">
            <DropdownActionButton
              label="Copy research"
              icon="copy"
              items={[
                { label: "Copy Markdown", onSelect: () => copyToClipboard(article.research_content ?? "") },
                { label: "Copy HTML", onSelect: () => copyToClipboard(article.researchHtml ?? "") },
                { label: "Copy Text", onSelect: () => copyToClipboard(researchText) },
              ]}
            />
            <DropdownActionButton
              label="Export research"
              icon="download"
              items={[
                { label: "Export Markdown", onSelect: () => downloadTextFile(`${article.slug ?? article.id}-research.md`, article.research_content ?? "", "text/markdown") },
                { label: "Export HTML", onSelect: () => downloadTextFile(`${article.slug ?? article.id}-research.html`, article.researchHtml ?? "", "text/html") },
                { label: "Export Text", onSelect: () => downloadTextFile(`${article.slug ?? article.id}-research.txt`, researchText, "text/plain") },
              ]}
            />
          </div>
          {article.research_content ? (
            <div
              className="prose prose-neutral max-w-none dark:prose-invert lg:prose-lg"
              dangerouslySetInnerHTML={{ __html: article.researchHtml }}
            />
          ) : (
            <div className="rounded-xl border border-dashed px-6 py-12 text-center text-muted-foreground">
              No research brief yet.
            </div>
          )}
        </TabsContent>

        <TabsContent value="publishing" className="space-y-6 pt-6">
          <div className="flex flex-wrap items-center gap-2">
            {article.published_url ? (
              <DropdownActionButton
                label="Copy live URL"
                icon="copy"
                items={[{ label: "Copy live URL", onSelect: () => copyToClipboard(article.published_url ?? "") }]}
              />
            ) : null}
          </div>
          {article.attempts.length > 0 ? (
            <div className="space-y-4">
              {article.attempts.map((attempt) => (
                <div key={attempt.id} className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
                  <div className="space-y-1">
                    <p className="font-medium text-foreground">{attempt.label || attempt.platform}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(attempt.created_at).toLocaleString()}
                    </p>
                    {attempt.error_message ? (
                      <p className="text-sm text-destructive">{attempt.error_message}</p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={attempt.status === "success" ? "default" : "secondary"}>
                      {attempt.status}
                    </Badge>
                    {attempt.published_url ? (
                      <a href={attempt.published_url} target="_blank" rel="noopener noreferrer">
                        <Button variant="outline" size="sm">Open</Button>
                      </a>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed px-6 py-12 text-center text-muted-foreground">
              No publishing activity yet.
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
