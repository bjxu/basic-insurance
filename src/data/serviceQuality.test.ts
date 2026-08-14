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

  it("every rating has at least 2 independent sources", () => {
    for (const rating of SERVICE_QUALITY_RATINGS) {
      expect(rating.sources.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("Helsana (1562) carries all 3 sources with the verified 2026 figures", () => {
    const helsana = SERVICE_QUALITY_RATINGS.find((r) => r.insurerCode === "1562");
    expect(helsana?.sources).toEqual([
      { sourceName: "moneyland.ch", rawScore: 8.0, scaleMax: 10, sourceYear: 2026, sourceUrl: "https://www.moneyland.ch/de/krankenkassen-zufriedenheit-2026" },
      { sourceName: "comparis.ch", rawScore: 5.1, scaleMax: 6, sourceYear: 2026, sourceUrl: "https://www.comparis.ch/krankenkassen/beste-krankenkasse" },
      { sourceName: "bonus.ch", rawScore: 5.2, scaleMax: 6, sourceYear: 2026, sourceUrl: "https://www.bonus.ch/Krankenkasse/Note/KPT-CPT-Kundenzufriedenheitsumfrage.aspx" },
    ]);
  });

  it("Groupe Mutuel's moneyland figure (7.4, brand-level) is applied to Avenir Assurance (343) and Philos Assurance (1535), each alongside their own comparis.ch and bonus.ch scores", () => {
    const avenir = SERVICE_QUALITY_RATINGS.find((r) => r.insurerCode === "343");
    const philos = SERVICE_QUALITY_RATINGS.find((r) => r.insurerCode === "1535");
    for (const rating of [avenir, philos]) {
      expect(rating?.sources).toEqual([
        { sourceName: "moneyland.ch", rawScore: 7.4, scaleMax: 10, sourceYear: 2026, sourceUrl: "https://www.moneyland.ch/de/krankenkassen-zufriedenheit-2026" },
        { sourceName: "comparis.ch", rawScore: 4.8, scaleMax: 6, sourceYear: 2026, sourceUrl: "https://www.comparis.ch/krankenkassen/beste-krankenkasse" },
        { sourceName: "bonus.ch", rawScore: 5.2, scaleMax: 6, sourceYear: 2026, sourceUrl: "https://www.bonus.ch/Krankenkasse/Note/KPT-CPT-Kundenzufriedenheitsumfrage.aspx" },
      ]);
    }
  });

  it("Mutuel Assurance (1479) has its own entry (moneyland brand-level figure + its own comparis.ch score, no bonus.ch coverage)", () => {
    const mutuel = SERVICE_QUALITY_RATINGS.find((r) => r.insurerCode === "1479");
    expect(mutuel?.sources).toEqual([
      { sourceName: "moneyland.ch", rawScore: 7.4, scaleMax: 10, sourceYear: 2026, sourceUrl: "https://www.moneyland.ch/de/krankenkassen-zufriedenheit-2026" },
      { sourceName: "comparis.ch", rawScore: 4.8, scaleMax: 6, sourceYear: 2026, sourceUrl: "https://www.comparis.ch/krankenkassen/beste-krankenkasse" },
    ]);
  });

  it("AMB Assurances (1507) still has no entry — not scored by any of the three sources", () => {
    expect(SERVICE_QUALITY_RATINGS.find((r) => r.insurerCode === "1507")).toBeUndefined();
  });

  it("Agrisano (1560) requalified once comparis.ch gave it a 2nd source (was excluded, bonus.ch-only)", () => {
    const agrisano = SERVICE_QUALITY_RATINGS.find((r) => r.insurerCode === "1560");
    expect(agrisano?.sources).toEqual([
      { sourceName: "comparis.ch", rawScore: 4.8, scaleMax: 6, sourceYear: 2026, sourceUrl: "https://www.comparis.ch/krankenkassen/beste-krankenkasse" },
      { sourceName: "bonus.ch", rawScore: 5.2, scaleMax: 6, sourceYear: 2026, sourceUrl: "https://www.bonus.ch/Krankenkasse/Note/KPT-CPT-Kundenzufriedenheitsumfrage.aspx" },
    ]);
  });
});
