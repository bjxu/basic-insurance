import { describe, it, expect } from "vitest";
import { getAgeGroup, AGE_GROUPS } from "@/lib/ageGroup";

describe("getAgeGroup", () => {
  it("buckets a newborn (age 0) as '0'", () => {
    expect(getAgeGroup(2026, 2026)).toBe("0");
  });

  it("buckets each band by its upper boundary", () => {
    expect(getAgeGroup(2021, 2026)).toBe("1-5");   // age 5
    expect(getAgeGroup(2014, 2026)).toBe("6-12");  // age 12
    expect(getAgeGroup(2008, 2026)).toBe("13-18"); // age 18
    expect(getAgeGroup(2001, 2026)).toBe("19-25"); // age 25
    expect(getAgeGroup(1991, 2026)).toBe("26-35"); // age 35
    expect(getAgeGroup(1976, 2026)).toBe("36-50"); // age 50
    expect(getAgeGroup(1961, 2026)).toBe("51-65"); // age 65
    expect(getAgeGroup(1960, 2026)).toBe("66+");   // age 66
  });

  it("buckets each band by its lower boundary", () => {
    expect(getAgeGroup(2025, 2026)).toBe("1-5");   // age 1
    expect(getAgeGroup(2020, 2026)).toBe("6-12");  // age 6
    expect(getAgeGroup(2007, 2026)).toBe("19-25"); // age 19
    expect(getAgeGroup(2000, 2026)).toBe("26-35"); // age 26
  });

  it("uses the passed visitYear verbatim (no calendar-year shift)", () => {
    expect(getAgeGroup(2000, 2026)).toBe("26-35");
    expect(getAgeGroup(2000, 2025)).toBe("19-25");
  });

  it("clamps a defensively-negative age to '0'", () => {
    expect(getAgeGroup(2030, 2026)).toBe("0");
  });

  it("AGE_GROUPS lists all nine bands youngest to oldest", () => {
    expect(AGE_GROUPS).toEqual([
      "0", "1-5", "6-12", "13-18", "19-25", "26-35", "36-50", "51-65", "66+",
    ]);
  });
});
