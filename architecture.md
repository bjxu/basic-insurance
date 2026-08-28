# Technical Architecture — Basic Insurance

## 1. Overview

A statically-deployable single-page web app that looks up and compares Swiss
Grundversicherung premiums from officially published BAG open data. There is no
user-facing backend: premium data is ingested at build time and shipped as
pre-processed static assets. The only runtime work is in the browser (filtering,
sorting, URL state reconstruction) and on the edge (dynamic `<head>` metadata for
shared URLs).

---

## 2. Stack

| Layer | Choice | Rationale |
|---|---|---|
| Framework | Next.js 15 (App Router) | SSR/edge for dynamic `<head>` on parameterised URLs (REQ-18, REQ-19, REQ-20); file-based routing; built-in metadata API. |
| Language | TypeScript | End-to-end type safety across data model, lookup logic, and URL params. |
| Styling | Tailwind CSS | Utility-first; mobile-first responsive; no runtime style injection. |
| Data | Bundled JSON (build-time ETL) | BAG data is semi-static (published once a year); bundling avoids a runtime DB, keeps lookups effectively instant, and makes deployments self-contained. |
| Hosting | Vercel | Zero-config Next.js deployment; Edge Functions for per-request `<head>` generation; global CDN for static assets. |
| Data pipeline | Node.js ETL script (runs in CI) | Downloads BAG CSV exports, validates, transforms, writes typed JSON to `public/data/`. Checked into the repo as committed artefacts so the app works offline and deployments are reproducible. |
| Inquiry log | Vercel Postgres (serverless) | Append-only write from an API route; used solely for activity monitoring (REQ-21). |
| Charts | Recharts | Lightweight React charting library; used only in the admin dashboard. Tree-shaken from the public bundle. |

---

## 3. Data Model & Pipeline

### 3.1 Source files

Three BAG open-data datasets are ingested:

1. **Premium file** (`praemien_YYYY.csv`) — one row per (insurer × Prämienregion ×
   Altersklasse × Franchise × Unfalldeckung × Tarifart). Published annually, typically
   September/October for the following year.
2. **Region/locality mapping** (`plz_gemeinde_region.csv`) — maps PLZ → Gemeinde →
   Prämienregion. Published by BAG alongside the premium file; supplemented with Swiss
   Post PLZ data for canonical municipality names.
3. **Enrollment file** (`Versichertenbestand_CH.csv`) — per-insurer, per-canton OKP
   membership counts, summed into per-insurer national totals for the results list's
   member-count badge; published on its own slower cadence, lagging the premium year.

All three files are downloaded from [opendata.swiss](https://opendata.swiss) (or, for
the enrollment file, its `bagnet.ch` mirror) by the ETL script and committed to
`data/raw/` so the exact source is auditable.

### 3.2 ETL script (`scripts/ingest.ts`)

Runs via `npm run ingest`. Steps:

1. Download (or accept local path via `--local` flag) BAG CSV exports.
2. Parse, validate column presence and value ranges; abort with a diff on unexpected
   values so schema changes surface immediately.
3. Emit typed JSON. Most outputs go to `src/data/`; the premium file is large enough
   (§3.4) that it instead goes to `public/data/` so it can be fetched as a static
   asset rather than bundled:
   - `premiums-{year}.json` — flat array of premium rows, typed as `PremiumRow`
     (`public/data/`).
   - `plz-map.json` — map of `PLZ → { gemeinden: Gemeinde[] }`.
   - `gemeinde-region-map.json` — map of `BfsNr → PraemienregionId`.
   - `insurers.json` — deduplicated insurer list with BAG insurer code + display name,
     plus an optional `memberCount` (OKP enrollment) when the insurer has a matching
     row in the enrollment file.
   - `metadata.json` — BAG publication dates and available years (drives the year
     toggle and the on-page publication-date display per §6.1), plus
     `memberCountAsOf` (the enrollment file's own, separately-lagging publication
     year).

### 3.3 Core TypeScript types

```ts
type AgeKlasse = 'kind' | 'jung' | 'erwachsen'; // 0–18, 19–25, 26+

type AgeGroup =
  | '0' | '1-5' | '6-12' | '13-18'
  | '19-25' | '26-35' | '36-50' | '51-65' | '66+'; // life-stage bands for analytics only; NOT a premium input

type Tarifart =
  | 'standard'
  | 'hmo'
  | 'hausarzt'
  | 'telmed'
  | 'andere'; // driven by BAG classification, not hardcoded labels

type PremiumRow = {
  year: number;
  insurerCode: string;          // BAG insurer code
  praemienregionId: string;
  altersklasse: AgeKlasse;
  franchise: number;            // CHF
  unfalldeckung: boolean;       // true = accident coverage included
  tarifart: Tarifart;
  monthlyPremium: number;       // CHF, two decimal places
};

type Gemeinde = {
  bfsNr: number;
  name: string;
  kanton: string;
  praemienregionId: string;
};
```

### 3.4 Data size estimate

~174 876 rows for a single year's premium file, at roughly 244 bytes/row (JSON):
~42.6 MB uncompressed / ~1.3 MB gzip. This is served as a static asset fetched once
on first interaction (from `public/data/`, not bundled), cached in the browser, and
never requested again within the same session.

---

## 4. Application Structure

```
src/
  app/
    page.tsx            # root page — renders <InsuranceComparator />
    layout.tsx          # root layout — global CSS, fonts
    metadata.ts         # generateMetadata() — dynamic title/OG per REQ-18/19/20
  components/
    InsuranceComparator.tsx   # top-level client component; owns all state
    inputs/
      PlzInput.tsx            # postal code field + Gemeinde picker
      BirthYearInput.tsx
      DeductibleSelect.tsx
    results/
      Headline.tsx            # savings / cheapest headline (§5.2)
      FilterBar.tsx           # model toggle, accident toggle, year toggle
      PlanList.tsx            # sorted plan rows
      PlanRow.tsx
      EmptyState.tsx
    current-plan/
      CurrentPlanSection.tsx  # collapsible "what do you pay now?" (§5.1)
  lib/
    lookup.ts           # pure functions: filterPlans(), sortPlans(), computeHeadline(), standardPremiumsByInsurer()
    ageband.ts          # birthYear + calendarYear → AgeKlasse + franchise tiers
    location.ts         # plz → Gemeinde[], Gemeinde → praemienregionId
    url-state.ts        # encodeState() / decodeState() — URL ↔ app state
    format.ts           # Swiss CHF formatting (apostrophe thousands separator)
    validate.ts         # PLZ and birth year validation (REQ-13)
  data/
    plz-map.json
    gemeinde-region-map.json
    insurers.json
    metadata.json
scripts/
  ingest.ts
public/
  data/
    premiums-2026.json
    premiums-2027.json  # present once BAG publishes it
```

---

## 5. State Management & URL Encoding

All comparison state lives in `URLSearchParams` (REQ-11). No global state store
(`useState` in `InsuranceComparator` + `useRouter`/`useSearchParams` to sync).

### 5.1 Parameter schema

| Param | Type | Example |
|---|---|---|
| `plz` | string | `8044` |
| `bfs` | number | `261` (BFS-Nr disambiguates when PLZ spans regions) |
| `by` | number | `1990` (birth year) |
| `fran` | number | `300` |
| `year` | number | `2026` |
| `acc` | `0\|1` | `1` (accident coverage included) |
| `models` | comma-list | `standard,hmo` |
| `ci` | string | current insurer's BAG code |
| `cp` | number | current monthly premium, CHF, self-reported |

On every input change, `encodeState()` pushes a new history entry via
`router.replace()` (not `push()`) to avoid polluting back-button history with every
keystroke. The live-recompute loop (REQ-3) is triggered by state, not by URL changes,
to keep the UI responsive.

### 5.2 Validation on load

`decodeState()` validates every parameter before use. Malformed or out-of-range values
are silently dropped (the field renders empty/default) rather than throwing, so an
edited shared URL degrades gracefully.

---

## 6. Lookup Logic

All lookup logic is pure functions in `src/lib/lookup.ts`, testable in isolation.

```
filterPlans(rows, { praemienregionId, altersklasse, franchise, models, unfalldeckung, year })
  → PremiumRow[]

cheapestPerInsurer(rows)
  // For each insurerCode, keep only the row with the lowest monthlyPremium.
  // Ties within one insurer broken by tarifart priority: standard > hausarzt > telmed > hmo > andere.
  → PremiumRow[]

sortPlans(rows)
  → PremiumRow[]  // price asc, ties alpha by insurer name

standardPremiumsByInsurer(rows, { praemienregionId, altersklasse, franchise, unfalldeckung, year })
  → Map<insurerCode, monthlyPremium>  // Standard-tarifart baseline for the discount badge (REQ-23)

discountVsStandardPct(standardPremium: number | undefined, premium: number)
  → number | null

computeHeadline(current: SelfReportedPlan | null, cheapest: PremiumRow | null)
  → HeadlineState
```

The current-plan premium is self-reported by the user (requirement.md §5.1) —
`computeHeadline` compares it directly against the filtered `cheapest` row, with no
dataset lookup/matching step. `standardPremiumsByInsurer` runs its own
`filterPlans → cheapestPerInsurer` pass restricted to `models: ["standard"]`,
independent of whichever models are currently toggled into the main results list.

Age band is computed by `ageband.ts`:

```ts
// Age band = age reached during the calendar year (year - birthYear).
// Confirmed against BAG data documentation (open question §11.1).
function getAltersklasse(birthYear: number, calendarYear: number): AgeKlasse
function getFranchiseTiers(altersklasse: AgeKlasse): number[]
```

Analytics age-group bucketing lives in `ageGroup.ts`:

```ts
function getAgeGroup(birthYear: number, visitYear: number): AgeGroup   // analytics bucketing; visitYear = real current year
```

---

## 7. SEO & Metadata (REQ-18, 19, 20)

Next.js `generateMetadata()` runs at request time on the edge:

- Reads `searchParams` from the URL.
- If a valid comparison state is present (PLZ + birth year + franchise resolved):
  - `<title>`: e.g. *"Krankenkassenvergleich Zürich – ab CHF 245/Monat"*
  - `<meta name="description">`: e.g. *"X Kassen ab CHF 245/Monat für Zürich, Jahrgang
    1990, Franchise CHF 300."*
  - `<meta name="robots" content="noindex">` + `<link rel="canonical" href="/">`.
  - OG / Twitter Card tags mirror title + description.
- If no valid state: generic keyword-appropriate defaults; no `noindex`; no canonical
  override (the base URL is already canonical).

`sitemap.ts` exports the base URL only. `robots.txt` allows all crawlers.

---

## 8. Accessibility (REQ-17)

- Semantic HTML: `<main>`, `<section>`, `<h1>`/`<h2>` hierarchy, `<table>` for the
  plan list (tabular data), `<label>` / `aria-describedby` on all inputs.
- All interactive controls are keyboard-navigable; focus rings are visible (Tailwind
  `focus-visible:ring`).
- Colour contrast ≥ 4.5:1 for body text, ≥ 3:1 for large text and UI components.
- `aria-live="polite"` region wraps the headline and plan list so screen readers
  announce updates when inputs change.
- No motion-dependent interactions; no content conveyed by colour alone.
- Target: WCAG 2.1 AA. Validated with axe-core in CI.

---

## 9. Formatting

`src/lib/format.ts` centralises all Swiss-convention number formatting:

```ts
formatChf(amount: number): string
// → "CHF 1'234.50"  (apostrophe thousands separator, two decimal places)
```

Month labels, deductible labels, and model description strings are defined in
`src/lib/copy.ts` (German only, v1).

---

## 10. Inquiry Logging (REQ-21)

### 10.1 Trigger

The browser fires a `POST /api/log-inquiry` request when all three required inputs
become valid and results are first rendered, and again whenever: a filter that
changes the result set is toggled; a birth-year edit moves the visitor into a
different resolved age group; or the optional current plan first becomes complete
(both insurer and a valid premium filled in). Debounced to 1 s to avoid flooding on
rapid input changes.

The current-plan values are not themselves request triggers — they are read from a
ref when the debounced request fires, so partial edits don't spam requests. Because
the current-plan section renders below the results, a completed current plan
typically produces a second row (the first written before it was filled in); there
is no join key to reconcile the two (REQ-21), so the `current_insurer` /
`current_premium_band` panels count inquiries, not unique users.

The payload also carries `ageGroup`, computed from the visitor's age in the *current*
calendar year (not the selected premium year) — so it does not shift when the year
toggle changes, unlike `altersklasse`.

### 10.2 API route (`src/app/api/log-inquiry/route.ts`)

A Next.js Route Handler (runs on Vercel serverless). It:

1. Validates the request body against a schema. Required: `regionId`,
   `altersklasse`, `franchise`, `year`, `models`, `accident` — enumerated values
   only where applicable. `locale` is optional; if present it must be one of
   `routing.locales` (400 otherwise), if absent it is stored as NULL.
   `currentInsurer` (a BAG insurer code, validated against the bundled insurer
   list) and `currentPremiumBand` (one of the five fixed bands) are optional; if
   present they must be valid (400 otherwise).
   `ageGroup` (one of the nine fixed life-stage bands) is optional; if present it must be valid (400 otherwise), if absent it is stored as NULL.
2. Writes one row to the `inquiry_log` table. Still no IP address, no exact
   premium, no free-text, and no join key back to a user or session — the
   incumbent insurer code and the coarse premium band are the only current-plan
   fields, both optional.
3. Returns `204 No Content`. Failures are silent to the user (logging must never block
   or degrade the comparison UI).

### 10.3 Schema

```sql
CREATE TABLE inquiry_log (
  id          BIGSERIAL PRIMARY KEY,
  ts          TIMESTAMPTZ NOT NULL DEFAULT now(),
  region_id   TEXT        NOT NULL,  -- Prämienregion ID
  altersklasse TEXT       NOT NULL,  -- 'kind' | 'jung' | 'erwachsen'
  franchise   SMALLINT    NOT NULL,
  year        SMALLINT    NOT NULL,
  models      TEXT[]      NOT NULL,  -- e.g. '{standard,hmo}'
  accident    BOOLEAN     NOT NULL,
  locale      TEXT,                  -- 'de' | 'fr' | 'it' | 'en' | 'pt' | 'es' | NULL (unknown / pre-feature rows)
  current_insurer      TEXT,         -- BAG insurer code; NULL when no current plan provided
  current_premium_band TEXT,         -- see below; NULL when no current plan provided
  age_group            TEXT          -- life-stage band (see below); NULL for pre-feature rows
);
```

`current_premium_band` is one of `<250 | 250-349 | 350-449 | 450-549 | 550+`, bucketed
client-side — the exact premium is never transmitted. These columns are all nullable:
`locale` is NULL for rows logged before the feature shipped, and `current_insurer` /
`current_premium_band` are NULL for any inquiry where the optional current plan was not
provided.

`age_group` is one of `0 | 1-5 | 6-12 | 13-18 | 19-25 | 26-35 | 36-50 | 51-65 | 66+`,
bucketed client-side from the visitor's age in the current calendar year — the birth
year is never transmitted. It is NULL for rows logged before this feature shipped.
Unlike `altersklasse` (age in the selected premium year), `age_group` always reflects
the visitor's age at the time of the visit.

No personal data is stored. No join key back to a user or session exists by design.

### 10.4 Access

Query access to `inquiry_log` is restricted to the Vercel project's internal connection
string. No public API exposes raw log rows. Aggregate dashboards (e.g. Vercel
Postgres's built-in query UI, or a simple admin query) are the intended consumption
path.

---

## 11. Testing Strategy

| Layer | Tool | Scope |
|---|---|---|
| Unit | Vitest | `lookup.ts`, `ageband.ts`, `url-state.ts`, `validate.ts`, `format.ts` |
| Integration | Vitest + jsdom | `InsuranceComparator` rendering with mock data |
| Accessibility | axe-core (vitest-axe) | Run against rendered component tree in CI |
| ETL | Vitest | `ingest.ts` against a small fixture CSV |
| API route | Vitest | `log-inquiry` route: valid body → 204, invalid body → 400, DB error → 204 (silent) |
| E2E (optional) | Playwright | Key user journeys; run on demand, not in every PR |

---

## 12. Local Development

```bash
npm install
npm run ingest          # download BAG data and regenerate src/data/ JSON
npm run dev             # Next.js dev server on :3000
npm test                # Vitest unit + integration
```

Re-run `npm run ingest` whenever BAG publishes updated or next-year data. The ETL
script diffs the output against the committed JSON and prints a summary so changes are
visible in code review.

---

## 13. Admin Dashboard (REQ-22)

### 13.1 Authentication

`/admin` is protected by Next.js middleware (`middleware.ts`). On every request to
`/admin/**`, the middleware checks for a cookie `admin_token`. If absent or mismatched
against the `ADMIN_SECRET` environment variable, the request is redirected to
`/admin/login`.

`/admin/login` renders a single password field. On submit, the server action compares
the submitted value (constant-time) against `ADMIN_SECRET`; on match it sets an
`HttpOnly; Secure; SameSite=Strict` session cookie and redirects to `/admin`.

No user table, no JWT library — one env variable, one cookie.

### 13.2 Data API

`GET /api/admin/stats?from=<ISO date>&to=<ISO date>` (guarded by middleware).

Both `from` and `to` are required ISO-8601 date strings (`YYYY-MM-DD`). The route
validates them server-side and returns 400 on invalid input. All queries are
parameterised — no string interpolation.

The trend chart granularity is chosen server-side based on the range length and
returned as a `granularity` field (`'hour' | 'day' | 'month'`) so the client doesn't
need to re-derive it:

| Range length | Granularity |
|---|---|
| ≤ 2 days | hour |
| 3 – 90 days | day |
| > 90 days | month |

```sql
-- 1. Total in range
SELECT COUNT(*) AS total
FROM inquiry_log
WHERE ts >= $1 AND ts < $2;

-- 2. Trend series (granularity substituted server-side as date_trunc argument)
SELECT date_trunc($3, ts) AS bucket, COUNT(*) AS n
FROM inquiry_log
WHERE ts >= $1 AND ts < $2
GROUP BY 1 ORDER BY 1;

-- 3. Top 10 regions
SELECT region_id, COUNT(*) AS n
FROM inquiry_log
WHERE ts >= $1 AND ts < $2
GROUP BY 1 ORDER BY 2 DESC LIMIT 10;

-- 4. Age band breakdown
SELECT altersklasse, COUNT(*) AS n
FROM inquiry_log
WHERE ts >= $1 AND ts < $2
GROUP BY 1 ORDER BY 2 DESC;

-- 4b. Age group breakdown (finer; NULL age_group = pre-feature rows, excluded)
-- No ORDER BY: bands come back arbitrary and are sorted client-side into the
-- fixed AGE_GROUPS sequence.
SELECT age_group AS "ageGroup", COUNT(*) AS n
FROM inquiry_log
WHERE ts >= $1 AND ts < $2 AND age_group IS NOT NULL
GROUP BY 1;

-- 5. Franchise breakdown
SELECT franchise, COUNT(*) AS n
FROM inquiry_log
WHERE ts >= $1 AND ts < $2
GROUP BY 1 ORDER BY 1;

-- 6. Model set breakdown (unnested)
SELECT unnest(models) AS model, COUNT(*) AS n
FROM inquiry_log
WHERE ts >= $1 AND ts < $2
GROUP BY 1 ORDER BY 2 DESC;

-- 7. Accident coverage
SELECT accident, COUNT(*) AS n
FROM inquiry_log
WHERE ts >= $1 AND ts < $2
GROUP BY 1;

-- 8. Language mix (COALESCE NULL -> 'unbekannt' so pre-feature rows still surface)
SELECT COALESCE(locale, 'unbekannt') AS locale, COUNT(*) AS n
FROM inquiry_log
WHERE ts >= $1 AND ts < $2
GROUP BY 1 ORDER BY 2 DESC;

-- 9. Current insurer, top 10 (only inquiries where the current plan was provided)
SELECT current_insurer, COUNT(*) AS n
FROM inquiry_log
WHERE ts >= $1 AND ts < $2 AND current_insurer IS NOT NULL
GROUP BY 1 ORDER BY 2 DESC LIMIT 10;

-- 10. Current premium band (only inquiries where the current plan was provided)
-- No ORDER BY: bands come back in arbitrary order and are sorted client-side
-- into the fixed PREMIUM_BANDS sequence. `ORDER BY 1` would sort lexically and
-- push `<250` to the end.
SELECT current_premium_band AS band, COUNT(*) AS n
FROM inquiry_log
WHERE ts >= $1 AND ts < $2 AND current_premium_band IS NOT NULL
GROUP BY 1;
```

### 13.3 Page Layout

```
/admin
  layout.tsx      # shared nav header: "Basic Insurance — Admin", logout button
  page.tsx        # reads ?from/to from searchParams; passes to <Dashboard />
  login/
    page.tsx      # login form
components/admin/
  Dashboard.tsx   # client component; owns range state, fetches /api/admin/stats
  RangePicker.tsx # preset buttons + custom from/to date inputs; updates URL params
  TrendChart.tsx
  BreakdownBar.tsx
```

`Dashboard` is a **client component** (needs interactivity for the range picker).
It initialises its `from`/`to` state from URL search params (defaulting to last 30
days), fetches `/api/admin/stats` via `useSWR` on mount and on every range change,
and writes the new range back to the URL with `router.replace()` so the view is
bookmarkable.

### 13.4 Dashboard Visual Design

```
┌─────────────────────────────────────────────────────────────────┐
│  Basic Insurance — Admin                          [Logout]   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ [Today] [Last 7d] [Last 30d] [This month] [Last 3m]       │ │
│  │ [This year] [Custom▾]  from [2026-01-01] to [2026-08-11] │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌─────────────────┐                                           │
│  │  Total in range  │                                           │
│  │                  │                                           │
│  │  187 450         │                                           │
│  │  inquiries       │                                           │
│  └─────────────────┘                                           │
│                                                                 │
│  Inquiries over time  (granularity: daily)                       │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  ▁▂▃▄▅▆▇█  (line chart, x = bucket, y = count)            │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌──────────────────────────────┐  ┌──────────────────────────┐│
│  │  Top 10 Regions              │  │  Age Band                ││
│  │  Zürich (ZH-1)    ████ 4210  │  │  Erwachsen (26+) ██ 71%  ││
│  │  Bern (BE-1)      ███  2840  │  │  Jung (19–25)    █  18%  ││
│  │  Basel (BS-1)     ██   1920  │  │  Kind (0–18)     ▌  11%  ││
│  │  …                           │  │  (horizontal bar chart)  ││
│  └──────────────────────────────┘  └──────────────────────────┘│
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  Altersgruppe   (age at the time of the visit)            │ │
│  │  0            ▌   3%      26–35  ████████ 24%             │ │
│  │  1–5          █   6%      36–50  ██████   19%             │ │
│  │  6–12         ██  9%      51–65  ████     12%             │ │
│  │  13–18        ██  8%      66+    ██        6%             │ │
│  │  19–25        ███ 13%     (rows youngest→oldest, up to 9) │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌──────────────────────────────┐  ┌──────────────────────────┐│
│  │  Franchise Distribution      │  │  Insurance Model         ││
│  │  CHF 300  ████████████ 38%   │  │  Standard   ████████ 82%  ││
│  │  CHF 500  ████        12%   │  │  Hausarzt   ██       10%  ││
│  │  …                           │  │  …                        ││
│  └──────────────────────────────┘  └──────────────────────────┘│
│                                                                 │
│  ┌──────────────────────────────┐                              │
│  │  Accident Coverage           │                              │
│  │  Included  ████████████ 87%  │                              │
│  │  Excluded  ██           13%  │                              │
│  └──────────────────────────────┘                              │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  Language                                                  │ │
│  │  Deutsch    ████████████ 70%   Français  ███  17%         │ │
│  │  Italiano   █  8%              English   ▌  4%   …        │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌──────────────────────────────┐  ┌──────────────────────────┐│
│  │  Current insurer             │  │  Current premium         ││
│  │  (current plan provided only)│  │  (current plan prov. only)││
│  │  Assura   ████████████ 28%   │  │  CHF <250    ███       7% ││
│  │  CSS      ████████     20%   │  │  CHF 250–349 ████████ 36%││
│  │  Helsana  ██████       15%   │  │  CHF 350–449 ██████████45%││
│  │  …                           │  │  CHF 450–549 ██        9% ││
│  │                              │  │  CHF 550+    ▌         3% ││
│  └──────────────────────────────┘  └──────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

**Visual conventions:**
- White cards with a subtle border and 8 px border-radius; Tailwind `shadow-sm`.
- **Range picker:** row of preset buttons (active preset highlighted `blue-600`);
  "Custom" button reveals two `<input type="date">` fields inline. Changing any
  preset or confirming a custom range triggers an immediate refetch.
- **Total stat card:** single large number (`text-3xl font-bold`) with the resolved
  date range shown beneath it in `text-sm text-gray-500` (e.g. "1 Jan – 11 Aug 2026").
- **Trend chart:** Recharts `<LineChart>`, x-axis labels adapt to granularity
  (HH:mm for hourly, DD MMM for daily, MMM YYYY for monthly), tooltip on hover.
- **All breakdown charts:** Recharts `<BarChart layout="vertical">` with count + %
  label at the end of each bar. Bars all share the `blue-600` accent.
- **Altersgruppe panel:** full-width card directly below the Altersklasse panel (the KVG
  `altersklasse` panel is left untouched). `BreakdownBar` with rows ordered
  youngest→oldest via the fixed `AGE_GROUPS` sequence (`orderedAgeGroupRows`), not by
  count. It passes no explicit total, so each bar's % is its share of the sum of the
  age-group rows shown — pre-feature rows with a NULL `age_group` are excluded by the
  query (§13.2 query 4b). This is the finer life-stage view (age at the time of the
  visit) alongside the coarser KVG `altersklasse` (age in the selected premium year).
- **Language panel:** one bar per UI locale — Deutsch / Français / Italiano / English /
  Português / Español, plus **Unbekannt** for rows with no `locale` (query 8). Full-width
  card below Accident Coverage.
- **Current insurer panel:** top 10 BAG insurers by count (query 9); insurer names shown
  verbatim (not translated). **Only counts inquiries where a current insurer was named**
  (`current_insurer IS NOT NULL`, independent of whether a premium was given) — the panel
  subtitle states this. The query is `LIMIT 10` and the panel passes no explicit total,
  so each bar's % is its share of the top 10 shown (not of all inquiries). Expect this
  count to be well below the total-inquiry count: the current plan is optional and, per
  §10.1, is only logged once the user completes it (or later toggles a filter).
- **Current premium panel:** the five fixed bands `CHF <250 / CHF 250–349 / CHF 350–449 /
  CHF 450–549 / CHF 550+` in ascending order (query 10), band boundaries computed
  client-side (§10.3). **Only counts inquiries where the current plan was provided**, same
  subtitle + subset-% treatment as the current-insurer panel.
- Loading state: skeleton shimmer over each panel while the fetch is in flight;
  stale data remains visible underneath to avoid layout shift.
- Page is desktop-only (no mobile requirement for the admin tool).
- No pagination — all result sets are small (≤ 10 rows for regions and current
  insurers; ≤ 9 rows for the Altersgruppe panel; ≤ 7 rows for language; ≤ 6 rows for
  all other breakdowns).

### 13.5 SEO / Discoverability

`/admin/**` carries `X-Robots-Tag: noindex, nofollow` via the middleware response
headers. It is not linked from anywhere in the public app.

---

## 14. Deployment

Every push to `main` triggers a Vercel build:

1. `npm run ingest --local` (uses the committed raw CSVs, no network fetch).
2. `next build` — generates static pages + edge function bundle for `generateMetadata`.
3. Vercel deploys: static assets to CDN, serverless functions to all regions.

Required environment variables in production:

| Variable | Purpose |
|---|---|
| `POSTGRES_URL` | Vercel Postgres connection string for inquiry logging |
| `ADMIN_SECRET` | Password protecting `/admin`; compared constant-time in the login action |

### 14.1 Release checklist — database migrations

**Standing rule:** whenever a change adds or alters a column on `inquiry_log`,
`npm run db:migrate` MUST be run against the production `POSTGRES_URL` *before*
that change is deployed. The route handler swallows INSERT failures (§10.2), so a
schema that lags the code does not raise an error — it silently drops every
inquiry row until the migration is applied. The migration is idempotent
(`ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, `scripts/migrateSql.ts`), so it is
always safe to re-run.

- This feature adds three columns (`locale`, `current_insurer`,
  `current_premium_band`); it must not be deployed until `npm run db:migrate`
  has completed against production.
- A later change adds a fourth column (`age_group`), same constraint: run
  `npm run db:migrate` before deploying the code that writes it.

---

## 15. Key Constraints & Decisions

- **No database for premium data.** BAG data is bundled. Annual re-ingestion is a `git commit`, not a migration. This is viable because the dataset is small (~10 MB) and changes are infrequent and wholesale.
- **Postgres only for inquiry logs.** The log table is append-only. Alongside the original REQ-21 fields it now also holds the incumbent insurer's BAG code, a coarse (~100-CHF) band of the self-reported current premium, and a coarse nine-band age group (age at the time of the visit; birth year never transmitted). A simple serverless Postgres instance (Vercel Postgres) is sufficient; no ORM is needed. There is no migration framework — schema changes are plain SQL in `scripts/migrateSql.ts`: the initial `CREATE TABLE IF NOT EXISTS` plus idempotent `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` statements for columns added after first ship, run via `npm run db:migrate` (see §14.1).
- **No user accounts, no server-side sessions.** All state is in the URL per §4 / REQ-11.
- **No referral links, no analytics SDKs** that would require a cookie banner. Inquiry logging (REQ-21) still does not require consent under Swiss DSG / GDPR as implemented, and this is a deliberate re-affirmation after adding the insurer code, premium band, and age group: there is no IP address, no join key back to a user or session, the premium is a coarse bucket (five ~100-CHF bands), the age group is one of nine life-stage bands (the birth year itself is never stored, only the derived band), and the region is one of ~40 premium regions. No single row, and no combination of the stored fields, identifies a natural person.
- **Single language (German).** Multi-language support is explicitly out of scope for
  v1 (§12 of requirements). String literals are centralised in `copy.ts` to make
  future i18n straightforward without over-engineering it now.
- **BAG Tarifart list is data-driven**, not hardcoded to the three named models in §3
  of the requirements, per open question §11.4.
