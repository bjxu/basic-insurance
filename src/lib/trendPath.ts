// SVG path builder for the admin trend chart — mirrors mockups/admin.html's
// hand-drawn <svg> line/area chart exactly (same viewBox, same path shape),
// architecture.md §13.4.

const WIDTH = 760;
const HEIGHT = 110;
const TOP_PAD = 6;
const BOTTOM_PAD = 20; // room for x-axis labels

export const TREND_CHART_VIEWBOX = `0 0 ${WIDTH} ${HEIGHT}`;

export type TrendPoint = { x: number; y: number };

export function buildTrendPath(values: number[]): { linePath: string; areaPath: string; points: TrendPoint[] } {
  if (values.length === 0) {
    return { linePath: "", areaPath: "", points: [] };
  }

  const max = Math.max(1, ...values);
  const innerHeight = HEIGHT - TOP_PAD - BOTTOM_PAD;
  const stepX = values.length > 1 ? WIDTH / (values.length - 1) : 0;

  const points: TrendPoint[] = values.map((v, i) => ({
    x: Math.round(i * stepX),
    y: Math.round(TOP_PAD + innerHeight * (1 - v / max)),
  }));

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  const areaPath = `${linePath} L${WIDTH},${HEIGHT} L0,${HEIGHT} Z`;

  return { linePath, areaPath, points };
}
