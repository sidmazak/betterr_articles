import { encode as encodeToon } from "@toon-format/toon";
import { countTokens } from "gpt-tokenizer";
import { getPromptOptimizationSettings } from "@/lib/db/settings";

type JsonLike =
  | string
  | number
  | boolean
  | null
  | JsonLike[]
  | { [key: string]: JsonLike };

export type StructuredPromptMode = "toon" | "json";

function getStructuredPromptMode(): StructuredPromptMode {
  return getPromptOptimizationSettings().structured_data_format;
}

function stringifyStructuredValue(
  value: JsonLike,
  mode: StructuredPromptMode
) {
  return mode === "toon" ? encodeToon(value) : JSON.stringify(value);
}

export function serializeStructuredPromptBlock(label: string, value: JsonLike) {
  const mode = getStructuredPromptMode();
  return `### ${label} [${mode.toUpperCase()}]\n${stringifyStructuredValue(value, mode)}`;
}

export function serializeStructuredPromptInline(label: string, value: JsonLike) {
  const mode = getStructuredPromptMode();
  return `${label} [${mode.toUpperCase()}]: ${stringifyStructuredValue(value, mode)}`;
}

export function getStructuredPromptInstruction() {
  const mode = getStructuredPromptMode();
  return mode === "toon"
    ? "Structured context may appear in TOON format. Read fields, arrays, and rows directly."
    : "Structured context may appear in compact JSON format. Read fields, arrays, and objects directly.";
}

export function measureStructuredPromptTokens(value: JsonLike) {
  const toon = encodeToon(value);
  const json = JSON.stringify(value);
  const toonTokens = countTokens(toon);
  const jsonTokens = countTokens(json);

  return {
    toon,
    json,
    toonTokens,
    jsonTokens,
    savings: jsonTokens - toonTokens,
    preferredMode: toonTokens <= jsonTokens ? "toon" : "json",
  } as const;
}
