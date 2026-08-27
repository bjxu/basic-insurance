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

  it("every entry carries hreflang alternates for all four locales", () => {
    for (const entry of entries) {
      expect(Object.keys(entry.alternates?.languages ?? {}).sort()).toEqual(["de", "en", "fr", "it"]);
    }
  });
});
