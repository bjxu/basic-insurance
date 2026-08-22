import { describe, it, expect } from "vitest";
import { getProductGroupName, type ProductGroups } from "@/lib/productGroups";

describe("getProductGroupName", () => {
  const groups: ProductGroups = {
    "1562": {
      BFP_BF: "BeneFit PLUS Hausarzt",
      BFP_CA: "BeneFit PLUS Hausarzt",
    },
  };

  it("returns the group name for a known insurer/tarifCode", () => {
    expect(getProductGroupName(groups, "1562", "BFP_BF")).toBe("BeneFit PLUS Hausarzt");
  });

  it("returns undefined for an unknown tarifCode", () => {
    expect(getProductGroupName(groups, "1562", "BASE")).toBeUndefined();
  });

  it("returns undefined for an unknown insurerCode", () => {
    expect(getProductGroupName(groups, "9999", "BFP_BF")).toBeUndefined();
  });

  it("returns undefined against an empty groups map", () => {
    expect(getProductGroupName({}, "1562", "BFP_BF")).toBeUndefined();
  });
});
