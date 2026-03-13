import { renderMarkdown } from "@/lib/markdown";

export type ArticleSection =
  | { type: "markdown"; html: string; markdown: string }
  | { type: "infographic"; title: string; html: string; imageBase64?: never }
  | { type: "infographic"; title: string; html?: never; imageBase64: string };

const INFOGRAPHIC_HTML_PATTERN = /<(figure|table|svg|div)\b/i;
const INFOGRAPHIC_IMAGE_BLOCK_REGEX =
  /(?:^|\n)(?:Infographic:\s*(.+?)\n)?```data:image\/png;base64\s*([\s\S]*?)```/gi;

const METADATA_BLOCK_PATTERNS = [
  /(?:\n|^)\s*#{1,6}\s*(?:Meta\s*Data|Metadata)\s*:?\s*$/im,
  /(?:\n|^)\s*\*\*(?:Meta\s*Data|Metadata)\*\*\s*$/im,
  /(?:\n|^)\s*(?:Meta\s*Data|Metadata)\s*:?\s*$/im,
  /(?:\n|^)\s*Research\s+brief\s*:?\s*$/im,
  /(?:\n|^)\s*Metadata\s*\([^)]*SEO[^)]*\)\s*$/im,
  /(?:\n|^)\s*SEO\s+Title\s*:\s+/im,
  /(?:\n|^)\s*Meta\s+Description\s*:\s+/im,
  /(?:\n|^)\s*Canonical\s+URL\s*:\s+/im,
  /(?:\n|^)\s*Tags\s*:\s+/im,
  /(?:\n|^)\s*Social\s+Hashtags\s*:\s+/im,
  /(?:\n|^)\s*Featured\s+Image\s+Concept\s*:\s+/im,
  /(?:\n|^)\s*Alt\s+Text\s*:\s+/im,
];

function stripTrailingMetadataBlock(content: string): string {
  let earliestIndex: number | undefined;
  for (const pattern of METADATA_BLOCK_PATTERNS) {
    const match = content.match(pattern);
    if (match && match.index !== undefined) {
      if (earliestIndex === undefined || match.index < earliestIndex) {
        earliestIndex = match.index;
      }
    }
  }
  if (earliestIndex === undefined) return content;
  return content.slice(0, earliestIndex).trimEnd();
}

export function cleanArticleMarkdown(content: string) {
  return stripTrailingMetadataBlock(
    content
      .replace(/\n```html\s*$/gi, "\n")
      .replace(/\n\d+\s*$/g, "\n")
      .replace(/(?<!\]\()\s*\(#infographic-[a-z0-9_-]+\)\s*/gi, " ")
      .trim()
  );
}

export function stripHtml(value: string) {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

/** Removes a leading H1 from HTML when the page already displays the title separately. */
export function stripLeadingH1(html: string): string {
  return html.replace(/^<h1[^>]*>[\s\S]*?<\/h1>\s*/i, "").trimStart();
}

export function markdownToPlainText(markdown: string) {
  return stripHtml(renderMarkdown(markdown));
}

export function htmlToPlainText(html: string) {
  return stripHtml(html);
}

function inferInfographicTitle(html: string, fallbackIndex: number) {
  const figcaption = html.match(/<figcaption[^>]*>([\s\S]*?)<\/figcaption>/i)?.[1];
  const heading = html.match(/<(h[1-6]|strong)[^>]*>([\s\S]*?)<\/(h[1-6]|strong)>/i)?.[2];
  const candidate = stripHtml(figcaption ?? heading ?? "");
  return candidate || `Infographic ${fallbackIndex}`;
}

function addListClasses(html: string, variant: "takeaways" | "toc") {
  const listClasses =
    variant === "takeaways"
      ? 'class="m-0 space-y-3 pl-5 text-[15px] leading-7 text-slate-800 marker:text-sky-700"'
      : 'class="m-0 space-y-3 pl-0 text-[15px] leading-7 text-purple-900 list-none"';

  const liPrefix =
    variant === "takeaways"
      ? '<li class="pl-1">'
      : '<li class="flex items-start gap-2"><span class="mt-0.5 text-purple-500">→</span><span>';
  const liSuffix = variant === "takeaways" ? "</li>" : "</span></li>";

  return html
    .replace(/^<(ul|ol)>/i, `<$1 ${listClasses}>`)
    .replace(/<li>/g, liPrefix)
    .replace(/<\/li>/g, liSuffix);
}

function wrapLeadCalloutBlock(
  html: string,
  heading: string,
  variant: "takeaways" | "toc"
) {
  const titleTone =
    variant === "takeaways" ? "text-sky-800" : "text-purple-800";
  const accentTone =
    variant === "takeaways" ? "bg-sky-600" : "bg-violet-500";
  const frameClasses =
    variant === "takeaways"
      ? "border-sky-200 bg-sky-50/90"
      : "border-purple-200 bg-purple-50/90";

  return html.replace(
    new RegExp(
      `<h2>${heading}<\\/h2>\\s*(<(?:ul|ol)>[\\s\\S]*?<\\/(?:ul|ol)>)`,
      "i"
    ),
    (_match, listHtml: string) =>
      `<section data-article-callout="${variant}" class="not-prose my-8 rounded-2xl border ${frameClasses} px-6 py-5 shadow-sm [&_a]:underline [&_a]:decoration-current [&_a]:underline-offset-2 [&_a]:font-medium hover:[&_a]:opacity-90">
  <div class="mb-4 flex items-center gap-3">
    <span class="h-8 w-1.5 rounded-full ${accentTone}"></span>
    <h2 class="m-0 text-[1.35rem] font-semibold tracking-tight ${titleTone}">${heading}</h2>
  </div>
  ${addListClasses(listHtml, variant)}
</section>`
  );
}

function enhanceSpecialArticleBlocks(html: string) {
  return wrapLeadCalloutBlock(
    wrapLeadCalloutBlock(html, "Key Takeaways", "takeaways"),
    "Table of Contents",
    "toc"
  );
}

function splitByInfographicBlocks(content: string): Array<{ type: "markdown" | "infographic-html" | "infographic-image"; start: number; end: number; title?: string; html?: string; imageBase64?: string }> {
  const blocks: Array<{ type: "markdown" | "infographic-html" | "infographic-image"; start: number; end: number; title?: string; html?: string; imageBase64?: string }> = [];
  const htmlRegex = /(?:^|\n)(?:Infographic:\s*(.+?)\n)?```html\s*([\s\S]*?)```/gi;
  const imageRegex = new RegExp(INFOGRAPHIC_IMAGE_BLOCK_REGEX.source, INFOGRAPHIC_IMAGE_BLOCK_REGEX.flags);

  const allMatches: Array<{ index: number; length: number; type: "html" | "image"; title?: string; html?: string; imageBase64?: string }> = [];

  let m: RegExpExecArray | null;
  while ((m = htmlRegex.exec(content)) !== null) {
    const title = m[1]?.trim();
    const html = m[2].trim();
    if (title || INFOGRAPHIC_HTML_PATTERN.test(html)) {
      allMatches.push({ index: m.index, length: m[0].length, type: "html", title, html });
    }
  }
  while ((m = imageRegex.exec(content)) !== null) {
    const title = m[1]?.trim();
    const imageBase64 = (m[2] ?? "").replace(/\s/g, "");
    if (imageBase64) {
      allMatches.push({ index: m.index, length: m[0].length, type: "image", title, imageBase64 });
    }
  }

  allMatches.sort((a, b) => a.index - b.index);

  const skipHtmlAfterImage = new Set<number>();
  for (let i = 0; i < allMatches.length - 1; i++) {
    const curr = allMatches[i];
    const next = allMatches[i + 1];
    if (curr.type === "image" && next.type === "html") {
      const gap = next.index - (curr.index + curr.length);
      if (gap >= 0 && gap <= 100 && /^\s*$/.test(content.slice(curr.index + curr.length, next.index))) {
        skipHtmlAfterImage.add(i + 1);
      }
    }
  }

  let lastEnd = 0;
  for (let i = 0; i < allMatches.length; i++) {
    const match = allMatches[i];
    if (skipHtmlAfterImage.has(i)) {
      lastEnd = match.index + match.length;
      continue;
    }
    if (match.index > lastEnd) {
      blocks.push({ type: "markdown", start: lastEnd, end: match.index });
    }
    if (match.type === "html") {
      blocks.push({
        type: "infographic-html",
        start: match.index,
        end: match.index + match.length,
        title: match.title,
        html: match.html,
      });
    } else {
      blocks.push({
        type: "infographic-image",
        start: match.index,
        end: match.index + match.length,
        title: match.title ?? "Infographic",
        imageBase64: match.imageBase64,
      });
    }
    lastEnd = match.index + match.length;
  }
  if (lastEnd < content.length) {
    blocks.push({ type: "markdown", start: lastEnd, end: content.length });
  }
  return blocks;
}

export function buildArticleSections(content: string): ArticleSection[] {
  if (!content.trim()) return [];

  const sections: ArticleSection[] = [];
  const blocks = splitByInfographicBlocks(content);
  let infographicIndex = 0;

  for (const block of blocks) {
    if (block.type === "markdown") {
      const markdownChunk = cleanArticleMarkdown(content.slice(block.start, block.end));
      if (markdownChunk.trim()) {
        sections.push({
          type: "markdown",
          markdown: markdownChunk,
          html: enhanceSpecialArticleBlocks(renderMarkdown(markdownChunk)),
        });
      }
    } else if (block.type === "infographic-html" && block.html) {
      infographicIndex += 1;
      sections.push({
        type: "infographic",
        title: block.title || inferInfographicTitle(block.html, infographicIndex),
        html: block.html,
      });
    } else if (block.type === "infographic-image" && block.imageBase64) {
      infographicIndex += 1;
      sections.push({
        type: "infographic",
        title: block.title ?? `Infographic ${infographicIndex}`,
        imageBase64: block.imageBase64,
      });
    }
  }

  return sections;
}

export function renderArticleAsHtml(content: string) {
  return buildArticleSections(content)
    .map((section) => {
      if (section.type === "markdown") return section.html;
      if ("imageBase64" in section && section.imageBase64) {
        return `<section data-infographic="true"><figure><img src="data:image/png;base64,${section.imageBase64}" alt="${escapeHtmlAttr(section.title)}" /><figcaption>${escapeHtmlAttr(section.title)}</figcaption></figure></section>`;
      }
      return `<section data-infographic="true">${section.html}</section>`;
    })
    .join("\n");
}

function escapeHtmlAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function renderArticleAsText(content: string) {
  return buildArticleSections(content)
    .map((section) => {
      if (section.type === "markdown") return htmlToPlainText(section.html);
      if ("html" in section && section.html) return htmlToPlainText(section.html);
      return section.title;
    })
    .filter(Boolean)
    .join("\n\n")
    .trim();
}

export function extractMarkdownLinks(content: string) {
  const markdownLinks = [...content.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g)].map((match) => ({
    text: match[1].trim(),
    url: match[2].trim(),
  }));
  const htmlLinks = [...content.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)].map(
    (match) => ({
      text: stripHtml(match[2]),
      url: match[1].trim(),
    })
  );

  return [...markdownLinks, ...htmlLinks].filter(
    (link) => link.text.length > 0 && link.url.length > 0
  );
}

