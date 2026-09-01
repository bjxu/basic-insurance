import { describe, it, expect } from "vitest";
import projection from "./praemienProjection.json";

// Hand-maintained editorial figures for the /de/praemien guide. This guards
// the shape the page (src/app/[locale]/praemien/page.tsx) and content
// component depend on, and — per requirement.md Core Principle #3 — that
// every published figure carries a source URL back to where it was announced.

describe("praemienProjection.json", () => {
  it("has both published forecasts with a non-empty increase and a source URL", () => {
    for (const key of ["comparis", "bag"] as const) {
      const entry = projection[key];
      expect(entry.increase.trim().length).toBeGreaterThan(0);
      expect(entry.source).toMatch(/^https:\/\//);
    }
  });

  it("states the year it projects and when the figures are from", () => {
    expect(projection.year).toBe(2027);
    expect(projection.asOf.trim().length).toBeGreaterThan(0);
  });
});
