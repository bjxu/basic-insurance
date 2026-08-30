// src/lib/adminStats.ts
// Pure helpers for the admin stats API (architecture.md §13.2, REQ-22).

import { zurichWallToUTC } from "./zurichTime";

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

// The stats route's trend query does `GROUP BY date_trunc(...)` bucketed in
// Europe/Zurich (see route.ts), which only emits rows for buckets that
// actually have data — empty buckets are simply absent, not present with
// n=0. buildTrendPath (src/lib/trendPath.ts) then spreads whatever rows it
// receives evenly across the chart's fixed width, so sparse data
// misrepresents time (e.g. two points on the 1st and the 30th render as a
// straight line, indistinguishable from steady daily activity).
//
// This fills every expected Zurich-wall-clock bucket boundary between
// `from` (inclusive) and `to` (exclusive, both Zurich calendar dates) at
// the given granularity, defaulting missing buckets to n: 0, so TrendChart
// always receives a complete, evenly-spaced series. Bucket boundaries are
// computed via zurichWallToUTC so they line up exactly with the SQL's own
// `date_trunc(..., ts AT TIME ZONE 'Europe/Zurich') AT TIME ZONE
// 'Europe/Zurich'` bucketing, DST included.
export function fillTrendGaps(
  rows: { bucket: string; n: number }[],
  granularity: Granularity,
  from: string,
  to: string,
): { bucket: string; n: number }[] {
  const [fromY, fromM, fromD] = from.split("-").map(Number);
  const [toY, toM, toD] = to.split("-").map(Number);
  const toDate = zurichWallToUTC(toY, toM, toD);

  const countsByBucket = new Map<string, number>();
  for (const row of rows) {
    countsByBucket.set(new Date(row.bucket).toISOString(), row.n);
  }

  const buckets: { bucket: string; n: number }[] = [];

  if (granularity === "month") {
    let year = fromY;
    let month = fromM; // 1-12
    let real = zurichWallToUTC(year, month, 1);
    while (real < toDate) {
      const iso = real.toISOString();
      buckets.push({ bucket: iso, n: countsByBucket.get(iso) ?? 0 });
      month += 1;
      if (month > 12) {
        month = 1;
        year += 1;
      }
      real = zurichWallToUTC(year, month, 1);
    }
    return buckets;
  }

  // day / hour: step a plain UTC-labelled scratch Date purely as calendar
  // arithmetic (leap years and month lengths handled by native Date), then
  // convert each label to its real UTC instant via zurichWallToUTC. The
  // scratch Date's fields are never used as a real instant themselves.
  const cursor =
    granularity === "hour"
      ? new Date(Date.UTC(fromY, fromM - 1, fromD, 0))
      : new Date(Date.UTC(fromY, fromM - 1, fromD));

  for (;;) {
    const y = cursor.getUTCFullYear();
    const m = cursor.getUTCMonth() + 1;
    const d = cursor.getUTCDate();
    const h = granularity === "hour" ? cursor.getUTCHours() : 0;
    const real = zurichWallToUTC(y, m, d, h);
    if (!(real < toDate)) break;
    const iso = real.toISOString();
    buckets.push({ bucket: iso, n: countsByBucket.get(iso) ?? 0 });
    if (granularity === "hour") {
      cursor.setUTCHours(cursor.getUTCHours() + 1);
    } else {
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  }

  return buckets;
}
