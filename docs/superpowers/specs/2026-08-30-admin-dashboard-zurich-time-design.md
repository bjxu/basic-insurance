# Admin dashboard: switch time handling to Europe/Zurich

Date: 2026-08-30

## Problem

The admin dashboard ("Anfragen über Zeit" trend chart, the "Heute / 7 Tage / 30
Tage / Dieser Monat / 3 Monate / Dieses Jahr" range presets, and every stats
query's date range filter) currently operates entirely in UTC: the `ts >=
${from} AND ts < ${to}` filters, the trend query's `date_trunc(..., ts)`
bucketing, `fillTrendGaps`'s bucket generation, `presetRange`'s boundary math,
and the trend chart's axis labels are all UTC-based (`getUTC*`, `Date.UTC`,
`timeZone: "UTC"`).

Since the admin using this dashboard, and the business it describes, are both
in Switzerland, "Heute" should mean today in Bern/Zurich, hourly trend buckets
should align to Swiss clock hours, and the chart's axis labels should read in
Swiss local time — not UTC.

## Scope

Everything time-related in the admin dashboard moves to `Europe/Zurich`:

- The stats API's range filters (`from`/`to`) — still `YYYY-MM-DD` strings,
  now interpreted as Zurich calendar dates.
- The trend query's bucketing (`date_trunc`).
- `fillTrendGaps`'s gap-filled bucket boundaries.
- `presetRange`'s preset boundaries (Heute, 7 Tage, 30 Tage, Dieser Monat, 3
  Monate, Dieses Jahr).
- `TrendChart`'s x-axis bucket labels.

`selectGranularity` (which threshold — hour/day/month — to bucket at) is
explicitly **out of scope**: it only picks a bucket size from a day count, and
a few hours of UTC/Zurich skew right at the 2-day/90-day threshold has no
visible effect. It keeps its current UTC-based day-count math.

`formatRangeLabel` needs no change — it already only does date-string
arithmetic on `YYYY-MM-DD` values, which now consistently mean Zurich
calendar dates end-to-end (they always did mean *some* calendar date; the
change is which zone maps that date to a UTC instant range).

## New module: `src/lib/zurichTime.ts`

A small pure module, in the same hand-written style as `adminRanges.ts`,
providing the two primitives everything else is rebuilt on:

- **`zurichParts(instant: Date): { year, month, day, hour, minute, second }`**
  — the Europe/Zurich wall-clock reading of a UTC instant. Built on
  `Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Zurich', ... }).formatToParts()`
  (the same `Intl` machinery already used elsewhere for `de-CH` formatting,
  just a different zone/locale).
- **`zurichWallToUTC(year, month, day, hour = 0, minute = 0, second = 0): Date`**
  — the inverse: the UTC instant at which Zurich's wall clock reads those
  components. Computed with the standard two-pass technique: take
  `Date.UTC(...)` as a first guess, read that guess's Zurich offset via
  `zurichParts`, and correct once — safe across the DST boundary.

No new dependency — `Intl` with IANA timezone data is a runtime built-in.

### DST edge convention

Europe/Zurich has two DST transitions a year. `zurichWallToUTC` resolves the
two edge cases as follows, and this is a deliberate, documented choice rather
than an accident of the two-pass algorithm:

- **Spring forward** (nonexistent wall-clock hour, e.g. 2026-03-29 02:00–03:00
  does not exist): snaps forward, matching native `Date`'s own overflow
  behavior for out-of-range fields.
- **Fall back** (ambiguous wall-clock hour, e.g. 2026-10-25 02:00–03:00 occurs
  twice): resolves to its **first** occurrence (the earlier UTC offset).

This affects at most ~2 hours a year, visible only at hourly granularity on
those two specific dashboard days.

## SQL: `src/app/api/admin/stats/route.ts`

Every query's range filter changes from a bare-date comparison to an
explicit Zurich-anchored one:

```sql
-- was:
WHERE ts >= ${from} AND ts < ${to}

-- becomes:
WHERE ts >= (${from}::date AT TIME ZONE 'Europe/Zurich')
  AND ts <  (${to}::date AT TIME ZONE 'Europe/Zurich')
```

This makes `from`/`to` unambiguously mean Zurich calendar dates regardless of
the DB session's timezone setting (currently UTC by Neon default, but this
removes the dependency on that default entirely). All 11 queries in the route
get this same substitution.

The trend query's bucketing also moves to Zurich, using the standard
"bucket-in-a-zone" idiom:

```sql
-- was:
date_trunc(${granularity}, ts) AS bucket

-- becomes:
date_trunc(${granularity}, ts AT TIME ZONE 'Europe/Zurich') AT TIME ZONE 'Europe/Zurich' AS bucket
```

(`ts AT TIME ZONE 'Europe/Zurich'` converts the instant to a naive
Zurich-wall-clock timestamp; `date_trunc` truncates that; the outer
`AT TIME ZONE 'Europe/Zurich'` converts the truncated wall-clock value back to
a UTC instant. This is what `zurichWallToUTC`/`zurichParts` mirror on the JS
side, so JS-generated bucket boundaries and DB-generated bucket values line
up exactly.)

`route.test.ts` needs no structural changes — its mock matches on substrings
(`"date_trunc"`, `"altersklasse"`, etc.) that remain present.

## `fillTrendGaps` (`src/lib/adminStats.ts`)

Currently steps through buckets with fixed millisecond increments (or UTC
month increments via `Date.UTC`). Switches to stepping through **Zurich
wall-clock calendar units**, converting each boundary with `zurichWallToUTC`:

- `month`: start from `zurichParts(fromDate)`'s year/month; increment the
  month field; `zurichWallToUTC(y, m, 1)` each step.
- `day`: increment the Zurich day field; `zurichWallToUTC(y, m, d)` each step.
- `hour`: increment the Zurich hour field; `zurichWallToUTC(y, m, d, h)` each
  step.

This exactly mirrors the SQL bucket expression, including on DST days: a
`day` bucket naturally spans 23 or 25 hours, and the `hour` loop naturally
skips or repeats a wall-clock hour, matching `date_trunc(...,
ts AT TIME ZONE 'Europe/Zurich')`.

## `presetRange` (`src/lib/adminRanges.ts`)

Currently reads `today`'s **UTC** fields (`getUTCFullYear()` etc.) and steps
with `setUTCDate`/`Date.UTC`. Switches to reading `zurichParts(today)`'s
fields, and every boundary (`today`, `addDays`, month-start, year-start) is
built by incrementing Zurich calendar fields and converting with
`zurichWallToUTC` instead of the UTC equivalents.

`formatRangeLabel` is unchanged.

## `TrendChart.tsx`

`formatBucketLabel`:

- Hour branch: `toLocaleTimeString`'s `timeZone` option changes from
  `"UTC"` to `"Europe/Zurich"`.
- Day/month branches: `d.getUTCDate()`/`getUTCMonth()`/`getUTCFullYear()`
  replaced with `zurichParts(d)`'s `day`/`month`/`year`.

No other UI changes — same layout, same German labels, just Zurich-anchored
values feeding them.

## Testing

- New `zurichTime.test.ts`: wall-clock parts in both CET and CEST for known
  instants; wall→UTC round-trips; the documented spring-forward-snap and
  fall-back-first-occurrence conventions, pinned to concrete 2026 dates
  (2026-03-29 and 2026-10-25, Zurich's actual DST-change Sundays this year).
- `adminRanges.test.ts`: existing cases re-expressed with Zurich-anchored
  expected boundaries, plus a new case where a UTC "now" near midnight (e.g.
  23:30 UTC in summer = 01:30 CEST the next day) lands on the correct Zurich
  calendar day for `today`.
- `adminStats.test.ts`: existing `fillTrendGaps`/`selectGranularity` cases
  re-verified against Zurich boundaries, plus a new hourly-range case
  crossing 2026-10-25 (23 or 25 buckets, not silently wrong).
- `route.test.ts`: unaffected structurally.

## Docs

`architecture.md` §13.2 gets updated to document the `AT TIME ZONE
'Europe/Zurich'` convention and that `from`/`to` mean Zurich calendar dates,
replacing its current (now-inaccurate) plain-UTC description.
