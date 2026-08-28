# Admin dashboard: finer age-group breakdown

**Date:** 2026-08-28
**Status:** approved (design)

## Problem

The admin dashboard's only age view is the KVG `Altersklasse` panel with three
buckets (`kind` 0–18, `jung` 19–25, `erwachsen` 26+). That is all the basic-insurance
premium tariff distinguishes, but for usage analytics we want a finer picture of
who is using the comparator — newborns vs. teenagers vs. retirees all collapse
into two buckets today.

## Goal

Add a finer, life-stage age breakdown to the admin dashboard, derived from the
visitor's birth year, **without** storing the birth year or any re-identifiable
age. Follow the existing "bucket in the browser, store only the band string"
pattern already used for `current_premium_band` (REQ-21).

## Key decisions

- **Nine life-stage buckets:** `0`, `1-5`, `6-12`, `13-18`, `19-25`, `26-35`,
  `36-50`, `51-65`, `66+`. Boundaries nest cleanly inside the KVG bands (`13-18`
  ends where `kind` ends; `19-25` equals `jung`), so the two panels never
  contradict each other.
- **Age is measured at the time of the visit.** Unlike `altersklasse` — which
  uses "age reached during the *selected premium year*" and shifts when the user
  toggles to next-year premiums (REQ-16) — the age group uses
  `new Date().getFullYear() - birthYear`, independent of the premium-year toggle.
  Birth year (not birth date) is the only input available, so this is "the age
  the visitor reaches this calendar year" — stable regardless of visit month.
- **Privacy unchanged.** The raw birth year never leaves the browser. Only the
  band string is sent and stored, exactly as with `current_premium_band`.
- **New panel, not a replacement.** The KVG `Altersklasse` panel stays; a new
  full-width `Altersgruppe` panel is added below it.
- **Pre-migration rows** have `age_group = NULL` and are excluded from the panel
  (same treatment as `current_insurer`). Every inquiry logged after the
  migration carries an age group, so no caveat copy is needed long-term.

## Components

### `src/lib/ageGroup.ts` (new)

```ts
export type AgeGroup =
  | "0" | "1-5" | "6-12" | "13-18" | "19-25" | "26-35" | "36-50" | "51-65" | "66+";

export const AGE_GROUPS: readonly AgeGroup[] = [
  "0", "1-5", "6-12", "13-18", "19-25", "26-35", "36-50", "51-65", "66+",
]; // youngest → oldest; drives dashboard row order

export function getAgeGroup(birthYear: number, visitYear: number): AgeGroup {
  const age = visitYear - birthYear;
  if (age <= 0)  return "0";        // newborns (and defensively negative)
  if (age <= 5)  return "1-5";
  if (age <= 12) return "6-12";
  if (age <= 18) return "13-18";
  if (age <= 25) return "19-25";
  if (age <= 35) return "26-35";
  if (age <= 50) return "36-50";
  if (age <= 65) return "51-65";
  return "66+";
}
```

Pure. `visitYear` is passed in so tests are deterministic; the comparator passes
`new Date().getFullYear()`.

### `src/lib/inquiryLog.ts`

- `InquiryLogPayload` gains `ageGroup: AgeGroup`. It has the same precondition as
  `altersklasse` (both derive from a valid birth year), so it is always present
  when the payload builds.
- `buildInquiryLogPayload` takes `ageGroup: string | null` as an input field and
  copies it onto the payload. The existing `if (!altersklasse) return null` guard
  already covers the "no birth year yet" case.

### `src/components/InsuranceComparator.tsx`

- Compute `const visitYear = new Date().getFullYear()` and
  `const ageGroup = parsedBirthYear ? getAgeGroup(parsedBirthYear, visitYear) : null;`
  next to the existing `altersklasse` derivation (~line 88). **Do not** use the
  `year` state variable here.
- Pass `ageGroup` into the `buildInquiryLogPayload({ ... })` call (~line 166) and
  add it to that `useMemo`'s dependency array.

### `src/app/api/log-inquiry/route.ts`

- `InquiryPayload` gains optional `ageGroup?: string`.
- Validate like `locale`: absent is allowed (stored `NULL`); if present it must be
  in `AGE_GROUPS`.
- `INSERT` adds the `age_group` column, value `${body.ageGroup ?? null}`.

### `scripts/migrateSql.ts`

Append to `ALTER_TABLE_SQL`:

```
ALTER TABLE inquiry_log ADD COLUMN IF NOT EXISTS age_group TEXT;
```

### `src/app/api/admin/stats/route.ts`

- New `AgeGroupRow = { ageGroup: string; n: number }`.
- New query, added to the `Promise.all`:
  ```sql
  SELECT age_group AS "ageGroup", COUNT(*)::int AS n
  FROM inquiry_log
  WHERE ts >= ${from} AND ts < ${to} AND age_group IS NOT NULL
  GROUP BY 1
  ```
- Add `ageGroups: []` to the no-DB empty payload and `ageGroups: ageGroupRows` to
  the success response.

### `src/components/admin/Dashboard.tsx`

- `Stats` type gains `ageGroups: { ageGroup: string; n: number }[]`.
- `AGE_GROUP_LABEL` map: `0` → "Neugeboren (0)", `1-5` → "1–5 Jahre",
  `6-12` → "6–12 Jahre", `13-18` → "13–18 Jahre", `19-25` → "19–25 Jahre",
  `26-35` → "26–35 Jahre", `36-50` → "36–50 Jahre", `51-65` → "51–65 Jahre",
  `66+` → "66+ Jahre".
- `orderedAgeGroupRows(rows)` helper mirroring `orderedBandRows` — orders by
  `AGE_GROUPS`, drops groups with no rows.
- New full-width card `<h2>Altersgruppe</h2>` with `<BreakdownBar>` (normal label
  width), inserted **after** the "Top 10 Prämienregionen / Altersklasse" grid and
  **before** the Franchise/Model grid. Percentages are relative to the sum of the
  age-group rows (no `total` prop), matching the premium-band panel.

### `mockups/admin.html`

Add the matching `Altersgruppe` card with representative static counts, same
placement and markup as the component (mockup is kept 1:1 with the dashboard).

### Docs

- **requirement.md**
  - REQ-21: add to the recorded-fields sentence — "a coarse age group based on the
    visitor's age at the time of the visit (nine life-stage buckets, computed in
    the browser)".
  - REQ-22: add "breakdown by Altersgruppe" to the panel list.
- **architecture.md**
  - §10.1 inquiry payload: add `ageGroup`.
  - §10.3 columns: add `age_group TEXT` (nullable; pre-migration rows are NULL).
  - §7 / §13 panel lists: add the Altersgruppe panel.
  - Function list: add `getAgeGroup(birthYear, visitYear)`.
  - ASCII dashboard sketch: add the panel if space allows.

## Testing (TDD — tests written first)

- `src/lib/ageGroup.test.ts` — every bucket boundary; newborn (`age <= 0`);
  defensive negative age; that it uses the passed `visitYear` verbatim (no
  calendar-year-shift like `getAltersklasse`).
- `src/lib/inquiryLog.test.ts` — payload carries `ageGroup`; still returns `null`
  when there is no birth year.
- `src/app/api/log-inquiry/route.test.ts` — stores a valid `age_group`; rejects an
  unknown value with 400; absent `ageGroup` → stored `NULL`.
- `src/app/api/admin/stats/route.test.ts` — updated response shape (both the
  empty-payload and populated `toEqual`); the mocked query matcher returns an
  `ageGroups` fixture; `age_group IS NOT NULL` present in the SQL.
- `scripts/migrateSql.test.ts` — `ALTER_TABLE_SQL` contains
  `ADD COLUMN IF NOT EXISTS age_group`.

No `Dashboard.test.tsx` exists; none is added (consistent with the existing
panels, which are covered via the mockup + route tests).

## Out of scope

- Backfilling `age_group` for pre-migration rows (impossible — birth year was
  never stored).
- Any change to `altersklasse` or the KVG age-band logic.
- Storing birth year or exact age.
