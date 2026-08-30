// src/lib/zurichTime.test.ts
import { describe, it, expect } from "vitest";
import { zurichParts, zurichWallToUTC } from "./zurichTime";

describe("zurichParts", () => {
  it("reads CEST (summer, UTC+2) wall-clock fields", () => {
    expect(zurichParts(new Date("2026-08-15T12:00:00Z"))).toEqual({
      year: 2026, month: 8, day: 15, hour: 14, minute: 0, second: 0,
    });
  });

  it("reads CET (winter, UTC+1) wall-clock fields", () => {
    expect(zurichParts(new Date("2026-01-15T12:00:00Z"))).toEqual({
      year: 2026, month: 1, day: 15, hour: 13, minute: 0, second: 0,
    });
  });

  it("rolls over to the next Zurich calendar day near midnight UTC in summer", () => {
    expect(zurichParts(new Date("2026-08-10T23:00:00Z"))).toEqual({
      year: 2026, month: 8, day: 11, hour: 1, minute: 0, second: 0,
    });
  });
});

describe("zurichWallToUTC", () => {
  it("converts an unambiguous CEST wall-clock time to UTC", () => {
    expect(zurichWallToUTC(2026, 8, 10, 0, 0, 0).toISOString()).toBe("2026-08-09T22:00:00.000Z");
  });

  it("converts an unambiguous CET wall-clock time to UTC", () => {
    expect(zurichWallToUTC(2026, 1, 1, 0, 0, 0).toISOString()).toBe("2025-12-31T23:00:00.000Z");
  });

  it("round-trips through zurichParts for an unambiguous instant", () => {
    const utc = zurichWallToUTC(2026, 8, 15, 14, 30, 0);
    expect(zurichParts(utc)).toEqual({ year: 2026, month: 8, day: 15, hour: 14, minute: 30, second: 0 });
  });

  it("snaps the nonexistent spring-forward hour forward (2026-03-29 02:00 does not exist)", () => {
    const snapped = zurichWallToUTC(2026, 3, 29, 2, 0, 0);
    const nextHour = zurichWallToUTC(2026, 3, 29, 3, 0, 0);
    expect(snapped.toISOString()).toBe("2026-03-29T01:00:00.000Z");
    expect(snapped.getTime()).toBe(nextHour.getTime());
  });

  it("resolves the ambiguous fall-back hour to its second (post-transition, CET) occurrence", () => {
    // 2026-10-25 02:00 Zurich occurs twice: first at CEST (UTC 00:00), then
    // at CET (UTC 01:00). zurichWallToUTC lands on the second.
    expect(zurichWallToUTC(2026, 10, 25, 2, 0, 0).toISOString()).toBe("2026-10-25T01:00:00.000Z");
  });

  it("handles the hours either side of the fall-back transition unambiguously", () => {
    expect(zurichWallToUTC(2026, 10, 25, 1, 0, 0).toISOString()).toBe("2026-10-24T23:00:00.000Z");
    expect(zurichWallToUTC(2026, 10, 25, 3, 0, 0).toISOString()).toBe("2026-10-25T02:00:00.000Z");
  });
});
