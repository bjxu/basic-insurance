// The Altersverteilung query (query 11) has no ORDER BY — the panel orders the
// rows client-side by the canonical AGE_BANDS sequence (architecture.md §13.4).

import { describe, it, expect } from "vitest";
import { orderedAgeBandRows } from "./Dashboard";

describe("orderedAgeBandRows", () => {
  it("returns rows in canonical AGE_BANDS order regardless of input order", () => {
    const shuffled = [
      { band: "76+", n: 1 },
      { band: "0-18", n: 2 },
      { band: "36-45", n: 3 },
    ];
    expect(orderedAgeBandRows(shuffled)).toEqual([
      { label: "0–18", value: 2 },
      { label: "36–45", value: 3 },
      { label: "76+", value: 1 },
    ]);
  });

  it("omits bands absent from the input", () => {
    const rows = orderedAgeBandRows([{ band: "26-35", n: 5 }]);
    expect(rows).toEqual([{ label: "26–35", value: 5 }]);
  });
});
