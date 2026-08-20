# Admin Dashboard (REQ-22) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the admin dashboard (REQ-22) end to end: wire the two stubbed API routes to the newly-provisioned Neon Postgres database, and rebuild `/admin` from a single placeholder page into the full multi-panel dashboard already specced in `architecture.md` §13 and rendered in `mockups/admin.html`.

**Architecture:** Business logic (date-range math, granularity selection, SVG path building, count formatting) lives in small pure `src/lib/*.ts` modules with full unit test coverage, matching this repo's existing convention. Route handlers and React components stay thin, composing those pure modules. `mockups/admin.html` is the pixel reference for every component's markup, copy, and layout.

**Tech Stack:** Next.js App Router (existing), `@neondatabase/serverless` (Postgres client — not `@vercel/postgres`, which is unmaintained), `swr` (client-side data fetching, matches `architecture.md` §13.3), native inline SVG/CSS for charts (no charting library — see Global Constraints).

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-20-admin-dashboard-design.md`. Full behavioral spec: `architecture.md` §13 (REQ-22), `requirement.md` REQ-22.
- DB env var is `POSTGRES_URL` (not `DATABASE_URL`) — already used throughout the existing code and `architecture.md` §14; the Vercel⇄Neon integration provides both.
- DB client is `@neondatabase/serverless`'s `neon()` tagged-template function, not `@vercel/postgres` (unmaintained).
- No charting library. Trend chart and every breakdown panel are native inline SVG / CSS, matching `mockups/admin.html` exactly (hand-written `<svg>` path for the trend line, `.bar-track`/`.bar-fill` divs for breakdowns).
- `mockups/admin.html` is the pixel-accurate visual reference: nav bar markup/copy, range-picker layout, stat card, and all breakdown panel grids/copy carry over 1:1 (German copy included) — it needs no changes itself.
- UI is light-only (no `dark:` Tailwind variants anywhere in this codebase) and desktop-only for `/admin` (no mobile requirement, per §13.4).
- Use the existing MD3 Tailwind tokens from `src/app/globals.css` (`bg-surface`, `text-on-surface-variant`, `border-outline-variant`, `bg-primary`, `text-on-primary`, `text-title-medium`, etc.) — don't introduce new colors.
- Counts are formatted with the apostrophe thousands separator via `src/lib/format.ts` (Swiss convention, requirement.md §9), e.g. `34'210`.
- All SQL is parameterized via the `sql\`...\`` tagged template (or `sql.query(text, params)`) — never string-interpolated.
- Logging/stats routes must never throw to the client: `POST /api/log-inquiry` always returns 204 (even on DB failure); `GET /api/admin/stats` returns a well-formed empty payload when `POSTGRES_URL` is unset (existing behavior — preserve it).
- This repo has no React component tests anywhere (`@testing-library/react` isn't a dependency, `vitest.config.ts` uses `environment: "node"`). Follow that convention: pure `src/lib/*.ts` modules get full unit tests; React components in `src/components/admin/` and `src/app/admin/**` get manual verification only, not automated tests. Don't add `@testing-library/react` or switch the test environment.
- `to` in the `{from, to}` range contract (URL params, `/api/admin/stats` query params, `adminRanges.ts`) is always the **exclusive** upper bound (`ts < to`), matching the SQL in §13.2. It equals "the calendar day after the last day a human considers included." Only human-facing labels (the range-picker's "Bis" date input, the stat card's range label) subtract one day to show the inclusive end date. Don't mix this up — see `src/lib/adminRanges.ts` in Task 4.
- Script orchestrators that call `main()` unconditionally at module load (this repo's existing pattern — see `scripts/ingest.ts`, `scripts/crawl/crawlDescriptions.ts`) are never imported by a test file. Pure logic those scripts need tested lives in a separate module with no top-level side effects (see `scripts/migrateSql.ts` vs `scripts/migrate.ts` in Task 2).

---

### Task 1: Postgres client (`src/lib/db.ts`)

**Files:**
- Create: `src/lib/db.ts`
- Test: `src/lib/db.test.ts`
- Modify: `package.json` (add `@neondatabase/serverless` — already installed in this worktree via `npm install @neondatabase/serverless@^1.1.0 swr@^2.5.1`; just confirm the `dependencies` entries are present)

**Interfaces:**
- Produces: `getSql(): NeonQueryFunction<false, false>` — lazily constructs and caches a Neon client from `process.env.POSTGRES_URL`, throwing `Error("POSTGRES_URL is not set")` if unset. Callers (Tasks 7, 8) are expected to check `process.env.POSTGRES_URL` themselves before calling this (existing route behavior — DB-not-configured is a normal no-op path, not an error path).
- Produces (test-only): `__resetSqlCacheForTests(): void` — clears the module-level cache so tests can flip `POSTGRES_URL` between cases.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/db.test.ts
import { describe, it, expect, afterEach } from "vitest";
import { getSql, __resetSqlCacheForTests } from "./db";

describe("getSql", () => {
  const original = process.env.POSTGRES_URL;

  afterEach(() => {
    process.env.POSTGRES_URL = original;
    __resetSqlCacheForTests();
  });

  it("throws when POSTGRES_URL is not set", () => {
    delete process.env.POSTGRES_URL;
    __resetSqlCacheForTests();
    expect(() => getSql()).toThrow("POSTGRES_URL is not set");
  });

  it("returns a callable client when POSTGRES_URL is set", () => {
    process.env.POSTGRES_URL = "postgres://user:pass@host/db";
    __resetSqlCacheForTests();
    expect(typeof getSql()).toBe("function");
  });

  it("caches the client across calls", () => {
    process.env.POSTGRES_URL = "postgres://user:pass@host/db";
    __resetSqlCacheForTests();
    expect(getSql()).toBe(getSql());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/db.test.ts`
Expected: FAIL — `src/lib/db.ts` doesn't exist yet.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/db.ts
// Lazy Neon Postgres client (REQ-21/REQ-22, architecture.md §13.2/§14).
//
// Callers must check `process.env.POSTGRES_URL` themselves first — an unset
// var is a normal "not configured yet" no-op path in the route handlers, not
// an error. This function only throws for the case where a caller forgot
// that check.

import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

let cached: NeonQueryFunction<false, false> | null = null;

export function getSql(): NeonQueryFunction<false, false> {
  if (!cached) {
    const url = process.env.POSTGRES_URL;
    if (!url) throw new Error("POSTGRES_URL is not set");
    cached = neon(url);
  }
  return cached;
}

// Test-only: clears the cached client so tests can flip POSTGRES_URL between cases.
export function __resetSqlCacheForTests(): void {
  cached = null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/db.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Confirm dependency is recorded, then commit**

```bash
grep -q '"@neondatabase/serverless"' package.json || npm install @neondatabase/serverless@^1.1.0
git add src/lib/db.ts src/lib/db.test.ts package.json package-lock.json
git commit -m "feat(admin): add lazy Neon Postgres client"
```

---

### Task 2: Database migration (`scripts/migrate.ts`)

**Files:**
- Create: `scripts/migrateSql.ts` (pure — just the SQL text, no side effects, so it's safe to import from a test)
- Test: `scripts/migrateSql.test.ts`
- Create: `scripts/migrate.ts` (runnable orchestrator — calls `main()` at load time, per this repo's existing script convention; never imported by a test)
- Modify: `package.json` (add `"db:migrate": "tsx scripts/migrate.ts"` script)

**Interfaces:**
- Produces: `MIGRATE_SQL: string` from `scripts/migrateSql.ts` — the `CREATE TABLE IF NOT EXISTS inquiry_log (...)` statement matching every column the queries in Tasks 7–8 use: `id`, `ts`, `region_id`, `altersklasse`, `franchise`, `year`, `models`, `accident`.
- Consumes: `getSql` is **not** used here — `scripts/migrate.ts` calls `neon()` directly (it's a standalone CLI script, not part of the Next.js server, so it doesn't share `src/lib/db.ts`'s request-scoped caching concern, and importing from `src/lib` into `scripts/` would be an unusual direction for this codebase — `scripts/` currently only imports from `src/lib/types` and `src/lib/productDescriptions`, one-way, never the reverse).

- [ ] **Step 1: Write the failing test**

```ts
// scripts/migrateSql.test.ts
import { describe, it, expect } from "vitest";
import { MIGRATE_SQL } from "./migrateSql";

describe("MIGRATE_SQL", () => {
  it("creates inquiry_log idempotently", () => {
    expect(MIGRATE_SQL).toContain("CREATE TABLE IF NOT EXISTS inquiry_log");
  });

  it("declares every column the stats and log-inquiry queries expect", () => {
    for (const column of ["id", "ts", "region_id", "altersklasse", "franchise", "year", "models", "accident"]) {
      expect(MIGRATE_SQL).toContain(column);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run scripts/migrateSql.test.ts`
Expected: FAIL — `scripts/migrateSql.ts` doesn't exist yet.

- [ ] **Step 3: Write the implementation**

```ts
// scripts/migrateSql.ts
// Pure SQL text for the inquiry_log migration — kept separate from migrate.ts
// (which runs it against a real database at module load) so it can be
// imported safely from a test. Columns match every query in
// architecture.md §13.2.

export const MIGRATE_SQL = `
CREATE TABLE IF NOT EXISTS inquiry_log (
  id           SERIAL PRIMARY KEY,
  ts           TIMESTAMPTZ NOT NULL DEFAULT now(),
  region_id    TEXT NOT NULL,
  altersklasse TEXT NOT NULL,
  franchise    INTEGER NOT NULL,
  year         INTEGER NOT NULL,
  models       TEXT[] NOT NULL,
  accident     BOOLEAN NOT NULL
)`.trim();
```

```ts
// scripts/migrate.ts
// One-time (safe to re-run) migration for the admin dashboard's inquiry log
// (REQ-21/REQ-22, architecture.md §13.2). Run via `npm run db:migrate`.
//
// Requires POSTGRES_URL in the environment — see architecture.md §14.

import { neon } from "@neondatabase/serverless";
import { MIGRATE_SQL } from "./migrateSql";

async function main() {
  const url = process.env.POSTGRES_URL;
  if (!url) {
    console.error("✖ db:migrate failed: POSTGRES_URL is not set.");
    process.exit(1);
  }

  const sql = neon(url);
  await sql.query(MIGRATE_SQL);
  console.log("✓ inquiry_log table ready.");
}

main().catch((err) => {
  console.error(`✖ db:migrate failed: ${err}`);
  process.exit(1);
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run scripts/migrateSql.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Add the npm script and commit**

Add to `package.json` `"scripts"`:
```json
"db:migrate": "tsx scripts/migrate.ts"
```

```bash
git add scripts/migrateSql.ts scripts/migrateSql.test.ts scripts/migrate.ts package.json
git commit -m "feat(admin): add inquiry_log migration script"
```

- [ ] **Step 6 (manual, not part of automated tests): run the migration against the provisioned Neon database**

Once `POSTGRES_URL` is set in the environment (Vercel project settings, and/or `.env.local` for local dev — pull it with `vercel env pull .env.local` if the project is linked): `npm run db:migrate`. Expect `✓ inquiry_log table ready.`. This step needs a real `POSTGRES_URL` and isn't something a task-runner subagent can do — flag it back to the user if `POSTGRES_URL` isn't available in this environment, and move on to the remaining tasks (they don't require a live DB to implement or test, since Tasks 7–8 mock `src/lib/db.ts`).

---

### Task 3: Granularity selection (`src/lib/adminStats.ts`)

**Files:**
- Create: `src/lib/adminStats.ts`
- Test: `src/lib/adminStats.test.ts`

**Interfaces:**
- Produces: `type Granularity = "hour" | "day" | "month"`; `selectGranularity(fromISO: string, toISO: string): Granularity` — used by Task 8 (stats route) and Task 12 (`TrendChart`'s label formatting).

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/adminStats.test.ts
import { describe, it, expect } from "vitest";
import { selectGranularity } from "./adminStats";

describe("selectGranularity", () => {
  it("returns hour for a range of 2 days or less", () => {
    expect(selectGranularity("2026-08-10", "2026-08-11")).toBe("hour");
    expect(selectGranularity("2026-08-09", "2026-08-11")).toBe("hour");
  });

  it("returns day for a range between 3 and 90 days", () => {
    expect(selectGranularity("2026-08-01", "2026-08-11")).toBe("day");
    expect(selectGranularity("2026-05-13", "2026-08-11")).toBe("day"); // exactly 90 days
  });

  it("returns month for a range over 90 days", () => {
    expect(selectGranularity("2026-01-01", "2026-08-11")).toBe("month");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/adminStats.test.ts`
Expected: FAIL — `src/lib/adminStats.ts` doesn't exist yet.

- [ ] **Step 3: Write the implementation**

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/adminStats.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/adminStats.ts src/lib/adminStats.test.ts
git commit -m "feat(admin): add trend-chart granularity selection"
```

---

### Task 4: Range-picker date math (`src/lib/adminRanges.ts`)

**Files:**
- Create: `src/lib/adminRanges.ts`
- Test: `src/lib/adminRanges.test.ts`

**Interfaces:**
- Produces: `type PresetKey = "today" | "7d" | "30d" | "month" | "3m" | "year"`; `PRESETS: { key: PresetKey; label: string }[]`; `presetRange(key: PresetKey, today: Date): { from: string; to: string }` (both ISO `YYYY-MM-DD`, `to` exclusive per Global Constraints); `formatRangeLabel(from: string, toExclusive: string): string` (e.g. `"13. Jul – 11. Aug 2026"`). Used by Task 11 (`RangePicker`), Task 14 (`Dashboard`), and `src/app/admin/page.tsx` (Task 14).

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/adminRanges.test.ts
import { describe, it, expect } from "vitest";
import { presetRange, formatRangeLabel } from "./adminRanges";

const TODAY = new Date(Date.UTC(2026, 7, 11)); // 11 Aug 2026 (month is 0-indexed)

describe("presetRange", () => {
  it("today: just today, exclusive tomorrow", () => {
    expect(presetRange("today", TODAY)).toEqual({ from: "2026-08-11", to: "2026-08-12" });
  });

  it("7d: today and the 6 days before it", () => {
    expect(presetRange("7d", TODAY)).toEqual({ from: "2026-08-05", to: "2026-08-12" });
  });

  it("30d: today and the 29 days before it", () => {
    expect(presetRange("30d", TODAY)).toEqual({ from: "2026-07-13", to: "2026-08-12" });
  });

  it("month: from the 1st of the current calendar month", () => {
    expect(presetRange("month", TODAY)).toEqual({ from: "2026-08-01", to: "2026-08-12" });
  });

  it("3m: today and the 89 days before it", () => {
    expect(presetRange("3m", TODAY)).toEqual({ from: "2026-05-14", to: "2026-08-12" });
  });

  it("year: from 1 January of the current calendar year", () => {
    expect(presetRange("year", TODAY)).toEqual({ from: "2026-01-01", to: "2026-08-12" });
  });
});

describe("formatRangeLabel", () => {
  it("formats a range within the same year", () => {
    expect(formatRangeLabel("2026-07-13", "2026-08-12")).toBe("13. Jul – 11. Aug 2026");
  });

  it("includes the from-year when it differs from the to-year", () => {
    expect(formatRangeLabel("2025-12-20", "2026-01-05")).toBe("20. Dez 2025 – 4. Jan 2026");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/adminRanges.test.ts`
Expected: FAIL — `src/lib/adminRanges.ts` doesn't exist yet.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/adminRanges.ts
// Preset date-range math and label formatting for the admin RangePicker
// (architecture.md §13.2/§13.4, REQ-22).
//
// `to` is always the *exclusive* upper bound the stats API expects
// (`ts < to`) — one calendar day past the last day a human considers
// "included". This lets the URL/API param be passed straight through with
// no conversion; only formatRangeLabel (and the RangePicker's date input,
// Task 11) convert to/from the inclusive, human-facing end date.

export type PresetKey = "today" | "7d" | "30d" | "month" | "3m" | "year";

export const PRESETS: { key: PresetKey; label: string }[] = [
  { key: "today", label: "Heute" },
  { key: "7d", label: "7 Tage" },
  { key: "30d", label: "30 Tage" },
  { key: "month", label: "Dieser Monat" },
  { key: "3m", label: "3 Monate" },
  { key: "year", label: "Dieses Jahr" },
];

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, n: number): Date {
  const copy = new Date(d);
  copy.setUTCDate(copy.getUTCDate() + n);
  return copy;
}

// `today` is injected (never read from `new Date()` internally) so callers —
// and tests — control "now" precisely instead of depending on wall-clock time.
export function presetRange(key: PresetKey, today: Date): { from: string; to: string } {
  const todayMidnight = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const to = toISODate(addDays(todayMidnight, 1)); // exclusive: tomorrow

  switch (key) {
    case "today":
      return { from: toISODate(todayMidnight), to };
    case "7d":
      return { from: toISODate(addDays(todayMidnight, -6)), to };
    case "30d":
      return { from: toISODate(addDays(todayMidnight, -29)), to };
    case "month":
      return {
        from: toISODate(new Date(Date.UTC(todayMidnight.getUTCFullYear(), todayMidnight.getUTCMonth(), 1))),
        to,
      };
    case "3m":
      return { from: toISODate(addDays(todayMidnight, -89)), to };
    case "year":
      return { from: toISODate(new Date(Date.UTC(todayMidnight.getUTCFullYear(), 0, 1))), to };
  }
}

const MONTHS_DE = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];

function formatDe(iso: string): { day: number; month: string; year: number } {
  const [y, m, d] = iso.split("-").map(Number);
  return { day: d, month: MONTHS_DE[m - 1], year: y };
}

// Human-facing "13. Jul – 11. Aug 2026" label from a canonical {from, toExclusive}
// pair (toExclusive per presetRange/the stats API contract above).
export function formatRangeLabel(from: string, toExclusive: string): string {
  const inclusiveTo = toISODate(addDays(new Date(`${toExclusive}T00:00:00Z`), -1));
  const a = formatDe(from);
  const b = formatDe(inclusiveTo);
  const fromStr = a.year === b.year ? `${a.day}. ${a.month}` : `${a.day}. ${a.month} ${a.year}`;
  return `${fromStr} – ${b.day}. ${b.month} ${b.year}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/adminRanges.test.ts`
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/adminRanges.ts src/lib/adminRanges.test.ts
git commit -m "feat(admin): add range-picker preset date math"
```

---

### Task 5: Trend-chart SVG path builder (`src/lib/trendPath.ts`)

**Files:**
- Create: `src/lib/trendPath.ts`
- Test: `src/lib/trendPath.test.ts`

**Interfaces:**
- Produces: `TREND_CHART_VIEWBOX: string` (`"0 0 760 110"`, matching `mockups/admin.html`'s `<svg viewBox>`); `buildTrendPath(values: number[]): { linePath: string; areaPath: string; points: { x: number; y: number }[] }`. Used by Task 12 (`TrendChart`).

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/trendPath.test.ts
import { describe, it, expect } from "vitest";
import { buildTrendPath } from "./trendPath";

describe("buildTrendPath", () => {
  it("returns empty paths and points for no data", () => {
    expect(buildTrendPath([])).toEqual({ linePath: "", areaPath: "", points: [] });
  });

  it("maps the max value to the top and 0 to the bottom of the plot area", () => {
    const { points } = buildTrendPath([0, 100]);
    expect(points[0]).toEqual({ x: 0, y: 90 });
    expect(points[1]).toEqual({ x: 760, y: 6 });
  });

  it("builds an M/L line path and a closed area path down to the x-axis", () => {
    const { linePath, areaPath } = buildTrendPath([10, 20, 10]);
    expect(linePath).toBe("M0,48 L380,6 L760,48");
    expect(areaPath).toBe("M0,48 L380,6 L760,48 L760,110 L0,110 Z");
  });

  it("treats a single point as a flat line at x=0", () => {
    const { points } = buildTrendPath([5]);
    expect(points).toEqual([{ x: 0, y: 6 }]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/trendPath.test.ts`
Expected: FAIL — `src/lib/trendPath.ts` doesn't exist yet.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/trendPath.ts
// SVG path builder for the admin trend chart — mirrors mockups/admin.html's
// hand-drawn <svg> line/area chart exactly (same viewBox, same path shape),
// architecture.md §13.4.

const WIDTH = 760;
const HEIGHT = 110;
const TOP_PAD = 6;
const BOTTOM_PAD = 20; // room for x-axis labels

export const TREND_CHART_VIEWBOX = `0 0 ${WIDTH} ${HEIGHT}`;

export type TrendPoint = { x: number; y: number };

export function buildTrendPath(values: number[]): { linePath: string; areaPath: string; points: TrendPoint[] } {
  if (values.length === 0) {
    return { linePath: "", areaPath: "", points: [] };
  }

  const max = Math.max(1, ...values);
  const innerHeight = HEIGHT - TOP_PAD - BOTTOM_PAD;
  const stepX = values.length > 1 ? WIDTH / (values.length - 1) : 0;

  const points: TrendPoint[] = values.map((v, i) => ({
    x: Math.round(i * stepX),
    y: Math.round(TOP_PAD + innerHeight * (1 - v / max)),
  }));

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  const areaPath = `${linePath} L${WIDTH},${HEIGHT} L0,${HEIGHT} Z`;

  return { linePath, areaPath, points };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/trendPath.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/trendPath.ts src/lib/trendPath.test.ts
git commit -m "feat(admin): add trend chart SVG path builder"
```

---

### Task 6: Count formatting (`src/lib/format.ts`)

**Files:**
- Modify: `src/lib/format.ts` (add one export; the existing `groupThousands` helper is reused, not duplicated)
- Modify: `src/lib/format.test.ts` (add a test block)

**Interfaces:**
- Produces: `formatCount(n: number): string` — thousands-grouped integer, no currency (e.g. `formatCount(34210) === "34'210"`). Used by Task 13 (`BreakdownBar`) and Task 14 (`Dashboard`'s total stat card).

- [ ] **Step 1: Write the failing test**

Append to `src/lib/format.test.ts`:

```ts
describe("formatCount", () => {
  it("groups thousands with an apostrophe, no currency or decimals", () => {
    expect(formatCount(34210)).toBe("34'210");
    expect(formatCount(999)).toBe("999");
    expect(formatCount(1234567)).toBe("1'234'567");
  });

  it("rounds non-integer input", () => {
    expect(formatCount(41.6)).toBe("42");
  });
});
```

And add `formatCount` to the existing top import line:
```ts
import { formatChf, formatMemberCount, formatMemberCountDetail, formatCount } from "@/lib/format";
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/format.test.ts`
Expected: FAIL — `formatCount` is not exported yet.

- [ ] **Step 3: Write the implementation**

In `src/lib/format.ts`, add after `groupThousands`:

```ts
// Thousands-grouped integer count, no currency (admin dashboard stat/breakdown panels).
export function formatCount(n: number): string {
  return groupThousands(String(Math.round(n)));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/format.test.ts`
Expected: PASS (all existing tests + 2 new)

- [ ] **Step 5: Commit**

```bash
git add src/lib/format.ts src/lib/format.test.ts
git commit -m "feat(admin): add formatCount for dashboard panels"
```

---

### Task 7: Wire `POST /api/log-inquiry` to the database

**Files:**
- Modify: `src/app/api/log-inquiry/route.ts`
- Test: `src/app/api/log-inquiry/route.test.ts`

**Interfaces:**
- Consumes: `getSql` from `src/lib/db.ts` (Task 1).
- No new exports — `POST` keeps its existing signature and status-code contract (400 invalid payload, 204 always otherwise).

- [ ] **Step 1: Write the failing test**

```ts
// src/app/api/log-inquiry/route.test.ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";
import * as db from "@/lib/db";

vi.mock("@/lib/db", () => ({ getSql: vi.fn() }));

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/api/log-inquiry", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

const validPayload = {
  regionId: "ZH-1",
  altersklasse: "erwachsen",
  franchise: 300,
  year: 2026,
  models: ["standard"],
  accident: true,
};

describe("POST /api/log-inquiry", () => {
  const originalUrl = process.env.POSTGRES_URL;

  afterEach(() => {
    process.env.POSTGRES_URL = originalUrl;
    vi.restoreAllMocks();
  });

  it("returns 400 on invalid payload", async () => {
    const res = await POST(makeRequest({ regionId: "" }));
    expect(res.status).toBe(400);
  });

  it("no-ops with 204 when POSTGRES_URL is unset", async () => {
    delete process.env.POSTGRES_URL;
    const res = await POST(makeRequest(validPayload));
    expect(res.status).toBe(204);
  });

  it("inserts the validated fields and returns 204 when POSTGRES_URL is set", async () => {
    process.env.POSTGRES_URL = "postgres://test";
    const fakeSql = vi.fn().mockResolvedValue([]);
    vi.mocked(db.getSql).mockReturnValue(fakeSql as unknown as ReturnType<typeof db.getSql>);

    const res = await POST(makeRequest(validPayload));

    expect(res.status).toBe(204);
    expect(fakeSql).toHaveBeenCalledTimes(1);
    const [strings, ...values] = fakeSql.mock.calls[0];
    expect(strings.join("?")).toContain("INSERT INTO inquiry_log");
    expect(values).toEqual(["ZH-1", "erwachsen", 300, 2026, ["standard"], true]);
  });

  it("still returns 204 if the insert throws", async () => {
    process.env.POSTGRES_URL = "postgres://test";
    const fakeSql = vi.fn().mockRejectedValue(new Error("db down"));
    vi.mocked(db.getSql).mockReturnValue(fakeSql as unknown as ReturnType<typeof db.getSql>);

    const res = await POST(makeRequest(validPayload));
    expect(res.status).toBe(204);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/api/log-inquiry/route.test.ts`
Expected: FAIL — no insert is issued yet, so `fakeSql` is never called.

- [ ] **Step 3: Write the implementation**

Replace the body of `src/app/api/log-inquiry/route.ts` from the `// No POSTGRES_URL configured` comment onward with:

```ts
  // No POSTGRES_URL configured (e.g. local dev) — no-op rather than error.
  if (!process.env.POSTGRES_URL) {
    return new NextResponse(null, { status: 204 });
  }

  try {
    const sql = getSql();
    await sql`INSERT INTO inquiry_log (region_id, altersklasse, franchise, year, models, accident)
              VALUES (${body.regionId}, ${body.altersklasse}, ${body.franchise}, ${body.year}, ${body.models}, ${body.accident})`;
    return new NextResponse(null, { status: 204 });
  } catch {
    // Logging failures must never surface to the user.
    return new NextResponse(null, { status: 204 });
  }
}
```

Add the import at the top of the file:
```ts
import { getSql } from "@/lib/db";
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/api/log-inquiry/route.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/app/api/log-inquiry/route.ts src/app/api/log-inquiry/route.test.ts
git commit -m "feat(admin): wire log-inquiry route to Postgres"
```

---

### Task 8: Wire `GET /api/admin/stats` to the database

**Files:**
- Modify: `src/app/api/admin/stats/route.ts`
- Test: `src/app/api/admin/stats/route.test.ts`

**Interfaces:**
- Consumes: `getSql` from `src/lib/db.ts` (Task 1); `selectGranularity` from `src/lib/adminStats.ts` (Task 3).
- Response shape is unchanged from the existing stub (preserve it exactly — `Dashboard` in Task 14 depends on it): `{ total: number; granularity: Granularity; trend: {bucket: string; n: number}[]; topRegions: {regionId: string; n: number}[]; altersklasse: {altersklasse: string; n: number}[]; franchise: {franchise: number; n: number}[]; models: {model: string; n: number}[]; accident: {accident: boolean; n: number}[] }`.

- [ ] **Step 1: Write the failing test**

```ts
// src/app/api/admin/stats/route.test.ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";
import * as db from "@/lib/db";

vi.mock("@/lib/db", () => ({ getSql: vi.fn() }));

function makeRequest(query: string) {
  return new NextRequest(`http://localhost/api/admin/stats?${query}`);
}

describe("GET /api/admin/stats", () => {
  const originalUrl = process.env.POSTGRES_URL;

  afterEach(() => {
    process.env.POSTGRES_URL = originalUrl;
    vi.restoreAllMocks();
  });

  it("returns 400 when from/to are missing or malformed", async () => {
    expect((await GET(makeRequest("from=2026-08-01"))).status).toBe(400);
    expect((await GET(makeRequest("from=bad&to=2026-08-11"))).status).toBe(400);
  });

  it("returns an empty-but-well-formed payload when POSTGRES_URL is unset", async () => {
    delete process.env.POSTGRES_URL;
    const res = await GET(makeRequest("from=2026-07-12&to=2026-08-11"));
    expect(await res.json()).toEqual({
      total: 0,
      granularity: "day",
      trend: [],
      topRegions: [],
      altersklasse: [],
      franchise: [],
      models: [],
      accident: [],
    });
  });

  it("runs the aggregation queries and assembles the response when POSTGRES_URL is set", async () => {
    process.env.POSTGRES_URL = "postgres://test";
    const fakeSql = vi.fn((strings: TemplateStringsArray) => {
      const text = strings.join("?");
      if (text.includes("COUNT(*)::int AS total")) return Promise.resolve([{ total: 42 }]);
      if (text.includes("date_trunc")) return Promise.resolve([{ bucket: "2026-08-01T00:00:00.000Z", n: 5 }]);
      if (text.includes("region_id")) return Promise.resolve([{ regionId: "ZH-1", n: 20 }]);
      if (text.includes("altersklasse")) return Promise.resolve([{ altersklasse: "erwachsen", n: 30 }]);
      if (text.includes("franchise")) return Promise.resolve([{ franchise: 300, n: 10 }]);
      if (text.includes("unnest(models)")) return Promise.resolve([{ model: "standard", n: 40 }]);
      if (text.includes("accident")) return Promise.resolve([{ accident: true, n: 35 }]);
      return Promise.resolve([]);
    });
    vi.mocked(db.getSql).mockReturnValue(fakeSql as unknown as ReturnType<typeof db.getSql>);

    const res = await GET(makeRequest("from=2026-07-12&to=2026-08-11"));
    const json = await res.json();

    expect(json).toEqual({
      total: 42,
      granularity: "day",
      trend: [{ bucket: "2026-08-01T00:00:00.000Z", n: 5 }],
      topRegions: [{ regionId: "ZH-1", n: 20 }],
      altersklasse: [{ altersklasse: "erwachsen", n: 30 }],
      franchise: [{ franchise: 300, n: 10 }],
      models: [{ model: "standard", n: 40 }],
      accident: [{ accident: true, n: 35 }],
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/api/admin/stats/route.test.ts`
Expected: FAIL — the current stub always returns the empty payload / 501, and never calls `getSql`.

- [ ] **Step 3: Write the implementation**

Replace `src/app/api/admin/stats/route.ts` entirely with:

```ts
// Aggregate activity stats for the admin dashboard (REQ-22, architecture.md §13.2).
// No raw log rows are ever exposed through this route — counts/aggregates only.

import { NextRequest, NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { selectGranularity } from "@/lib/adminStats";

type TotalRow = { total: number };
type TrendRow = { bucket: string; n: number };
type RegionRow = { regionId: string; n: number };
type AgeRow = { altersklasse: string; n: number };
type FranchiseRow = { franchise: number; n: number };
type ModelRow = { model: string; n: number };
type AccidentRow = { accident: boolean; n: number };

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  if (!from || !to || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return NextResponse.json({ error: "from/to must be YYYY-MM-DD" }, { status: 400 });
  }

  if (!process.env.POSTGRES_URL) {
    // No DB configured yet — return an empty-but-well-formed payload so the
    // dashboard UI can be built against a stable shape before data exists.
    return NextResponse.json({
      total: 0,
      granularity: "day",
      trend: [],
      topRegions: [],
      altersklasse: [],
      franchise: [],
      models: [],
      accident: [],
    });
  }

  const sql = getSql();
  const granularity = selectGranularity(from, to);

  const [totalRows, trendRows, regionRows, ageRows, franchiseRows, modelRows, accidentRows] = (await Promise.all([
    sql`SELECT COUNT(*)::int AS total FROM inquiry_log WHERE ts >= ${from} AND ts < ${to}`,
    sql`SELECT date_trunc(${granularity}, ts) AS bucket, COUNT(*)::int AS n FROM inquiry_log WHERE ts >= ${from} AND ts < ${to} GROUP BY 1 ORDER BY 1`,
    sql`SELECT region_id AS "regionId", COUNT(*)::int AS n FROM inquiry_log WHERE ts >= ${from} AND ts < ${to} GROUP BY 1 ORDER BY 2 DESC LIMIT 10`,
    sql`SELECT altersklasse, COUNT(*)::int AS n FROM inquiry_log WHERE ts >= ${from} AND ts < ${to} GROUP BY 1 ORDER BY 2 DESC`,
    sql`SELECT franchise, COUNT(*)::int AS n FROM inquiry_log WHERE ts >= ${from} AND ts < ${to} GROUP BY 1 ORDER BY 1`,
    sql`SELECT unnest(models) AS model, COUNT(*)::int AS n FROM inquiry_log WHERE ts >= ${from} AND ts < ${to} GROUP BY 1 ORDER BY 2 DESC`,
    sql`SELECT accident, COUNT(*)::int AS n FROM inquiry_log WHERE ts >= ${from} AND ts < ${to} GROUP BY 1`,
  ])) as [TotalRow[], TrendRow[], RegionRow[], AgeRow[], FranchiseRow[], ModelRow[], AccidentRow[]];

  return NextResponse.json({
    total: totalRows[0]?.total ?? 0,
    granularity,
    trend: trendRows,
    topRegions: regionRows,
    altersklasse: ageRows,
    franchise: franchiseRows,
    models: modelRows,
    accident: accidentRows,
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/api/admin/stats/route.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/app/api/admin/stats/route.ts src/app/api/admin/stats/route.test.ts
git commit -m "feat(admin): wire admin stats route to Postgres"
```

---

### Task 9: `X-Robots-Tag` header on all `/admin` responses

**Files:**
- Modify: `src/middleware.ts`
- Test: `src/middleware.test.ts`

**Interfaces:** none new — `middleware(request: NextRequest): NextResponse` keeps its existing signature and matcher config.

- [ ] **Step 1: Write the failing test**

```ts
// src/middleware.test.ts
import { describe, it, expect, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "./middleware";

describe("middleware — X-Robots-Tag on /admin routes", () => {
  const originalSecret = process.env.ADMIN_SECRET;

  afterEach(() => {
    process.env.ADMIN_SECRET = originalSecret;
  });

  it("sets X-Robots-Tag on an authorized /admin request", () => {
    process.env.ADMIN_SECRET = "s3cret";
    const req = new NextRequest("http://localhost/admin", { headers: { cookie: "admin_token=s3cret" } });
    const res = middleware(req);
    expect(res.headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
  });

  it("sets X-Robots-Tag on the login redirect for an unauthorized /admin request", () => {
    process.env.ADMIN_SECRET = "s3cret";
    const req = new NextRequest("http://localhost/admin");
    const res = middleware(req);
    expect(res.status).toBe(307);
    expect(res.headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
  });

  it("sets X-Robots-Tag on an unauthorized /api/admin request", () => {
    process.env.ADMIN_SECRET = "s3cret";
    const req = new NextRequest("http://localhost/api/admin/stats");
    const res = middleware(req);
    expect(res.status).toBe(401);
    expect(res.headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/middleware.test.ts`
Expected: FAIL — no `X-Robots-Tag` header is set today.

- [ ] **Step 3: Write the implementation**

In `src/middleware.ts`, replace the `middleware` function with:

```ts
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtectedApi = pathname.startsWith("/api/admin");
  const isProtectedPage = pathname.startsWith("/admin") && !pathname.startsWith("/admin/login");
  const isAdminRoute = pathname.startsWith("/admin") || pathname.startsWith("/api/admin");

  if (isProtectedApi || isProtectedPage) {
    const token = request.cookies.get("admin_token")?.value;
    const secret = process.env.ADMIN_SECRET;
    const authorized = Boolean(secret && token && safeEqual(token, secret));

    if (!authorized) {
      if (isProtectedApi) {
        return withRobotsHeader(NextResponse.json({ error: "unauthorized" }, { status: 401 }));
      }
      const loginUrl = new URL("/admin/login", request.url);
      return withRobotsHeader(NextResponse.redirect(loginUrl));
    }
  }

  if (isAdminRoute) {
    return withRobotsHeader(NextResponse.next());
  }

  return intlMiddleware(request);
}

// §13.5: /admin/** and /api/admin/** must never be indexed.
function withRobotsHeader(response: NextResponse): NextResponse {
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/middleware.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/middleware.ts src/middleware.test.ts
git commit -m "feat(admin): set X-Robots-Tag on admin routes"
```

---

### Task 10: Logout action + nav header (`AdminNav`)

**Files:**
- Create: `src/app/admin/actions.ts`
- Create: `src/components/admin/AdminNav.tsx`

**Interfaces:**
- Produces: `logoutAction(): Promise<void>` (server action, `src/app/admin/actions.ts`) — clears the `admin_token` cookie and redirects to `/admin/login`.
- Produces: `AdminNav()` — a server component (no `"use client"` needed; the logout button is a plain `<form action={logoutAction}>`, same pattern as the existing `/admin/login` form). Consumed by Task 14's `src/app/admin/page.tsx`. **Deliberately not rendered by `src/app/admin/layout.tsx`** — `layout.tsx` wraps `/admin/login` too, and a logout control makes no sense on the login screen; `AdminNav` is rendered directly by `page.tsx` instead (a documented deviation from `architecture.md` §13.3's file listing, which put the nav header in `layout.tsx`).
- No automated test — matches this repo's convention of manual verification for React components (see Global Constraints). Manual check: visiting `/admin/login` shows no nav bar (existing behavior, unchanged); visiting `/admin` (after Task 14 wires `AdminNav` in) shows the "Krankenkassenvergleich" / "ADMIN" nav bar with a working "Abmelden" button.

- [ ] **Step 1: Write `actions.ts`**

```ts
// src/app/admin/actions.ts
// Logout: clears the admin_token cookie and redirects to the login screen
// (REQ-22, architecture.md §13.3). Same "one cookie, no server-side session"
// model as the login action in admin/login/page.tsx.

"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function logoutAction() {
  const cookieStore = await cookies();
  cookieStore.delete("admin_token");
  redirect("/admin/login");
}
```

- [ ] **Step 2: Write `AdminNav.tsx`**

```tsx
// src/components/admin/AdminNav.tsx
// Shared nav header for the (authenticated) admin dashboard — markup and copy
// match mockups/admin.html's <nav> exactly. Not shown on /admin/login (see
// Task 10 notes) — rendered directly by admin/page.tsx instead of layout.tsx.

import { logoutAction } from "@/app/admin/actions";

export function AdminNav() {
  return (
    <nav className="sticky top-0 z-10 h-[52px] flex items-center gap-3 px-6 bg-on-surface text-on-primary">
      <span className="text-title-large">Krankenkassenvergleich</span>
      <span className="text-[11px] px-[7px] py-0.5 rounded bg-on-surface-variant text-outline tracking-[.4px]">
        ADMIN
      </span>
      <div className="flex-1" />
      <form action={logoutAction}>
        <button
          type="submit"
          className="text-[13px] text-outline px-2.5 py-[5px] rounded-[5px] border border-on-surface-variant bg-transparent hover:bg-on-surface-variant hover:text-on-primary"
        >
          Abmelden
        </button>
      </form>
    </nav>
  );
}
```

- [ ] **Step 3: Manual verification**

Run: `npm run dev`, visit `http://localhost:3000/admin/login` — confirm no nav bar appears (unchanged from before this task; `AdminNav` isn't wired into any page yet, that happens in Task 14).

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/actions.ts src/components/admin/AdminNav.tsx
git commit -m "feat(admin): add logout action and nav header component"
```

---

### Task 11: `RangePicker` component

**Files:**
- Create: `src/components/admin/RangePicker.tsx`

**Interfaces:**
- Consumes: `PRESETS`, `presetRange`, `formatRangeLabel`, `PresetKey` from `src/lib/adminRanges.ts` (Task 4).
- Produces: `RangePicker({ from, to, activePreset, onChange }: { from: string; to: string; activePreset: PresetKey | null; onChange: (range: { from: string; to: string; preset: PresetKey | null }) => void })`. Consumed by Task 14's `Dashboard`.
- No automated test (component — see Global Constraints).

- [ ] **Step 1: Write the implementation**

```tsx
// src/components/admin/RangePicker.tsx
// Preset buttons + custom date inputs, matching mockups/admin.html's
// .range-picker markup/copy exactly (architecture.md §13.3/§13.4).

"use client";

import { PRESETS, presetRange, formatRangeLabel, type PresetKey } from "@/lib/adminRanges";

type Range = { from: string; to: string; preset: PresetKey | null };

type Props = {
  from: string;
  to: string;
  activePreset: PresetKey | null;
  onChange: (range: Range) => void;
};

// `to` is always the exclusive upper bound (see adminRanges.ts); the date
// inputs show the *inclusive* end date to the user, converting back to the
// exclusive form on change.
function inclusiveToDisplay(to: string): string {
  const d = new Date(`${to}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

function exclusiveFromInclusiveDisplay(inclusiveTo: string): string {
  const d = new Date(`${inclusiveTo}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function RangePicker({ from, to, activePreset, onChange }: Props) {
  const today = new Date();

  return (
    <div className="bg-surface border border-outline-variant rounded-lg shadow-sm p-3 flex items-center gap-2 flex-wrap mb-5">
      <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide mr-1">Zeitraum</span>
      {PRESETS.map((p) => (
        <button
          key={p.key}
          type="button"
          aria-pressed={activePreset === p.key}
          onClick={() => onChange({ ...presetRange(p.key, today), preset: p.key })}
          className={`px-3 py-1.5 rounded-full border text-sm ${
            activePreset === p.key
              ? "bg-primary border-primary text-on-primary font-semibold"
              : "border-outline-variant text-on-surface-variant"
          }`}
        >
          {p.label}
        </button>
      ))}
      <div className="w-px h-[22px] bg-outline-variant mx-1" />
      <div className="flex items-center gap-1.5">
        <label htmlFor="date-from" className="sr-only">
          Von
        </label>
        <input
          id="date-from"
          type="date"
          value={from}
          onChange={(e) => onChange({ from: e.target.value, to, preset: null })}
          className="h-8 px-2 rounded-md border border-outline-variant text-[13px] text-on-surface-variant"
        />
        <span className="text-xs text-outline">→</span>
        <label htmlFor="date-to" className="sr-only">
          Bis
        </label>
        <input
          id="date-to"
          type="date"
          value={inclusiveToDisplay(to)}
          onChange={(e) => onChange({ from, to: exclusiveFromInclusiveDisplay(e.target.value), preset: null })}
          className="h-8 px-2 rounded-md border border-outline-variant text-[13px] text-on-surface-variant"
        />
      </div>
      <span className="ml-auto text-xs text-outline">{formatRangeLabel(from, to)}</span>
    </div>
  );
}
```

- [ ] **Step 2: Manual verification**

Deferred to Task 14 (this component isn't rendered by any page until `Dashboard` wires it in).

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/RangePicker.tsx
git commit -m "feat(admin): add RangePicker component"
```

---

### Task 12: `TrendChart` component

**Files:**
- Create: `src/components/admin/TrendChart.tsx`

**Interfaces:**
- Consumes: `buildTrendPath`, `TREND_CHART_VIEWBOX` from `src/lib/trendPath.ts` (Task 5); `type Granularity` from `src/lib/adminStats.ts` (Task 3).
- Produces: `TrendChart({ data, granularity }: { data: { bucket: string; n: number }[]; granularity: Granularity })`. Consumed by Task 14's `Dashboard`.
- No automated test (component — see Global Constraints); `buildTrendPath` itself is fully tested in Task 5.

- [ ] **Step 1: Write the implementation**

```tsx
// src/components/admin/TrendChart.tsx
// Inline SVG line+area chart — mirrors mockups/admin.html's hand-drawn <svg>
// exactly (architecture.md §13.4), driven by real bucket/n data via
// buildTrendPath.

import { buildTrendPath, TREND_CHART_VIEWBOX } from "@/lib/trendPath";
import type { Granularity } from "@/lib/adminStats";

type Point = { bucket: string; n: number };

const GRANULARITY_LABEL: Record<Granularity, string> = {
  hour: "stündlich",
  day: "täglich",
  month: "monatlich",
};

function formatBucketLabel(iso: string, granularity: Granularity): string {
  const d = new Date(iso);
  if (granularity === "hour") {
    return d.toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
  }
  if (granularity === "month") {
    return d.toLocaleDateString("de-CH", { month: "short", year: "numeric", timeZone: "UTC" });
  }
  return d.toLocaleDateString("de-CH", { day: "2-digit", month: "short", timeZone: "UTC" });
}

// Evenly-spaced label indices, capped at `maxLabels`, so a long trend doesn't
// crowd the x-axis (mockups/admin.html shows 7 for ~31 daily buckets).
function pickLabelIndices(count: number, maxLabels = 7): number[] {
  if (count === 0) return [];
  if (count <= maxLabels) return Array.from({ length: count }, (_, i) => i);
  const step = (count - 1) / (maxLabels - 1);
  return Array.from({ length: maxLabels }, (_, i) => Math.round(i * step));
}

export function TrendChart({ data, granularity }: { data: Point[]; granularity: Granularity }) {
  const { linePath, areaPath, points } = buildTrendPath(data.map((d) => d.n));
  const labelIndices = pickLabelIndices(points.length);

  return (
    <div className="bg-surface border border-outline-variant rounded-lg shadow-sm p-5 mb-4">
      <h2 className="text-title-medium text-on-surface-variant uppercase tracking-wide mb-4">
        Anfragen über Zeit{" "}
        <span className="font-normal normal-case tracking-normal text-[11px] text-outline">
          {GRANULARITY_LABEL[granularity]}
        </span>
      </h2>
      <div className="w-full h-[130px]">
        <svg
          viewBox={TREND_CHART_VIEWBOX}
          preserveAspectRatio="none"
          className="w-full h-full overflow-visible"
          role="img"
          aria-label={`Anfragen ${GRANULARITY_LABEL[granularity]}, ${data.length} Datenpunkte`}
        >
          {data.length > 0 && (
            <>
              <path d={areaPath} fill="rgba(0,83,219,.08)" />
              <path d={linePath} fill="none" stroke="var(--md-sys-color-primary)" strokeWidth={2} strokeLinejoin="round" />
              {labelIndices.map((i) => (
                <text key={i} x={points[i].x} y={108} className="text-[11px] fill-outline">
                  {formatBucketLabel(data[i].bucket, granularity)}
                </text>
              ))}
            </>
          )}
        </svg>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Manual verification**

Deferred to Task 14.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/TrendChart.tsx
git commit -m "feat(admin): add TrendChart component"
```

---

### Task 13: `BreakdownBar` component

**Files:**
- Create: `src/components/admin/BreakdownBar.tsx`

**Interfaces:**
- Consumes: `formatCount` from `src/lib/format.ts` (Task 6).
- Produces: `BreakdownBar({ rows, labelWidth }: { rows: { label: string; value: number }[]; labelWidth?: "normal" | "short" })`. Consumed by Task 14's `Dashboard` (5 times: regions, Altersklasse, accident, Franchise, model).
- No automated test (component — see Global Constraints).

- [ ] **Step 1: Write the implementation**

```tsx
// src/components/admin/BreakdownBar.tsx
// Reusable horizontal bar list — one component behind every breakdown panel
// (regions, Altersklasse, accident, Franchise, model), matching
// mockups/admin.html's identical .bar-chart markup across all of them
// (architecture.md §13.4). Bar width is relative to the largest row's value.

import { formatCount } from "@/lib/format";

type Row = { label: string; value: number };

export function BreakdownBar({ rows, labelWidth = "normal" }: { rows: Row[]; labelWidth?: "normal" | "short" }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  const total = rows.reduce((sum, r) => sum + r.value, 0) || 1;

  return (
    <div className="flex flex-col gap-2.5">
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-2">
          <span
            className={`shrink-0 text-[13px] text-on-surface-variant whitespace-nowrap overflow-hidden text-ellipsis ${
              labelWidth === "short" ? "w-[90px]" : "w-[130px]"
            }`}
          >
            {r.label}
          </span>
          <div className="flex-1 h-[18px] bg-surface-variant rounded-[3px] overflow-hidden">
            <div
              className="h-full bg-primary rounded-[3px] transition-[width] duration-300"
              style={{ width: `${(r.value / max) * 100}%` }}
            />
          </div>
          <span className="w-16 shrink-0 text-xs text-on-surface-variant text-right">
            {formatCount(r.value)} · {Math.round((r.value / total) * 100)}%
          </span>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Manual verification**

Deferred to Task 14.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/BreakdownBar.tsx
git commit -m "feat(admin): add BreakdownBar component"
```

---

### Task 14: `Dashboard` component + rewrite `admin/page.tsx`

**Files:**
- Create: `src/components/admin/Dashboard.tsx`
- Modify: `src/app/admin/page.tsx` (currently the monolithic placeholder page — replaced entirely)

**Interfaces:**
- Consumes: `RangePicker` (Task 11), `TrendChart` (Task 12), `BreakdownBar` (Task 13), `AdminNav` (Task 10), `presetRange`/`formatRangeLabel`/`type PresetKey` (Task 4), `formatCount` (Task 6), `type Granularity` (Task 3). Fetches `GET /api/admin/stats` (Task 8) via `swr`.
- Produces: `Dashboard({ initialFrom, initialTo, initialPreset }: { initialFrom: string; initialTo: string; initialPreset: PresetKey | null })`, rendered by `src/app/admin/page.tsx`.
- No automated test (component — see Global Constraints); every piece of logic it composes (`adminRanges`, `adminStats`, `trendPath`, `format`, the stats route itself) is already unit-tested in Tasks 3–8.

- [ ] **Step 1: Write `Dashboard.tsx`**

```tsx
// src/components/admin/Dashboard.tsx
// Owns range state, fetches /api/admin/stats, keeps the URL bookmarkable
// (architecture.md §13.3, REQ-22). Panel layout/copy matches
// mockups/admin.html exactly.

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { RangePicker } from "./RangePicker";
import { TrendChart } from "./TrendChart";
import { BreakdownBar } from "./BreakdownBar";
import { formatRangeLabel, type PresetKey } from "@/lib/adminRanges";
import { formatCount } from "@/lib/format";
import type { Granularity } from "@/lib/adminStats";

type Stats = {
  total: number;
  granularity: Granularity;
  trend: { bucket: string; n: number }[];
  topRegions: { regionId: string; n: number }[];
  altersklasse: { altersklasse: string; n: number }[];
  franchise: { franchise: number; n: number }[];
  models: { model: string; n: number }[];
  accident: { accident: boolean; n: number }[];
};

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const ALTERSKLASSE_LABEL: Record<string, string> = {
  erwachsen: "Erwachsen (26+)",
  jung: "Jung (19–25)",
  kind: "Kind (0–18)",
};

const MODEL_LABEL: Record<string, string> = {
  standard: "Standard",
  hausarzt: "Hausarzt",
  hmo: "HMO",
  telmed: "Telmed",
  andere: "Andere",
};

type Range = { from: string; to: string; preset: PresetKey | null };

export function Dashboard({
  initialFrom,
  initialTo,
  initialPreset,
}: {
  initialFrom: string;
  initialTo: string;
  initialPreset: PresetKey | null;
}) {
  const router = useRouter();
  const [range, setRange] = useState<Range>({ from: initialFrom, to: initialTo, preset: initialPreset });

  useEffect(() => {
    router.replace(`/admin?from=${range.from}&to=${range.to}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.from, range.to]);

  const { data: stats, isLoading } = useSWR<Stats>(
    `/api/admin/stats?from=${range.from}&to=${range.to}`,
    fetcher,
    { keepPreviousData: true },
  );

  const showSkeleton = isLoading && !stats;

  return (
    <main className="max-w-[1100px] mx-auto my-7 px-5">
      <h1 className="sr-only">Admin-Dashboard — Anfrage-Aktivität</h1>

      <RangePicker from={range.from} to={range.to} activePreset={range.preset} onChange={setRange} />

      <div className={showSkeleton ? "animate-pulse" : undefined}>
        <div className="bg-surface border border-outline-variant rounded-lg shadow-sm p-5 inline-block mb-5 min-w-[220px]">
          <div className="text-xs font-semibold text-outline uppercase tracking-wide">Anfragen im Zeitraum</div>
          <div className="text-4xl font-bold tracking-tight my-1 text-on-surface">
            {stats ? formatCount(stats.total) : "–"}
          </div>
          <div className="text-xs text-outline">{formatRangeLabel(range.from, range.to)}</div>
        </div>

        <TrendChart data={stats?.trend ?? []} granularity={stats?.granularity ?? "day"} />

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="bg-surface border border-outline-variant rounded-lg shadow-sm p-5">
            <h2 className="text-title-medium text-on-surface-variant uppercase tracking-wide mb-4">
              Top 10 Prämienregionen
            </h2>
            <BreakdownBar rows={(stats?.topRegions ?? []).map((r) => ({ label: r.regionId, value: r.n }))} />
          </div>
          <div className="bg-surface border border-outline-variant rounded-lg shadow-sm p-5">
            <h2 className="text-title-medium text-on-surface-variant uppercase tracking-wide mb-4">Altersklasse</h2>
            <BreakdownBar
              rows={(stats?.altersklasse ?? []).map((r) => ({
                label: ALTERSKLASSE_LABEL[r.altersklasse] ?? r.altersklasse,
                value: r.n,
              }))}
            />
            <h2 className="text-title-medium text-on-surface-variant uppercase tracking-wide mt-6 mb-4">
              Unfalldeckung
            </h2>
            <BreakdownBar
              rows={(stats?.accident ?? []).map((r) => ({
                label: r.accident ? "Eingeschlossen" : "Ausgeschlossen",
                value: r.n,
              }))}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-surface border border-outline-variant rounded-lg shadow-sm p-5">
            <h2 className="text-title-medium text-on-surface-variant uppercase tracking-wide mb-4">
              Franchise-Verteilung
            </h2>
            <BreakdownBar
              labelWidth="short"
              rows={(stats?.franchise ?? []).map((r) => ({ label: `CHF ${r.franchise}`, value: r.n }))}
            />
          </div>
          <div className="bg-surface border border-outline-variant rounded-lg shadow-sm p-5">
            <h2 className="text-title-medium text-on-surface-variant uppercase tracking-wide mb-4">
              Versicherungsmodell
            </h2>
            <BreakdownBar
              labelWidth="short"
              rows={(stats?.models ?? []).map((r) => ({ label: MODEL_LABEL[r.model] ?? r.model, value: r.n }))}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Rewrite `admin/page.tsx`**

```tsx
// src/app/admin/page.tsx
// Server component: resolves the initial range from URL search params
// (defaulting to last 30 days per architecture.md §13.3), renders the nav
// header and the client Dashboard.

import { AdminNav } from "@/components/admin/AdminNav";
import { Dashboard } from "@/components/admin/Dashboard";
import { presetRange } from "@/lib/adminRanges";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { from, to } = await searchParams;
  const defaultRange = presetRange("30d", new Date());

  const initialFrom = from && ISO_DATE.test(from) ? from : defaultRange.from;
  const initialTo = to && ISO_DATE.test(to) ? to : defaultRange.to;
  const usedDefault = initialFrom === defaultRange.from && initialTo === defaultRange.to && !from && !to;

  return (
    <>
      <AdminNav />
      <Dashboard initialFrom={initialFrom} initialTo={initialTo} initialPreset={usedDefault ? "30d" : null} />
    </>
  );
}
```

- [ ] **Step 3: Install `swr` if not already recorded, then verify the app builds**

```bash
grep -q '"swr"' package.json || npm install swr@^2.5.1
npx tsc --noEmit
```

Expected: no type errors. Fix any that surface (e.g. adjust the `Promise.all` cast in Task 8 if the Neon client's inferred row type doesn't narrow cleanly) before moving on.

- [ ] **Step 4: Manual verification**

Run: `npm run dev`. Visit `http://localhost:3000/admin/login`, log in with `ADMIN_SECRET` (set it in `.env.local` if not already set). Confirm:
- The nav bar ("Krankenkassenvergleich" / "ADMIN" / "Abmelden") renders, matching `mockups/admin.html`.
- The range picker shows all 6 presets plus custom date inputs; clicking a preset updates the URL (`?from=...&to=...`) and refetches.
- With no `POSTGRES_URL` set, all panels render with `0`/empty state (no crashes) — this is the existing stub behavior, preserved.
- If `POSTGRES_URL` is set and the migration (Task 2, Step 6) has run: submit a comparator inquiry from the public site, then confirm it appears in the dashboard's total count and relevant breakdown panels within the selected range.
- Clicking "Abmelden" clears the session and redirects to `/admin/login`.

- [ ] **Step 5: Run the full test suite**

Run: `npm test`
Expected: all tests pass, including every test file added in Tasks 1–9.

- [ ] **Step 6: Commit**

```bash
git add src/components/admin/Dashboard.tsx src/app/admin/page.tsx package.json package-lock.json
git commit -m "feat(admin): assemble the full admin dashboard"
```

---

## Self-Review Notes

- **Spec coverage:** every §13 subsection has a task — 13.1 (auth) was already implemented before this plan; 13.2 (data API) → Tasks 1, 2, 7, 8; 13.3 (component layout) → Tasks 10–14; 13.4 (visual design) → Tasks 10–14, driven by `mockups/admin.html`; 13.5 (robots) → Task 9.
- **Mockup step:** explicitly called out in Global Constraints and in every component task's header comment — no `mockups/admin.html` changes needed (already in sync), it's the reference for markup/copy/layout.
- **Deviation flagged:** nav header lives in `page.tsx`, not `layout.tsx` as `architecture.md` §13.3 lists it — documented in Task 10 with the reasoning (logout control doesn't belong on the login screen, and `layout.tsx` wraps both).
- **Type consistency checked:** `PresetKey`, `Granularity`, `Stats`, and the `{from, to, preset}` range shape are used identically across Tasks 4, 8, 11, 12, 14 — no naming drift.
