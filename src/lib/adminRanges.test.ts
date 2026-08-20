import { describe, it, expect } from "vitest";
import { presetRange, formatRangeLabel } from "./adminRanges";

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
});

describe("formatRangeLabel", () => {
  it("formats a range within the same year", () => {
    expect(formatRangeLabel("2026-07-13", "2026-08-12")).toBe("13. Jul – 11. Aug 2026");
  });

  it("includes the from-year when it differs from the to-year", () => {
    expect(formatRangeLabel("2025-12-20", "2026-01-05")).toBe("20. Dez 2025 – 4. Jan 2026");
  });
});
