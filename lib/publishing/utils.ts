import { renderMarkdown } from "@/lib/markdown";

export function requireString(config: Record<string, unknown>, key: string) {
  const value = config[key];
  return typeof value === "string" ? value.trim() : "";
}

export function splitTags(tags?: string[]) {
  return Array.isArray(tags)
    ? tags.map((tag) => tag.trim()).filter(Boolean)
    : [];
}

export function toParagraphRichContent(markdown: string) {
  const now = Date.now();
  const lines = markdown
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const nodes = lines.map((line, index) => ({
    id: `node-${index}-${now}`,
    type: "PARAGRAPH",
    nodes: [
      {
        id: `text-${index}-${now}`,
        type: "TEXT",
        textData: {
          text: line,
          decorations: [],
        },
      },
    ],
    paragraphData: {},
  }));

  return {
    version: "1.0.0",
    nodes,
    metadata: {
      createdTimestamp: now,
      updatedTimestamp: now,
    },
  };
}

export function markdownToHtml(markdown: string) {
  return renderMarkdown(markdown);
}

export function toDataUrl(base64: string | null | undefined, mimeType: string | null | undefined) {
  if (!base64 || !mimeType) return null;
  return `data:${mimeType};base64,${base64}`;
}

export function renderTemplate(template: string, payload: Record<string, unknown>) {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key) => {
    const value = payload[key];
    if (value == null) return "";
    return typeof value === "string" ? value : JSON.stringify(value);
  });
}

export function getJsonPathValue(input: unknown, path: string | undefined) {
  if (!path) return undefined;
  const parts = path.split(".").filter(Boolean);
  let current = input;
  for (const part of parts) {
    if (!current || typeof current !== "object" || !(part in current)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}
