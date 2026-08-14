import { describe, it, expect } from "vitest";
import { SERVICE_QUALITY_RATINGS } from "./serviceQuality";
import { INSURER_NAMES } from "../../scripts/ingest/insurers";

describe("SERVICE_QUALITY_RATINGS", () => {
  it("every insurerCode exists in INSURER_NAMES", () => {
    for (const rating of SERVICE_QUALITY_RATINGS) {
      expect(INSURER_NAMES[rating.insurerCode], `unknown insurer code "${rating.insurerCode}"`).toBeDefined();
    }
  });

  it("every source's rawScore is within (0, scaleMax]", () => {
    for (const rating of SERVICE_QUALITY_RATINGS) {
      for (const source of rating.sources) {
        expect(source.rawScore).toBeGreaterThan(0);
        expect(source.rawScore).toBeLessThanOrEqual(source.scaleMax);
      }
    }
  });

  it("has no duplicate insurerCode entries", () => {
    const codes = SERVICE_QUALITY_RATINGS.map((r) => r.insurerCode);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("every rating has at least one source", () => {
    for (const rating of SERVICE_QUALITY_RATINGS) {
      expect(rating.sources.length).toBeGreaterThan(0);
    }
  });

  it("Helsana (1562) carries all 3 sources with the verified 2026 figures", () => {
    const helsana = SERVICE_QUALITY_RATINGS.find((r) => r.insurerCode === "1562");
    expect(helsana?.sources).toEqual([
      { sourceName: "moneyland.ch", rawScore: 8.0, scaleMax: 10, sourceYear: 2026, sourceUrl: "https://www.moneyland.ch/de/krankenkassen-zufriedenheit-2026" },
      { sourceName: "comparis.ch", rawScore: 5.1, scaleMax: 6, sourceYear: 2026, sourceUrl: "https://www.presseportal.ch/de/pm/100003671/100941089" },
      { sourceName: "bonus.ch", rawScore: 5.2, scaleMax: 6, sourceYear: 2026, sourceUrl: "https://www.bonus.ch/Krankenkasse/Vergleich/Krankenkassenpraemie.aspx" },
    ]);
  });
});
