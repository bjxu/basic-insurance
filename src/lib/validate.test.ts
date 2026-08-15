import { describe, it, expect } from "vitest";
import { validatePlz, validateBirthYear, validateCurrentPremium } from "@/lib/validate";

describe("validatePlz", () => {
  it("accepts a valid 4-digit PLZ", () => {
    expect(validatePlz("8044")).toEqual({ valid: true });
  });
  it("rejects non-4-digit input with invalidPlzFormat", () => {
    expect(validatePlz("99999")).toEqual({ valid: false, code: "invalidPlzFormat" });
    expect(validatePlz("12")).toEqual({ valid: false, code: "invalidPlzFormat" });
    expect(validatePlz("abcd")).toEqual({ valid: false, code: "invalidPlzFormat" });
  });
});

describe("validateBirthYear", () => {
  const currentYear = new Date().getFullYear();

  it("accepts a realistic birth year", () => {
    expect(validateBirthYear(1988)).toEqual({ valid: true });
  });
  it("rejects a future birth year with futureBirthYear", () => {
    expect(validateBirthYear(currentYear + 1)).toEqual({ valid: false, code: "futureBirthYear" });
  });
  it("rejects an implausibly old birth year with unrealisticBirthYear", () => {
    expect(validateBirthYear(currentYear - 150)).toEqual({ valid: false, code: "unrealisticBirthYear" });
  });
});

describe("validateCurrentPremium", () => {
  it("accepts a positive premium", () => {
    expect(validateCurrentPremium(350.5)).toEqual({ valid: true });
  });
  it("rejects non-finite values with invalidPremium", () => {
    expect(validateCurrentPremium(NaN)).toEqual({ valid: false, code: "invalidPremium" });
    expect(validateCurrentPremium(Infinity)).toEqual({ valid: false, code: "invalidPremium" });
  });
  it("rejects zero or negative values with nonPositivePremium", () => {
    expect(validateCurrentPremium(0)).toEqual({ valid: false, code: "nonPositivePremium" });
    expect(validateCurrentPremium(-5)).toEqual({ valid: false, code: "nonPositivePremium" });
  });
});
