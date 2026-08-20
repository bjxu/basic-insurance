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

// The stats route's trend query does `GROUP BY date_trunc(...)`, which only
// emits rows for buckets that actually have data — empty buckets are simply
// absent, not present with n=0. buildTrendPath (src/lib/trendPath.ts) then
// spreads whatever rows it receives evenly across the chart's fixed width, so
// sparse data misrepresents time (e.g. two points on the 1st and the 30th
// render as a straight line, indistinguishable from steady daily activity).
//
// This fills every expected bucket boundary between `from` (inclusive) and
// `to` (exclusive) at the given granularity, defaulting missing buckets to
// n: 0, so TrendChart always receives a complete, evenly-spaced series.
export function fillTrendGaps(
  rows: { bucket: string; n: number }[],
  granularity: Granularity,
  from: string,
  to: string,
): { bucket: string; n: number }[] {
  const fromDate = new Date(`${from}T00:00:00Z`);
  const toDate = new Date(`${to}T00:00:00Z`);

  const countsByBucket = new Map<string, number>();
  for (const row of rows) {
    countsByBucket.set(new Date(row.bucket).toISOString(), row.n);
  }

  const buckets: { bucket: string; n: number }[] = [];

  if (granularity === "month") {
    let cursor = new Date(Date.UTC(fromDate.getUTCFullYear(), fromDate.getUTCMonth(), 1));
    while (cursor < toDate) {
      const iso = cursor.toISOString();
      buckets.push({ bucket: iso, n: countsByBucket.get(iso) ?? 0 });
      cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1));
    }
  } else {
    const stepMs = granularity === "hour" ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
    for (let ms = fromDate.getTime(); ms < toDate.getTime(); ms += stepMs) {
      const iso = new Date(ms).toISOString();
      buckets.push({ bucket: iso, n: countsByBucket.get(iso) ?? 0 });
    }
  }

  return buckets;
}
