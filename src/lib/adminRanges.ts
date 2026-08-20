// Preset date-range math and label formatting for the admin RangePicker
// (architecture.md §13.2/§13.4, REQ-22).
//
// `to` is always the *exclusive* upper bound the stats API expects
// (`ts < to`) — one calendar day past the last day a human considers
// "included". This lets the URL/API param be passed straight through with
// no conversion; only formatRangeLabel (and the RangePicker's date input,
// Task 11) convert to/from the inclusive, human-facing end date.

export type PresetKey = "today" | "7d" | "30d" | "month" | "3m" | "year";

export const PRESETS: { key: PresetKey; label: string }[] = [
  { key: "today", label: "Heute" },
  { key: "7d", label: "7 Tage" },
  { key: "30d", label: "30 Tage" },
  { key: "month", label: "Dieser Monat" },
  { key: "3m", label: "3 Monate" },
  { key: "year", label: "Dieses Jahr" },
];

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, n: number): Date {
  const copy = new Date(d);
  copy.setUTCDate(copy.getUTCDate() + n);
  return copy;
}

// `today` is injected (never read from `new Date()` internally) so callers —
// and tests — control "now" precisely instead of depending on wall-clock time.
export function presetRange(key: PresetKey, today: Date): { from: string; to: string } {
  const todayMidnight = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const to = toISODate(addDays(todayMidnight, 1)); // exclusive: tomorrow

  switch (key) {
    case "today":
      return { from: toISODate(todayMidnight), to };
    case "7d":
      return { from: toISODate(addDays(todayMidnight, -6)), to };
    case "30d":
      return { from: toISODate(addDays(todayMidnight, -29)), to };
    case "month":
      return {
        from: toISODate(new Date(Date.UTC(todayMidnight.getUTCFullYear(), todayMidnight.getUTCMonth(), 1))),
        to,
      };
    case "3m":
      return { from: toISODate(addDays(todayMidnight, -89)), to };
    case "year":
      return { from: toISODate(new Date(Date.UTC(todayMidnight.getUTCFullYear(), 0, 1))), to };
  }
}

const MONTHS_DE = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];

function formatDe(iso: string): { day: number; month: string; year: number } {
  const [y, m, d] = iso.split("-").map(Number);
  return { day: d, month: MONTHS_DE[m - 1], year: y };
}

// Human-facing "13. Jul – 11. Aug 2026" label from a canonical {from, toExclusive}
// pair (toExclusive per presetRange/the stats API contract above).
export function formatRangeLabel(from: string, toExclusive: string): string {
  const inclusiveTo = toISODate(addDays(new Date(`${toExclusive}T00:00:00Z`), -1));
  const a = formatDe(from);
  const b = formatDe(inclusiveTo);
  const fromStr = a.year === b.year ? `${a.day}. ${a.month}` : `${a.day}. ${a.month} ${a.year}`;
  return `${fromStr} – ${b.day}. ${b.month} ${b.year}`;
}
