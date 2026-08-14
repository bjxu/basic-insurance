import { describe, it, expect } from "vitest";
import { formatChf, formatMemberCount, formatMemberCountDetail, formatServiceQualityPct, formatServiceQualityDetail } from "@/lib/format";
import type { ServiceQualityRating } from "@/lib/types";

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

describe("formatServiceQualityPct", () => {
  it("rounds to the nearest whole percent, prefixed with the average marker", () => {
    expect(formatServiceQualityPct(83.888888889)).toBe("Ø 84%");
    expect(formatServiceQualityPct(84.166666667)).toBe("Ø 84%");
  });
  it("rounds .5 up", () => {
    expect(formatServiceQualityPct(82.5)).toBe("Ø 83%");
  });
});

describe("formatServiceQualityDetail", () => {
  it("lists every source's raw score, scale, and a shared year, singular 'Quelle' for one source", () => {
    const rating: ServiceQualityRating = {
      insurerCode: "1560",
      sources: [
        { sourceName: "bonus.ch", rawScore: 5.2, scaleMax: 6, sourceYear: 2026, sourceUrl: "https://www.bonus.ch" },
      ],
    };
    expect(formatServiceQualityDetail(rating, 86.666666667)).toBe(
      "Ø 87% aus 1 Quelle (2026)\nbonus.ch: 5.2/6",
    );
  });

  it("lists all three sources, plural 'Quellen', using the real Helsana 2026 figures", () => {
    const rating: ServiceQualityRating = {
      insurerCode: "1562",
      sources: [
        { sourceName: "moneyland.ch", rawScore: 8.0, scaleMax: 10, sourceYear: 2026, sourceUrl: "https://www.moneyland.ch/de/krankenkassen-zufriedenheit-2026" },
        { sourceName: "comparis.ch", rawScore: 5.1, scaleMax: 6, sourceYear: 2026, sourceUrl: "https://www.presseportal.ch/de/pm/100003671/100941089" },
        { sourceName: "bonus.ch", rawScore: 5.2, scaleMax: 6, sourceYear: 2026, sourceUrl: "https://www.bonus.ch" },
      ],
    };
    expect(formatServiceQualityDetail(rating, 83.888888889)).toBe(
      "Ø 84% aus 3 Quellen (2026)\nmoneyland.ch: 8.0/10\ncomparis.ch: 5.1/6\nbonus.ch: 5.2/6",
    );
  });
});
