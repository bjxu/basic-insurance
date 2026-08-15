import { describe, expect, it } from "vitest";
import de from "./de.json";
import en from "./en.json";
import fr from "./fr.json";
import itMessages from "./it.json";

function collectKeys(value: unknown, prefix = ""): string[] {
  if (typeof value !== "object" || value === null) return [prefix];
  return Object.entries(value).flatMap(([key, v]) => collectKeys(v, prefix ? `${prefix}.${key}` : key));
}

describe("message catalogs", () => {
  const deKeys = collectKeys(de).sort();

  it.each([
    ["en", en],
    ["fr", fr],
    ["it", itMessages],
  ])("%s.json has exactly the same keys as de.json", (_locale, catalog) => {
    expect(collectKeys(catalog).sort()).toEqual(deKeys);
  });
});
