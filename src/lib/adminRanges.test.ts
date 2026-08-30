import { describe, it, expect } from "vitest";
import { presetRange, formatRangeLabel, PRESETS } from "./adminRanges";

const TODAY = new Date(Date.UTC(2026, 7, 11)); // 11 Aug 2026 (month is 0-indexed)

describe("presetRange", () => {
  it("today: just today, exclusive tomorrow", () => {
    expect(presetRange("today", TODAY)).toEqual({ from: "2026-08-11", to: "2026-08-12" });
  });

  it("7d: today and the 6 days before it", () => {
    expect(presetRange("7d", TODAY)).toEqual({ from: "2026-08-05", to: "2026-08-12" });
  });

  it("30d: today and the 29 days before it", () => {
    expect(presetRange("30d", TODAY)).toEqual({ from: "2026-07-13", to: "2026-08-12" });
  });

  it("month: from the 1st of the current calendar month", () => {
    expect(presetRange("month", TODAY)).toEqual({ from: "2026-08-01", to: "2026-08-12" });
  });

  it("3m: today and the 89 days before it", () => {
    expect(presetRange("3m", TODAY)).toEqual({ from: "2026-05-14", to: "2026-08-12" });
  });

  it("year: from 1 January of the current calendar year", () => {
    expect(presetRange("year", TODAY)).toEqual({ from: "2026-01-01", to: "2026-08-12" });
  });

  it("30d with year-rollover: rolls into previous year on early January date", () => {
    const jan5 = new Date(Date.UTC(2026, 0, 5)); // 5 Jan 2026
    expect(presetRange("30d", jan5)).toEqual({ from: "2025-12-07", to: "2026-01-06" });
  });

  it("30d with leap-year: correctly handles February with 29 days", () => {
    const mar1 = new Date(Date.UTC(2028, 2, 1)); // 1 Mar 2028 (leap year)
    expect(presetRange("30d", mar1)).toEqual({ from: "2028-02-01", to: "2028-03-02" });
  });

  it("today: uses the Zurich calendar day, not the UTC one, near midnight in summer (CEST)", () => {
    // 2026-08-10T23:00Z is already 2026-08-11 01:00 CEST in Zurich.
    const lateUTC = new Date(Date.UTC(2026, 7, 10, 23, 0));
    expect(presetRange("today", lateUTC)).toEqual({ from: "2026-08-11", to: "2026-08-12" });
  });

  it("today: uses the Zurich calendar day, not the UTC one, near midnight in winter (CET)", () => {
    // 2026-01-10T23:30Z is already 2026-01-11 00:30 CET in Zurich.
    const lateUTC = new Date(Date.UTC(2026, 0, 10, 23, 30));
    expect(presetRange("today", lateUTC)).toEqual({ from: "2026-01-11", to: "2026-01-12" });
  });
});

describe("PRESETS", () => {
  it("has exactly 6 entries with the correct keys and German labels in order", () => {
    expect(PRESETS).toHaveLength(6);
    expect(PRESETS).toEqual([
      { key: "today", label: "Heute" },
      { key: "7d", label: "7 Tage" },
      { key: "30d", label: "30 Tage" },
      { key: "month", label: "Dieser Monat" },
      { key: "3m", label: "3 Monate" },
      { key: "year", label: "Dieses Jahr" },
    ]);
  });
});

describe("formatRangeLabel", () => {
  it("formats a range within the same year", () => {
    expect(formatRangeLabel("2026-07-13", "2026-08-12")).toBe("13. Jul – 11. Aug 2026");
  });

  it("includes the from-year when it differs from the to-year", () => {
    expect(formatRangeLabel("2025-12-20", "2026-01-05")).toBe("20. Dez 2025 – 4. Jan 2026");
  });
});
