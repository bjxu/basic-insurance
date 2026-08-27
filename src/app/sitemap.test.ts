import { describe, it, expect } from "vitest";
import sitemap from "@/app/sitemap";

describe("sitemap", () => {
  const entries = sitemap();
  const urls = entries.map((e) => e.url);
  const LOCALES = ["de", "en", "es", "fr", "it", "pt"];

  it("lists /{locale} and /{locale}/how-it-works for all six locales (12 entries)", () => {
    expect([...urls].sort()).toEqual(
      LOCALES.flatMap((l) => [
        `https://example.com/${l}`,
        `https://example.com/${l}/how-it-works`,
      ]).sort(),
    );
  });

  it("contains no parameterized URLs", () => {
    expect(urls.every((u) => !u.includes("?"))).toBe(true);
  });

  it("every entry carries hreflang alternates for all six locales with correct per-path targeting", () => {
    for (const entry of entries) {
      const languages = entry.alternates?.languages ?? {};
      expect(Object.keys(languages).sort()).toEqual([...LOCALES].sort());

      // Extract the path from the entry URL (e.g., "/de/how-it-works" or "/de")
      const entryPath = entry.url.replace("https://example.com", "");
      const isHowItWorksPath = entryPath.endsWith("/how-it-works");

      // Each hreflang alternate must target the same path on the correct locale
      for (const locale of LOCALES) {
        const expectedAlternate = isHowItWorksPath
          ? `https://example.com/${locale}/how-it-works`
          : `https://example.com/${locale}`;
        expect(languages[locale as keyof typeof languages]).toBe(expectedAlternate);
      }
    }
  });
});
