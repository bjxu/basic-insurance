// src/lib/adminStats.ts
// Pure helpers for the admin stats API (architecture.md §13.2, REQ-22).

export type Granularity = "hour" | "day" | "month";

// Range-length -> trend-chart granularity, per the table in architecture.md §13.2.
export function selectGranularity(fromISO: string, toISO: string): Granularity {
  const from = new Date(`${fromISO}T00:00:00Z`);
  const to = new Date(`${toISO}T00:00:00Z`);
  const days = (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24);
  if (days <= 2) return "hour";
  if (days <= 90) return "day";
  return "month";
}
