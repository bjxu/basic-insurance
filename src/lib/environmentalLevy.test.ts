import { describe, it, expect } from "vitest";
import { applyEnvironmentalLevy } from "@/lib/environmentalLevy";

describe("applyEnvironmentalLevy", () => {
  const levyByYear = { "2026": 5.15 };

  it("subtracts the levy for a year with a published amount", () => {
    expect(applyEnvironmentalLevy(311.6, 2026, levyByYear)).toBeCloseTo(306.45);
  });

  it("matches the verified Swica FAVORIT SANTE reference value (ZH-3, 2026)", () => {
    expect(applyEnvironmentalLevy(315.4, 2026, levyByYear)).toBeCloseTo(310.25);
  });

  it("matches the verified Helsana BENEFIT PLUS TELMED reference value (ZH-3, 2026)", () => {
    expect(applyEnvironmentalLevy(323.4, 2026, levyByYear)).toBeCloseTo(318.25);
  });

  it("returns the premium unchanged for a year with no published levy", () => {
    expect(applyEnvironmentalLevy(311.6, 2027, levyByYear)).toBe(311.6);
  });

  it("returns the premium unchanged when the levy map is empty", () => {
    expect(applyEnvironmentalLevy(311.6, 2026, {})).toBe(311.6);
  });
});
