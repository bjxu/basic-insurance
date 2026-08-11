import { describe, it, expect } from "vitest";
import { getAltersklasse, getFranchiseTiers } from "@/lib/ageband";

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
