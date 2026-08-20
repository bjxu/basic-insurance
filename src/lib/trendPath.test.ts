import { describe, it, expect } from "vitest";
import { buildTrendPath } from "./trendPath";

describe("buildTrendPath", () => {
  it("returns empty paths and points for no data", () => {
    expect(buildTrendPath([])).toEqual({ linePath: "", areaPath: "", points: [] });
  });

  it("maps the max value to the top and 0 to the bottom of the plot area", () => {
    const { points } = buildTrendPath([0, 100]);
    expect(points[0]).toEqual({ x: 0, y: 90 });
    expect(points[1]).toEqual({ x: 760, y: 6 });
  });

  it("builds an M/L line path and a closed area path down to the x-axis", () => {
    const { linePath, areaPath } = buildTrendPath([10, 20, 10]);
    expect(linePath).toBe("M0,48 L380,6 L760,48");
    expect(areaPath).toBe("M0,48 L380,6 L760,48 L760,110 L0,110 Z");
  });

  it("treats a single point as a flat line at x=0", () => {
    const { points } = buildTrendPath([5]);
    expect(points).toEqual([{ x: 0, y: 6 }]);
  });
});
