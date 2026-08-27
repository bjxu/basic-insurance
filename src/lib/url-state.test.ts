import { describe, it, expect } from "vitest";
import { encodeState, decodeState, type ComparisonState } from "./url-state";

const BASE_STATE: ComparisonState = {
  plz: "8001",
  bfsNr: 261,
  birthYear: 1990,
  franchise: 300,
  year: 2026,
  unfalldeckung: true,
  models: ["standard"],
  currentInsurerCode: "8",
  currentMonthlyPremium: 350.5,
};

describe("decodeState — models default", () => {
  it("defaults to all tarifarten (alternative models on) when no models param is present", () => {
    const models = decodeState(new URLSearchParams("")).models;
    expect(models.length).toBeGreaterThan(1);
    expect(models).toContain("standard");
  });

  it("respects an explicit models=standard from a shared link", () => {
    expect(decodeState(new URLSearchParams("models=standard")).models).toEqual(["standard"]);
  });
});

describe("encodeState / decodeState — currentMonthlyPremium round-trip", () => {
  it("encodes currentMonthlyPremium as the cp param", () => {
    const params = encodeState(BASE_STATE);
    expect(params.get("cp")).toBe("350.5");
  });

  it("decodes cp back into currentMonthlyPremium", () => {
    const params = encodeState(BASE_STATE);
    const decoded = decodeState(params);
    expect(decoded.currentMonthlyPremium).toBe(350.5);
  });

  it("omits cp when currentMonthlyPremium is null, and decodes its absence as null", () => {
    const params = encodeState({ ...BASE_STATE, currentMonthlyPremium: null });
    expect(params.has("cp")).toBe(false);
    expect(decodeState(params).currentMonthlyPremium).toBeNull();
  });

  it("rejects a zero or negative cp value on decode (defensive — REQ-13)", () => {
    expect(decodeState(new URLSearchParams("cp=0")).currentMonthlyPremium).toBeNull();
    expect(decodeState(new URLSearchParams("cp=-5")).currentMonthlyPremium).toBeNull();
  });

  it("rejects a non-numeric cp value on decode", () => {
    expect(decodeState(new URLSearchParams("cp=abc")).currentMonthlyPremium).toBeNull();
  });

  it("rounds a 3-decimal currentMonthlyPremium to 2 decimals at encode time so it round-trips (REQ-11)", () => {
    const params = encodeState({ ...BASE_STATE, currentMonthlyPremium: 350.567 });
    const decoded = decodeState(params);
    expect(decoded.currentMonthlyPremium).not.toBeNull();
    expect(decoded.currentMonthlyPremium as number).toBeCloseTo(350.57, 2);
  });

  it("decodes a 2-decimal cp value", () => {
    expect(decodeState(new URLSearchParams("cp=350.55")).currentMonthlyPremium).toBe(350.55);
  });

  it("decodes a bare-integer cp value with no decimal point", () => {
    expect(decodeState(new URLSearchParams("cp=350")).currentMonthlyPremium).toBe(350);
  });
});
