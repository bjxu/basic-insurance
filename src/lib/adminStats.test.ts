// src/lib/adminStats.test.ts
import { describe, it, expect } from "vitest";
import { selectGranularity } from "./adminStats";

describe("selectGranularity", () => {
  it("returns hour for a range of 2 days or less", () => {
    expect(selectGranularity("2026-08-10", "2026-08-11")).toBe("hour");
    expect(selectGranularity("2026-08-09", "2026-08-11")).toBe("hour");
  });

  it("returns day for a range between 3 and 90 days", () => {
    expect(selectGranularity("2026-08-01", "2026-08-11")).toBe("day");
    expect(selectGranularity("2026-05-13", "2026-08-11")).toBe("day"); // exactly 90 days
  });

  it("returns day for exactly 3 days (lower boundary)", () => {
    expect(selectGranularity("2026-08-08", "2026-08-11")).toBe("day");
  });

  it("returns month for a range over 90 days", () => {
    expect(selectGranularity("2026-01-01", "2026-08-11")).toBe("month");
  });

  it("returns month for exactly 91 days (just over the threshold)", () => {
    expect(selectGranularity("2026-05-12", "2026-08-11")).toBe("month");
  });
});
