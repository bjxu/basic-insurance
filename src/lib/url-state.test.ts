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
});
