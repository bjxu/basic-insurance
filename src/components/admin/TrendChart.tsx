// src/components/admin/TrendChart.tsx
// Inline SVG line+area chart — mirrors mockups/admin.html's hand-drawn <svg>
// exactly (architecture.md §13.4), driven by real bucket/n data via
// buildTrendPath.

import { buildTrendPath, TREND_CHART_VIEWBOX } from "@/lib/trendPath";
import { MONTHS_DE } from "@/lib/adminRanges";
import type { Granularity } from "@/lib/adminStats";

type Point = { bucket: string; n: number };

const GRANULARITY_LABEL: Record<Granularity, string> = {
  hour: "stündlich",
  day: "täglich",
  month: "monatlich",
};

// Hand-written instead of Intl/toLocaleDateString so the trend chart's x-axis
// uses the exact same German month abbreviations as the range-picker's label
// (adminRanges.ts's MONTHS_DE) rather than a second, differently-abbreviated
// set from the locale data — and to match mockups/admin.html's compact,
// unpunctuated "12 Jul" style.
function formatBucketLabel(iso: string, granularity: Granularity): string {
  const d = new Date(iso);
  if (granularity === "hour") {
    return d.toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
  }
  if (granularity === "month") {
    return `${MONTHS_DE[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  }
  return `${d.getUTCDate()} ${MONTHS_DE[d.getUTCMonth()]}`;
}

// Evenly-spaced label indices, capped at `maxLabels`, so a long trend doesn't
// crowd the x-axis (mockups/admin.html shows 7 for ~31 daily buckets).
function pickLabelIndices(count: number, maxLabels = 7): number[] {
  if (count === 0) return [];
  if (count <= maxLabels) return Array.from({ length: count }, (_, i) => i);
  const step = (count - 1) / (maxLabels - 1);
  return Array.from({ length: maxLabels }, (_, i) => Math.round(i * step));
}

export function TrendChart({ data, granularity }: { data: Point[]; granularity: Granularity }) {
  const { linePath, areaPath, points } = buildTrendPath(data.map((d) => d.n));
  const labelIndices = pickLabelIndices(points.length);

  return (
    <div className="bg-surface border border-outline-variant rounded-lg shadow-sm p-5 mb-4">
      <h2 className="text-title-medium text-on-surface-variant uppercase tracking-wide mb-4">
        Anfragen über Zeit{" "}
        <span className="font-normal normal-case tracking-normal text-[11px] text-outline">
          {GRANULARITY_LABEL[granularity]}
        </span>
      </h2>
      <div className="w-full h-[130px]">
        <svg
          viewBox={TREND_CHART_VIEWBOX}
          preserveAspectRatio="none"
          className="w-full h-full overflow-visible"
          role="img"
          aria-label={`Anfragen ${GRANULARITY_LABEL[granularity]}, ${data.length} Datenpunkte`}
        >
          {/* Grid lines — always visible, matches mockup */}
          <line x1="0" y1="0" x2="760" y2="0" stroke="var(--md-sys-color-surface-variant)" strokeWidth="1" />
          <line x1="0" y1="36" x2="760" y2="36" stroke="var(--md-sys-color-surface-variant)" strokeWidth="1" />
          <line x1="0" y1="72" x2="760" y2="72" stroke="var(--md-sys-color-surface-variant)" strokeWidth="1" />

          {data.length > 0 && (
            <>
              <path d={areaPath} fill="rgba(0,83,219,.08)" />
              <path d={linePath} fill="none" stroke="var(--md-sys-color-primary)" strokeWidth={2} strokeLinejoin="round" />
              {labelIndices.map((i, idx) => {
                const anchor = idx === 0 ? "start" : idx === labelIndices.length - 1 ? "end" : "middle";
                return (
                  <text key={i} x={points[i].x} y={108} textAnchor={anchor} className="text-[11px] fill-outline">
                    {formatBucketLabel(data[i].bucket, granularity)}
                  </text>
                );
              })}
            </>
          )}
        </svg>
      </div>
    </div>
  );
}
