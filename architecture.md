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

Two BAG open-data datasets are ingested:

1. **Premium file** (`praemien_YYYY.csv`) — one row per (insurer × Prämienregion ×
   Altersklasse × Franchise × Unfalldeckung × Tarifart). Published annually, typically
   September/October for the following year.
2. **Region/locality mapping** (`plz_gemeinde_region.csv`) — maps PLZ → Gemeinde →
   Prämienregion. Published by BAG alongside the premium file; supplemented with Swiss
   Post PLZ data for canonical municipality names.

Both files are downloaded from [opendata.swiss](https://opendata.swiss) by the ETL
script and committed to `data/raw/` so the exact source is auditable.

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
   - `insurers.json` — deduplicated insurer list with BAG insurer code + display name.
   - `metadata.json` — BAG publication dates and available years (drives the year
     toggle and the on-page publication-date display per §6.1).

### 3.3 Core TypeScript types

```ts
type AgeKlasse = 'kind' | 'jung' | 'erwachsen'; // 0–18, 19–25, 26+

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
    lookup.ts           # pure functions: filterPlans(), sortPlans(), findCurrentPlan()
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
| `ci` | string | BAG insurer code |
| `cf` | number | current franchise |
| `cm` | Tarifart | current model |
| `ca` | `0\|1` | current accident coverage |

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

findCurrentPlan(rows, { insurerCode, franchise, tarifart, unfalldeckung, praemienregionId, altersklasse, year })
  → PremiumRow | null

computeHeadline(current: PremiumRow | null, cheapest: PremiumRow | null, currentPlanProvided: boolean)
  → HeadlineState
```

The pipeline for each render is: `filterPlans → cheapestPerInsurer → sortPlans`.
`findCurrentPlan` runs against the **unfiltered** set (all models, both accident-coverage
variants) so the current plan is always findable regardless of active filters.

Age band is computed by `ageband.ts`:

```ts
// Age band = age reached during the calendar year (year - birthYear).
// Confirmed against BAG data documentation (open question §11.1).
function getAltersklasse(birthYear: number, calendarYear: number): AgeKlasse
function getFranchiseTiers(altersklasse: AgeKlasse): number[]
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

The browser fires a `POST /api/log-inquiry` request exactly once per resolved
comparison — i.e. when all three required inputs become valid and results are first
rendered, and again whenever a filter that changes the result set is toggled. Debounced
to 1 s to avoid flooding on rapid input changes.

### 10.2 API route (`src/app/api/log-inquiry/route.ts`)

A Next.js Route Handler (runs on Vercel serverless). It:

1. Validates the request body against a strict schema (all fields required, enumerated
   values only).
2. Writes one row to the `inquiry_log` table. No IP address, no current-plan fields,
   no free-text — only the fields specified in REQ-21.
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
  accident    BOOLEAN     NOT NULL
);
```

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
- Loading state: skeleton shimmer over each panel while the fetch is in flight;
  stale data remains visible underneath to avoid layout shift.
- Page is desktop-only (no mobile requirement for the admin tool).
- No pagination — all result sets are small (≤ 10 rows for regions; ≤ 6 rows for
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

---

## 15. Key Constraints & Decisions

- **No database for premium data.** BAG data is bundled. Annual re-ingestion is a `git commit`, not a migration. This is viable because the dataset is small (~10 MB) and changes are infrequent and wholesale.
- **Postgres only for inquiry logs.** The log table is append-only and stores no personal data. A simple serverless Postgres instance (Vercel Postgres) is sufficient; no ORM or migration framework is needed beyond a single `CREATE TABLE`.
- **No user accounts, no server-side sessions.** All state is in the URL per §4 / REQ-11.
- **No referral links, no analytics SDKs** that would require a cookie banner. Inquiry logging (REQ-21) stores no personal data and does not require consent under Swiss DSG / GDPR as implemented.
- **Single language (German).** Multi-language support is explicitly out of scope for
  v1 (§12 of requirements). String literals are centralised in `copy.ts` to make
  future i18n straightforward without over-engineering it now.
- **BAG Tarifart list is data-driven**, not hardcoded to the three named models in §3
  of the requirements, per open question §11.4.
