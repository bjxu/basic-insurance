import { describe, it, expect } from "vitest";
import sitemap from "@/app/sitemap";

describe("sitemap", () => {
  const entries = sitemap();
  const urls = entries.map((e) => e.url);
  const LOCALES = ["de", "en", "es", "fr", "it", "pt"];

  it("lists /{locale} and /{locale}/how-it-works for all six locales, plus the German-only /de/praemien guide (13 entries)", () => {
    expect([...urls].sort()).toEqual(
      [
        ...LOCALES.flatMap((l) => [
          `https://example.com/${l}`,
          `https://example.com/${l}/how-it-works`,
        ]),
        "https://example.com/de/praemien",
      ].sort(),
    );
  });

  it("contains no parameterized URLs", () => {
    expect(urls.every((u) => !u.includes("?"))).toBe(true);
  });

  it("every localized entry carries hreflang alternates for all six locales with correct per-path targeting", () => {
    const localizedEntries = entries.filter((e) => e.url !== "https://example.com/de/praemien");
    for (const entry of localizedEntries) {
      const languages = entry.alternates?.languages ?? {};
      expect(Object.keys(languages).sort()).toEqual([...LOCALES].sort());

      const entryPath = entry.url.replace("https://example.com", "");
      const isHowItWorksPath = entryPath.endsWith("/how-it-works");

      for (const locale of LOCALES) {
        const expectedAlternate = isHowItWorksPath
          ? `https://example.com/${locale}/how-it-works`
          : `https://example.com/${locale}`;
        expect(languages[locale as keyof typeof languages]).toBe(expectedAlternate);
      }
    }
  });

  it("the /de/praemien entry has no hreflang alternates (no other-locale version exists)", () => {
    const praemienEntry = entries.find((e) => e.url === "https://example.com/de/praemien");
    expect(praemienEntry).toBeDefined();
    expect(praemienEntry?.alternates?.languages ?? {}).toEqual({});
  });
});
