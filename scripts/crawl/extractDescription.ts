// Turns a crawled product page into a one-sentence, restriction-focused description in
// each of de/en/fr/it, matching copy.tarifart.*.description's tone (src/messages/de.json)
// — e.g. "Erstbehandlung immer beim gewählten Hausarzt", never marketing copy
// (docs/superpowers/specs/2026-08-19-provider-product-descriptions-design.md).

import type Anthropic from "@anthropic-ai/sdk";
import type { Tarifart } from "../../src/lib/types";

const MODEL = "claude-sonnet-5";
const MAX_PAGE_TEXT_CHARS = 8000;

export type DescriptionSet = { de: string; en: string; fr: string; it: string };

type ExtractArgs = { pageText: string; productName: string; tarifart: Tarifart };

export function buildPrompt({ pageText, productName, tarifart }: ExtractArgs): string {
  return [
    `You are writing a one-sentence description of a Swiss basic health insurance`,
    `("Grundversicherung") product for a comparison site.`,
    `Product name: "${productName}". Insurance model category (Tarifart): "${tarifart}".`,
    ``,
    `Focus ONLY on the access restriction mechanic (which doctor/hotline/practice must`,
    `be contacted first, network size if the page states one) — never general marketing,`,
    `perks, or pricing. Match this tone and length (existing generic examples for the`,
    `category, for reference):`,
    `- hausarzt: "Erstbehandlung immer beim gewählten Hausarzt"`,
    `- telmed: "Anruf bei Hotline erforderlich vor jedem Arztbesuch"`,
    `- hmo: "Erstanlaufstelle immer beim HMO-Zentrum"`,
    ``,
    `Write one sentence per language (de, en, fr, it). If the page doesn't give you`,
    `enough to say something more specific than the generic category description above,`,
    `output the generic description translated into each language instead of inventing`,
    `details.`,
    ``,
    `Respond with ONLY a JSON object, no markdown fences, no other text:`,
    `{"de": "...", "en": "...", "fr": "...", "it": "..."}`,
    ``,
    `Page content (from ${productName}'s product page):`,
    pageText.slice(0, MAX_PAGE_TEXT_CHARS),
  ].join("\n");
}

export function parseResponse(text: string): DescriptionSet | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text.trim());
  } catch {
    return null;
  }
  return isDescriptionSet(parsed) ? parsed : null;
}

function isDescriptionSet(value: unknown): value is DescriptionSet {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return (["de", "en", "fr", "it"] as const).every(
    (key) => typeof record[key] === "string" && record[key].trim() !== "",
  );
}

export async function extractDescription(
  client: Anthropic,
  args: ExtractArgs,
): Promise<DescriptionSet | null> {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 512,
    messages: [{ role: "user", content: buildPrompt(args) }],
  });
  const block = response.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") return null;
  return parseResponse(block.text);
}
