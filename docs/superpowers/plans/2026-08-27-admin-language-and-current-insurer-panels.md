# Admin Language & Current-Insurer Panels Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three aggregate breakdowns to the `/admin` dashboard — inquiries per UI language, distribution of the user's current insurer, and distribution of their self-reported current premium (coarse bands).

**Architecture:** Three new nullable columns on the existing `inquiry_log` table (`locale`, `current_insurer`, `current_premium_band`). The browser computes the premium band so the exact figure never leaves the client. `/api/log-inquiry` validates and stores the new fields; `/api/admin/stats` adds three `GROUP BY` queries; `Dashboard.tsx` renders three `BreakdownBar` panels with German copy.

**Tech Stack:** Next.js 15 App Router (route handlers), TypeScript, `@neondatabase/serverless` (tagged-template `sql`), Vitest, Tailwind v4, next-intl.

## Global Constraints

- The admin dashboard is **German-only** (REQ-25). All new panel copy is German. Do not add next-intl keys for admin strings — follow `Dashboard.tsx`, which hardcodes German.
- The inquiry log stores **no PII, no exact premium, no free-text, no join key** (REQ-21). The premium is bucketed **client-side**; only the band string reaches the server.
- Premium bands, exactly: `<250` (0 < chf < 250), `250-349` (250 ≤ chf < 350), `350-449` (350 ≤ chf < 450), `450-549` (450 ≤ chf < 550), `550+` (chf ≥ 550). `chf ≤ 0` or non-finite → no band.
- Locale values, exactly: `de`, `fr`, `it`, `en`, `pt`, `es` (from `routing.locales` in `src/i18n/routing.ts`).
- Logging must never surface an error to the user — `/api/log-inquiry` keeps returning `204`/`400` only, failures stay silent.
- New DB columns are **nullable** (historical rows predate them).
- `@neondatabase/serverless`'s `neon(url)` `.query()` takes **one statement per call**.
- Commit after every task with a `feat:` / `test:` / `docs:` prefixed message.

---

## File Structure

| File | Responsibility | Task |
|------|----------------|------|
| `src/lib/premiumBand.ts` (new) | Pure `premiumBand(chf)` helper + `PREMIUM_BANDS` / `PremiumBand` type | 1 |
| `src/lib/premiumBand.test.ts` (new) | Boundary tests for the helper | 1 |
| `scripts/migrateSql.ts` | Add `ALTER_TABLE_SQL`; add 3 columns to `CREATE_TABLE_SQL` | 2 |
| `scripts/migrate.ts` | Run `ALTER_TABLE_SQL` statements | 2 |
| `scripts/migrateSql.test.ts` | Assert new columns / ALTER statements present | 2 |
| `src/lib/inquiryLog.ts` | Extend payload builder with `locale` + current-plan fields | 3 |
| `src/lib/inquiryLog.test.ts` | Update call sites; test new field mapping | 3 |
| `src/app/api/log-inquiry/route.ts` | Validate + INSERT the 3 new fields | 4 |
| `src/app/api/log-inquiry/route.test.ts` | Update INSERT assertion; new validation tests | 4 |
| `src/components/InsuranceComparator.tsx` | Pass `locale` + `currentPlan` into the builder | 5 |
| `src/app/api/admin/stats/route.ts` | 3 new aggregate queries + response keys | 6 |
| `src/app/api/admin/stats/route.test.ts` | Update `.toEqual` payloads; assert new keys | 6 |
| `src/components/admin/Dashboard.tsx` | 3 new `BreakdownBar` panels | 7 |
| `mockups/admin.html` | Static parity for the 3 panels | 8 |
| `requirement.md`, `architecture.md` | Amend REQ-21, §10.3, §13.2, §13.4 | 8 |

---

## Task 1: `premiumBand` helper

**Files:**
- Create: `src/lib/premiumBand.ts`
- Test: `src/lib/premiumBand.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type PremiumBand = "<250" | "250-349" | "350-449" | "450-549" | "550+"`
  - `const PREMIUM_BANDS: readonly PremiumBand[]` — ascending order
  - `function premiumBand(chf: number): PremiumBand | null`

- [ ] **Step 1: Write the failing test**

Create `src/lib/premiumBand.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { premiumBand, PREMIUM_BANDS } from "./premiumBand";

describe("premiumBand", () => {
  it("bands typical adult premiums", () => {
    expect(premiumBand(249.99)).toBe("<250");
    expect(premiumBand(250)).toBe("250-349");
    expect(premiumBand(349.99)).toBe("250-349");
    expect(premiumBand(350)).toBe("350-449");
    expect(premiumBand(449.99)).toBe("350-449");
    expect(premiumBand(450)).toBe("450-549");
    expect(premiumBand(549.99)).toBe("450-549");
    expect(premiumBand(550)).toBe("550+");
    expect(premiumBand(1200)).toBe("550+");
  });

  it("returns null for non-positive or non-finite input", () => {
    expect(premiumBand(0)).toBeNull();
    expect(premiumBand(-10)).toBeNull();
    expect(premiumBand(Number.NaN)).toBeNull();
    expect(premiumBand(Number.POSITIVE_INFINITY)).toBeNull();
  });

  it("exposes the bands in ascending order", () => {
    expect(PREMIUM_BANDS).toEqual(["<250", "250-349", "350-449", "450-549", "550+"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/premiumBand.test.ts`
Expected: FAIL — `Failed to resolve import "./premiumBand"`.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/premiumBand.ts`:

```ts
// Coarse client-side bucketing of the user's self-reported current premium
// (architecture.md §10.3). The exact figure is never sent to the server —
// only the band string — so the inquiry log keeps no re-identifiable premium.

export type PremiumBand = "<250" | "250-349" | "350-449" | "450-549" | "550+";

export const PREMIUM_BANDS: readonly PremiumBand[] = [
  "<250",
  "250-349",
  "350-449",
  "450-549",
  "550+",
];

export function premiumBand(chf: number): PremiumBand | null {
  if (!Number.isFinite(chf) || chf <= 0) return null;
  if (chf < 250) return "<250";
  if (chf < 350) return "250-349";
  if (chf < 450) return "350-449";
  if (chf < 550) return "450-549";
  return "550+";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/premiumBand.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/premiumBand.ts src/lib/premiumBand.test.ts
git commit -m "feat: add premiumBand client-side bucketing helper"
```

---

## Task 2: Migration — new inquiry_log columns

**Files:**
- Modify: `scripts/migrateSql.ts`
- Modify: `scripts/migrate.ts`
- Test: `scripts/migrateSql.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `export const ALTER_TABLE_SQL: string[]` — one `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` statement per array element.

- [ ] **Step 1: Write the failing test**

Add to `scripts/migrateSql.test.ts` (new `describe` block, and extend the existing column list):

In the existing test `"declares every column the stats and log-inquiry queries expect"`, change the column array to:

```ts
for (const column of [
  "id", "ts", "region_id", "altersklasse", "franchise", "year", "models", "accident",
  "locale", "current_insurer", "current_premium_band",
]) {
```

Add at the end of the file:

```ts
describe("ALTER_TABLE_SQL", () => {
  it("adds each new column idempotently", () => {
    const joined = ALTER_TABLE_SQL.join("\n");
    for (const column of ["locale", "current_insurer", "current_premium_band"]) {
      expect(joined).toContain(`ADD COLUMN IF NOT EXISTS ${column}`);
    }
  });

  it("is a list of single statements", () => {
    expect(Array.isArray(ALTER_TABLE_SQL)).toBe(true);
    for (const stmt of ALTER_TABLE_SQL) {
      expect(stmt.match(/;/g) ?? []).toHaveLength(1);
    }
  });
});
```

Update the import line at the top of the test file:

```ts
import { CREATE_TABLE_SQL, CREATE_INDEX_SQL, ALTER_TABLE_SQL } from "./migrateSql";
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run scripts/migrateSql.test.ts`
Expected: FAIL — `ALTER_TABLE_SQL` is `undefined` / not exported, and `CREATE_TABLE_SQL` lacks the new columns.

- [ ] **Step 3: Write minimal implementation**

In `scripts/migrateSql.ts`, replace the `CREATE_TABLE_SQL` body so it includes the three columns:

```ts
export const CREATE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS inquiry_log (
  id                   BIGSERIAL PRIMARY KEY,
  ts                   TIMESTAMPTZ NOT NULL DEFAULT now(),
  region_id            TEXT NOT NULL,
  altersklasse         TEXT NOT NULL,
  franchise            SMALLINT NOT NULL,
  year                 SMALLINT NOT NULL,
  models               TEXT[] NOT NULL,
  accident             BOOLEAN NOT NULL,
  locale               TEXT,
  current_insurer      TEXT,
  current_premium_band TEXT
);
`.trim();
```

> Note: the existing test `"uses the column types specified in architecture.md §10.3"` asserts exact substrings `"id           BIGSERIAL PRIMARY KEY"`, `"franchise    SMALLINT NOT NULL"`, `"year         SMALLINT NOT NULL"` (with specific spacing). Update those three `expect(...).toContain(...)` strings in that test to match the new alignment above (`id                   BIGSERIAL PRIMARY KEY`, `franchise            SMALLINT NOT NULL`, `year                 SMALLINT NOT NULL`).

Append to `scripts/migrateSql.ts`:

```ts
// Columns added after inquiry_log first shipped (architecture.md §10.3).
// Idempotent so `npm run db:migrate` stays safe to re-run against a
// database that already has some or all of them.
export const ALTER_TABLE_SQL = [
  "ALTER TABLE inquiry_log ADD COLUMN IF NOT EXISTS locale TEXT;",
  "ALTER TABLE inquiry_log ADD COLUMN IF NOT EXISTS current_insurer TEXT;",
  "ALTER TABLE inquiry_log ADD COLUMN IF NOT EXISTS current_premium_band TEXT;",
];
```

In `scripts/migrate.ts`, update the import and run the statements after the `CREATE_TABLE_SQL` call:

```ts
import { CREATE_TABLE_SQL, CREATE_INDEX_SQL, ALTER_TABLE_SQL } from "./migrateSql";
```

```ts
  const sql = neon(url);
  await sql.query(CREATE_TABLE_SQL);
  for (const stmt of ALTER_TABLE_SQL) {
    await sql.query(stmt);
  }
  await sql.query(CREATE_INDEX_SQL);
  console.log("✓ inquiry_log table ready.");
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run scripts/migrateSql.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/migrateSql.ts scripts/migrate.ts scripts/migrateSql.test.ts
git commit -m "feat: migration adds locale/current_insurer/current_premium_band to inquiry_log"
```

---

## Task 3: Extend `buildInquiryLogPayload`

**Files:**
- Modify: `src/lib/inquiryLog.ts`
- Test: `src/lib/inquiryLog.test.ts`

**Interfaces:**
- Consumes: `premiumBand`, `PremiumBand` from `src/lib/premiumBand.ts` (Task 1).
- Produces: updated
  ```ts
  type InquiryLogPayload = {
    regionId: string; altersklasse: string; franchise: number; year: number;
    models: Tarifart[]; accident: boolean;
    locale: string;
    currentInsurer?: string;
    currentPremiumBand?: PremiumBand;
  };
  function buildInquiryLogPayload(input: {
    praemienregionId: string | null; altersklasse: string | null; franchise: number | null;
    year: number; altModelsActive: boolean; unfalldeckung: boolean;
    locale: string; currentInsurerCode: string | null; currentMonthlyPremium: number | null;
  }): InquiryLogPayload | null;
  ```

- [ ] **Step 1: Write the failing test**

In `src/lib/inquiryLog.test.ts`, update `BASE_INPUT` and the first assertion, then add new cases:

```ts
const BASE_INPUT = {
  praemienregionId: "ZH-1",
  altersklasse: "erwachsen",
  franchise: 300,
  year: 2026,
  altModelsActive: false,
  unfalldeckung: true,
  locale: "de",
  currentInsurerCode: null,
  currentMonthlyPremium: null,
};
```

Change the first test's expectation to include `locale: "de"`:

```ts
  it("maps the resolved query state to the log-inquiry payload shape", () => {
    expect(buildInquiryLogPayload(BASE_INPUT)).toEqual({
      regionId: "ZH-1",
      altersklasse: "erwachsen",
      franchise: 300,
      year: 2026,
      models: ["standard"],
      accident: true,
      locale: "de",
    });
  });
```

Add:

```ts
  it("carries the locale through unchanged", () => {
    expect(buildInquiryLogPayload({ ...BASE_INPUT, locale: "fr" })?.locale).toBe("fr");
  });

  it("includes currentInsurer only when an insurer code is set", () => {
    expect(buildInquiryLogPayload(BASE_INPUT)).not.toHaveProperty("currentInsurer");
    expect(
      buildInquiryLogPayload({ ...BASE_INPUT, currentInsurerCode: "1542" })?.currentInsurer,
    ).toBe("1542");
  });

  it("includes currentPremiumBand only when a usable premium is given", () => {
    expect(buildInquiryLogPayload(BASE_INPUT)).not.toHaveProperty("currentPremiumBand");
    expect(
      buildInquiryLogPayload({ ...BASE_INPUT, currentMonthlyPremium: 372.4 })?.currentPremiumBand,
    ).toBe("350-449");
    expect(
      buildInquiryLogPayload({ ...BASE_INPUT, currentMonthlyPremium: 0 }),
    ).not.toHaveProperty("currentPremiumBand");
  });

  it("returns null (no current-plan fields consulted) when required inputs are missing", () => {
    expect(
      buildInquiryLogPayload({
        ...BASE_INPUT,
        praemienregionId: null,
        currentInsurerCode: "1542",
        currentMonthlyPremium: 400,
      }),
    ).toBeNull();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/inquiryLog.test.ts`
Expected: FAIL — `currentInsurer` / `currentPremiumBand` / `locale` not on the payload.

- [ ] **Step 3: Write minimal implementation**

Replace `src/lib/inquiryLog.ts` body:

```ts
import { ALL_TARIFARTS } from "./lookup";
import { premiumBand, type PremiumBand } from "./premiumBand";
import type { Tarifart } from "./types";

export type InquiryLogPayload = {
  regionId: string;
  altersklasse: string;
  franchise: number;
  year: number;
  models: Tarifart[];
  accident: boolean;
  locale: string;
  currentInsurer?: string;
  currentPremiumBand?: PremiumBand;
};

export function buildInquiryLogPayload(input: {
  praemienregionId: string | null;
  altersklasse: string | null;
  franchise: number | null;
  year: number;
  altModelsActive: boolean;
  unfalldeckung: boolean;
  locale: string;
  currentInsurerCode: string | null;
  currentMonthlyPremium: number | null;
}): InquiryLogPayload | null {
  if (!input.praemienregionId || !input.altersklasse || !input.franchise) return null;

  const payload: InquiryLogPayload = {
    regionId: input.praemienregionId,
    altersklasse: input.altersklasse,
    franchise: input.franchise,
    year: input.year,
    models: input.altModelsActive ? ALL_TARIFARTS : ["standard"],
    accident: input.unfalldeckung,
    locale: input.locale,
  };

  if (input.currentInsurerCode) {
    payload.currentInsurer = input.currentInsurerCode;
  }

  const band =
    input.currentMonthlyPremium != null ? premiumBand(input.currentMonthlyPremium) : null;
  if (band) {
    payload.currentPremiumBand = band;
  }

  return payload;
}
```

Keep the module's existing header comment.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/inquiryLog.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/inquiryLog.ts src/lib/inquiryLog.test.ts
git commit -m "feat: buildInquiryLogPayload carries locale + current insurer/premium band"
```

---

## Task 4: `/api/log-inquiry` — validate & store new fields

**Files:**
- Modify: `src/app/api/log-inquiry/route.ts`
- Test: `src/app/api/log-inquiry/route.test.ts`

**Interfaces:**
- Consumes: `PREMIUM_BANDS` from `src/lib/premiumBand.ts`; `routing` from `src/i18n/routing.ts`; `insurersData` from `src/data/insurers.json`.
- Produces: `POST` handler that accepts `{ ...existing, locale, currentInsurer?, currentPremiumBand? }`.

- [ ] **Step 1: Write the failing tests**

In `src/app/api/log-inquiry/route.test.ts`, update `validPayload` to include `locale`:

```ts
const validPayload = {
  regionId: "ZH-1",
  altersklasse: "erwachsen",
  franchise: 300,
  year: 2026,
  models: ["standard"],
  accident: true,
  locale: "de",
};
```

Update the INSERT assertion in `"inserts the validated fields and returns 204..."`:

```ts
    const [strings, ...values] = fakeSql.mock.calls[0];
    expect(strings.join("?")).toContain("INSERT INTO inquiry_log");
    expect(values).toEqual(["ZH-1", "erwachsen", 300, 2026, ["standard"], true, "de", null, null]);
```

Add new tests inside the `describe`:

```ts
  it("returns 400 when locale is missing", async () => {
    const { locale, ...noLocale } = validPayload;
    void locale;
    const res = await POST(makeRequest(noLocale));
    expect(res.status).toBe(400);
  });

  it("returns 400 on an unknown locale", async () => {
    const res = await POST(makeRequest({ ...validPayload, locale: "xx" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 on an unknown current insurer code", async () => {
    const res = await POST(makeRequest({ ...validPayload, currentInsurer: "not-a-code" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 on an unknown premium band", async () => {
    const res = await POST(makeRequest({ ...validPayload, currentPremiumBand: "999+" }));
    expect(res.status).toBe(400);
  });

  it("stores current insurer and premium band when valid", async () => {
    process.env.POSTGRES_URL = "postgres://test";
    const fakeSql = vi.fn().mockResolvedValue([]);
    vi.mocked(db.getSql).mockReturnValue(fakeSql as unknown as ReturnType<typeof db.getSql>);

    const res = await POST(
      makeRequest({ ...validPayload, currentInsurer: "1542", currentPremiumBand: "350-449" }),
    );

    expect(res.status).toBe(204);
    const [, ...values] = fakeSql.mock.calls[0];
    expect(values).toEqual([
      "ZH-1", "erwachsen", 300, 2026, ["standard"], true, "de", "1542", "350-449",
    ]);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/app/api/log-inquiry/route.test.ts`
Expected: FAIL — old INSERT has 6 values; `locale` not validated.

- [ ] **Step 3: Write the implementation**

Rewrite `src/app/api/log-inquiry/route.ts`:

```ts
// REQ-21: append-only inquiry log for activity monitoring, no PII (architecture.md §10).
// Silent on failure — logging must never block or degrade the comparison UI.

import { NextRequest, NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { routing } from "@/i18n/routing";
import { PREMIUM_BANDS } from "@/lib/premiumBand";
import insurersData from "@/data/insurers.json";

const TARIFARTEN = ["standard", "hmo", "hausarzt", "telmed", "andere"];
const ALTERSKLASSEN = ["kind", "jung", "erwachsen"];
const LOCALES: readonly string[] = routing.locales;
const INSURER_CODES = new Set(insurersData.map((i) => i.insurerCode));
const BANDS: readonly string[] = PREMIUM_BANDS;

type InquiryPayload = {
  regionId: string;
  altersklasse: string;
  franchise: number;
  year: number;
  models: string[];
  accident: boolean;
  locale: string;
  currentInsurer?: string;
  currentPremiumBand?: string;
};

function isValidPayload(body: unknown): body is InquiryPayload {
  if (typeof body !== "object" || body === null) return false;
  const b = body as Record<string, unknown>;

  const baseOk =
    typeof b.regionId === "string" &&
    b.regionId.length > 0 &&
    typeof b.altersklasse === "string" &&
    ALTERSKLASSEN.includes(b.altersklasse) &&
    typeof b.franchise === "number" &&
    typeof b.year === "number" &&
    Array.isArray(b.models) &&
    b.models.every((m) => typeof m === "string" && TARIFARTEN.includes(m)) &&
    typeof b.accident === "boolean" &&
    typeof b.locale === "string" &&
    LOCALES.includes(b.locale);

  if (!baseOk) return false;

  if (b.currentInsurer !== undefined) {
    if (typeof b.currentInsurer !== "string" || !INSURER_CODES.has(b.currentInsurer)) return false;
  }
  if (b.currentPremiumBand !== undefined) {
    if (typeof b.currentPremiumBand !== "string" || !BANDS.includes(b.currentPremiumBand)) return false;
  }
  return true;
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  if (!isValidPayload(body)) {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  // No POSTGRES_URL configured (e.g. local dev) — no-op rather than error.
  if (!process.env.POSTGRES_URL) {
    return new NextResponse(null, { status: 204 });
  }

  try {
    const sql = getSql();
    await sql`INSERT INTO inquiry_log
              (region_id, altersklasse, franchise, year, models, accident, locale, current_insurer, current_premium_band)
              VALUES (${body.regionId}, ${body.altersklasse}, ${body.franchise}, ${body.year},
                      ${body.models}, ${body.accident}, ${body.locale},
                      ${body.currentInsurer ?? null}, ${body.currentPremiumBand ?? null})`;
    return new NextResponse(null, { status: 204 });
  } catch {
    // Logging failures must never surface to the user.
    return new NextResponse(null, { status: 204 });
  }
}
```

> The test asserts `values` positionally: `[region_id, altersklasse, franchise, year, models, accident, locale, current_insurer, current_premium_band]`. Keep the `VALUES (...)` interpolation order exactly matching that.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/app/api/log-inquiry/route.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/log-inquiry/route.ts src/app/api/log-inquiry/route.test.ts
git commit -m "feat: log-inquiry validates + stores locale, current insurer, premium band"
```

---

## Task 5: Wire `InsuranceComparator` to send the new fields

**Files:**
- Modify: `src/components/InsuranceComparator.tsx` (the debounced log effect near line 161)

**Interfaces:**
- Consumes: `buildInquiryLogPayload` new signature (Task 3). `locale` is already in scope (`const locale = useLocale();`, line 55). `currentPlan` state is already in scope (line 65).

- [ ] **Step 1: Update the log effect**

Find the effect that builds and POSTs the inquiry payload (starts `const payload = buildInquiryLogPayload({` around line 162). Change the argument object to add the three inputs:

```ts
    const payload = buildInquiryLogPayload({
      praemienregionId,
      altersklasse,
      franchise,
      year,
      altModelsActive,
      unfalldeckung,
      locale,
      currentInsurerCode: currentPlan.insurerCode ?? null,
      currentMonthlyPremium: currentPlan.monthlyPremium ?? null,
    });
```

**Do not** add `locale` or `currentPlan` to the effect's dependency array — leave the existing deps list and the `eslint-disable-next-line react-hooks/exhaustive-deps` exactly as they are. Update the existing comment block above the effect to note the current-plan fields are captured opportunistically at fire time (a plan entered after the last trigger fire lands on the next fire).

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. (If `tsc` reports pre-existing unrelated errors, confirm none reference `InsuranceComparator.tsx` or `inquiryLog.ts`.)

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: no new errors for `InsuranceComparator.tsx`.

- [ ] **Step 4: Full test run**

Run: `npm test`
Expected: PASS (nothing regressed; this file has no unit test).

- [ ] **Step 5: Commit**

```bash
git add src/components/InsuranceComparator.tsx
git commit -m "feat: comparator sends locale + current plan to the inquiry log"
```

---

## Task 6: `/api/admin/stats` — three new aggregates

**Files:**
- Modify: `src/app/api/admin/stats/route.ts`
- Test: `src/app/api/admin/stats/route.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: response JSON gains
  ```ts
  languages: { locale: string; n: number }[];
  currentInsurers: { insurerCode: string; n: number }[];
  premiumBands: { band: string; n: number }[];
  ```

- [ ] **Step 1: Update the failing tests**

In `src/app/api/admin/stats/route.test.ts`:

Update the empty-payload `.toEqual` (in `"returns an empty-but-well-formed payload when POSTGRES_URL is unset"`):

```ts
    expect(await res.json()).toEqual({
      total: 0,
      granularity: "day",
      trend: [],
      topRegions: [],
      altersklasse: [],
      franchise: [],
      models: [],
      accident: [],
      languages: [],
      currentInsurers: [],
      premiumBands: [],
    });
```

In `"runs the aggregation queries and assembles the response..."`, add branches to `fakeSql` **before** the final `return Promise.resolve([])`:

```ts
      if (text.includes("COALESCE(locale")) return Promise.resolve([{ locale: "de", n: 12 }]);
      if (text.includes("current_insurer")) return Promise.resolve([{ insurerCode: "1542", n: 7 }]);
      if (text.includes("current_premium_band")) return Promise.resolve([{ band: "250-349", n: 4 }]);
```

> Ordering: place the `current_insurer` / `current_premium_band` checks **after** the existing `if (text.includes("accident"))` check is fine — none of the existing substrings (`total`, `date_trunc`, `region_id`, `altersklasse`, `franchise`, `unnest(models)`, `accident`) appear in the three new query texts, and vice versa. Place `COALESCE(locale` anywhere before the fallback.

Extend the final `.toEqual`:

```ts
    expect(json).toEqual({
      total: 42,
      granularity: "day",
      trend: expectedTrend,
      topRegions: [{ regionId: "ZH-1", n: 20 }],
      altersklasse: [{ altersklasse: "erwachsen", n: 30 }],
      franchise: [{ franchise: 300, n: 10 }],
      models: [{ model: "standard", n: 40 }],
      accident: [{ accident: true, n: 35 }],
      languages: [{ locale: "de", n: 12 }],
      currentInsurers: [{ insurerCode: "1542", n: 7 }],
      premiumBands: [{ band: "250-349", n: 4 }],
    });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/app/api/admin/stats/route.test.ts`
Expected: FAIL — response missing the three keys.

- [ ] **Step 3: Write the implementation**

In `src/app/api/admin/stats/route.ts`:

Add row types near the others:

```ts
type LanguageRow = { locale: string; n: number };
type CurrentInsurerRow = { insurerCode: string; n: number };
type PremiumBandRow = { band: string; n: number };
```

Extend the no-`POSTGRES_URL` early return:

```ts
    return NextResponse.json({
      total: 0,
      granularity: "day",
      trend: [],
      topRegions: [],
      altersklasse: [],
      franchise: [],
      models: [],
      accident: [],
      languages: [],
      currentInsurers: [],
      premiumBands: [],
    });
```

Add three `let` bindings and three queries to the `Promise.all` (and widen the destructuring + the `as [...]` tuple):

```ts
  let languageRows: LanguageRow[];
  let currentInsurerRows: CurrentInsurerRow[];
  let premiumBandRows: PremiumBandRow[];

  try {
    const sql = getSql();
    [
      totalRows, trendRows, regionRows, ageRows, franchiseRows, modelRows, accidentRows,
      languageRows, currentInsurerRows, premiumBandRows,
    ] = (await Promise.all([
      sql`SELECT COUNT(*)::int AS total FROM inquiry_log WHERE ts >= ${from} AND ts < ${to}`,
      sql`SELECT date_trunc(${granularity}, ts) AS bucket, COUNT(*)::int AS n FROM inquiry_log WHERE ts >= ${from} AND ts < ${to} GROUP BY 1 ORDER BY 1`,
      sql`SELECT region_id AS "regionId", COUNT(*)::int AS n FROM inquiry_log WHERE ts >= ${from} AND ts < ${to} GROUP BY 1 ORDER BY 2 DESC LIMIT 10`,
      sql`SELECT altersklasse, COUNT(*)::int AS n FROM inquiry_log WHERE ts >= ${from} AND ts < ${to} GROUP BY 1 ORDER BY 2 DESC`,
      sql`SELECT franchise, COUNT(*)::int AS n FROM inquiry_log WHERE ts >= ${from} AND ts < ${to} GROUP BY 1 ORDER BY 1`,
      sql`SELECT unnest(models) AS model, COUNT(*)::int AS n FROM inquiry_log WHERE ts >= ${from} AND ts < ${to} GROUP BY 1 ORDER BY 2 DESC`,
      sql`SELECT accident, COUNT(*)::int AS n FROM inquiry_log WHERE ts >= ${from} AND ts < ${to} GROUP BY 1`,
      sql`SELECT COALESCE(locale, 'unbekannt') AS locale, COUNT(*)::int AS n FROM inquiry_log WHERE ts >= ${from} AND ts < ${to} GROUP BY 1 ORDER BY 2 DESC`,
      sql`SELECT current_insurer AS "insurerCode", COUNT(*)::int AS n FROM inquiry_log WHERE ts >= ${from} AND ts < ${to} AND current_insurer IS NOT NULL GROUP BY 1 ORDER BY 2 DESC LIMIT 10`,
      sql`SELECT current_premium_band AS band, COUNT(*)::int AS n FROM inquiry_log WHERE ts >= ${from} AND ts < ${to} AND current_premium_band IS NOT NULL GROUP BY 1`,
    ])) as [
      TotalRow[], TrendRow[], RegionRow[], AgeRow[], FranchiseRow[], ModelRow[], AccidentRow[],
      LanguageRow[], CurrentInsurerRow[], PremiumBandRow[],
    ];
  } catch {
    return NextResponse.json({ error: "query failed" }, { status: 500 });
  }
```

Extend the success response:

```ts
  return NextResponse.json({
    total: totalRows[0]?.total ?? 0,
    granularity,
    trend: fillTrendGaps(trendRows, granularity, from, to),
    topRegions: regionRows,
    altersklasse: ageRows,
    franchise: franchiseRows,
    models: modelRows,
    accident: accidentRows,
    languages: languageRows,
    currentInsurers: currentInsurerRows,
    premiumBands: premiumBandRows,
  });
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/app/api/admin/stats/route.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/admin/stats/route.ts src/app/api/admin/stats/route.test.ts
git commit -m "feat: admin stats returns language, current-insurer, premium-band breakdowns"
```

---

## Task 7: Dashboard panels

**Files:**
- Modify: `src/components/admin/Dashboard.tsx`

**Interfaces:**
- Consumes: `stats.languages`, `stats.currentInsurers`, `stats.premiumBands` (Task 6); `PREMIUM_BANDS` from `src/lib/premiumBand.ts`; `insurersData` from `src/data/insurers.json`; existing `BreakdownBar`.

- [ ] **Step 1: Extend the `Stats` type**

Add to the `type Stats = { ... }` block:

```ts
  languages: { locale: string; n: number }[];
  currentInsurers: { insurerCode: string; n: number }[];
  premiumBands: { band: string; n: number }[];
```

- [ ] **Step 2: Add imports and label maps**

Add imports near the top:

```ts
import insurersData from "@/data/insurers.json";
import { PREMIUM_BANDS } from "@/lib/premiumBand";
```

Add module-level constants beside `ALTERSKLASSE_LABEL` / `MODEL_LABEL`:

```ts
const LOCALE_LABEL: Record<string, string> = {
  de: "Deutsch",
  fr: "Français",
  it: "Italiano",
  en: "English",
  pt: "Português",
  es: "Español",
  unbekannt: "Unbekannt",
};

const INSURER_NAME: Record<string, string> = Object.fromEntries(
  insurersData.map((i) => [i.insurerCode, i.insurerName]),
);

const PREMIUM_BAND_LABEL: Record<string, string> = {
  "<250": "CHF <250",
  "250-349": "CHF 250–349",
  "350-449": "CHF 350–449",
  "450-549": "CHF 450–549",
  "550+": "CHF 550+",
};

function orderedBandRows(rows: { band: string; n: number }[]): { label: string; value: number }[] {
  const byBand = new Map(rows.map((r) => [r.band, r.n]));
  return PREMIUM_BANDS.filter((b) => byBand.has(b)).map((b) => ({
    label: PREMIUM_BAND_LABEL[b] ?? b,
    value: byBand.get(b) ?? 0,
  }));
}
```

- [ ] **Step 3: Add the three panels**

Immediately after the closing `</div>` of the final `grid grid-cols-2 gap-4` block (the Franchise/Versicherungsmodell grid, ends around line 145) and still inside the `showSkeleton` wrapper `<div>`, insert:

```tsx
          <div className="bg-surface border border-outline-variant rounded-lg shadow-sm p-5 mt-4">
            <h2 className="text-title-medium text-on-surface-variant uppercase tracking-wide mb-4">
              Anfragen pro Sprache
            </h2>
            <BreakdownBar
              rows={(stats?.languages ?? []).map((r) => ({
                label: LOCALE_LABEL[r.locale] ?? r.locale,
                value: r.n,
              }))}
              total={stats?.total}
            />
          </div>

          <div className="grid grid-cols-2 gap-4 mt-4">
            <div className="bg-surface border border-outline-variant rounded-lg shadow-sm p-5">
              <h2 className="text-title-medium text-on-surface-variant uppercase tracking-wide mb-1">
                Aktuelle Krankenkasse
              </h2>
              <p className="text-body-small text-outline mb-4">
                nur Anfragen mit angegebenem aktuellem Plan
              </p>
              <BreakdownBar
                rows={(stats?.currentInsurers ?? []).map((r) => ({
                  label: INSURER_NAME[r.insurerCode] ?? r.insurerCode,
                  value: r.n,
                }))}
              />
            </div>
            <div className="bg-surface border border-outline-variant rounded-lg shadow-sm p-5">
              <h2 className="text-title-medium text-on-surface-variant uppercase tracking-wide mb-1">
                Aktuelle Prämie
              </h2>
              <p className="text-body-small text-outline mb-4">
                nur Anfragen mit angegebener aktueller Prämie
              </p>
              <BreakdownBar labelWidth="short" rows={orderedBandRows(stats?.premiumBands ?? [])} />
            </div>
          </div>
```

- [ ] **Step 4: Typecheck + lint + tests**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: all pass.

- [ ] **Step 5: Visual check**

Run: `npm run dev`, open `http://localhost:3000/admin` (set the `admin_token` cookie / log in via `/admin/login` with `ADMIN_SECRET`). Confirm the three panels render below the existing grid without layout shift. With no DB configured, they render empty (no rows) — that is expected.

- [ ] **Step 6: Commit**

```bash
git add src/components/admin/Dashboard.tsx
git commit -m "feat: admin dashboard shows language, current-insurer, premium-band panels"
```

---

## Task 8: Mockup + requirement/architecture docs

**Files:**
- Modify: `mockups/admin.html`
- Modify: `requirement.md` (REQ-21, line ~286)
- Modify: `architecture.md` (§10.3, §13.2, §13.4)

**Interfaces:** none — documentation only.

- [ ] **Step 1: Update `mockups/admin.html`**

After the closing `</div>` of the `<!-- ── Franchise + Model ── -->` `grid-2` block (around line 435), before `</main>`, add markup mirroring the existing `.card` / `.bar-chart` / `.bar-row` pattern:

```html
  <!-- ── Language ── -->
  <div class="card" style="margin-top:16px;">
    <h2>Anfragen pro Sprache</h2>
    <div class="bar-chart">
      <div class="bar-row"><span class="bar-row-label">Deutsch</span>  <div class="bar-track"><div class="bar-fill" style="width:100%"></div></div><span class="bar-value">24'100 · 71%</span></div>
      <div class="bar-row"><span class="bar-row-label">Français</span> <div class="bar-track"><div class="bar-fill" style="width:24%"></div></div> <span class="bar-value"> 5'800 · 17%</span></div>
      <div class="bar-row"><span class="bar-row-label">Italiano</span> <div class="bar-track"><div class="bar-fill" style="width:11%"></div></div> <span class="bar-value"> 2'600 · 8%</span></div>
      <div class="bar-row"><span class="bar-row-label">English</span>  <div class="bar-track"><div class="bar-fill" style="width:6%"></div></div>  <span class="bar-value"> 1'400 · 4%</span></div>
    </div>
  </div>

  <!-- ── Current insurer + current premium ── -->
  <div class="grid-2" style="margin-top:16px;">
    <div class="card">
      <h2>Aktuelle Krankenkasse</h2>
      <p style="font-size:12px;color:var(--md-sys-color-outline);margin:-4px 0 12px;">nur Anfragen mit angegebenem aktuellem Plan</p>
      <div class="bar-chart">
        <div class="bar-row"><span class="bar-row-label">Assura</span>   <div class="bar-track"><div class="bar-fill" style="width:100%"></div></div><span class="bar-value">3'200 · 28%</span></div>
        <div class="bar-row"><span class="bar-row-label">CSS</span>      <div class="bar-track"><div class="bar-fill" style="width:70%"></div></div> <span class="bar-value">2'240 · 20%</span></div>
        <div class="bar-row"><span class="bar-row-label">Helsana</span>  <div class="bar-track"><div class="bar-fill" style="width:55%"></div></div> <span class="bar-value">1'760 · 15%</span></div>
        <div class="bar-row"><span class="bar-row-label">Groupe Mutuel</span><div class="bar-track"><div class="bar-fill" style="width:40%"></div></div><span class="bar-value">1'280 · 11%</span></div>
      </div>
    </div>
    <div class="card">
      <h2>Aktuelle Prämie</h2>
      <p style="font-size:12px;color:var(--md-sys-color-outline);margin:-4px 0 12px;">nur Anfragen mit angegebener aktueller Prämie</p>
      <div class="bar-chart">
        <div class="bar-row"><span class="bar-row-label short">CHF &lt;250</span>   <div class="bar-track"><div class="bar-fill" style="width:20%"></div></div> <span class="bar-value">1'100 · 12%</span></div>
        <div class="bar-row"><span class="bar-row-label short">CHF 250–349</span> <div class="bar-track"><div class="bar-fill" style="width:60%"></div></div> <span class="bar-value">3'300 · 36%</span></div>
        <div class="bar-row"><span class="bar-row-label short">CHF 350–449</span> <div class="bar-track"><div class="bar-fill" style="width:100%"></div></div><span class="bar-value">4'200 · 45%</span></div>
        <div class="bar-row"><span class="bar-row-label short">CHF 450–549</span> <div class="bar-track"><div class="bar-fill" style="width:12%"></div></div> <span class="bar-value">  500 · 5%</span></div>
        <div class="bar-row"><span class="bar-row-label short">CHF 550+</span>    <div class="bar-track"><div class="bar-fill" style="width:5%"></div></div>  <span class="bar-value">  180 · 2%</span></div>
      </div>
    </div>
  </div>
```

If `.bar-row-label` has no non-`short` width rule that fits "Groupe Mutuel", let it truncate as the existing region labels do — do not add new CSS.

- [ ] **Step 2: Amend REQ-21 in `requirement.md`**

Replace the sentence *"It does **not** record IP address, the optional current-plan fields, or any other data not needed for aggregate usage analysis."* with:

> It additionally records the UI language, the selected current insurer (BAG insurer code only), and a coarse band of the self-reported current premium (five ~100-CHF buckets, computed in the browser). It does **not** record IP address, the **exact** current premium, any free-text, or any join key back to a user or session. Logged data is used solely for understanding usage patterns (popular regions, peak times, filter usage, language mix, incumbent insurers) and is never sold or shared.

- [ ] **Step 3: Amend `architecture.md` §10.3**

Update the SQL block to add `locale TEXT`, `current_insurer TEXT`, `current_premium_band TEXT` (all nullable), and add a sentence: *"`current_premium_band` is one of `<250 | 250-349 | 350-449 | 450-549 | 550+`, bucketed client-side — the exact premium is never transmitted."*

- [ ] **Step 4: Amend `architecture.md` §13.2 and §13.4**

§13.2: add the three queries (8. language, 9. current insurer top 10, 10. premium band) to the SQL list.
§13.4: add "Language", "Current insurer", and "Current premium" panels to the ASCII layout and the panel inventory; note the last two are "only inquiries where the current plan was provided".

- [ ] **Step 5: Verify build**

Run: `npm test && npm run lint`
Expected: pass (no code changed, but confirms nothing broke).

- [ ] **Step 6: Commit**

```bash
git add mockups/admin.html requirement.md architecture.md
git commit -m "docs: reconcile REQ-21, architecture, admin mockup with the new panels"
```

---

## Self-Review

**Spec coverage:**
- §1 data model → Task 2 (columns) + Task 1 (band definition).
- §2 client→API: `premiumBand` → Task 1; `inquiryLog.ts` → Task 3; `InsuranceComparator` → Task 5; `/api/log-inquiry` → Task 4.
- §3 stats API → Task 6.
- §4 dashboard UI → Task 7.
- §5 mockup → Task 8 Step 1.
- §6 requirement/architecture changes → Task 8 Steps 2–4.
- §7 tests → embedded in Tasks 1, 2, 3, 4, 6 (§7's `adminStats.test.ts` "verify only" row needs no change — covered by `npm test` in Tasks 6/7).
- §8 out of scope → nothing to implement; historical rows surface as `unbekannt` (Task 6 `COALESCE`) / omitted (Tasks 6 `IS NOT NULL`).

**Placeholder scan:** none — all steps carry concrete code.

**Type consistency:**
- `PremiumBand` / `PREMIUM_BANDS` — defined Task 1, consumed Tasks 3, 4, 7 with matching names.
- Payload field names `currentInsurer` / `currentPremiumBand` — consistent across Tasks 3, 4, and the comparator input names `currentInsurerCode` / `currentMonthlyPremium` (Tasks 3, 5).
- Stats response keys `languages` / `currentInsurers` / `premiumBands` and row shapes `{ locale, n }` / `{ insurerCode, n }` / `{ band, n }` — identical in Tasks 6 and 7.
- `ALTER_TABLE_SQL` is `string[]` — produced Task 2, consumed only by `migrate.ts` in the same task.
