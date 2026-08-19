import { describe, it, expect } from "vitest";
import { matchProductPage, type CrawledPage } from "./matchProductPage";

describe("matchProductPage", () => {
  it("prefers a title match over a page with more body-text occurrences", () => {
    const pages: CrawledPage[] = [
      { url: "https://x.ch/other", title: "Other Product", text: "Callmed Callmed Callmed Callmed" },
      { url: "https://x.ch/callmed", title: "Callmed – Telmed-Modell", text: "Details about Callmed." },
    ];
    expect(matchProductPage(pages, "Callmed")?.url).toBe("https://x.ch/callmed");
  });

  it("returns null when only body text mentions the product, not the title", () => {
    // A body-text mention on a category/nav page is not enough to attribute the page to
    // a specific product — report it unmatched rather than describing the wrong page.
    const pages: CrawledPage[] = [
      { url: "https://x.ch/telmed", title: "Telmed-Modelle", text: "Unser Produkt Sana24 im Detail." },
    ];
    expect(matchProductPage(pages, "Sana24")).toBeNull();
  });

  it("is case- and diacritic-insensitive", () => {
    const pages: CrawledPage[] = [
      { url: "https://x.ch/gv", title: "Persönliche Ärzte GRUNDVERSICHERUNG", text: "" },
    ];
    expect(matchProductPage(pages, "personliche arzte grundversicherung")?.url).toBe(
      "https://x.ch/gv",
    );
  });

  it("returns null when no page mentions the product at all", () => {
    const pages: CrawledPage[] = [{ url: "https://x.ch/other", title: "Unrelated", text: "Nothing relevant." }];
    expect(matchProductPage(pages, "Callmed")).toBeNull();
  });

  it("returns null for an empty pages array", () => {
    expect(matchProductPage([], "Callmed")).toBeNull();
  });

  it("returns null for an empty product name rather than matching everything", () => {
    const pages: CrawledPage[] = [{ url: "https://x.ch/a", title: "Anything", text: "Some text" }];
    expect(matchProductPage(pages, "")).toBeNull();
  });
});
