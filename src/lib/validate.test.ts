import { describe, it, expect } from "vitest";
import { validatePlz, validateBirthYear, validateCurrentPremium } from "@/lib/validate";

describe("validatePlz", () => {
  it("accepts a valid 4-digit PLZ", () => {
    expect(validatePlz("8044").valid).toBe(true);
  });
  it("rejects non-4-digit input", () => {
    expect(validatePlz("99999").valid).toBe(false);
    expect(validatePlz("12").valid).toBe(false);
    expect(validatePlz("abcd").valid).toBe(false);
  });
});

describe("validateBirthYear", () => {
  const currentYear = new Date().getFullYear();

  it("accepts a realistic birth year", () => {
    expect(validateBirthYear(1988).valid).toBe(true);
  });
  it("rejects a future birth year", () => {
    expect(validateBirthYear(currentYear + 1).valid).toBe(false);
  });
  it("rejects an implausibly old birth year", () => {
    expect(validateBirthYear(currentYear - 150).valid).toBe(false);
  });
});

describe("validateCurrentPremium", () => {
  it("accepts a positive premium", () => {
    expect(validateCurrentPremium(350.5).valid).toBe(true);
  });
  it("rejects non-finite values", () => {
    expect(validateCurrentPremium(NaN).valid).toBe(false);
    expect(validateCurrentPremium(Infinity).valid).toBe(false);
  });
  it("rejects zero or negative values", () => {
    expect(validateCurrentPremium(0).valid).toBe(false);
    expect(validateCurrentPremium(-5).valid).toBe(false);
  });
});
