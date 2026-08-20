// src/components/admin/RangePicker.tsx
// Preset buttons + custom date inputs, matching mockups/admin.html's
// .range-picker markup/copy exactly (architecture.md §13.3/§13.4).

"use client";

import { PRESETS, presetRange, formatRangeLabel, type PresetKey } from "@/lib/adminRanges";

type Range = { from: string; to: string; preset: PresetKey | null };

type Props = {
  from: string;
  to: string;
  activePreset: PresetKey | null;
  onChange: (range: Range) => void;
};

// `to` is always the exclusive upper bound (see adminRanges.ts); the date
// inputs show the *inclusive* end date to the user, converting back to the
// exclusive form on change.
function inclusiveToDisplay(to: string): string {
  const d = new Date(`${to}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

function exclusiveFromInclusiveDisplay(inclusiveTo: string): string {
  const d = new Date(`${inclusiveTo}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function RangePicker({ from, to, activePreset, onChange }: Props) {
  const today = new Date();

  return (
    <div className="bg-surface border border-outline-variant rounded-lg shadow-sm p-3 flex items-center gap-2 flex-wrap mb-5">
      <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide mr-1">Zeitraum</span>
      {PRESETS.map((p) => (
        <button
          key={p.key}
          type="button"
          aria-pressed={activePreset === p.key}
          onClick={() => onChange({ ...presetRange(p.key, today), preset: p.key })}
          className={`px-3 py-1.5 rounded-full border text-sm ${
            activePreset === p.key
              ? "bg-primary border-primary text-on-primary font-semibold"
              : "border-outline-variant text-on-surface-variant"
          }`}
        >
          {p.label}
        </button>
      ))}
      <div className="w-px h-[22px] bg-outline-variant mx-1" />
      <div className="flex items-center gap-1.5">
        <label htmlFor="date-from" className="sr-only">
          Von
        </label>
        <input
          id="date-from"
          type="date"
          value={from}
          onChange={(e) => onChange({ from: e.target.value, to, preset: null })}
          className="h-8 px-2 rounded-md border border-outline-variant text-[13px] text-on-surface-variant"
        />
        <span className="text-xs text-outline">→</span>
        <label htmlFor="date-to" className="sr-only">
          Bis
        </label>
        <input
          id="date-to"
          type="date"
          value={inclusiveToDisplay(to)}
          onChange={(e) => onChange({ from, to: exclusiveFromInclusiveDisplay(e.target.value), preset: null })}
          className="h-8 px-2 rounded-md border border-outline-variant text-[13px] text-on-surface-variant"
        />
      </div>
      <span className="ml-auto text-xs text-outline">
        {activePreset && PRESETS.find((p) => p.key === activePreset)?.label
          ? `${PRESETS.find((p) => p.key === activePreset)?.label} · `
          : ""}
        {formatRangeLabel(from, to)}
      </span>
    </div>
  );
}
