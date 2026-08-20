// src/components/admin/BreakdownBar.tsx
// Reusable horizontal bar list — one component behind every breakdown panel
// (regions, Altersklasse, accident, Franchise, model), matching
// mockups/admin.html's identical .bar-chart markup across all of them
// (architecture.md §13.4). Bar width is relative to the largest row's value.

import { formatCount } from "@/lib/format";

type Row = { label: string; value: number };

export function BreakdownBar({ rows, labelWidth = "normal", total: totalOverride }: { rows: Row[]; labelWidth?: "normal" | "short"; total?: number }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  const total = totalOverride ?? (rows.reduce((sum, r) => sum + r.value, 0) || 1);

  return (
    <div className="flex flex-col gap-2.5">
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-2">
          <span
            className={`shrink-0 text-[13px] text-on-surface-variant whitespace-nowrap overflow-hidden text-ellipsis ${
              labelWidth === "short" ? "w-[90px]" : "w-[130px]"
            }`}
          >
            {r.label}
          </span>
          <div className="flex-1 h-[18px] bg-surface-variant rounded-[3px] overflow-hidden">
            <div
              className="h-full bg-primary rounded-[3px] transition-[width] duration-300"
              style={{ width: `${(r.value / max) * 100}%` }}
            />
          </div>
          <span className="w-16 shrink-0 text-xs text-on-surface-variant text-right">
            {formatCount(r.value)} · {Math.round((r.value / total) * 100)}%
          </span>
        </div>
      ))}
    </div>
  );
}
