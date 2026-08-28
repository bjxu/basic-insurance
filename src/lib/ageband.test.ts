import { describe, it, expect } from "vitest";
import { getAltersklasse, getFranchiseTiers, ageBand, AGE_BANDS } from "@/lib/ageband";

describe("getAltersklasse", () => {
  it("classifies children 0-18", () => {
    expect(getAltersklasse(2010, 2026)).toBe("kind");
  });
  it("classifies young adults 19-25", () => {
    expect(getAltersklasse(2004, 2026)).toBe("jung");
  });
  it("classifies adults 26+", () => {
    expect(getAltersklasse(1988, 2026)).toBe("erwachsen");
  });
  it("uses age reached during the calendar year at the boundary", () => {
    expect(getAltersklasse(2007, 2026)).toBe("jung"); // turns 19 in 2026
    expect(getAltersklasse(2000, 2026)).toBe("erwachsen"); // turns 26 in 2026
  });
});

describe("getFranchiseTiers", () => {
  it("returns child tiers for kind", () => {
    expect(getFranchiseTiers("kind")).toEqual([0, 100, 200, 300, 400, 500, 600]);
  });
  it("returns adult tiers for jung and erwachsen", () => {
    expect(getFranchiseTiers("jung")).toEqual([300, 500, 1000, 1500, 2000, 2500]);
    expect(getFranchiseTiers("erwachsen")).toEqual([300, 500, 1000, 1500, 2000, 2500]);
  });
});

describe("ageBand", () => {
  it("buckets ages at every band boundary", () => {
    expect(ageBand(0)).toBe("0-18");
    expect(ageBand(18)).toBe("0-18");
    expect(ageBand(19)).toBe("19-25");
    expect(ageBand(25)).toBe("19-25");
    expect(ageBand(26)).toBe("26-35");
    expect(ageBand(35)).toBe("26-35");
    expect(ageBand(36)).toBe("36-45");
    expect(ageBand(45)).toBe("36-45");
    expect(ageBand(46)).toBe("46-55");
    expect(ageBand(55)).toBe("46-55");
    expect(ageBand(56)).toBe("56-65");
    expect(ageBand(65)).toBe("56-65");
    expect(ageBand(66)).toBe("66-75");
    expect(ageBand(75)).toBe("66-75");
    expect(ageBand(76)).toBe("76+");
    expect(ageBand(130)).toBe("76+");
  });

  it("returns null for a negative or non-finite age", () => {
    expect(ageBand(-1)).toBeNull();
    expect(ageBand(Number.NaN)).toBeNull();
    expect(ageBand(Number.POSITIVE_INFINITY)).toBeNull();
  });

  it("exposes the eight bands in ascending order", () => {
    expect(AGE_BANDS).toEqual([
      "0-18", "19-25", "26-35", "36-45", "46-55", "56-65", "66-75", "76+",
    ]);
  });
});
