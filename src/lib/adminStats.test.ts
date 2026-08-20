// src/lib/adminStats.test.ts
import { describe, it, expect } from "vitest";
import { selectGranularity, fillTrendGaps } from "./adminStats";

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

describe("fillTrendGaps", () => {
  it("fills a gap in the middle of a day-granularity range with zeros", () => {
    const rows = [
      { bucket: "2026-08-10T00:00:00.000Z", n: 3 },
      { bucket: "2026-08-13T00:00:00.000Z", n: 5 },
    ];
    const result = fillTrendGaps(rows, "day", "2026-08-10", "2026-08-14");
    expect(result).toEqual([
      { bucket: "2026-08-10T00:00:00.000Z", n: 3 },
      { bucket: "2026-08-11T00:00:00.000Z", n: 0 },
      { bucket: "2026-08-12T00:00:00.000Z", n: 0 },
      { bucket: "2026-08-13T00:00:00.000Z", n: 5 },
    ]);
  });

  it("returns an empty series when from equals the exclusive to", () => {
    const rows = [{ bucket: "2026-08-10T00:00:00.000Z", n: 2 }];
    const result = fillTrendGaps(rows, "hour", "2026-08-10", "2026-08-10");
    expect(result).toEqual([]);
  });

  it("fills a gap in an hour-granularity range with zeros", () => {
    const rows = [
      { bucket: "2026-08-10T00:00:00.000Z", n: 2 },
      { bucket: "2026-08-10T03:00:00.000Z", n: 4 },
    ];
    const from = "2026-08-10";
    // Use full-day boundaries (the only shape the API ever passes for `to`)
    // but assert on just the first few hourly buckets to keep this focused.
    const result = fillTrendGaps(rows, "hour", from, "2026-08-11");
    expect(result.slice(0, 5)).toEqual([
      { bucket: "2026-08-10T00:00:00.000Z", n: 2 },
      { bucket: "2026-08-10T01:00:00.000Z", n: 0 },
      { bucket: "2026-08-10T02:00:00.000Z", n: 0 },
      { bucket: "2026-08-10T03:00:00.000Z", n: 4 },
      { bucket: "2026-08-10T04:00:00.000Z", n: 0 },
    ]);
    expect(result).toHaveLength(24);
  });

  it("fills a gap in a month-granularity range with zeros", () => {
    const rows = [
      { bucket: "2026-01-01T00:00:00.000Z", n: 10 },
      { bucket: "2026-04-01T00:00:00.000Z", n: 20 },
    ];
    const result = fillTrendGaps(rows, "month", "2026-01-01", "2026-05-01");
    expect(result).toEqual([
      { bucket: "2026-01-01T00:00:00.000Z", n: 10 },
      { bucket: "2026-02-01T00:00:00.000Z", n: 0 },
      { bucket: "2026-03-01T00:00:00.000Z", n: 0 },
      { bucket: "2026-04-01T00:00:00.000Z", n: 20 },
    ]);
  });

  it("passes through unchanged when rows exactly match every expected bucket", () => {
    const rows = [
      { bucket: "2026-08-10T00:00:00.000Z", n: 1 },
      { bucket: "2026-08-11T00:00:00.000Z", n: 2 },
      { bucket: "2026-08-12T00:00:00.000Z", n: 3 },
    ];
    const result = fillTrendGaps(rows, "day", "2026-08-10", "2026-08-13");
    expect(result).toEqual(rows);
  });
});
