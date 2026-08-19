import { describe, it, expect } from "vitest";
import { getProductDescription, type ProductDescriptions } from "@/lib/productDescriptions";

describe("getProductDescription", () => {
  const descriptions: ProductDescriptions = {
    "1509": {
      "01_131": {
        de: "Anruf bei der Callmed-Hotline erforderlich.",
        en: "Call the Callmed hotline first.",
        fr: "Appel à la hotline Callmed requis.",
        it: "Chiamata alla hotline Callmed richiesta.",
        sourceUrl: "https://example.com/callmed",
        crawledAt: "2026-08-19",
      },
    },
  };

  it("returns the description for a known insurer/tarifCode/locale", () => {
    expect(getProductDescription(descriptions, "1509", "01_131", "en")).toBe(
      "Call the Callmed hotline first.",
    );
  });

  it("returns undefined for a locale not present on the entry", () => {
    // Type system normally prevents this, but the JSON on disk is hand/script-edited,
    // so a partially-filled entry is a real runtime possibility.
    const partial = { "1509": { "01_131": { de: "x" } } } as unknown as ProductDescriptions;
    expect(getProductDescription(partial, "1509", "01_131", "en")).toBeUndefined();
  });

  it("returns undefined for an unknown tarifCode", () => {
    expect(getProductDescription(descriptions, "1509", "BASE", "en")).toBeUndefined();
  });

  it("returns undefined for an unknown insurerCode", () => {
    expect(getProductDescription(descriptions, "9999", "01_131", "en")).toBeUndefined();
  });

  it("returns undefined for an unrecognized locale string", () => {
    expect(getProductDescription(descriptions, "1509", "01_131", "rm")).toBeUndefined();
  });

  it("returns undefined against an empty descriptions map", () => {
    expect(getProductDescription({}, "1509", "01_131", "de")).toBeUndefined();
  });
});
