// src/lib/praemienGuide.test.ts
import { describe, it, expect } from "vitest";
import { averagePremiumByCanton, readPremiumRows, CANTON_NAMES_DE } from "./praemienGuide";
import type { PremiumRow } from "./types";

function row(overrides: Partial<PremiumRow>): PremiumRow {
  return {
    year: 2026,
    insurerCode: "1",
    insurerName: "Test",
    praemienregionId: "ZH-1",
    altersklasse: "erwachsen",
    franchise: 300,
    unfalldeckung: true,
    tarifart: "standard",
    monthlyPremium: 300,
    tarifCode: "BASE",
    productName: "Grundversicherung",
    ...overrides,
  };
}

describe("averagePremiumByCanton", () => {
  it("averages matching rows per canton, derived from the praemienregionId prefix", () => {
    const rows = [
      row({ praemienregionId: "ZH-1", insurerCode: "1", monthlyPremium: 300 }),
      row({ praemienregionId: "ZH-2", insurerCode: "2", monthlyPremium: 320 }),
      row({ praemienregionId: "BE-1", insurerCode: "1", monthlyPremium: 280 }),
    ];
    const result = averagePremiumByCanton(rows, 2026, {});
    expect(result).toEqual([
      { kanton: "BE", averagePremium: 280 },
      { kanton: "ZH", averagePremium: 310 },
    ]);
  });

  it("excludes rows outside the fixed reference profile", () => {
    const rows = [
      row({ monthlyPremium: 300 }), // matches REFERENCE_PROFILE
      row({ franchise: 2500, monthlyPremium: 100 }), // wrong franchise, excluded
      row({ altersklasse: "kind", monthlyPremium: 100 }), // wrong age band, excluded
      row({ tarifart: "hmo", monthlyPremium: 100 }), // wrong model, excluded
      row({ unfalldeckung: false, monthlyPremium: 100 }), // wrong accident coverage, excluded
    ];
    const result = averagePremiumByCanton(rows, 2026, {});
    expect(result).toEqual([{ kanton: "ZH", averagePremium: 300 }]);
  });

  it("keeps only each insurer's cheapest row per canton before averaging", () => {
    const rows = [
      row({ insurerCode: "1", monthlyPremium: 300 }),
      row({ insurerCode: "1", monthlyPremium: 250, tarifCode: "OTHER", productName: "Other" }),
      row({ insurerCode: "2", monthlyPremium: 350 }),
    ];
    const result = averagePremiumByCanton(rows, 2026, {});
    // insurer 1 contributes its cheaper row (250), insurer 2 contributes 350 -> (250+350)/2 = 300
    expect(result).toEqual([{ kanton: "ZH", averagePremium: 300 }]);
  });

  it("subtracts the environmental levy before averaging, not after", () => {
    const rows = [
      row({ insurerCode: "1", monthlyPremium: 300 }),
      row({ insurerCode: "2", monthlyPremium: 320 }),
    ];
    const result = averagePremiumByCanton(rows, 2026, { "2026": 5.15 });
    // (300 - 5.15 + 320 - 5.15) / 2 = 304.85
    expect(result).toEqual([{ kanton: "ZH", averagePremium: 304.85 }]);
  });

  it("returns no entry for a canton with no rows in the reference profile", () => {
    const rows = [row({ praemienregionId: "ZH-1", altersklasse: "kind" })];
    expect(averagePremiumByCanton(rows, 2026, {})).toEqual([]);
  });
});

describe("CANTON_NAMES_DE", () => {
  it("has all 26 cantons", () => {
    expect(Object.keys(CANTON_NAMES_DE)).toHaveLength(26);
  });

  it("maps each code to its German name (spot check)", () => {
    expect(CANTON_NAMES_DE.ZH).toBe("Zürich");
    expect(CANTON_NAMES_DE.GE).toBe("Genf");
    expect(CANTON_NAMES_DE.TI).toBe("Tessin");
  });
});

describe("readPremiumRows", () => {
  it("reads and parses the real premiums-2026.json fixture", async () => {
    const rows = await readPremiumRows(2026);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0]).toHaveProperty("praemienregionId");
    expect(rows[0].year).toBe(2026);
  });

  it("rejects for a year with no data file", async () => {
    await expect(readPremiumRows(1999)).rejects.toThrow();
  });
});
