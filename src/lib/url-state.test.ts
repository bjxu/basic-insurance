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
  currentFranchise: 300,
  currentTarifart: "telmed",
  currentTarifCode: "01_016",
  currentUnfalldeckung: true,
};

describe("encodeState / decodeState — currentTarifCode round-trip", () => {
  it("encodes currentTarifCode as the ct param", () => {
    const params = encodeState(BASE_STATE);
    expect(params.get("ct")).toBe("01_016");
  });

  it("decodes ct back into currentTarifCode", () => {
    const params = encodeState(BASE_STATE);
    const decoded = decodeState(params);
    expect(decoded.currentTarifCode).toBe("01_016");
  });

  it("omits ct when currentTarifCode is null, and decodes its absence as null", () => {
    const params = encodeState({ ...BASE_STATE, currentTarifCode: null });
    expect(params.has("ct")).toBe(false);
    expect(decodeState(params).currentTarifCode).toBeNull();
  });
});
