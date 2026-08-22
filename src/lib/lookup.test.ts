import { describe, it, expect } from "vitest";
import {
  filterPlans,
  cheapestPerInsurer,
  sortPlans,
  computeHeadline,
  standardPremiumsByInsurer,
  discountVsStandardPct,
  groupByInsurer,
  groupProductsByTarifart,
  deriveVariantLabel,
} from "@/lib/lookup";
import type { PremiumRow, SelfReportedPlan } from "@/lib/types";

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

describe("groupByInsurer", () => {
  it("groups rows by insurerCode, preserving row order within each group", () => {
    const result = groupByInsurer(ROWS);
    expect(result.get("A")).toEqual([ROWS[0]]);
    expect(result.get("B")).toEqual([ROWS[1], ROWS[2]]);
    expect(result.get("C")).toEqual([ROWS[3], ROWS[4]]);
  });

  it("returns an empty map for empty input", () => {
    expect(groupByInsurer([]).size).toBe(0);
  });
});

describe("groupProductsByTarifart", () => {
  const products: PremiumRow[] = [
    { ...ROWS[0], tarifart: "hmo", tarifCode: "HMO-B", productName: "Bonus Care", monthlyPremium: 233.6 },
    { ...ROWS[0], tarifart: "standard", tarifCode: "STD", productName: "Grundversicherung", monthlyPremium: 270.5 },
    { ...ROWS[0], tarifart: "telmed", tarifCode: "TEL-A", productName: "Callmed", monthlyPremium: 221.8 },
    { ...ROWS[0], tarifart: "telmed", tarifCode: "TEL-B", productName: "Sana24", monthlyPremium: 229.4 },
    { ...ROWS[0], tarifart: "hausarzt", tarifCode: "HAM", productName: "Casamed", monthlyPremium: 238.9 },
  ];

  it("groups by tarifart in Standard → Hausarzt → Telmed → HMO → Andere order", () => {
    const result = groupProductsByTarifart(products, {});
    expect(result.map((g) => g.tarifart)).toEqual(["standard", "hausarzt", "telmed", "hmo"]);
  });

  it("sorts each tarifart's groups by price ascending when ungrouped (one variant each)", () => {
    const result = groupProductsByTarifart(products, {});
    const telmedGroup = result.find((g) => g.tarifart === "telmed")!;
    expect(telmedGroup.groups.map((g) => g.groupName)).toEqual(["Callmed", "Sana24"]);
    expect(telmedGroup.groups.every((g) => g.variants.length === 1)).toBe(true);
  });

  it("breaks price ties alphabetically by productName (de-CH)", () => {
    const tiedProducts: PremiumRow[] = [
      { ...ROWS[0], tarifart: "hmo", tarifCode: "HMO-Z", productName: "Zeta HMO", monthlyPremium: 200 },
      { ...ROWS[0], tarifart: "hmo", tarifCode: "HMO-A", productName: "Alpha HMO", monthlyPremium: 200 },
    ];
    const result = groupProductsByTarifart(tiedProducts, {});
    expect(result[0].groups.map((g) => g.groupName)).toEqual(["Alpha HMO", "Zeta HMO"]);
  });

  it("returns an empty array for empty input", () => {
    expect(groupProductsByTarifart([], {})).toEqual([]);
  });

  it("nests tarifCodes sharing a product-groups.json entry into one group's variants", () => {
    const variants: PremiumRow[] = [
      { ...ROWS[0], insurerCode: "1562", tarifart: "hausarzt", tarifCode: "BFP_CP", productName: "BeneFit PLUS Hausarzt R1", monthlyPremium: 400.15 },
      { ...ROWS[0], insurerCode: "1562", tarifart: "hausarzt", tarifCode: "BFP_BF", productName: "BeneFit PLUS Hausarzt R4", monthlyPremium: 451.65 },
    ];
    const productGroups = {
      "1562": { BFP_CP: "BeneFit PLUS Hausarzt", BFP_BF: "BeneFit PLUS Hausarzt" },
    };
    const result = groupProductsByTarifart(variants, productGroups);
    const hausarzt = result.find((g) => g.tarifart === "hausarzt")!;
    expect(hausarzt.groups).toHaveLength(1);
    expect(hausarzt.groups[0].groupName).toBe("BeneFit PLUS Hausarzt");
    expect(hausarzt.groups[0].variants.map((v) => v.tarifCode)).toEqual(["BFP_CP", "BFP_BF"]); // price ascending
  });

  it("orders groups by their own cheapest variant", () => {
    const variants: PremiumRow[] = [
      { ...ROWS[0], insurerCode: "1562", tarifart: "hausarzt", tarifCode: "BFP_CAF", productName: "BeneFit PLUS Flexmed R3", monthlyPremium: 432.35 },
      { ...ROWS[0], insurerCode: "1562", tarifart: "hausarzt", tarifCode: "BFP_CP", productName: "BeneFit PLUS Hausarzt R1", monthlyPremium: 400.15 },
      { ...ROWS[0], insurerCode: "1562", tarifart: "hausarzt", tarifCode: "BFP_BF", productName: "BeneFit PLUS Hausarzt R4", monthlyPremium: 451.65 },
    ];
    const productGroups = {
      "1562": {
        BFP_CP: "BeneFit PLUS Hausarzt",
        BFP_BF: "BeneFit PLUS Hausarzt",
        BFP_CAF: "BeneFit PLUS Flexmed",
      },
    };
    const result = groupProductsByTarifart(variants, productGroups);
    const hausarzt = result.find((g) => g.tarifart === "hausarzt")!;
    // Hausarzt's cheapest variant (400.15) undercuts Flexmed's only variant (432.35).
    expect(hausarzt.groups.map((g) => g.groupName)).toEqual(["BeneFit PLUS Hausarzt", "BeneFit PLUS Flexmed"]);
  });
});

describe("deriveVariantLabel", () => {
  it("strips the group name prefix and trims the remainder", () => {
    expect(deriveVariantLabel("BeneFit PLUS Hausarzt", "BeneFit PLUS Hausarzt R1")).toBe("R1");
  });

  it("returns an empty string for a singleton group (productName === groupName)", () => {
    expect(deriveVariantLabel("Grundversicherung", "Grundversicherung")).toBe("");
  });

  it("falls back to the full productName when it doesn't start with the group name", () => {
    expect(deriveVariantLabel("BeneFit PLUS Hausarzt", "Completely Different Name")).toBe(
      "Completely Different Name",
    );
  });
});
