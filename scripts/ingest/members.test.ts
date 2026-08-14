import { describe, it, expect } from "vitest";
import { normalizeInsurerCode, parseMemberCounts } from "./members";

const HEADER = "Versicherer;Kanton;Geschäftsjahr;Durchschnittsbestand";

function csv(...rows: string[]): string {
  return "﻿" + [HEADER, ...rows].join("\r\n");
}

describe("normalizeInsurerCode", () => {
  it("strips leading zeros", () => {
    expect(normalizeInsurerCode("0008")).toBe("8");
    expect(normalizeInsurerCode("1542")).toBe("1542");
  });
  it("throws on a non-numeric code", () => {
    expect(() => normalizeInsurerCode("abcd")).toThrow(/unrecognized code/);
  });
});

describe("parseMemberCounts", () => {
  const insurerNames = { "8": "CSS" };

  it("sums Durchschnittsbestand across cantons per insurer, rounded", () => {
    const text = csv("0008;AG;2024;153225.267", "0008;ZH;2024;100.5");
    const result = parseMemberCounts(text, insurerNames);
    expect(result.counts).toEqual({ "8": 153326 }); // 153225.267 + 100.5 = 153325.767 -> round
    expect(result.year).toBe(2024);
  });

  it("collects unmatched insurer codes separately, excluded from counts", () => {
    const text = csv("0008;AG;2024;153225.267", "0829;BE;2024;12661.4");
    const result = parseMemberCounts(text, insurerNames);
    expect(result.counts).toEqual({ "8": 153225 });
    expect(result.unmatchedCodes).toEqual(new Set(["829"]));
  });

  it("sums every canton row regardless of canton validity (unlike premium parsing)", () => {
    // "ZE"/"ZR" are cross-border/special-region codes parsePremiums.ts skips for pricing —
    // but those are still real insured people for a total membership count.
    const text = csv("0008;ZE;2024;50.2", "0008;ZR;2024;10.1");
    const result = parseMemberCounts(text, insurerNames);
    expect(result.counts).toEqual({ "8": 60 });
  });

  it("throws if the file mixes more than one Geschäftsjahr", () => {
    const text = csv("0008;AG;2024;153225.267", "0008;AG;2023;140000");
    expect(() => parseMemberCounts(text, insurerNames)).toThrow(/Geschäftsjahr/);
  });
});
