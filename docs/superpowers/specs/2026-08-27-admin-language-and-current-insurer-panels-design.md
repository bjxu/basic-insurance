# Admin dashboard: language & current-insurer panels

**Date:** 2026-08-27
**Status:** Approved, ready for planning
**Touches:** REQ-21, REQ-22, architecture.md §10, §13

## Goal

Add three aggregate breakdowns to the `/admin` dashboard:

1. **Anfragen pro Sprache** — inquiry count by UI locale.
2. **Aktuelle Krankenkasse** — distribution of the current insurer the user
   selected in the optional current-plan section (only inquiries where one was
   given).
3. **Aktuelle Prämie** — distribution of the user's self-reported current
   premium, bucketed into coarse bands.

This requires logging three new fields on `inquiry_log`, which reverses part of
REQ-21's original "no current-plan fields" rule (see §6).

## 1. Data model

Three new **nullable** columns on `inquiry_log`. `scripts/migrateSql.ts` gains a
new exported constant `ALTER_TABLE_SQL` holding three
`ALTER TABLE inquiry_log ADD COLUMN IF NOT EXISTS <col> TEXT;` statements (run one
per `sql.query(...)` call, since neon's `.query` takes a single statement).
`scripts/migrate.ts` runs them after `CREATE_TABLE_SQL` and before/after the
index. The three columns are **also** added to the `CREATE_TABLE_SQL` body so a
fresh database and a migrated one converge.

| Column                 | Type   | Meaning |
|------------------------|--------|---------|
| `locale`               | `TEXT` | UI locale at inquiry time. One of `de`/`fr`/`it`/`en`/`pt`/`es`. Null only for rows written before this migration. |
| `current_insurer`      | `TEXT` | BAG insurer code from the current-plan section. Null = user gave no current insurer. |
| `current_premium_band` | `TEXT` | One of `<250`, `250-349`, `350-449`, `450-549`, `550+`. Null = user gave no current premium. |

- The **raw premium is never sent to the server** — the client computes the band.
- No new index. Every breakdown is a full scan of a `ts`-filtered range, exactly
  like the existing region/age/franchise/model/accident queries.

### Band definition

| Band       | Condition (CHF/month) |
|------------|-----------------------|
| `<250`     | `0 < chf < 250`       |
| `250-349`  | `250 <= chf < 350`    |
| `350-449`  | `350 <= chf < 450`    |
| `450-549`  | `450 <= chf < 550`    |
| `550+`     | `chf >= 550`          |

`chf <= 0` or non-finite → no band (null).

## 2. Client → API

### New pure helper: `src/lib/premiumBand.ts`

```ts
export type PremiumBand = "<250" | "250-349" | "350-449" | "450-549" | "550+";
export const PREMIUM_BANDS: PremiumBand[] = ["<250", "250-349", "350-449", "450-549", "550+"];
export function premiumBand(chf: number): PremiumBand | null;
```

Returns null for non-finite or `<= 0`. Unit-tested at every boundary.

### `src/lib/inquiryLog.ts`

`buildInquiryLogPayload` input gains:

- `locale: string`
- `currentInsurerCode: string | null`
- `currentMonthlyPremium: number | null`

`InquiryLogPayload` gains:

- `locale: string` — always present
- `currentInsurer?: string` — included only when `currentInsurerCode` is a
  non-empty string
- `currentPremiumBand?: PremiumBand` — included only when
  `premiumBand(currentMonthlyPremium)` returns non-null

The "is there a loggable query yet" gate (region + altersklasse + franchise) is
unchanged. The current-plan fields never affect whether a payload is produced.

### `src/components/InsuranceComparator.tsx`

The existing debounced log effect (around line 161) passes `locale` (already
available via `useLocale()`), `currentPlan.insurerCode`, and
`currentPlan.monthlyPremium` into `buildInquiryLogPayload`.

**`currentPlan` stays out of the effect's dependency array** (the existing
`eslint-disable react-hooks/exhaustive-deps` and deps list are unchanged). The
effect re-runs only on the current triggers (region/age/franchise/year/models/
accident/premium-data-loaded); when it runs it reads whatever `currentPlan`
values exist in that render's closure. Consequence, accepted during
brainstorming: a current plan entered *after* the last trigger fire is not
captured until the next trigger fires. No new re-log trigger — total inquiry
counts are unaffected.

### `src/app/api/log-inquiry/route.ts`

Extend `isValidPayload` / the schema:

- `locale` — **required**, must be one of
  `["de","fr","it","en","pt","es"]` (import `routing.locales`). Missing/invalid → 400.
- `currentInsurer` — optional; if present, must be a `string` matching an
  `insurerCode` in `src/data/insurers.json`. Invalid → 400.
- `currentPremiumBand` — optional; if present, must be one of `PREMIUM_BANDS`.
  Invalid → 400.

`INSERT` writes `locale`, `current_insurer`, `current_premium_band`, passing
`null` for the two optional fields when absent.

`InquiryPayload` type updated to match.

## 3. Stats API — `src/app/api/admin/stats/route.ts`

Three new queries added to the `Promise.all`, parameterised and `ts`-filtered
like the rest:

```sql
-- language
SELECT COALESCE(locale, 'unbekannt') AS locale, COUNT(*)::int AS n
FROM inquiry_log
WHERE ts >= ${from} AND ts < ${to}
GROUP BY 1 ORDER BY 2 DESC;

-- current insurer (only rows where one was given), top 10
SELECT current_insurer AS "insurerCode", COUNT(*)::int AS n
FROM inquiry_log
WHERE ts >= ${from} AND ts < ${to} AND current_insurer IS NOT NULL
GROUP BY 1 ORDER BY 2 DESC LIMIT 10;

-- current premium band (only rows where one was given)
SELECT current_premium_band AS band, COUNT(*)::int AS n
FROM inquiry_log
WHERE ts >= ${from} AND ts < ${to} AND current_premium_band IS NOT NULL
GROUP BY 1;
```

Response JSON gains:

```ts
languages: { locale: string; n: number }[];
currentInsurers: { insurerCode: string; n: number }[];
premiumBands: { band: string; n: number }[];
```

The no-`POSTGRES_URL` early-return payload gains the same three keys as empty
arrays. The `catch` behaviour is unchanged.

## 4. Dashboard UI — `src/components/admin/Dashboard.tsx`

`Stats` type gains the three new fields. Three new `BreakdownBar` panels appended
after the existing franchise/model grid. Copy is **German** (admin dashboard is
German-only per REQ-25).

- **"Anfragen pro Sprache"** — own full-width card. Label map:
  `de→Deutsch, fr→Français, it→Italiano, en→English, pt→Português, es→Español,
  unbekannt→Unbekannt`. Unknown/other keys fall through to the raw value.
- **"Aktuelle Krankenkasse"** — half-width card, paired with the premium panel in
  a 2-col grid. A `text-body-small text-outline` subtitle: "nur Anfragen mit
  angegebenem aktuellem Plan". Insurer code → name via a map built from
  `insurersData` (imported from `@/data/insurers.json`, same as the comparator).
  Unknown code falls through to the raw code.
- **"Aktuelle Prämie"** — half-width card. Rows ordered by `PREMIUM_BANDS`
  (ascending), not by count. Label: `CHF <250`, `CHF 250–349`, … `CHF 550+`
  (en-dash). Bands absent from the data are simply omitted (no zero rows).

Skeleton/stale-data behaviour is inherited from the existing wrapper — no change.

## 5. Mockup — `mockups/admin.html`

Add the three panels to the static mockup so it stays in parity with the
component (the admin components carry a "matches mockups/admin.html exactly"
contract). Match existing card markup/classes.

## 6. Requirements & architecture changes

### REQ-21 (requirement.md)

Current text says the log "does **not** record IP address, the optional
current-plan fields, or any other data not needed for aggregate usage analysis."

Amended to: the log additionally records **the UI language, the selected current
insurer (BAG code only), and a coarse band of the self-reported current premium**
(five ~100-CHF buckets). It still does **not** record IP address, the **exact**
current premium, any free-text, or any join key back to a user or session. The
premium is bucketed client-side; the exact figure never reaches the server.
Purpose is unchanged: aggregate usage analysis only, never sold or shared.

### architecture.md §10.3

Add the three columns to the schema block and a sentence noting the premium is
banded in the browser.

### architecture.md §13.2 / §13.4

Add the three new queries to the SQL list and the three panels to the layout
description / ASCII diagram.

## 7. Tests

| File | Coverage |
|------|----------|
| `src/lib/premiumBand.test.ts` (new) | Every band boundary (249.99, 250, 349.99, 350, …, 550), `0`, negative, `NaN`, `Infinity`. |
| `src/lib/inquiryLog.test.ts` | `locale` always in payload; `currentInsurer` present only with a code; `currentPremiumBand` present only with a valid premium; absent keys omitted (not `undefined` set). |
| `src/app/api/log-inquiry/route.test.ts` | Missing `locale` → 400; bad `locale` → 400; unknown `currentInsurer` code → 400; bad band → 400; valid full payload → 204; valid payload with neither optional field → 204. |
| `src/lib/adminStats.test.ts` | Unchanged helpers still pass (no logic change there — verify only). |
| `src/app/api/admin/stats/route.test.ts` | Response contains `languages`, `currentInsurers`, `premiumBands`; no-`POSTGRES_URL` payload has them as `[]`. |
| `scripts/migrateSql.test.ts` | `CREATE_TABLE_SQL` declares the three new columns; `ALTER_TABLE_SQL` contains an idempotent `ADD COLUMN IF NOT EXISTS` for each of `locale`, `current_insurer`, `current_premium_band`. |

## 8. Out of scope

- Backfilling `locale` for historical rows (they show as "Unbekannt").
- Any UI to filter the dashboard by language/insurer — these are read-only
  breakdowns.
- Logging the exact premium, plan model of the current plan, or franchise of the
  current plan.
- Translating the admin dashboard.
