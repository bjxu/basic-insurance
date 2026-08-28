# Admin dashboard: age-distribution panel

**Date:** 2026-08-28
**Status:** Approved, ready for planning
**Touches:** REQ-21, REQ-22, architecture.md §10, §13
**Stacked on:** branch `worktree-admin-age-distribution` (forked from `worktree-admin-language-current-insurer-panels` HEAD `ce10a32`, which is PR #36). This feature's PR targets that branch and merges after #36.

## Goal

Add a finer age-distribution panel ("Altersverteilung") to the `/admin`
dashboard, alongside the existing 3-way "Altersklasse" (Kind/Jung/Erwachsen)
panel. The age is bucketed into eight coarse bands **client-side** from the
birth year the user entered; the birth year and exact age are never sent to the
server.

## 1. Data model

One new **nullable** column on `inquiry_log`:

| Column     | Type   | Meaning |
|------------|--------|---------|
| `age_band` | `TEXT` | One of `0-18`, `19-25`, `26-35`, `36-45`, `46-55`, `56-65`, `66-75`, `76+`. Null for rows written before this migration. |

Added exactly like PR #36's three columns:
- appended to `CREATE_TABLE_SQL` in `scripts/migrateSql.ts`
- a fourth entry in `ALTER_TABLE_SQL`: `ALTER TABLE inquiry_log ADD COLUMN IF NOT EXISTS age_band TEXT;`
- `scripts/migrate.ts` already loops over `ALTER_TABLE_SQL`, no change needed there

No index — the age-distribution query is a full scan of a `ts`-filtered range
like every other breakdown.

### Band definition

`age = activeYear − birthYear` (identical to `getAltersklasse` in
`src/lib/ageband.ts`).

| Band     | Condition |
|----------|-----------|
| `0-18`   | `age <= 18` |
| `19-25`  | `19 <= age <= 25` |
| `26-35`  | `26 <= age <= 35` |
| `36-45`  | `36 <= age <= 45` |
| `46-55`  | `46 <= age <= 55` |
| `56-65`  | `56 <= age <= 65` |
| `66-75`  | `66 <= age <= 75` |
| `76+`    | `age >= 76` |

`age < 0` (future birth year) or non-finite → no band (null). `validateBirthYear`
already rejects future years and ages > 120 upstream, so the builder normally
only sees plausible ages; the guard is defensive.

## 2. Client → API

### New pure helper: `src/lib/ageBand.ts`

```ts
export type AgeBand = "0-18" | "19-25" | "26-35" | "36-45" | "46-55" | "56-65" | "66-75" | "76+";
export const AGE_BANDS: readonly AgeBand[];   // the eight bands, ascending
export function ageBand(age: number): AgeBand | null;   // null when age < 0 or non-finite
```

Modelled on `src/lib/premiumBand.ts`. Unit-tested at every boundary.

### `src/lib/inquiryLog.ts`

`buildInquiryLogPayload`'s input object gains `birthYear: number | null`. It
already has `year`. `InquiryLogPayload` gains `ageBand?: AgeBand`.

After the existing `currentPremiumBand` block:

```ts
const band = input.birthYear != null ? ageBand(input.year - input.birthYear) : null;
if (band) {
  payload.ageBand = band;
}
```

The loggable-query gate (`region + altersklasse + franchise`) is unchanged.
Since `altersklasse` is required for a payload and is itself derived from a
valid birth year, `ageBand` is present on virtually every logged row; the
conditional is a guard, not an expected-empty case.

### `src/components/InsuranceComparator.tsx`

The debounced log effect passes `birthYear: parsedBirthYear` (already in scope,
line 87) into `buildInquiryLogPayload`.

**`parsedBirthYear` is NOT added to the effect's dependency array.** Consistent
with PR #36's decision for the current-plan fields: no new re-log trigger, so
inquiry counts stay comparable. The age band is captured opportunistically at
fire time — it refreshes whenever `altersklasse` or another trigger changes.
Consequence: editing the birth year *within* a band without crossing an
Altersklasse boundary (e.g. 1980 → 1975, both "erwachsen", `46-55` → `46-55`)
doesn't re-log; crossing a band boundary that isn't also an Altersklasse
boundary (e.g. 1980 → 1968, `46-55` → `56-65`, both "erwachsen") re-logs only on
the next unrelated trigger. Acceptable — the panel is a coarse aggregate.

### `src/app/api/log-inquiry/route.ts`

- `import { AGE_BANDS } from "@/lib/ageBand";` and
  `const AGE_BAND_VALUES: readonly string[] = AGE_BANDS;`
- `InquiryPayload` gains `ageBand?: string`.
- In `isValidPayload`, after the `currentPremiumBand` check:
  ```ts
  if (b.ageBand !== undefined) {
    if (typeof b.ageBand !== "string" || !AGE_BAND_VALUES.includes(b.ageBand)) return false;
  }
  ```
- The INSERT column list gains `age_band` at the end; `VALUES` gains
  `${body.ageBand ?? null}` in the matching position.

## 3. Stats API — `src/app/api/admin/stats/route.ts`

New row type: `type AgeBandRow = { band: string; n: number };`

New query appended to the `Promise.all` (and to the destructuring + `as [...]`
tuple), parameterised and `ts`-filtered like the rest:

```sql
SELECT age_band AS band, COUNT(*)::int AS n
FROM inquiry_log
WHERE ts >= ${from} AND ts < ${to} AND age_band IS NOT NULL
GROUP BY 1;
```

`IS NOT NULL` (not `COALESCE`) so pre-migration rows don't dominate the panel
as "unknown" — the panel reads as "inquiries since this shipped". Ordering is
client-side by `AGE_BANDS`.

Response JSON gains `ageBands: { band: string; n: number }[]`. The
no-`POSTGRES_URL` early-return payload gains `ageBands: []`. The `catch` (500)
is unchanged.

## 4. Dashboard UI — `src/components/admin/Dashboard.tsx`

- `Stats` type gains `ageBands: { band: string; n: number }[]`.
- `import { AGE_BANDS } from "@/lib/ageBand";`
- New module-level constant + helper, mirroring `PREMIUM_BAND_LABEL` /
  `orderedBandRows`:
  ```ts
  const AGE_BAND_LABEL: Record<string, string> = {
    "0-18": "0–18", "19-25": "19–25", "26-35": "26–35", "36-45": "36–45",
    "46-55": "46–55", "56-65": "56–65", "66-75": "66–75", "76+": "76+",
  };
  function orderedAgeBandRows(rows: { band: string; n: number }[]) {
    const byBand = new Map(rows.map((r) => [r.band, r.n]));
    return AGE_BANDS.filter((b) => byBand.has(b)).map((b) => ({
      label: AGE_BAND_LABEL[b] ?? b,
      value: byBand.get(b) ?? 0,
    }));
  }
  ```
- New panel **"Altersverteilung"** as a **full-width card** (like "Anfragen pro
  Sprache"), placed immediately after the Franchise/Versicherungsmodell
  `grid grid-cols-2` block and before the "Anfragen pro Sprache" card. Full
  width gives the eight bars room and leaves the existing
  Regionen/Altersklasse/Unfalldeckung cluster untouched. The existing layout is
  not restructured.
  ```tsx
  <div className="bg-surface border border-outline-variant rounded-lg shadow-sm p-5 mt-4">
    <h2 className="text-title-medium text-on-surface-variant uppercase tracking-wide mb-4">
      Altersverteilung
    </h2>
    <BreakdownBar labelWidth="short" rows={orderedAgeBandRows(stats?.ageBands ?? [])} total={stats?.total} />
  </div>
  ```
  `total={stats?.total}` — like the language panel, because `age_band` is present
  on essentially every post-migration row, so percentages are meaningful against
  the range total. (If a large backlog of pre-migration NULL rows is a concern
  for the first weeks, the panel simply reads slightly low until they age out of
  the default 30-day window — acceptable.)

The existing 3-way "Altersklasse" panel is **kept unchanged**.

## 5. Mockup — `mockups/admin.html`

Add an "Altersverteilung" card matching the existing `.card` / `.bar-chart` /
`.bar-row` pattern, placed after the Franchise/Model `grid-2` block, before the
language card. Eight illustrative rows in ascending band order, internally
consistent bar widths / percentages.

## 6. Requirements & architecture changes

### REQ-21 (requirement.md)

Extend the "additionally records" clause to include **a coarse age band (eight
groups) derived from the birth year**. Still no birth year, no exact age, no
join key. The band is computed in the browser.

### architecture.md

- **§10.2** — add `ageBand` to the optional-fields list.
- **§10.3** — add `age_band TEXT` (nullable) to the schema block; note it is one
  of the eight bands, bucketed client-side.
- **§13.2** — add the age-band query to the SQL list; note ordering is
  client-side.
- **§13.4** — add the "Altersverteilung" panel to the layout / inventory; note
  it complements (does not replace) the Altersklasse panel.

## 7. Tests

| File | Coverage |
|------|----------|
| `src/lib/ageBand.test.ts` (new) | Boundaries: `-1`, `0`, `18`, `19`, `25`, `26`, `35`, `36`, `45`, `55`, `56`, `65`, `66`, `75`, `76`, `130`; `NaN`, `Infinity`. `AGE_BANDS` order + length 8. |
| `src/lib/inquiryLog.test.ts` | `ageBand` present when `birthYear` set (assert a specific band from `year - birthYear`); omitted (`.not.toHaveProperty`) when `birthYear` is `null`; omitted when `year - birthYear < 0`. Update `BASE_INPUT` to include `birthYear`. |
| `src/app/api/log-inquiry/route.test.ts` | Bad `ageBand` → 400; valid `ageBand` stored (INSERT positional assertion grows to 10 elements); payload without `ageBand` still 204 with `null` in that position. Update `validPayload` / the existing INSERT assertions. |
| `src/app/api/admin/stats/route.test.ts` | Response contains `ageBands`; no-`POSTGRES_URL` payload has `ageBands: []`; `fakeSql` gains an `age_band` branch. Update both `.toEqual` objects. |
| `scripts/migrateSql.test.ts` | `CREATE_TABLE_SQL` declares `age_band`; `ALTER_TABLE_SQL` has an idempotent `ADD COLUMN IF NOT EXISTS age_band`. |

## 8. Out of scope

- Backfilling `age_band` for historical rows (they're excluded by `IS NOT NULL`).
- Storing birth year or exact age.
- Changing or removing the existing 3-way "Altersklasse" panel.
- Any dashboard filter by age band.
- Deriving the Altersklasse panel from `age_band` (the two stay independent;
  `altersklasse` remains a real premium-data dimension).

## 9. Deploy prerequisite

Same standing rule as PR #36 (architecture.md §14.1): `npm run db:migrate` must
run against the production `POSTGRES_URL` before this deploys, or the widened
INSERT fails against the pre-`age_band` table and all inquiry logging silently
stops. Because this stacks on PR #36, one migration run after both branches
merge covers all four new columns.
