import { describe, it, expect } from "vitest";
import { formatChf, formatMemberCount, formatMemberCountDetail } from "@/lib/format";

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
  it("formats sub-1000 counts as an exact integer", () => {
    expect(formatMemberCount(999)).toBe("999");
  });
  it("formats thousands rounded to the nearest whole Tsd.", () => {
    expect(formatMemberCount(1000)).toBe("1 Tsd.");
    expect(formatMemberCount(2792)).toBe("3 Tsd."); // real: Krankenkasse Birchmeier
    expect(formatMemberCount(813080)).toBe("813 Tsd."); // real: Swica
  });
  it("formats millions with one decimal", () => {
    expect(formatMemberCount(1537730)).toBe("1.5 Mio."); // real: CSS
    expect(formatMemberCount(1290207)).toBe("1.3 Mio."); // real: Helsana
  });
  it("rounds the Tsd./Mio. cutover boundary up", () => {
    expect(formatMemberCount(999999)).toBe("1.0 Mio.");
  });
  it("crosses over to Mio. as low as ~950'000, not a clean 1'000'000", () => {
    expect(formatMemberCount(960000)).toBe("1.0 Mio.");
  });
  it("stays in Tsd. just below the effective cutover", () => {
    expect(formatMemberCount(949999)).toBe("950 Tsd.");
  });
});

describe("formatMemberCountDetail", () => {
  it("formats the exact grouped count with the data-as-of year", () => {
    expect(formatMemberCountDetail(1537730, 2024)).toBe("1'537'730 Versicherte · Stand 2024");
  });
  it("rounds a fractional count before grouping", () => {
    expect(formatMemberCountDetail(2791.6, 2024)).toBe("2'792 Versicherte · Stand 2024");
  });
});
