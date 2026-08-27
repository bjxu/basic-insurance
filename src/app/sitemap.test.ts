import { describe, it, expect } from "vitest";
import sitemap from "@/app/sitemap";

describe("sitemap", () => {
  const entries = sitemap();
  const urls = entries.map((e) => e.url);

  it("lists /{locale} and /{locale}/how-it-works for all four locales (8 entries)", () => {
    expect([...urls].sort()).toEqual(
      [
        "https://example.com/de",
        "https://example.com/de/how-it-works",
        "https://example.com/en",
        "https://example.com/en/how-it-works",
        "https://example.com/fr",
        "https://example.com/fr/how-it-works",
        "https://example.com/it",
        "https://example.com/it/how-it-works",
      ].sort(),
    );
  });

  it("contains no parameterized URLs", () => {
    expect(urls.every((u) => !u.includes("?"))).toBe(true);
  });

  it("every entry carries hreflang alternates for all four locales with correct per-path targeting", () => {
    for (const entry of entries) {
      const languages = entry.alternates?.languages ?? {};
      expect(Object.keys(languages).sort()).toEqual(["de", "en", "fr", "it"]);

      // Extract the path from the entry URL (e.g., "/de/how-it-works" or "/de")
      const entryPath = entry.url.replace("https://example.com", "");
      const isHowItWorksPath = entryPath.endsWith("/how-it-works");

      // Each hreflang alternate must target the same path on the correct locale
      for (const locale of ["de", "en", "fr", "it"]) {
        const expectedAlternate = isHowItWorksPath
          ? `https://example.com/${locale}/how-it-works`
          : `https://example.com/${locale}`;
        expect(languages[locale as keyof typeof languages]).toBe(expectedAlternate);
      }
    }
  });
});
