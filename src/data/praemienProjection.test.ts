import { describe, it, expect } from "vitest";
import projection from "./praemienProjection.json";

// Hand-maintained editorial figures for the /de/praemien guide. This guards
// the shape the page (src/app/[locale]/praemien/page.tsx) and content
// component depend on, and — per requirement.md Core Principle #3 — that
// every published figure carries a source URL back to where it was announced.

describe("praemienProjection.json", () => {
  it("has the Comparis forecast as a positive numeric percentage with a source URL", () => {
    expect(typeof projection.comparis.increase).toBe("number");
    expect(projection.comparis.increase).toBeGreaterThan(0);
    expect(projection.comparis.source).toMatch(/^https:\/\//);
  });

  it("has the BAG forecast as a low<=high numeric range with a source URL", () => {
    expect(typeof projection.bag.low).toBe("number");
    expect(typeof projection.bag.high).toBe("number");
    expect(projection.bag.high).toBeGreaterThanOrEqual(projection.bag.low);
    expect(projection.bag.source).toMatch(/^https:\/\//);
  });

  it("states the projected year and an ISO year-month it is current as of", () => {
    expect(projection.year).toBe(2027);
    expect(projection.asOf).toMatch(/^\d{4}-\d{2}$/);
  });
});
