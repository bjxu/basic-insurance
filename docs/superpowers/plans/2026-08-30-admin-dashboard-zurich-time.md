# Admin Dashboard Zurich Time Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every time-related piece of the admin dashboard (range presets, trend-chart bucketing, and axis labels) operate in Europe/Zurich local time instead of UTC.

**Architecture:** A new zero-dependency pure module, `src/lib/zurichTime.ts`, provides UTC↔Zurich wall-clock conversion via `Intl`. `adminStats.ts`'s `fillTrendGaps`, `adminRanges.ts`'s `presetRange`, the SQL in `route.ts`, and `TrendChart.tsx`'s label formatter are all rebuilt on it.

**Tech Stack:** TypeScript, Vitest, Neon serverless Postgres (`@neondatabase/serverless`), native `Intl.DateTimeFormat`. No new dependency.

## Global Constraints

- No new npm dependency — timezone conversion uses the built-in `Intl` timezone database only.
- `from`/`to` stay plain `YYYY-MM-DD` strings on the API — their meaning changes to "Zurich calendar date," not their shape.
- DST edge convention (`Europe/Zurich`), from the spec, exact wording:
  - Spring forward (nonexistent wall-clock hour, e.g. 2026-03-29 02:00–03:00): snaps forward.
  - Fall back (ambiguous wall-clock hour, e.g. 2026-10-25 02:00–03:00, occurs twice): resolves to its **second** (post-transition, CET) occurrence — the natural fixed point of the same two-pass correction used everywhere else, not a special-cased branch.
- `selectGranularity` (`src/lib/adminStats.ts`) is explicitly **out of scope** — keep its current UTC-based day-count math unchanged.
- `formatRangeLabel` (`src/lib/adminRanges.ts`) is explicitly **out of scope** — no change needed.

---

### Task 1: `src/lib/zurichTime.ts` — UTC↔Zurich conversion helpers

**Files:**
- Create: `src/lib/zurichTime.ts`
- Test: `src/lib/zurichTime.test.ts`

**Interfaces:**
- Produces: `zurichParts(instant: Date): { year: number; month: number; day: number; hour: number; minute: number; second: number }` (`month` is 1–12). `zurichWallToUTC(year: number, month: number, day: number, hour?: number, minute?: number, second?: number): Date`.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/zurichTime.test.ts`:

```ts
// src/lib/zurichTime.test.ts
import { describe, it, expect } from "vitest";
import { zurichParts, zurichWallToUTC } from "./zurichTime";

describe("zurichParts", () => {
  it("reads CEST (summer, UTC+2) wall-clock fields", () => {
    expect(zurichParts(new Date("2026-08-15T12:00:00Z"))).toEqual({
      year: 2026, month: 8, day: 15, hour: 14, minute: 0, second: 0,
    });
  });

  it("reads CET (winter, UTC+1) wall-clock fields", () => {
    expect(zurichParts(new Date("2026-01-15T12:00:00Z"))).toEqual({
      year: 2026, month: 1, day: 15, hour: 13, minute: 0, second: 0,
    });
  });

  it("rolls over to the next Zurich calendar day near midnight UTC in summer", () => {
    expect(zurichParts(new Date("2026-08-10T23:00:00Z"))).toEqual({
      year: 2026, month: 8, day: 11, hour: 1, minute: 0, second: 0,
    });
  });
});

describe("zurichWallToUTC", () => {
  it("converts an unambiguous CEST wall-clock time to UTC", () => {
    expect(zurichWallToUTC(2026, 8, 10, 0, 0, 0).toISOString()).toBe("2026-08-09T22:00:00.000Z");
  });

  it("converts an unambiguous CET wall-clock time to UTC", () => {
    expect(zurichWallToUTC(2026, 1, 1, 0, 0, 0).toISOString()).toBe("2025-12-31T23:00:00.000Z");
  });

  it("round-trips through zurichParts for an unambiguous instant", () => {
    const utc = zurichWallToUTC(2026, 8, 15, 14, 30, 0);
    expect(zurichParts(utc)).toEqual({ year: 2026, month: 8, day: 15, hour: 14, minute: 30, second: 0 });
  });

  it("snaps the nonexistent spring-forward hour forward (2026-03-29 02:00 does not exist)", () => {
    const snapped = zurichWallToUTC(2026, 3, 29, 2, 0, 0);
    const nextHour = zurichWallToUTC(2026, 3, 29, 3, 0, 0);
    expect(snapped.toISOString()).toBe("2026-03-29T01:00:00.000Z");
    expect(snapped.getTime()).toBe(nextHour.getTime());
  });

  it("resolves the ambiguous fall-back hour to its second (post-transition, CET) occurrence", () => {
    // 2026-10-25 02:00 Zurich occurs twice: first at CEST (UTC 00:00), then
    // at CET (UTC 01:00). zurichWallToUTC lands on the second.
    expect(zurichWallToUTC(2026, 10, 25, 2, 0, 0).toISOString()).toBe("2026-10-25T01:00:00.000Z");
  });

  it("handles the hours either side of the fall-back transition unambiguously", () => {
    expect(zurichWallToUTC(2026, 10, 25, 1, 0, 0).toISOString()).toBe("2026-10-24T23:00:00.000Z");
    expect(zurichWallToUTC(2026, 10, 25, 3, 0, 0).toISOString()).toBe("2026-10-25T02:00:00.000Z");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/zurichTime.test.ts`
Expected: FAIL — `Cannot find module './zurichTime'`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/zurichTime.ts`:

```ts
// src/lib/zurichTime.ts
// Pure UTC <-> Europe/Zurich wall-clock conversion helpers for the admin
// dashboard (architecture.md §13.2). No dependency: built on the Intl
// timezone database that's already used elsewhere in the codebase for
// de-CH formatting, just a different zone.
//
// DST edge convention (Europe/Zurich has two transitions a year):
// - Spring forward (the nonexistent wall-clock hour, e.g. 2026-03-29
//   02:00-03:00): zurichWallToUTC snaps forward, matching native Date's own
//   overflow behavior for out-of-range fields.
// - Fall back (the ambiguous, twice-occurring wall-clock hour, e.g.
//   2026-10-25 02:00-03:00): zurichWallToUTC resolves to its *second*
//   occurrence (the post-transition, CET offset) -- the natural fixed
//   point of the same two-pass correction used for every other instant,
//   not a specially-cased branch. This affects at most ~1-2 hours a year,
//   visible only at hourly granularity on those two specific days.

export type ZurichParts = {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  second: number;
};

const PARTS_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Zurich",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

// The Europe/Zurich wall-clock reading of a UTC instant.
export function zurichParts(instant: Date): ZurichParts {
  const parts = PARTS_FORMATTER.formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

// Europe/Zurich's UTC offset, in milliseconds, at the given instant.
function zurichOffsetMs(instant: Date): number {
  const local = zurichParts(instant);
  const asUTC = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute, local.second);
  return asUTC - instant.getTime();
}

// The UTC instant at which Europe/Zurich's wall clock reads the given
// components. Two-pass: guess the instant as if the components were UTC,
// read that guess's actual Zurich offset, and correct once more from the
// corrected instant's own offset -- a fixed point that's safe across the
// DST boundary (see the module-level DST edge convention above).
export function zurichWallToUTC(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
): Date {
  const naiveMs = Date.UTC(year, month - 1, day, hour, minute, second);
  const offsetMs = zurichOffsetMs(new Date(naiveMs));
  const corrected = new Date(naiveMs - offsetMs);
  const offsetMs2 = zurichOffsetMs(corrected);
  return offsetMs2 === offsetMs ? corrected : new Date(naiveMs - offsetMs2);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/zurichTime.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/zurichTime.ts src/lib/zurichTime.test.ts
git commit -m "feat: add Europe/Zurich wall-clock conversion helpers

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: `fillTrendGaps` — Zurich-anchored bucket boundaries

**Files:**
- Modify: `src/lib/adminStats.ts`
- Test: `src/lib/adminStats.test.ts`

**Interfaces:**
- Consumes: `zurichWallToUTC(year, month, day, hour?, minute?, second?): Date` from Task 1 (`src/lib/zurichTime.ts`).
- Produces: `fillTrendGaps` keeps its existing signature and return shape (`{ bucket: string; n: number }[]`) — only the actual boundary values it computes change.

- [ ] **Step 1: Write the failing tests**

Replace `src/lib/adminStats.test.ts`'s `fillTrendGaps` describe block (keep `selectGranularity`'s block untouched) with:

```ts
describe("fillTrendGaps", () => {
  it("fills a gap in the middle of a day-granularity range with zeros (Zurich-anchored, CEST)", () => {
    const rows = [
      { bucket: "2026-08-09T22:00:00.000Z", n: 3 }, // Zurich 2026-08-10 00:00 CEST
      { bucket: "2026-08-12T22:00:00.000Z", n: 5 }, // Zurich 2026-08-13 00:00 CEST
    ];
    const result = fillTrendGaps(rows, "day", "2026-08-10", "2026-08-14");
    expect(result).toEqual([
      { bucket: "2026-08-09T22:00:00.000Z", n: 3 },
      { bucket: "2026-08-10T22:00:00.000Z", n: 0 },
      { bucket: "2026-08-11T22:00:00.000Z", n: 0 },
      { bucket: "2026-08-12T22:00:00.000Z", n: 5 },
    ]);
  });

  it("returns an empty series when from equals the exclusive to", () => {
    const rows = [{ bucket: "2026-08-10T00:00:00.000Z", n: 2 }];
    const result = fillTrendGaps(rows, "hour", "2026-08-10", "2026-08-10");
    expect(result).toEqual([]);
  });

  it("fills a gap in an hour-granularity range with zeros (Zurich-anchored, CEST)", () => {
    const rows = [
      { bucket: "2026-08-09T22:00:00.000Z", n: 2 }, // Zurich 2026-08-10 00:00
      { bucket: "2026-08-10T01:00:00.000Z", n: 4 }, // Zurich 2026-08-10 03:00
    ];
    const result = fillTrendGaps(rows, "hour", "2026-08-10", "2026-08-11");
    expect(result.slice(0, 5)).toEqual([
      { bucket: "2026-08-09T22:00:00.000Z", n: 2 },
      { bucket: "2026-08-09T23:00:00.000Z", n: 0 },
      { bucket: "2026-08-10T00:00:00.000Z", n: 0 },
      { bucket: "2026-08-10T01:00:00.000Z", n: 4 },
      { bucket: "2026-08-10T02:00:00.000Z", n: 0 },
    ]);
    expect(result).toHaveLength(24);
  });

  it("handles the spring-forward DST day (2026-03-29): 24 hourly buckets, one duplicated instant", () => {
    const result = fillTrendGaps([], "hour", "2026-03-29", "2026-03-30");
    expect(result).toHaveLength(24);
    expect(result[0].bucket).toBe("2026-03-28T23:00:00.000Z");
    expect(result[1].bucket).toBe("2026-03-29T00:00:00.000Z");
    expect(result[2].bucket).toBe("2026-03-29T01:00:00.000Z");
    // The nonexistent local 02:00 snaps forward onto the same instant as
    // the following 03:00 -- a documented, harmless duplicate point.
    expect(result[3].bucket).toBe("2026-03-29T01:00:00.000Z");
    expect(result[4].bucket).toBe("2026-03-29T02:00:00.000Z");
    expect(result[23].bucket).toBe("2026-03-29T21:00:00.000Z");
    expect(result.every((b) => b.n === 0)).toBe(true);
  });

  it("fills a gap in a month-granularity range with zeros, crossing the spring DST change", () => {
    const rows = [
      { bucket: "2025-12-31T23:00:00.000Z", n: 10 }, // Zurich 2026-01-01 00:00 CET
      { bucket: "2026-03-31T22:00:00.000Z", n: 20 }, // Zurich 2026-04-01 00:00 CEST
    ];
    const result = fillTrendGaps(rows, "month", "2026-01-01", "2026-05-01");
    expect(result).toEqual([
      { bucket: "2025-12-31T23:00:00.000Z", n: 10 },
      { bucket: "2026-01-31T23:00:00.000Z", n: 0 }, // Zurich 2026-02-01 00:00 CET
      { bucket: "2026-02-28T23:00:00.000Z", n: 0 }, // Zurich 2026-03-01 00:00 CET
      { bucket: "2026-03-31T22:00:00.000Z", n: 20 },
    ]);
  });

  it("passes through unchanged when rows exactly match every expected bucket", () => {
    const rows = [
      { bucket: "2026-08-09T22:00:00.000Z", n: 1 }, // Zurich 2026-08-10
      { bucket: "2026-08-10T22:00:00.000Z", n: 2 }, // Zurich 2026-08-11
      { bucket: "2026-08-11T22:00:00.000Z", n: 3 }, // Zurich 2026-08-12
    ];
    const result = fillTrendGaps(rows, "day", "2026-08-10", "2026-08-13");
    expect(result).toEqual(rows);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/adminStats.test.ts`
Expected: FAIL — the existing implementation still produces UTC-anchored (`T00:00:00.000Z`-style) buckets, not the Zurich-anchored ones above.

- [ ] **Step 3: Update the implementation**

In `src/lib/adminStats.ts`, add the import and replace `fillTrendGaps`'s body:

```ts
import { zurichWallToUTC } from "./zurichTime";
```

```ts
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/adminStats.test.ts`
Expected: PASS (all `selectGranularity` and `fillTrendGaps` tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/adminStats.ts src/lib/adminStats.test.ts
git commit -m "feat: bucket the admin trend chart in Europe/Zurich time

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: `presetRange` — Zurich "today"

**Files:**
- Modify: `src/lib/adminRanges.ts`
- Test: `src/lib/adminRanges.test.ts`

**Interfaces:**
- Consumes: `zurichParts(instant: Date): ZurichParts` from Task 1 (`src/lib/zurichTime.ts`).
- Produces: `presetRange` keeps its existing signature (`(key: PresetKey, today: Date) => { from: string; to: string }`) and its date strings are still plain `YYYY-MM-DD`; downstream (`fillTrendGaps`, `route.ts`) already treats them as Zurich calendar dates as of Tasks 2/4.

- [ ] **Step 1: Write the failing tests**

In `src/lib/adminRanges.test.ts`, add these two cases inside the existing `describe("presetRange", ...)` block (after the `"30d with leap-year..."` test, before its closing `});`):

```ts
  it("today: uses the Zurich calendar day, not the UTC one, near midnight in summer (CEST)", () => {
    // 2026-08-10T23:00Z is already 2026-08-11 01:00 CEST in Zurich.
    const lateUTC = new Date(Date.UTC(2026, 7, 10, 23, 0));
    expect(presetRange("today", lateUTC)).toEqual({ from: "2026-08-11", to: "2026-08-12" });
  });

  it("today: uses the Zurich calendar day, not the UTC one, near midnight in winter (CET)", () => {
    // 2026-01-10T23:30Z is already 2026-01-11 00:30 CET in Zurich.
    const lateUTC = new Date(Date.UTC(2026, 0, 10, 23, 30));
    expect(presetRange("today", lateUTC)).toEqual({ from: "2026-01-11", to: "2026-01-12" });
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/adminRanges.test.ts`
Expected: FAIL — the current UTC-based implementation returns `{ from: "2026-08-10", to: "2026-08-11" }` and `{ from: "2026-01-10", to: "2026-01-11" }` respectively.

- [ ] **Step 3: Update the implementation**

In `src/lib/adminRanges.ts`, add the import:

```ts
import { zurichParts } from "./zurichTime";
```

Replace the first line of `presetRange`'s body:

```ts
// was:
export function presetRange(key: PresetKey, today: Date): { from: string; to: string } {
  const todayMidnight = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));

// becomes:
export function presetRange(key: PresetKey, today: Date): { from: string; to: string } {
  const zp = zurichParts(today);
  const todayMidnight = new Date(Date.UTC(zp.year, zp.month - 1, zp.day));
```

Everything below that line (the `switch`, `addDays`, the month/year-start `Date.UTC` calls, `toISODate`) is unchanged — it was already pure calendar-field arithmetic on a scratch `Date` used purely as calendar labels, never as a real instant; only where those labels come from (Zurich fields instead of UTC fields) changes.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/adminRanges.test.ts`
Expected: PASS (all `presetRange`, `PRESETS`, and `formatRangeLabel` tests, including the two new ones).

- [ ] **Step 5: Commit**

```bash
git add src/lib/adminRanges.ts src/lib/adminRanges.test.ts
git commit -m "feat: anchor admin range presets to the Zurich calendar day

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: `route.ts` — Zurich-anchored SQL filters and bucketing

**Files:**
- Modify: `src/app/api/admin/stats/route.ts`
- Test: `src/app/api/admin/stats/route.test.ts`

**Interfaces:**
- Consumes: nothing new from earlier tasks directly (the SQL text change is self-contained); relies on `fillTrendGaps` (Task 2) already being Zurich-aware so `trend` in the response is internally consistent with the new bucket SQL.
- Produces: same route behavior/response shape; only the SQL text and the real instants it selects change.

- [ ] **Step 1: Write the failing test**

In `src/app/api/admin/stats/route.test.ts`, add this test inside the `describe("GET /api/admin/stats", ...)` block, after the `"runs the aggregation queries..."` test:

```ts
  it("anchors every range filter and the trend bucketing to Europe/Zurich", async () => {
    process.env.POSTGRES_URL = "postgres://test";
    const fakeSql = vi.fn(() => Promise.resolve([]));
    vi.mocked(db.getSql).mockReturnValue(fakeSql as unknown as ReturnType<typeof db.getSql>);

    await GET(makeRequest("from=2026-07-12&to=2026-08-11"));

    const queryTexts = (fakeSql.mock.calls as [TemplateStringsArray][]).map(([strings]) => strings.join("?"));
    expect(queryTexts.length).toBe(11); // total + trend + 9 breakdowns
    for (const text of queryTexts) {
      expect(text).toContain("AT TIME ZONE 'Europe/Zurich'");
    }
    expect(queryTexts.some((t) => t.includes("date_trunc"))).toBe(true);
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/app/api/admin/stats/route.test.ts`
Expected: FAIL — the current SQL text contains no `"AT TIME ZONE"` at all.

- [ ] **Step 3: Update the implementation**

In `src/app/api/admin/stats/route.ts`, replace the `try` block's query array (the 11 `sql\`...\`` calls) with:

```ts
    const sql = getSql();
    [
      totalRows, trendRows, regionRows, ageRows, franchiseRows, modelRows, accidentRows,
      languageRows, currentInsurerRows, premiumBandRows, ageGroupRows,
    ] = (await Promise.all([
      sql`SELECT COUNT(*)::int AS total FROM inquiry_log WHERE ts >= (${from}::date AT TIME ZONE 'Europe/Zurich') AND ts < (${to}::date AT TIME ZONE 'Europe/Zurich')`,
      sql`SELECT date_trunc(${granularity}, ts AT TIME ZONE 'Europe/Zurich') AT TIME ZONE 'Europe/Zurich' AS bucket, COUNT(*)::int AS n FROM inquiry_log WHERE ts >= (${from}::date AT TIME ZONE 'Europe/Zurich') AND ts < (${to}::date AT TIME ZONE 'Europe/Zurich') GROUP BY 1 ORDER BY 1`,
      sql`SELECT region_id AS "regionId", COUNT(*)::int AS n FROM inquiry_log WHERE ts >= (${from}::date AT TIME ZONE 'Europe/Zurich') AND ts < (${to}::date AT TIME ZONE 'Europe/Zurich') GROUP BY 1 ORDER BY 2 DESC LIMIT 10`,
      sql`SELECT altersklasse, COUNT(*)::int AS n FROM inquiry_log WHERE ts >= (${from}::date AT TIME ZONE 'Europe/Zurich') AND ts < (${to}::date AT TIME ZONE 'Europe/Zurich') GROUP BY 1 ORDER BY 2 DESC`,
      sql`SELECT franchise, COUNT(*)::int AS n FROM inquiry_log WHERE ts >= (${from}::date AT TIME ZONE 'Europe/Zurich') AND ts < (${to}::date AT TIME ZONE 'Europe/Zurich') GROUP BY 1 ORDER BY 1`,
      sql`SELECT unnest(models) AS model, COUNT(*)::int AS n FROM inquiry_log WHERE ts >= (${from}::date AT TIME ZONE 'Europe/Zurich') AND ts < (${to}::date AT TIME ZONE 'Europe/Zurich') GROUP BY 1 ORDER BY 2 DESC`,
      sql`SELECT accident, COUNT(*)::int AS n FROM inquiry_log WHERE ts >= (${from}::date AT TIME ZONE 'Europe/Zurich') AND ts < (${to}::date AT TIME ZONE 'Europe/Zurich') GROUP BY 1`,
      sql`SELECT COALESCE(locale, 'unbekannt') AS locale, COUNT(*)::int AS n FROM inquiry_log WHERE ts >= (${from}::date AT TIME ZONE 'Europe/Zurich') AND ts < (${to}::date AT TIME ZONE 'Europe/Zurich') GROUP BY 1 ORDER BY 2 DESC`,
      sql`SELECT current_insurer AS "insurerCode", COUNT(*)::int AS n FROM inquiry_log WHERE ts >= (${from}::date AT TIME ZONE 'Europe/Zurich') AND ts < (${to}::date AT TIME ZONE 'Europe/Zurich') AND current_insurer IS NOT NULL GROUP BY 1 ORDER BY 2 DESC LIMIT 10`,
      sql`SELECT current_premium_band AS band, COUNT(*)::int AS n FROM inquiry_log WHERE ts >= (${from}::date AT TIME ZONE 'Europe/Zurich') AND ts < (${to}::date AT TIME ZONE 'Europe/Zurich') AND current_premium_band IS NOT NULL GROUP BY 1`,
      sql`SELECT age_group AS "ageGroup", COUNT(*)::int AS n FROM inquiry_log WHERE ts >= (${from}::date AT TIME ZONE 'Europe/Zurich') AND ts < (${to}::date AT TIME ZONE 'Europe/Zurich') AND age_group IS NOT NULL GROUP BY 1`,
    ])) as [
      TotalRow[], TrendRow[], RegionRow[], AgeRow[], FranchiseRow[], ModelRow[], AccidentRow[],
      LanguageRow[], CurrentInsurerRow[], PremiumBandRow[], AgeGroupRow[],
    ];
```

(Only the `WHERE`/bucket fragments change — column lists, aliases, `GROUP BY`/`ORDER BY`/`LIMIT` clauses, and the `NOT NULL` filters are untouched.)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/app/api/admin/stats/route.test.ts`
Expected: PASS (all existing tests plus the new one — the existing `"runs the aggregation queries..."` test still passes unchanged since it matches on the same column-name substrings, and its `expectedTrend` is computed by calling the real, now-Zurich-aware `fillTrendGaps` itself).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/admin/stats/route.ts src/app/api/admin/stats/route.test.ts
git commit -m "feat: anchor the admin stats API's date range filters to Europe/Zurich

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: `TrendChart.tsx` — Zurich-anchored axis labels

**Files:**
- Modify: `src/components/admin/TrendChart.tsx`

**Interfaces:**
- Consumes: `zurichParts(instant: Date): ZurichParts` from Task 1 (`src/lib/zurichTime.ts`).
- Produces: no external interface change — `TrendChart`'s props and rendering are unchanged, only the label text's time zone.

There's no existing test file for this component (none of the admin components have one; the repo's convention here is visual/E2E verification, done in Step 3 below).

- [ ] **Step 1: Update the implementation**

In `src/components/admin/TrendChart.tsx`, add the import:

```ts
import { zurichParts } from "@/lib/zurichTime";
```

Replace `formatBucketLabel`:

```ts
// was:
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

// becomes:
function formatBucketLabel(iso: string, granularity: Granularity): string {
  const d = new Date(iso);
  if (granularity === "hour") {
    return d.toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Zurich" });
  }
  const zp = zurichParts(d);
  if (granularity === "month") {
    return `${MONTHS_DE[zp.month - 1]} ${zp.year}`;
  }
  return `${zp.day} ${MONTHS_DE[zp.month - 1]}`;
}
```

- [ ] **Step 2: Typecheck and lint**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npx eslint src/components/admin/TrendChart.tsx`
Expected: no errors.

- [ ] **Step 3: Visually verify in the running app**

Use the `run` skill (or `npm run dev`) to start the app, sign in at `/admin/login`, open `/admin`, and check the "Anfragen über Zeit" chart's x-axis: hourly-granularity labels (select "Heute") should read Zurich clock time, which — since this is being verified in August (CEST) — should be 2 hours ahead of what the same data would have shown in UTC before this change.

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/TrendChart.tsx
git commit -m "feat: render the admin trend chart's axis labels in Europe/Zurich time

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: Update `architecture.md` §13.2

**Files:**
- Modify: `architecture.md:412-500`

**Interfaces:** none — documentation only.

- [ ] **Step 1: Update the section**

In `architecture.md`, replace the paragraph at lines 416–418:

```markdown
Both `from` and `to` are required ISO-8601 date strings (`YYYY-MM-DD`). The route
validates them server-side and returns 400 on invalid input. All queries are
parameterised — no string interpolation.
```

with:

```markdown
Both `from` and `to` are required ISO-8601 date strings (`YYYY-MM-DD`),
interpreted as **Europe/Zurich calendar dates** (Bern/Zurich local time, not
UTC) — every query wraps them as `$1::date AT TIME ZONE 'Europe/Zurich'` /
`$2::date AT TIME ZONE 'Europe/Zurich'` so the range boundary lands on the
correct real instant regardless of the DB session's own timezone setting.
The route validates them server-side and returns 400 on invalid input. All
queries are parameterised — no string interpolation.
```

Then replace the SQL code block (lines 430–500) with the same 10 queries, each `WHERE ts >= $1 AND ts < $2` replaced by `WHERE ts >= ($1::date AT TIME ZONE 'Europe/Zurich') AND ts < ($2::date AT TIME ZONE 'Europe/Zurich')` (and the `AND current_insurer IS NOT NULL` / `AND current_premium_band IS NOT NULL` / `AND age_group IS NOT NULL` suffixes kept where they already existed), and query 2's `date_trunc` line updated to:

```sql
-- 2. Trend series (granularity substituted server-side as date_trunc argument;
--    bucketed in Europe/Zurich, matching the range filter above)
SELECT date_trunc($3, ts AT TIME ZONE 'Europe/Zurich') AT TIME ZONE 'Europe/Zurich' AS bucket, COUNT(*) AS n
FROM inquiry_log
WHERE ts >= ($1::date AT TIME ZONE 'Europe/Zurich') AND ts < ($2::date AT TIME ZONE 'Europe/Zurich')
GROUP BY 1 ORDER BY 1;
```

- [ ] **Step 2: Commit**

```bash
git add architecture.md
git commit -m "docs: document Europe/Zurich date handling in admin stats API (§13.2)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 7: Full verification

**Files:** none (verification only).

- [ ] **Step 1: Run the full test suite**

Run: `npx vitest run`
Expected: all tests pass, including the new/updated ones in Tasks 1–4.

- [ ] **Step 2: Typecheck and lint the whole project**

Run: `npx tsc --noEmit && npx eslint .`
Expected: no errors.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 4: Grep for any remaining UTC-based admin-dashboard time handling**

Run: `grep -rn "getUTC\|Date.UTC\|timeZone: \"UTC\"" src/lib/adminStats.ts src/lib/adminRanges.ts src/components/admin/TrendChart.tsx`

Expected: only the intentionally-unchanged `selectGranularity` (in `adminStats.ts`) and the calendar-scratch-`Date` usages inside `fillTrendGaps`/`presetRange` that are explicitly documented as pure label arithmetic, not real-instant math (Tasks 2–3). No `timeZone: "UTC"` should remain in `TrendChart.tsx`.

- [ ] **Step 5: No commit needed** (verification-only task).
