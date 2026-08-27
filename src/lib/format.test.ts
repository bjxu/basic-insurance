import { describe, it, expect } from "vitest";
import { formatChf, formatMemberCount, formatMemberCountDetail, formatCount } from "@/lib/format";

describe("formatChf", () => {
  it("formats with apostrophe thousands separator and two decimals", () => {
    expect(formatChf(1234.5)).toBe("CHF 1'234.50");
  });
  it("formats small amounts without a separator", () => {
    expect(formatChf(301.1)).toBe("CHF 301.10");
  });
  it("formats large amounts with multiple separators", () => {
    expect(formatChf(1234567.89)).toBe("CHF 1'234'567.89");
  });
});

describe("formatMemberCount", () => {
  it("formats sub-1000 counts as an exact integer regardless of locale", () => {
    expect(formatMemberCount(999, "de")).toBe("999");
    expect(formatMemberCount(999, "en")).toBe("999");
  });
  it("formats thousands rounded to the nearest whole unit, per locale", () => {
    expect(formatMemberCount(1000, "de")).toBe("1 Tsd.");
    expect(formatMemberCount(2792, "de")).toBe("3 Tsd."); // real: Krankenkasse Birchmeier
    expect(formatMemberCount(813080, "de")).toBe("813 Tsd."); // real: Swica
    expect(formatMemberCount(813080, "en")).toBe("813 k");
    expect(formatMemberCount(813080, "fr")).toBe("813 k");
    expect(formatMemberCount(813080, "it")).toBe("813 mila");
    expect(formatMemberCount(813080, "pt")).toBe("813 mil");
    expect(formatMemberCount(813080, "es")).toBe("813 mil");
  });
  it("formats millions with one decimal, per locale", () => {
    expect(formatMemberCount(1537730, "de")).toBe("1.5 Mio."); // real: CSS
    expect(formatMemberCount(1290207, "de")).toBe("1.3 Mio."); // real: Helsana
    expect(formatMemberCount(1537730, "en")).toBe("1.5 M");
    expect(formatMemberCount(1537730, "fr")).toBe("1.5 mio");
    expect(formatMemberCount(1537730, "it")).toBe("1.5 mio");
    expect(formatMemberCount(1537730, "pt")).toBe("1.5 mi.");
    expect(formatMemberCount(1537730, "es")).toBe("1.5 M");
  });
  it("rounds the thousand/million cutover boundary up", () => {
    expect(formatMemberCount(999999, "de")).toBe("1.0 Mio.");
  });
  it("crosses over to million as low as ~950'000, not a clean 1'000'000", () => {
    expect(formatMemberCount(960000, "de")).toBe("1.0 Mio.");
  });
  it("stays in thousands just below the effective cutover", () => {
    expect(formatMemberCount(949999, "de")).toBe("950 Tsd.");
  });
  it("falls back to German units for an unrecognized locale", () => {
    expect(formatMemberCount(2792, "xx")).toBe("3 Tsd.");
  });
});

describe("formatMemberCountDetail", () => {
  it("formats the exact grouped count with the data-as-of year, per locale", () => {
    expect(formatMemberCountDetail(1537730, 2024, "de")).toBe("1'537'730 Versicherte · Stand 2024");
    expect(formatMemberCountDetail(1537730, 2024, "en")).toBe("1'537'730 insured · as of 2024");
    expect(formatMemberCountDetail(1537730, 2024, "fr")).toBe("1'537'730 assurés · en 2024");
    expect(formatMemberCountDetail(1537730, 2024, "it")).toBe("1'537'730 assicurati · nel 2024");
    expect(formatMemberCountDetail(1537730, 2024, "pt")).toBe("1'537'730 segurados · em 2024");
    expect(formatMemberCountDetail(1537730, 2024, "es")).toBe("1'537'730 asegurados · en 2024");
  });
  it("rounds a fractional count before grouping", () => {
    expect(formatMemberCountDetail(2791.6, 2024, "de")).toBe("2'792 Versicherte · Stand 2024");
  });
});

describe("formatCount", () => {
  it("groups thousands with an apostrophe, no currency or decimals", () => {
    expect(formatCount(34210)).toBe("34'210");
    expect(formatCount(999)).toBe("999");
    expect(formatCount(1234567)).toBe("1'234'567");
  });

  it("rounds non-integer input", () => {
    expect(formatCount(41.6)).toBe("42");
  });
});
