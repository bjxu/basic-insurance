import { describe, it, expect } from "vitest";
import { filterPlans, cheapestPerInsurer, sortPlans, findCurrentPlan, computeHeadline } from "@/lib/lookup";
import type { PremiumRow } from "@/lib/types";

const ROWS: PremiumRow[] = [
  { year: 2026, insurerCode: "A", insurerName: "Assura", praemienregionId: "ZH-1", altersklasse: "erwachsen", franchise: 500, unfalldeckung: true, tarifart: "standard", monthlyPremium: 301.1, tarifCode: "A-STD", productName: "Grundversicherung" },
  { year: 2026, insurerCode: "B", insurerName: "Sanitas", praemienregionId: "ZH-1", altersklasse: "erwachsen", franchise: 500, unfalldeckung: true, tarifart: "telmed", monthlyPremium: 221.8, tarifCode: "B-TEL", productName: "Sanitas Telmed" },
  { year: 2026, insurerCode: "B", insurerName: "Sanitas", praemienregionId: "ZH-1", altersklasse: "erwachsen", franchise: 500, unfalldeckung: true, tarifart: "standard", monthlyPremium: 290.0, tarifCode: "B-STD", productName: "Grundversicherung" },
  { year: 2026, insurerCode: "C", insurerName: "Helsana", praemienregionId: "ZH-1", altersklasse: "erwachsen", franchise: 500, unfalldeckung: true, tarifart: "standard", monthlyPremium: 412.4, tarifCode: "C-STD", productName: "Grundversicherung" },
  { year: 2026, insurerCode: "C", insurerName: "Helsana", praemienregionId: "ZH-1", altersklasse: "erwachsen", franchise: 500, unfalldeckung: true, tarifart: "hmo", monthlyPremium: 362.1, tarifCode: "C-HMO", productName: "Helsana HMO" },
  // Different region — should be filtered out.
  { year: 2026, insurerCode: "D", insurerName: "Visana", praemienregionId: "BE-1", altersklasse: "erwachsen", franchise: 500, unfalldeckung: true, tarifart: "standard", monthlyPremium: 100, tarifCode: "D-STD", productName: "Grundversicherung" },
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
    expect(result).toHaveLength(3);
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

describe("findCurrentPlan", () => {
  it("finds an exact match regardless of active filters", () => {
    const found = findCurrentPlan(ROWS, {
      insurerCode: "C",
      franchise: 500,
      tarifart: "standard",
      unfalldeckung: true,
      praemienregionId: "ZH-1",
      altersklasse: "erwachsen",
      year: 2026,
    });
    expect(found?.monthlyPremium).toBe(412.4);
  });

  it("returns null when no exact match exists", () => {
    const found = findCurrentPlan(ROWS, {
      insurerCode: "UNKNOWN",
      franchise: 500,
      tarifart: "standard",
      unfalldeckung: true,
      praemienregionId: "ZH-1",
      altersklasse: "erwachsen",
      year: 2026,
    });
    expect(found).toBeNull();
  });
});

describe("computeHeadline", () => {
  const cheapest = ROWS[1]; // Sanitas telmed 221.80

  it("returns no-current-plan when none provided", () => {
    expect(computeHeadline(null, cheapest, false)).toEqual({ kind: "no-current-plan", cheapest });
  });

  it("returns current-plan-not-found when a plan was provided but not matched", () => {
    expect(computeHeadline(null, cheapest, true)).toEqual({ kind: "current-plan-not-found", cheapest });
  });

  it("returns savings when current plan is pricier than cheapest", () => {
    const current = ROWS[3]; // Helsana standard 412.40
    const result = computeHeadline(current, cheapest, true);
    expect(result.kind).toBe("savings");
    if (result.kind === "savings") {
      expect(result.savingsPerYear).toBeCloseTo((412.4 - 221.8) * 12);
    }
  });

  it("returns already-cheapest when current plan equals the cheapest", () => {
    const result = computeHeadline(cheapest, cheapest, true);
    expect(result.kind).toBe("already-cheapest");
  });

  it("returns already-cheapest (not savings) when current is strictly cheaper than the filtered cheapest", () => {
    // findCurrentPlan runs unfiltered, so this can legitimately happen (REQ-10).
    const cheaperThanCheapest: PremiumRow = { ...cheapest, monthlyPremium: cheapest.monthlyPremium - 10 };
    const result = computeHeadline(cheaperThanCheapest, cheapest, true);
    expect(result.kind).toBe("already-cheapest");
  });
});
