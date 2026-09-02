import { describe, it, expect } from "vitest";
import sitemap from "@/app/sitemap";

describe("sitemap", () => {
  const entries = sitemap();
  const urls = entries.map((e) => e.url);
  const LOCALES = ["de", "en", "es", "fr", "it", "pt"];

  it("lists /{locale}, /{locale}/how-it-works and /{locale}/praemien for all six locales (18 entries)", () => {
    expect([...urls].sort()).toEqual(
      LOCALES.flatMap((l) => [
        `https://example.com/${l}`,
        `https://example.com/${l}/how-it-works`,
        `https://example.com/${l}/praemien`,
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

      const suffix = entry.url
        .replace("https://example.com", "")
        .replace(/^\/(de|en|es|fr|it|pt)/, "");
      for (const locale of LOCALES) {
        expect(languages[locale as keyof typeof languages]).toBe(
          `https://example.com/${locale}${suffix}`,
        );
      }
    }
  });
});
