"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import html2canvas from "html2canvas";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, Code, Download, Share2, Sparkles } from "lucide-react";

const ARTICLE_BODY_PROSE =
  "prose prose-neutral max-w-none wrap-break-word text-[16px] leading-8 text-foreground dark:prose-invert lg:text-[1.05rem] lg:leading-8 lg:prose-lg prose-p:my-5 prose-p:leading-8 prose-headings:scroll-mt-24 prose-headings:font-semibold prose-headings:tracking-tight prose-h1:mb-5 prose-h1:text-4xl prose-h2:mt-12 prose-h2:mb-5 prose-h2:text-3xl prose-h3:mt-10 prose-h3:mb-4 prose-h3:text-2xl prose-h4:mt-8 prose-h4:mb-3 prose-h4:text-xl prose-strong:font-semibold prose-li:my-2 prose-li:leading-8 prose-blockquote:border-l-sky-300 prose-table:w-full prose-table:border-collapse prose-table:overflow-x-auto prose-thead:border-b prose-th:border prose-th:border-border prose-th:bg-muted/50 prose-th:px-4 prose-th:py-3 prose-th:text-left prose-th:font-semibold prose-td:border prose-td:border-border prose-td:px-4 prose-td:py-3 prose-a:font-medium prose-a:text-blue-600 prose-a:underline prose-a:decoration-blue-600 hover:prose-a:text-blue-800 prose-img:rounded-xl prose-img:border";

type PublicArticle = {
  id: string;
  title: string;
  slug: string | null;
  excerpt: string | null;
  category: string | null;
  tags: string[];
  cover_image_base64: string | null;
  cover_image_mime_type: string | null;
  cover_image_alt: string | null;
  contentHtml: string;
  articleSections: Array<
    | { type: "markdown"; html: string; markdown: string }
    | { type: "infographic"; title: string; html?: string; imageBase64?: string }
  >;
  publishMetadata: Record<string, unknown> | null;
};

function copyToClipboard(value: string) {
  if (!value) return Promise.resolve();
  return navigator.clipboard.writeText(value);
}

function InfographicBlock({
  html,
  title,
  imageBase64,
}: {
  html?: string;
  title: string;
  imageBase64?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [embedCopied, setEmbedCopied] = useState(false);
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

  return (
    <figure className="my-10 w-full max-w-4xl mx-auto overflow-hidden rounded-xl border border-border/80 bg-muted/10 p-4">
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
      <figcaption className="px-2 pt-3 text-sm text-muted-foreground text-center">
        {title}
      </figcaption>
      <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
        <Button variant="outline" size="sm" onClick={handleEmbed}>
          {embedCopied ? <Check className="mr-1 h-4 w-4" /> : <Code className="mr-1 h-4 w-4" />}
          {embedCopied ? "Copied" : "Embed"}
        </Button>
        <Button variant="outline" size="sm" onClick={handleDownload}>
          <Download className="mr-1 h-4 w-4" />
          Download
        </Button>
      </div>
    </figure>
  );
}

export default function PublicArticlePage() {
  const params = useParams();
  const id = params.id as string;
  const [article, setArticle] = useState<PublicArticle | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/articles/${id}/public`)
      .then((r) => {
        if (!r.ok) throw new Error("Article not found");
        return r.json();
      })
      .then(setArticle)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, [id]);

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-6">
        <p className="text-muted-foreground">{error}</p>
        <Link href="/" className="text-sm text-blue-600 underline hover:text-blue-800">
          Back to home
        </Link>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4">
          <Link
            href="/"
            className="text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            {process.env.NEXT_PUBLIC_SITE_NAME ?? "Better Articles"}
          </Link>
          <button
            type="button"
            onClick={() => {
              const url = `${typeof window !== "undefined" ? window.location.origin : ""}/a/${id}`;
              navigator.clipboard.writeText(url);
            }}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <Share2 className="h-4 w-4" />
            Share
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-8">
        <article className="space-y-8">
          <header className="space-y-4">
            {article.category && (
              <p className="text-sm font-medium text-muted-foreground">
                {article.category}
              </p>
            )}
            <h1 className="wrap-break-word text-4xl font-semibold tracking-tight text-foreground lg:text-5xl">
              {article.title}
            </h1>
            {article.excerpt && (
              <p className="wrap-break-word text-lg leading-8 text-muted-foreground">
                {article.excerpt}
              </p>
            )}
            {article.tags.length > 0 && (
              <div className="flex min-w-0 flex-wrap gap-2">
                {article.tags.map((tag) => (
                  <span
                    key={tag}
                    className="max-w-full wrap-break-word rounded-md border px-2 py-0.5 text-xs text-muted-foreground"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </header>
          {article.cover_image_base64 && article.cover_image_mime_type && (
            <div className="overflow-hidden rounded-2xl border bg-muted/20">
              <Image
                src={`data:${article.cover_image_mime_type};base64,${article.cover_image_base64}`}
                alt={article.cover_image_alt ?? article.title}
                width={1200}
                height={630}
                unoptimized
                className="h-auto w-full object-cover"
              />
            </div>
          )}
          <div className="space-y-2">
            {article.articleSections.map((section, index) =>
              section.type === "markdown" ? (
                <div
                  key={`md-${index}`}
                  className={ARTICLE_BODY_PROSE}
                  dangerouslySetInnerHTML={{ __html: section.html }}
                />
              ) : (
                <InfographicBlock
                  key={`infographic-${index}`}
                  html={"html" in section ? section.html : undefined}
                  title={section.title}
                  imageBase64={"imageBase64" in section ? section.imageBase64 : undefined}
                />
              )
            )}
          </div>
        </article>
      </main>
    </div>
  );
}
