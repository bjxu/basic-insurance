import { describe, it, expect } from "vitest";
import { filterPlans, cheapestPerInsurer, sortPlans, computeHeadline, standardPremiumsByInsurer, discountVsStandardPct, averageServiceQualityPct } from "@/lib/lookup";
import type { PremiumRow, SelfReportedPlan, ServiceQualitySourceScore } from "@/lib/types";

const ROWS: PremiumRow[] = [
  { year: 2026, insurerCode: "A", insurerName: "Assura", praemienregionId: "ZH-1", altersklasse: "erwachsen", franchise: 500, unfalldeckung: true, tarifart: "standard", monthlyPremium: 301.1, tarifCode: "A-STD", productName: "Grundversicherung" },
  { year: 2026, insurerCode: "B", insurerName: "Sanitas", praemienregionId: "ZH-1", altersklasse: "erwachsen", franchise: 500, unfalldeckung: true, tarifart: "telmed", monthlyPremium: 221.8, tarifCode: "B-TEL", productName: "Sanitas Telmed" },
  { year: 2026, insurerCode: "B", insurerName: "Sanitas", praemienregionId: "ZH-1", altersklasse: "erwachsen", franchise: 500, unfalldeckung: true, tarifart: "standard", monthlyPremium: 290.0, tarifCode: "B-STD", productName: "Grundversicherung" },
  { year: 2026, insurerCode: "C", insurerName: "Helsana", praemienregionId: "ZH-1", altersklasse: "erwachsen", franchise: 500, unfalldeckung: true, tarifart: "standard", monthlyPremium: 412.4, tarifCode: "C-STD", productName: "Grundversicherung" },
  { year: 2026, insurerCode: "C", insurerName: "Helsana", praemienregionId: "ZH-1", altersklasse: "erwachsen", franchise: 500, unfalldeckung: true, tarifart: "hmo", monthlyPremium: 362.1, tarifCode: "C-HMO", productName: "Helsana HMO" },
  // Different region — should be filtered out.
  { year: 2026, insurerCode: "D", insurerName: "Visana", praemienregionId: "BE-1", altersklasse: "erwachsen", franchise: 500, unfalldeckung: true, tarifart: "standard", monthlyPremium: 100, tarifCode: "D-STD", productName: "Grundversicherung" },
  // No Standard row for insurer E — the "no baseline" case for the discount helpers.
  { year: 2026, insurerCode: "E", insurerName: "NoStandardKasse", praemienregionId: "ZH-1", altersklasse: "erwachsen", franchise: 500, unfalldeckung: true, tarifart: "hmo", monthlyPremium: 200, tarifCode: "E-HMO", productName: "NoStandardKasse HMO" },
];

describe("filterPlans", () => {
  it("filters by region, age band, franchise, accident coverage, year, and model set", () => {
    const result = filterPlans(ROWS, {
      praemienregionId: "ZH-1",
      altersklasse: "erwachsen",
      franchise: 500,
      models: ["standard"],
      unfalldeckung: true,
      year: 2026,
    });
    expect(result.map((r) => r.insurerCode).sort()).toEqual(["A", "B", "C"]);
  });
});

describe("cheapestPerInsurer", () => {
  it("keeps only each insurer's cheapest row (REQ-3/REQ-4)", () => {
    const filtered = filterPlans(ROWS, {
      praemienregionId: "ZH-1",
      altersklasse: "erwachsen",
      franchise: 500,
      models: ["standard", "telmed", "hmo"],
      unfalldeckung: true,
      year: 2026,
    });
    const result = cheapestPerInsurer(filtered);
    const sanitas = result.find((r) => r.insurerCode === "B");
    const helsana = result.find((r) => r.insurerCode === "C");
    expect(sanitas?.tarifart).toBe("telmed"); // cheaper than Sanitas Standard
    expect(helsana?.tarifart).toBe("hmo"); // cheaper than Helsana Standard
    expect(result).toHaveLength(4);
  });
});

describe("sortPlans", () => {
  it("sorts price ascending", () => {
    const sorted = sortPlans([
      { ...ROWS[0], monthlyPremium: 300 },
      { ...ROWS[0], monthlyPremium: 100 },
      { ...ROWS[0], monthlyPremium: 200 },
    ]);
    expect(sorted.map((r) => r.monthlyPremium)).toEqual([100, 200, 300]);
  });

  it("breaks ties alphabetically by insurer name", () => {
    const sorted = sortPlans([
      { ...ROWS[0], insurerName: "Zurich", monthlyPremium: 100 },
      { ...ROWS[0], insurerName: "Assura", monthlyPremium: 100 },
    ]);
    expect(sorted.map((r) => r.insurerName)).toEqual(["Assura", "Zurich"]);
  });
});

describe("standardPremiumsByInsurer", () => {
  it("maps each insurer to its Standard premium at the given filter context", () => {
    const result = standardPremiumsByInsurer(ROWS, {
      praemienregionId: "ZH-1",
      altersklasse: "erwachsen",
      franchise: 500,
      unfalldeckung: true,
      year: 2026,
    });
    expect(result.get("A")).toBe(301.1);
    expect(result.get("B")).toBe(290.0);
    expect(result.get("C")).toBe(412.4);
  });

  it("omits insurers with no Standard row in that context (REQ-23 defensive case)", () => {
    const result = standardPremiumsByInsurer(ROWS, {
      praemienregionId: "ZH-1",
      altersklasse: "erwachsen",
      franchise: 500,
      unfalldeckung: true,
      year: 2026,
    });
    expect(result.has("E")).toBe(false);
  });
});

describe("discountVsStandardPct", () => {
  it("computes the percentage discount vs. the Standard baseline", () => {
    expect(discountVsStandardPct(400, 300)).toBeCloseTo(25);
  });

  it("returns null when there's no Standard baseline", () => {
    expect(discountVsStandardPct(undefined, 300)).toBeNull();
  });

  it("returns null when the Standard baseline is zero or negative (defensive)", () => {
    expect(discountVsStandardPct(0, 300)).toBeNull();
    expect(discountVsStandardPct(-10, 300)).toBeNull();
  });
});

describe("computeHeadline", () => {
  const cheapest = ROWS[1]; // Sanitas telmed 221.80

  it("returns no-current-plan when none provided", () => {
    expect(computeHeadline(null, cheapest)).toEqual({ kind: "no-current-plan", cheapest });
  });

  it("returns no-current-plan (with no cheapest) when neither is available", () => {
    expect(computeHeadline(null, null)).toEqual({ kind: "no-current-plan", cheapest: null });
  });

  it("returns savings when the self-reported premium is pricier than cheapest", () => {
    const current: SelfReportedPlan = { insurerCode: "C", insurerName: "Helsana", monthlyPremium: 412.4 };
    const result = computeHeadline(current, cheapest);
    expect(result.kind).toBe("savings");
    if (result.kind === "savings") {
      expect(result.savingsPerYear).toBeCloseTo((412.4 - 221.8) * 12);
    }
  });

  it("returns already-cheapest when the self-reported premium equals the cheapest", () => {
    const current: SelfReportedPlan = { insurerCode: "B", insurerName: "Sanitas", monthlyPremium: cheapest.monthlyPremium };
    const result = computeHeadline(current, cheapest);
    expect(result.kind).toBe("already-cheapest");
    if (result.kind === "already-cheapest") {
      expect(result.cheapest).toBe(cheapest);
    }
  });

  it("returns already-cheapest (not savings) when the self-reported premium is strictly cheaper than the filtered cheapest", () => {
    // The self-reported premium isn't filtered by model/region at all — it's just a
    // number the user typed in — so it can legitimately undercut the filtered cheapest (REQ-10).
    const current: SelfReportedPlan = { insurerCode: "Z", insurerName: "SomeInsurer", monthlyPremium: cheapest.monthlyPremium - 10 };
    const result = computeHeadline(current, cheapest);
    expect(result.kind).toBe("already-cheapest");
    if (result.kind === "already-cheapest") {
      expect(result.cheapest).toBe(cheapest);
    }
  });
});

describe("averageServiceQualityPct", () => {
  it("returns the source's own fraction when there's only one", () => {
    const sources: ServiceQualitySourceScore[] = [
      { sourceName: "bonus.ch", rawScore: 5.2, scaleMax: 6, sourceYear: 2026, sourceUrl: "https://www.bonus.ch" },
    ];
    expect(averageServiceQualityPct(sources)).toBeCloseTo(86.666666667, 6);
  });

  it("normalizes each source to its own scale before averaging (real CSS 2026 figures)", () => {
    const sources: ServiceQualitySourceScore[] = [
      { sourceName: "comparis.ch", rawScore: 4.9, scaleMax: 6, sourceYear: 2026, sourceUrl: "https://www.comparis.ch/krankenkassen/beste-krankenkasse" },
      { sourceName: "bonus.ch", rawScore: 5.2, scaleMax: 6, sourceYear: 2026, sourceUrl: "https://www.bonus.ch" },
    ];
    // (4.9/6 + 5.2/6) / 2 = 0.841666... -> 84.1666...%, NOT a naive raw average of 4.9/5.2.
    expect(averageServiceQualityPct(sources)).toBeCloseTo(84.166666667, 6);
  });

  it("normalizes a 1-10 scale alongside 1-6 scales (real Helsana 2026 figures)", () => {
    const sources: ServiceQualitySourceScore[] = [
      { sourceName: "moneyland.ch", rawScore: 8.0, scaleMax: 10, sourceYear: 2026, sourceUrl: "https://www.moneyland.ch/de/krankenkassen-zufriedenheit-2026" },
      { sourceName: "comparis.ch", rawScore: 5.1, scaleMax: 6, sourceYear: 2026, sourceUrl: "https://www.comparis.ch/krankenkassen/beste-krankenkasse" },
      { sourceName: "bonus.ch", rawScore: 5.2, scaleMax: 6, sourceYear: 2026, sourceUrl: "https://www.bonus.ch" },
    ];
    // (0.8 + 0.85 + 0.866666...) / 3 = 0.838888... -> 83.8888...%
    expect(averageServiceQualityPct(sources)).toBeCloseTo(83.888888889, 6);
  });
});
