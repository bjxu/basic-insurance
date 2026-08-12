import { describe, it, expect } from "vitest";
import { INSURER_NAMES, buildInsurersJson } from "./insurers";

describe("INSURER_NAMES", () => {
  it("has an entry for every known BAG insurer code", () => {
    expect(Object.keys(INSURER_NAMES)).toHaveLength(34);
    expect(INSURER_NAMES["8"]).toBe("CSS");
    expect(INSURER_NAMES["1542"]).toBe("Assura");
  });
});

describe("buildInsurersJson", () => {
  it("maps the code table into {insurerCode, insurerName} rows sorted by name", () => {
    const result = buildInsurersJson({ "32": "Aquilana", "8": "CSS" });
    expect(result).toEqual([
      { insurerCode: "32", insurerName: "Aquilana" },
      { insurerCode: "8", insurerName: "CSS" },
    ]);
  });
});
