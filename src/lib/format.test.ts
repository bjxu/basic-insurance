import { describe, it, expect } from "vitest";
import { formatChf } from "@/lib/format";

describe("formatChf", () => {
  it("formats with apostrophe thousands separator and two decimals", () => {
    expect(formatChf(1234.5)).toBe("CHF 1'234.50");
  });
  it("formats small amounts without a separator", () => {
    expect(formatChf(301.1)).toBe("CHF 301.10");
  });
  it("formats large amounts with multiple separators", () => {
    expect(formatChf(1234567.89)).toBe("CHF 1'234'567.89");
  });
});
