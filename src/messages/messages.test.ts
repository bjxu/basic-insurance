import { describe, expect, it } from "vitest";
import de from "./de.json";
import en from "./en.json";
import fr from "./fr.json";
import itMessages from "./it.json";
import pt from "./pt.json";
import es from "./es.json";
import { ALL_TARIFARTS } from "@/lib/lookup";

function collectKeys(value: unknown, prefix = ""): string[] {
  if (typeof value !== "object" || value === null) return [prefix];
  return Object.entries(value).flatMap(([key, v]) => collectKeys(v, prefix ? `${prefix}.${key}` : key));
}

// key path -> sorted {placeholder} names in that leaf string, so a locale that typo'd
// {amount} as {Amount} or dropped a placeholder fails instead of silently rendering wrong.
function collectPlaceholders(value: unknown, prefix = "", out: Record<string, string[]> = {}) {
  if (typeof value !== "object" || value === null) {
    const names = [...String(value).matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
    out[prefix] = [...new Set(names)].sort();
    return out;
  }
  for (const [key, v] of Object.entries(value)) collectPlaceholders(v, prefix ? `${prefix}.${key}` : key, out);
  return out;
}

describe("message catalogs", () => {
  const deKeys = collectKeys(de).sort();
  const dePlaceholders = collectPlaceholders(de);

  it.each([
    ["en", en],
    ["fr", fr],
    ["it", itMessages],
    ["pt", pt],
    ["es", es],
  ])("%s.json has exactly the same keys and placeholders as de.json", (_locale, catalog) => {
    expect(collectKeys(catalog).sort()).toEqual(deKeys);
    expect(collectPlaceholders(catalog)).toEqual(dePlaceholders);
  });

  it("de.json has label and description copy for every real Tarifart value", () => {
    for (const tarifart of ALL_TARIFARTS) {
      const entry = (de.copy.tarifart as Record<string, { label?: string; description?: string }>)[tarifart];
      expect(entry?.label, `missing copy.tarifart.${tarifart}.label`).toBeTruthy();
      expect(entry?.description, `missing copy.tarifart.${tarifart}.description`).toBeTruthy();
    }
  });
});
