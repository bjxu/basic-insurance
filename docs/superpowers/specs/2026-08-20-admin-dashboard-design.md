# Admin Dashboard — Complete REQ-22

**Date:** 2026-08-20
**Status:** Approved

## Context

`architecture.md` §13 already specs the admin dashboard in full (auth, data API,
component layout, SQL, visual design) and `mockups/admin.html` already renders it
pixel-complete. What exists in `src/app/admin/**` today only implements a slice of
that: auth (middleware + login) works, but `/api/admin/stats` and `/api/log-inquiry`
are stubbed pending a Postgres connection, and `admin/page.tsx` only renders the
range presets and a total-count card — no trend chart, no breakdown panels, no
component split, no URL-bookmarkable range, no nav header/logout, no `X-Robots-Tag`.

Since this session, Neon has been provisioned through the Vercel marketplace
integration, unblocking the data layer. This spec covers finishing REQ-22 end to
end: wiring the real database and building out the dashboard UI to match the
existing mockup and architecture spec.

Nothing in `requirement.md` or `architecture.md`'s *behavior* changes — this is
implementation of what's already specced, plus the concrete technical decisions
that spec left open (client library, migration mechanism, chart implementation).

## Decisions

**Database client: `@neondatabase/serverless`, not `@vercel/postgres`.**
Vercel folded Postgres into the Neon marketplace integration; `@vercel/postgres` is
no longer actively maintained, and Vercel/Neon's own docs point new code at
`@neondatabase/serverless`'s `neon()` tagged-template function.

**Env var: keep `POSTGRES_URL`.** The Vercel⇄Neon integration sets both `DATABASE_URL`
(its new primary var) and the legacy `POSTGRES_*` vars for backward compatibility.
`architecture.md` §14 and both existing route files already reference `POSTGRES_URL`;
keeping it avoids unrelated churn.

**Charts: native inline SVG/CSS, not Recharts.** `mockups/admin.html` — committed in
the same commit as `architecture.md` and already in sync with §13.4 — implements the
trend chart as a hand-written `<svg>` path and every breakdown panel as plain CSS
flex bars (`.bar-track`/`.bar-fill` with an inline `width: %`), with no charting
library. That mockup is the concrete visual reference; matching it directly avoids
adding a dependency and guarantees pixel parity. `architecture.md`'s mention of
"Recharts" is superseded by this decision.

**Mockup: no changes needed.** `mockups/admin.html` is already complete and correct
against §13.4 (it already has the "Dieser Monat" preset the live page is missing).
It serves as the exact reference for markup, copy, and layout when building the
live `Dashboard`/`RangePicker`/`TrendChart`/`BreakdownBar` components — nav bar
("Krankenkassenvergleich" + "ADMIN" badge + "Abmelden"), range-picker layout (6
presets + separator + date inputs + trailing range label), stat card, and the two
`grid-2` breakdown rows all carry over 1:1, including existing German copy.

## Scope

### 1. Database migration

New `scripts/migrate.ts` (run via `npm run db:migrate`), idempotent:

```sql
CREATE TABLE IF NOT EXISTS inquiry_log (
  id           SERIAL PRIMARY KEY,
  ts           TIMESTAMPTZ NOT NULL DEFAULT now(),
  region_id    TEXT NOT NULL,
  altersklasse TEXT NOT NULL,
  franchise    INTEGER NOT NULL,
  year         INTEGER NOT NULL,
  models       TEXT[] NOT NULL,
  accident     BOOLEAN NOT NULL
);
```

Columns match every query already written in `architecture.md` §13.2. One-time
manual run against the provisioned Neon database; safe to re-run in any environment.

### 2. Wire the two existing API routes

- `src/app/api/log-inquiry/route.ts`: replace the commented-out insert with a real
  `sql\`INSERT INTO inquiry_log (...) VALUES (...)\`` call via `neon(process.env.POSTGRES_URL!)`.
  Keep the existing silent-failure behavior (logging must never surface to the user)
  and the existing payload validation unchanged.
- `src/app/api/admin/stats/route.ts`: run the 7 queries from §13.2 (total, trend,
  top regions, altersklasse, franchise, models, accident) via `Promise.all`,
  substituting `granularity` (`hour`/`day`/`month`, chosen server-side by range
  length per the existing table in §13.2). Keep the existing `from`/`to` validation
  and the response shape the current stub already returns (so this is a drop-in
  replacement, not a contract change).

### 3. Component split (`src/components/admin/`)

Per `architecture.md` §13.3:

- `Dashboard.tsx` — client component; owns range state (initialized from URL search
  params, defaulting to last 30 days), fetches `/api/admin/stats` with `swr` on
  mount and every range change, writes the range back to the URL with
  `router.replace()`.
- `RangePicker.tsx` — the 6 preset buttons (today, 7 days, 30 days, **this month**,
  3 months, this year — adding the currently-missing "this month" preset) plus
  custom from/to `<input type="date">` fields, matching `mockups/admin.html`'s
  markup and copy exactly. Any preset click or custom-date confirmation triggers
  an immediate refetch.
- `TrendChart.tsx` — inline SVG line+area chart reproducing the mockup's path-based
  rendering, driven by real `bucket`/`n` data instead of the mockup's static path;
  x-axis label format adapts to `granularity` (`HH:mm` / `DD MMM` / `MMM YYYY`).
- `BreakdownBar.tsx` — reusable horizontal bar list (label, track, fill width from
  %, trailing "count · pct" text) used for regions, Altersklasse, Franchise, model,
  and accident-coverage panels — all four+one breakdowns share this one component
  with different data/labels, per the mockup's identical `.bar-chart` markup
  across panels.

`src/app/admin/page.tsx` becomes a thin server component reading `searchParams`
and rendering `<Dashboard initialFrom initialTo />`.

### 4. Nav header + logout

`src/app/admin/layout.tsx` gains the header bar from the mockup: "Krankenkassenvergleich"
brand + "ADMIN" badge + a logout button ("Abmelden") that clears the `admin_token`
cookie (small server action) and redirects to `/admin/login`.

### 5. `X-Robots-Tag` header

`src/middleware.ts`: for any request matched as `isAdminRoute`, set
`X-Robots-Tag: noindex, nofollow` on the outgoing response, per §13.5 (currently
only the `<meta robots>` tag in `layout.tsx` covers this).

### 6. Loading state

Skeleton shimmer over each panel while a fetch is in flight; stale data stays
visible underneath (standard `swr` behavior — no extra state machine needed).

## Out of scope

- No changes to `requirement.md` / `architecture.md` behavior — this implements
  what's already specced.
- No mobile layout (§13.4: "Page is desktop-only").
- No pagination (§13.4: all result sets are small).

## Testing

- `scripts/migrate.test.ts` (or equivalent): migration is idempotent (running twice
  doesn't error, doesn't duplicate the table).
- `api/admin/stats/route.test.ts`: `from`/`to` validation (existing), response shape
  when `POSTGRES_URL` is unset (existing behavior preserved), granularity selection
  logic for the three range-length bands.
- `api/log-inquiry/route.test.ts`: payload validation (existing), insert is called
  with the validated fields when `POSTGRES_URL` is set.
- `RangePicker` / `BreakdownBar` component tests: preset selection updates the URL;
  bar width/percent rendering from sample data.
- Manual verification: run `npm run db:migrate` against the provisioned Neon
  database, submit a comparator inquiry, confirm it shows up in `/admin`'s panels
  within the selected range.
