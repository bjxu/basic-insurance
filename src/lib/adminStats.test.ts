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
  it("fills a gap in the middle of a day-granularity range with zeros (Zurich-anchored, CEST)", () => {
    const rows = [
      { bucket: "2026-08-09T22:00:00.000Z", n: 3 }, // Zurich 2026-08-10 00:00 CEST
      { bucket: "2026-08-12T22:00:00.000Z", n: 5 }, // Zurich 2026-08-13 00:00 CEST
    ];
    const result = fillTrendGaps(rows, "day", "2026-08-10", "2026-08-14");
    expect(result).toEqual([
      { bucket: "2026-08-09T22:00:00.000Z", n: 3 },
      { bucket: "2026-08-10T22:00:00.000Z", n: 0 },
      { bucket: "2026-08-11T22:00:00.000Z", n: 0 },
      { bucket: "2026-08-12T22:00:00.000Z", n: 5 },
    ]);
  });

  it("returns an empty series when from equals the exclusive to", () => {
    const rows = [{ bucket: "2026-08-10T00:00:00.000Z", n: 2 }];
    const result = fillTrendGaps(rows, "hour", "2026-08-10", "2026-08-10");
    expect(result).toEqual([]);
  });

  it("fills a gap in an hour-granularity range with zeros (Zurich-anchored, CEST)", () => {
    const rows = [
      { bucket: "2026-08-09T22:00:00.000Z", n: 2 }, // Zurich 2026-08-10 00:00
      { bucket: "2026-08-10T01:00:00.000Z", n: 4 }, // Zurich 2026-08-10 03:00
    ];
    const result = fillTrendGaps(rows, "hour", "2026-08-10", "2026-08-11");
    expect(result.slice(0, 5)).toEqual([
      { bucket: "2026-08-09T22:00:00.000Z", n: 2 },
      { bucket: "2026-08-09T23:00:00.000Z", n: 0 },
      { bucket: "2026-08-10T00:00:00.000Z", n: 0 },
      { bucket: "2026-08-10T01:00:00.000Z", n: 4 },
      { bucket: "2026-08-10T02:00:00.000Z", n: 0 },
    ]);
    expect(result).toHaveLength(24);
  });

  it("handles the spring-forward DST day (2026-03-29): 24 hourly buckets, one duplicated instant", () => {
    const result = fillTrendGaps([], "hour", "2026-03-29", "2026-03-30");
    expect(result).toHaveLength(24);
    expect(result[0].bucket).toBe("2026-03-28T23:00:00.000Z");
    expect(result[1].bucket).toBe("2026-03-29T00:00:00.000Z");
    expect(result[2].bucket).toBe("2026-03-29T01:00:00.000Z");
    // The nonexistent local 02:00 snaps forward onto the same instant as
    // the following 03:00 -- a documented, harmless duplicate point.
    expect(result[3].bucket).toBe("2026-03-29T01:00:00.000Z");
    expect(result[4].bucket).toBe("2026-03-29T02:00:00.000Z");
    expect(result[23].bucket).toBe("2026-03-29T21:00:00.000Z");
    expect(result.every((b) => b.n === 0)).toBe(true);
  });

  it("fills a gap in a month-granularity range with zeros, crossing the spring DST change", () => {
    const rows = [
      { bucket: "2025-12-31T23:00:00.000Z", n: 10 }, // Zurich 2026-01-01 00:00 CET
      { bucket: "2026-03-31T22:00:00.000Z", n: 20 }, // Zurich 2026-04-01 00:00 CEST
    ];
    const result = fillTrendGaps(rows, "month", "2026-01-01", "2026-05-01");
    expect(result).toEqual([
      { bucket: "2025-12-31T23:00:00.000Z", n: 10 },
      { bucket: "2026-01-31T23:00:00.000Z", n: 0 }, // Zurich 2026-02-01 00:00 CET
      { bucket: "2026-02-28T23:00:00.000Z", n: 0 }, // Zurich 2026-03-01 00:00 CET
      { bucket: "2026-03-31T22:00:00.000Z", n: 20 },
    ]);
  });

  it("passes through unchanged when rows exactly match every expected bucket", () => {
    const rows = [
      { bucket: "2026-08-09T22:00:00.000Z", n: 1 }, // Zurich 2026-08-10
      { bucket: "2026-08-10T22:00:00.000Z", n: 2 }, // Zurich 2026-08-11
      { bucket: "2026-08-11T22:00:00.000Z", n: 3 }, // Zurich 2026-08-12
    ];
    const result = fillTrendGaps(rows, "day", "2026-08-10", "2026-08-13");
    expect(result).toEqual(rows);
  });
});
