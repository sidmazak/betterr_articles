import { marked } from "marked";

marked.setOptions({
  gfm: true,
  breaks: true,
});

function unwrapRenderableHtmlBlocks(markdown: string) {
  return markdown.replace(/```html\s*([\s\S]*?)```/gi, (_match, html) => html.trim());
}

/** Wrap tables in a scrollable container and apply proper bordered styling. */
function wrapTablesInScrollContainer(html: string) {
  return html.replace(
    /<table(\s[^>]*)?>([\s\S]*?)<\/table>/gi,
    (_, attrs, content) =>
      `<div class="my-6 overflow-x-auto -mx-2 px-2"><table class="article-table"${attrs ?? ""}>${content}</table></div>`
  );
}

export function renderMarkdown(markdown: string | null | undefined) {
  if (!markdown?.trim()) {
    return "";
  }

  const html = marked.parse(unwrapRenderableHtmlBlocks(markdown)) as string;
  return wrapTablesInScrollContainer(html);
}
