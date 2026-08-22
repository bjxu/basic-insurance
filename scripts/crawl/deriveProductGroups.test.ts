import { describe, it, expect } from "vitest";
import { deriveProductGroups, mergeProductGroups, type MatchedProduct } from "./deriveProductGroups";
import type { ProductGroups } from "../../src/lib/productGroups";

describe("deriveProductGroups", () => {
  it("groups tarifCodes that matched the same page, naming the group by shared leading words", () => {
    const matches: MatchedProduct[] = [
      { tarifCode: "BFP_CP", productName: "BeneFit PLUS Hausarzt R1", pageUrl: "https://x.ch/hausarzt.html" },
      { tarifCode: "BFP_CM", productName: "BeneFit PLUS Hausarzt R2", pageUrl: "https://x.ch/hausarzt.html" },
      { tarifCode: "BFP_CA", productName: "BeneFit PLUS Hausarzt R3", pageUrl: "https://x.ch/hausarzt.html" },
      { tarifCode: "BFP_BF", productName: "BeneFit PLUS Hausarzt R4", pageUrl: "https://x.ch/hausarzt.html" },
    ];
    expect(deriveProductGroups(matches)).toEqual({
      BFP_CP: "BeneFit PLUS Hausarzt",
      BFP_CM: "BeneFit PLUS Hausarzt",
      BFP_CA: "BeneFit PLUS Hausarzt",
      BFP_BF: "BeneFit PLUS Hausarzt",
    });
  });

  it("does not group a tarifCode that matched a page alone", () => {
    const matches: MatchedProduct[] = [
      { tarifCode: "BASE", productName: "Grundversicherung", pageUrl: "https://x.ch/std.html" },
    ];
    expect(deriveProductGroups(matches)).toEqual({});
  });

  it("does not group tarifCodes on the same page with no shared leading word", () => {
    const matches: MatchedProduct[] = [
      { tarifCode: "A", productName: "Alpha Plan", pageUrl: "https://x.ch/shared.html" },
      { tarifCode: "B", productName: "Beta Plan", pageUrl: "https://x.ch/shared.html" },
    ];
    expect(deriveProductGroups(matches)).toEqual({});
  });

  it("keeps unrelated pages' groups independent", () => {
    const matches: MatchedProduct[] = [
      { tarifCode: "H1", productName: "Hausarztmodell 1", pageUrl: "https://x.ch/haus.html" },
      { tarifCode: "H2", productName: "Hausarztmodell 2", pageUrl: "https://x.ch/haus.html" },
      { tarifCode: "T1", productName: "Telmed Callmed", pageUrl: "https://x.ch/telmed.html" },
      { tarifCode: "T2", productName: "Telmed Sana24", pageUrl: "https://x.ch/telmed.html" },
    ];
    expect(deriveProductGroups(matches)).toEqual({
      H1: "Hausarztmodell",
      H2: "Hausarztmodell",
      T1: "Telmed",
      T2: "Telmed",
    });
  });

  it("cuts at word boundaries, not mid-token", () => {
    // "...Hausarzt R" is NOT the correct group name — the shared token is "Hausarzt", not "R".
    const matches: MatchedProduct[] = [
      { tarifCode: "R1", productName: "Modell Hausarzt R1", pageUrl: "https://x.ch/p.html" },
      { tarifCode: "R2", productName: "Modell Hausarzt R2", pageUrl: "https://x.ch/p.html" },
    ];
    expect(deriveProductGroups(matches)).toEqual({
      R1: "Modell Hausarzt",
      R2: "Modell Hausarzt",
    });
  });

  it("returns an empty object for empty input", () => {
    expect(deriveProductGroups([])).toEqual({});
  });
});

describe("mergeProductGroups", () => {
  it("adds derived groups for tarifCodes with no existing entry", () => {
    const result = mergeProductGroups({}, "1562", { BFP_BF: "BeneFit PLUS Hausarzt" });
    expect(result).toEqual({ "1562": { BFP_BF: "BeneFit PLUS Hausarzt" } });
  });

  it("never overwrites an existing hand-entered groupName", () => {
    const existing: ProductGroups = { "1562": { BFP_BF: "Hand-Corrected Name" } };
    const result = mergeProductGroups(existing, "1562", { BFP_BF: "Auto-Derived Name" });
    expect(result).toEqual({ "1562": { BFP_BF: "Hand-Corrected Name" } });
  });

  it("preserves other insurers untouched", () => {
    const existing: ProductGroups = { "9999": { X: "Y" } };
    const result = mergeProductGroups(existing, "1562", { BFP_BF: "BeneFit PLUS Hausarzt" });
    expect(result).toEqual({ "9999": { X: "Y" }, "1562": { BFP_BF: "BeneFit PLUS Hausarzt" } });
  });

  it("returns existing unchanged when there's nothing to merge", () => {
    const existing: ProductGroups = { "9999": { X: "Y" } };
    expect(mergeProductGroups(existing, "1562", {})).toEqual(existing);
  });
});
