# Admin Age-Distribution Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an "Altersverteilung" panel to the `/admin` dashboard showing inquiries bucketed into eight coarse age bands, derived client-side from the birth year the user entered.

**Architecture:** One new nullable column `age_band` on `inquiry_log`. A pure `ageBand(age)` helper buckets the age in the browser — the birth year and exact age never leave the client. `buildInquiryLogPayload` gains a `birthYear` input; `/api/log-inquiry` validates + stores the band; `/api/admin/stats` adds one `GROUP BY` query; `Dashboard.tsx` renders one `BreakdownBar` panel (German copy). The existing 3-way "Altersklasse" panel is untouched.

**Tech Stack:** Next.js 15 App Router route handlers, TypeScript, `@neondatabase/serverless` tagged-template `sql`, Vitest, Tailwind v4.

**Branch:** `worktree-admin-age-distribution`, stacked on `worktree-admin-language-current-insurer-panels` (PR #36). This feature's PR targets that branch.

## Global Constraints

- The admin dashboard is **German-only** (REQ-25). New panel copy is German, hardcoded — no next-intl keys. Follow `Dashboard.tsx`.
- The inquiry log stores **no birth year, no exact age, no PII, no join key** (REQ-21). The age is bucketed **client-side**; only the band string reaches the server.
- Age bands, exactly (`age = activeYear − birthYear`, matching `getAltersklasse` in `src/lib/ageband.ts`): `0-18` (age ≤ 18), `19-25` (19–25), `26-35` (26–35), `36-45` (36–45), `46-55` (46–55), `56-65` (56–65), `66-75` (66–75), `76+` (age ≥ 76). `age < 0` or non-finite → no band (`null`).
- `AGE_BANDS` is the eight bands in ascending order.
- The new DB column is **nullable** (historical rows predate it).
- `@neondatabase/serverless`'s `neon(url).query()` takes **one statement per call**; `ALTER_TABLE_SQL` is a `string[]`, one `ADD COLUMN IF NOT EXISTS` per element.
- No new re-log trigger — `parsedBirthYear` must NOT be added to the log effect's dependency array; inquiry counts stay comparable.
- Logging never surfaces an error beyond `204`/`400`; a DB insert failure still returns `204` (and `console.error`s).
- The panel's percentages are of the **age-known subset** (rows summed by `BreakdownBar`, no `total` prop) — consistent with the other `IS NOT NULL` panels ("Aktuelle Krankenkasse", "Aktuelle Prämie").
- Commit after every task with a `feat:` / `test:` / `docs:` prefixed message.

---

## File Structure

| File | Responsibility | Task |
|------|----------------|------|
| `src/lib/ageBand.ts` (new) | Pure `ageBand(age)` + `AGE_BANDS` / `AgeBand` type | 1 |
| `src/lib/ageBand.test.ts` (new) | Boundary tests | 1 |
| `scripts/migrateSql.ts` | Add `age_band` to `CREATE_TABLE_SQL`; 4th `ALTER_TABLE_SQL` entry | 2 |
| `scripts/migrateSql.test.ts` | Assert `age_band` present | 2 |
| `src/lib/inquiryLog.ts` | `birthYear` input → `ageBand?` output | 3 |
| `src/lib/inquiryLog.test.ts` | New field mapping tests | 3 |
| `src/app/api/log-inquiry/route.ts` | Validate + INSERT `age_band` | 4 |
| `src/app/api/log-inquiry/route.test.ts` | Validation + INSERT-position tests | 4 |
| `src/components/InsuranceComparator.tsx` | Pass `birthYear` into the builder | 5 |
| `src/app/api/admin/stats/route.ts` | `age_band` aggregate query + response key | 6 |
| `src/app/api/admin/stats/route.test.ts` | `ageBands` key + empty payload | 6 |
| `src/components/admin/Dashboard.tsx` | "Altersverteilung" `BreakdownBar` panel | 7 |
| `mockups/admin.html` | Static parity | 8 |
| `requirement.md`, `architecture.md` | REQ-21, §10.2, §10.3, §13.2, §13.4 | 8 |

---

## Task 1: `ageBand` helper

**Files:**
- Create: `src/lib/ageBand.ts`
- Test: `src/lib/ageBand.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type AgeBand = "0-18" | "19-25" | "26-35" | "36-45" | "46-55" | "56-65" | "66-75" | "76+"`
  - `const AGE_BANDS: readonly AgeBand[]` — ascending
  - `function ageBand(age: number): AgeBand | null`

- [ ] **Step 1: Write the failing test**

Create `src/lib/ageBand.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { ageBand, AGE_BANDS } from "./ageBand";

describe("ageBand", () => {
  it("buckets ages at every band boundary", () => {
    expect(ageBand(0)).toBe("0-18");
    expect(ageBand(18)).toBe("0-18");
    expect(ageBand(19)).toBe("19-25");
    expect(ageBand(25)).toBe("19-25");
    expect(ageBand(26)).toBe("26-35");
    expect(ageBand(35)).toBe("26-35");
    expect(ageBand(36)).toBe("36-45");
    expect(ageBand(45)).toBe("36-45");
    expect(ageBand(46)).toBe("46-55");
    expect(ageBand(55)).toBe("46-55");
    expect(ageBand(56)).toBe("56-65");
    expect(ageBand(65)).toBe("56-65");
    expect(ageBand(66)).toBe("66-75");
    expect(ageBand(75)).toBe("66-75");
    expect(ageBand(76)).toBe("76+");
    expect(ageBand(130)).toBe("76+");
  });

  it("returns null for a negative or non-finite age", () => {
    expect(ageBand(-1)).toBeNull();
    expect(ageBand(Number.NaN)).toBeNull();
    expect(ageBand(Number.POSITIVE_INFINITY)).toBeNull();
  });

  it("exposes the eight bands in ascending order", () => {
    expect(AGE_BANDS).toEqual([
      "0-18", "19-25", "26-35", "36-45", "46-55", "56-65", "66-75", "76+",
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/ageBand.test.ts`
Expected: FAIL — `Failed to resolve import "./ageBand"`.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/ageBand.ts`:

```ts
// Coarse client-side bucketing of the user's age, derived from the birth year
// they entered (architecture.md §10.3). The birth year and exact age are never
// sent to the server — only the band string — so the inquiry log keeps no
// re-identifiable age. Boundaries at 18 and 25 mirror the statutory
// Altersklasse split (src/lib/ageband.ts); the rest are decades.

export type AgeBand =
  | "0-18" | "19-25" | "26-35" | "36-45" | "46-55" | "56-65" | "66-75" | "76+";

export const AGE_BANDS: readonly AgeBand[] = [
  "0-18", "19-25", "26-35", "36-45", "46-55", "56-65", "66-75", "76+",
];

export function ageBand(age: number): AgeBand | null {
  if (!Number.isFinite(age) || age < 0) return null;
  if (age <= 18) return "0-18";
  if (age <= 25) return "19-25";
  if (age <= 35) return "26-35";
  if (age <= 45) return "36-45";
  if (age <= 55) return "46-55";
  if (age <= 65) return "56-65";
  if (age <= 75) return "66-75";
  return "76+";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/ageBand.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/ageBand.ts src/lib/ageBand.test.ts
git commit -m "feat: add ageBand client-side bucketing helper"
```

---

## Task 2: Migration — `age_band` column

**Files:**
- Modify: `scripts/migrateSql.ts`
- Test: `scripts/migrateSql.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `ALTER_TABLE_SQL` gains a 4th element for `age_band`; `CREATE_TABLE_SQL` gains the `age_band TEXT` column.

- [ ] **Step 1: Write the failing test**

In `scripts/migrateSql.test.ts`:

In `"declares every column the stats and log-inquiry queries expect"`, add `"age_band"` to the column array:

```ts
    for (const column of [
      "id", "ts", "region_id", "altersklasse", "franchise", "year", "models", "accident",
      "locale", "current_insurer", "current_premium_band", "age_band",
    ]) {
```

In `"adds each new column idempotently"`, add `"age_band"`:

```ts
    for (const column of ["locale", "current_insurer", "current_premium_band", "age_band"]) {
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run scripts/migrateSql.test.ts`
Expected: FAIL — `CREATE_TABLE_SQL` / `ALTER_TABLE_SQL` don't mention `age_band`.

- [ ] **Step 3: Write minimal implementation**

In `scripts/migrateSql.ts`, add `age_band TEXT` as the last column of `CREATE_TABLE_SQL` (align the type keyword under the existing block — `current_premium_band` is the widest name at 20 chars, so the type starts at column 22; `age_band` is 8 chars → 13 spaces before `TEXT`):

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
  current_premium_band TEXT,
  age_band             TEXT
);
`.trim();
```

Add the 4th `ALTER_TABLE_SQL` entry:

```ts
export const ALTER_TABLE_SQL = [
  "ALTER TABLE inquiry_log ADD COLUMN IF NOT EXISTS locale TEXT;",
  "ALTER TABLE inquiry_log ADD COLUMN IF NOT EXISTS current_insurer TEXT;",
  "ALTER TABLE inquiry_log ADD COLUMN IF NOT EXISTS current_premium_band TEXT;",
  "ALTER TABLE inquiry_log ADD COLUMN IF NOT EXISTS age_band TEXT;",
];
```

> The existing test `"uses the column types specified in architecture.md §10.3"` asserts exact strings for `id` / `franchise` / `year` only — those lines are unchanged by adding a column at the end, so no update is needed there. `scripts/migrate.ts` already loops over `ALTER_TABLE_SQL` — no change.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run scripts/migrateSql.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/migrateSql.ts scripts/migrateSql.test.ts
git commit -m "feat: migration adds age_band column to inquiry_log"
```

---

## Task 3: Extend `buildInquiryLogPayload`

**Files:**
- Modify: `src/lib/inquiryLog.ts`
- Test: `src/lib/inquiryLog.test.ts`

**Interfaces:**
- Consumes: `ageBand`, `AgeBand` from `src/lib/ageBand.ts` (Task 1).
- Produces: updated
  ```ts
  type InquiryLogPayload = { /* ...existing... */ ageBand?: AgeBand };
  function buildInquiryLogPayload(input: { /* ...existing... */ birthYear: number | null }): InquiryLogPayload | null;
  ```

- [ ] **Step 1: Write the failing test**

In `src/lib/inquiryLog.test.ts`, add `birthYear: null` to `BASE_INPUT`:

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
  birthYear: null,
};
```

Add these cases inside the `describe`:

```ts
  it("includes ageBand only when a birth year is given", () => {
    expect(buildInquiryLogPayload(BASE_INPUT)).not.toHaveProperty("ageBand");
    // year 2026 − birthYear 1985 = age 41 → "36-45"
    expect(
      buildInquiryLogPayload({ ...BASE_INPUT, birthYear: 1985 })?.ageBand,
    ).toBe("36-45");
  });

  it("derives ageBand against the active year, not the current date", () => {
    // year 2026 − birthYear 2009 = age 17 → "0-18"
    expect(buildInquiryLogPayload({ ...BASE_INPUT, birthYear: 2009 })?.ageBand).toBe("0-18");
  });

  it("omits ageBand when the birth year implies a negative age", () => {
    expect(
      buildInquiryLogPayload({ ...BASE_INPUT, birthYear: 2030 }),
    ).not.toHaveProperty("ageBand");
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/inquiryLog.test.ts`
Expected: FAIL — `ageBand` not on the payload.

- [ ] **Step 3: Write minimal implementation**

In `src/lib/inquiryLog.ts`:

Add the import:

```ts
import { ageBand, type AgeBand } from "./ageBand";
```

Add to `InquiryLogPayload` (after `currentPremiumBand?`):

```ts
  ageBand?: AgeBand;
```

Add to the input object type (after `currentMonthlyPremium`):

```ts
  birthYear: number | null;
```

After the existing `currentPremiumBand` block, before `return payload;`:

```ts
  const age = input.birthYear != null ? ageBand(input.year - input.birthYear) : null;
  if (age) {
    payload.ageBand = age;
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/inquiryLog.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/inquiryLog.ts src/lib/inquiryLog.test.ts
git commit -m "feat: buildInquiryLogPayload derives ageBand from birth year"
```

---

## Task 4: `/api/log-inquiry` — validate & store `age_band`

**Files:**
- Modify: `src/app/api/log-inquiry/route.ts`
- Test: `src/app/api/log-inquiry/route.test.ts`

**Interfaces:**
- Consumes: `AGE_BANDS` from `src/lib/ageBand.ts`.
- Produces: `POST` accepts `{ ...existing, ageBand? }`; INSERT writes `age_band` as the 10th value.

- [ ] **Step 1: Write the failing tests**

In `src/app/api/log-inquiry/route.test.ts`:

Update the INSERT assertion in `"inserts the validated fields and returns 204..."` (append one `null`):

```ts
    expect(values).toEqual(["ZH-1", "erwachsen", 300, 2026, ["standard"], true, "de", null, null, null]);
```

Update the assertion in `"inserts NULL locale when locale is omitted"` (append one `null`):

```ts
    expect(values).toEqual(["ZH-1", "erwachsen", 300, 2026, ["standard"], true, null, null, null, null]);
```

Update the assertion in `"stores current insurer and premium band when valid"` (append one `null`):

```ts
    expect(values).toEqual([
      "ZH-1", "erwachsen", 300, 2026, ["standard"], true, "de", "1542", "350-449", null,
    ]);
```

Add two new tests:

```ts
  it("returns 400 on an unknown age band", async () => {
    const res = await POST(makeRequest({ ...validPayload, ageBand: "18-30" }));
    expect(res.status).toBe(400);
  });

  it("stores age band when valid", async () => {
    process.env.POSTGRES_URL = "postgres://test";
    const fakeSql = vi.fn().mockResolvedValue([]);
    vi.mocked(db.getSql).mockReturnValue(fakeSql as unknown as ReturnType<typeof db.getSql>);

    const res = await POST(makeRequest({ ...validPayload, ageBand: "36-45" }));

    expect(res.status).toBe(204);
    const [, ...values] = fakeSql.mock.calls[0];
    expect(values).toEqual([
      "ZH-1", "erwachsen", 300, 2026, ["standard"], true, "de", null, null, "36-45",
    ]);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/app/api/log-inquiry/route.test.ts`
Expected: FAIL — INSERT has 9 values; `ageBand` not validated.

- [ ] **Step 3: Write the implementation**

In `src/app/api/log-inquiry/route.ts`:

Add the import and constant:

```ts
import { AGE_BANDS } from "@/lib/ageBand";
```
```ts
const AGE_BAND_VALUES: readonly string[] = AGE_BANDS;
```

Add to `InquiryPayload` (after `currentPremiumBand?`):

```ts
  ageBand?: string;
```

In `isValidPayload`, after the `currentPremiumBand` check and before `return true;`:

```ts
  if (b.ageBand !== undefined) {
    if (typeof b.ageBand !== "string" || !AGE_BAND_VALUES.includes(b.ageBand)) return false;
  }
```

Update the INSERT — add `age_band` to the column list and `${body.ageBand ?? null}` as the last value:

```ts
    await sql`INSERT INTO inquiry_log
              (region_id, altersklasse, franchise, year, models, accident, locale, current_insurer, current_premium_band, age_band)
              VALUES (${body.regionId}, ${body.altersklasse}, ${body.franchise}, ${body.year},
                      ${body.models}, ${body.accident}, ${body.locale ?? null},
                      ${body.currentInsurer ?? null}, ${body.currentPremiumBand ?? null}, ${body.ageBand ?? null})`;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/app/api/log-inquiry/route.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/log-inquiry/route.ts src/app/api/log-inquiry/route.test.ts
git commit -m "feat: log-inquiry validates + stores age_band"
```

---

## Task 5: Wire `InsuranceComparator` to send `birthYear`

**Files:**
- Modify: `src/components/InsuranceComparator.tsx` (the debounced log effect, ~line 165)

**Interfaces:**
- Consumes: `buildInquiryLogPayload` new signature (Task 3). `parsedBirthYear` is already in scope (`const parsedBirthYear = birthYear ? Number(birthYear) : null;`, line 87).

- [ ] **Step 1: Update the log effect**

In the `buildInquiryLogPayload({ ... })` call inside the debounced effect, add one line:

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
      birthYear: parsedBirthYear,
    });
```

**Do NOT add `parsedBirthYear` (or `birthYear`) to the effect's dependency array.** Leave the deps list and the `eslint-disable-next-line react-hooks/exhaustive-deps` exactly as they are. Extend the comment block above the effect to mention the age band is captured opportunistically at fire time, like the current-plan fields (a birth-year edit that doesn't cross an Altersklasse boundary lands on the next unrelated trigger, not immediately).

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: no new errors (one pre-existing warning at `InsuranceComparator.tsx:136` about `ALL_PREMIUMS` is OK).

- [ ] **Step 4: Full test run**

Run: `npm test`
Expected: PASS (nothing regressed; this file has no unit test).

- [ ] **Step 5: Commit**

```bash
git add src/components/InsuranceComparator.tsx
git commit -m "feat: comparator sends birth year to the inquiry log for age banding"
```

---

## Task 6: `/api/admin/stats` — age-band aggregate

**Files:**
- Modify: `src/app/api/admin/stats/route.ts`
- Test: `src/app/api/admin/stats/route.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: response JSON gains `ageBands: { band: string; n: number }[]`.

- [ ] **Step 1: Update the failing tests**

In `src/app/api/admin/stats/route.test.ts`:

Extend the empty-payload `.toEqual` (add `ageBands: []`):

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
      ageBands: [],
    });
```

In `"runs the aggregation queries..."`, add a `fakeSql` branch before the final `return Promise.resolve([])`:

```ts
      if (text.includes("age_band")) return Promise.resolve([{ band: "26-35", n: 8 }]);
```

> No collision: none of the existing query texts (`total`, `date_trunc`, `region_id`, `altersklasse`, `franchise`, `unnest(models)`, `accident`, `COALESCE(locale`, `current_insurer`, `current_premium_band`) contain `age_band`, and the age-band query text contains none of them.

Extend the assembled-response `.toEqual` (add `ageBands`):

```ts
      languages: [{ locale: "de", n: 12 }],
      currentInsurers: [{ insurerCode: "1542", n: 7 }],
      premiumBands: [{ band: "250-349", n: 4 }],
      ageBands: [{ band: "26-35", n: 8 }],
    });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/app/api/admin/stats/route.test.ts`
Expected: FAIL — response missing `ageBands`.

- [ ] **Step 3: Write the implementation**

In `src/app/api/admin/stats/route.ts`:

Add the row type near the others:

```ts
type AgeBandRow = { band: string; n: number };
```

Extend the no-`POSTGRES_URL` early return (add `ageBands: []`):

```ts
      languages: [],
      currentInsurers: [],
      premiumBands: [],
      ageBands: [],
    });
```

Add a `let` binding:

```ts
  let ageBandRows: AgeBandRow[];
```

Add the query to the `Promise.all` (last), and widen the destructuring + `as [...]` tuple:

```ts
    [
      totalRows, trendRows, regionRows, ageRows, franchiseRows, modelRows, accidentRows,
      languageRows, currentInsurerRows, premiumBandRows, ageBandRows,
    ] = (await Promise.all([
      // ...existing ten queries unchanged...
      sql`SELECT age_band AS band, COUNT(*)::int AS n FROM inquiry_log WHERE ts >= ${from} AND ts < ${to} AND age_band IS NOT NULL GROUP BY 1`,
    ])) as [
      TotalRow[], TrendRow[], RegionRow[], AgeRow[], FranchiseRow[], ModelRow[], AccidentRow[],
      LanguageRow[], CurrentInsurerRow[], PremiumBandRow[], AgeBandRow[],
    ];
```

Extend the success response (add `ageBands`):

```ts
    languages: languageRows,
    currentInsurers: currentInsurerRows,
    premiumBands: premiumBandRows,
    ageBands: ageBandRows,
  });
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/app/api/admin/stats/route.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/admin/stats/route.ts src/app/api/admin/stats/route.test.ts
git commit -m "feat: admin stats returns age-band breakdown"
```

---

## Task 7: Dashboard panel

**Files:**
- Modify: `src/components/admin/Dashboard.tsx`

**Interfaces:**
- Consumes: `stats.ageBands` (Task 6); `AGE_BANDS` from `src/lib/ageBand.ts`; existing `BreakdownBar`.

- [ ] **Step 1: Extend the `Stats` type**

Add to `type Stats = { ... }`:

```ts
  ageBands: { band: string; n: number }[];
```

- [ ] **Step 2: Add the import, label map, and helper**

Add near the other `@/lib` imports:

```ts
import { AGE_BANDS } from "@/lib/ageBand";
```

Add module-level, beside `PREMIUM_BAND_LABEL` / `orderedBandRows`:

```ts
const AGE_BAND_LABEL: Record<string, string> = {
  "0-18": "0–18",
  "19-25": "19–25",
  "26-35": "26–35",
  "36-45": "36–45",
  "46-55": "46–55",
  "56-65": "56–65",
  "66-75": "66–75",
  "76+": "76+",
};

function orderedAgeBandRows(rows: { band: string; n: number }[]): { label: string; value: number }[] {
  const byBand = new Map(rows.map((r) => [r.band, r.n]));
  return AGE_BANDS.filter((b) => byBand.has(b)).map((b) => ({
    label: AGE_BAND_LABEL[b] ?? b,
    value: byBand.get(b) ?? 0,
  }));
}
```

- [ ] **Step 3: Add the panel**

Insert this full-width card **immediately before** the `Anfragen pro Sprache` card (i.e. after the closing `</div>` of the Franchise/Versicherungsmodell `grid grid-cols-2 gap-4` block, and before the `bg-surface ... mt-4` div that holds "Anfragen pro Sprache"):

```tsx
          <div className="bg-surface border border-outline-variant rounded-lg shadow-sm p-5 mt-4">
            <h2 className="text-title-medium text-on-surface-variant uppercase tracking-wide mb-4">
              Altersverteilung
            </h2>
            <BreakdownBar labelWidth="short" rows={orderedAgeBandRows(stats?.ageBands ?? [])} />
          </div>
```

- [ ] **Step 4: Typecheck + lint + tests**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: all pass (one pre-existing lint warning at `InsuranceComparator.tsx:136` is OK).

- [ ] **Step 5: Visual check**

Run `npm run dev`, open `http://localhost:3000/admin` (log in via `/admin/login` with `ADMIN_SECRET` if set; otherwise the middleware redirect is expected). Confirm the "Altersverteilung" panel renders full-width between "Versicherungsmodell" and "Anfragen pro Sprache" with no layout shift. With no DB configured it renders empty (no rows) — expected. If interactive login isn't possible, say so and rely on tsc/lint/tests. Kill the dev server after.

- [ ] **Step 6: Commit**

```bash
git add src/components/admin/Dashboard.tsx
git commit -m "feat: admin dashboard shows age-distribution panel"
```

---

## Task 8: Mockup + requirement/architecture docs

**Files:**
- Modify: `mockups/admin.html`
- Modify: `requirement.md` (REQ-21)
- Modify: `architecture.md` (§10.2, §10.3, §13.2, §13.4)

**Interfaces:** none — documentation only.

- [ ] **Step 1: Read the target files first**

Read `mockups/admin.html` in full (especially the `.card` / `.bar-chart` / `.bar-row` / `.bar-row-label.short` markup and the language card added by PR #36), and the REQ-21 paragraph in `requirement.md` and §10.2 / §10.3 / §13.2 / §13.4 in `architecture.md`.

- [ ] **Step 2: Update `mockups/admin.html`**

Add an "Altersverteilung" card immediately before the `<!-- ── Language ── -->` card, matching the existing `.card` markup. Eight illustrative rows in ascending band order, using the `short` label class:

```html
  <!-- ── Age distribution ── -->
  <div class="card" style="margin-top:16px;">
    <h2>Altersverteilung</h2>
    <div class="bar-chart">
      <div class="bar-row"><span class="bar-row-label short">0–18</span>   <div class="bar-track"><div class="bar-fill" style="width:14%"></div></div> <span class="bar-value">1'900 · 6%</span></div>
      <div class="bar-row"><span class="bar-row-label short">19–25</span>  <div class="bar-track"><div class="bar-fill" style="width:20%"></div></div> <span class="bar-value">2'700 · 8%</span></div>
      <div class="bar-row"><span class="bar-row-label short">26–35</span>  <div class="bar-track"><div class="bar-fill" style="width:100%"></div></div><span class="bar-value">7'400 · 22%</span></div>
      <div class="bar-row"><span class="bar-row-label short">36–45</span>  <div class="bar-track"><div class="bar-fill" style="width:82%"></div></div> <span class="bar-value">6'050 · 18%</span></div>
      <div class="bar-row"><span class="bar-row-label short">46–55</span>  <div class="bar-track"><div class="bar-fill" style="width:70%"></div></div> <span class="bar-value">5'200 · 15%</span></div>
      <div class="bar-row"><span class="bar-row-label short">56–65</span>  <div class="bar-track"><div class="bar-fill" style="width:58%"></div></div> <span class="bar-value">4'300 · 13%</span></div>
      <div class="bar-row"><span class="bar-row-label short">66–75</span>  <div class="bar-track"><div class="bar-fill" style="width:40%"></div></div> <span class="bar-value">3'000 · 9%</span></div>
      <div class="bar-row"><span class="bar-row-label short">76+</span>    <div class="bar-track"><div class="bar-fill" style="width:30%"></div></div> <span class="bar-value">2'200 · 7%</span></div>
    </div>
  </div>
```

Adjust class names / whitespace to match whatever the file actually uses. Keep counts/percentages internally consistent (they should sum to ~34'210, matching the existing stat card).

- [ ] **Step 3: Amend REQ-21 in `requirement.md`**

In the "additionally records" clause (added by PR #36), add the age band. Example edit — adapt to the actual wording present:

> It additionally records the UI language, the selected current insurer (BAG insurer code only), a coarse band of the self-reported current premium, **and a coarse age band (eight groups) derived from the entered birth year** — all computed in the browser. It does **not** record IP address, the exact current premium, **the birth year or exact age**, any free-text, or any join key back to a user or session.

- [ ] **Step 4: Amend `architecture.md`**

- **§10.2** — add `ageBand` to the list of optional fields the route accepts/validates.
- **§10.3** — add `age_band TEXT` (nullable) to the schema block; one sentence: it is one of `0-18 | 19-25 | 26-35 | 36-45 | 46-55 | 56-65 | 66-75 | 76+`, bucketed client-side from the birth year; the birth year itself is never transmitted.
- **§13.2** — add the age-band query to the SQL list: `SELECT age_band, COUNT(*) AS n FROM inquiry_log WHERE ts >= $1 AND ts < $2 AND age_band IS NOT NULL GROUP BY 1;` with a note that ordering is client-side by the canonical band order.
- **§13.4** — add an "Altersverteilung" panel to the layout / inventory; note it is a full-width card complementing (not replacing) the "Altersklasse" panel, and that its `IS NOT NULL` filter means pre-migration inquiries are excluded.

- [ ] **Step 5: Verify nothing broke**

Run: `npm test && npm run lint`
Expected: pass (no code changed).

- [ ] **Step 6: Commit**

```bash
git add mockups/admin.html requirement.md architecture.md
git commit -m "docs: reconcile REQ-21, architecture, admin mockup with the age-distribution panel"
```

---

## Self-Review

**Spec coverage:**
- §1 data model → Task 2 (column) + Task 1 (band definition).
- §2 client→API: `ageBand` → Task 1; `inquiryLog.ts` → Task 3; `InsuranceComparator` → Task 5; `/api/log-inquiry` → Task 4.
- §3 stats API → Task 6.
- §4 dashboard UI → Task 7 (uses no `total` prop per Global Constraints — percentages of the age-known subset, consistent with the other `IS NOT NULL` panels; this refines spec §4's "like the language panel" wording).
- §5 mockup → Task 8 Step 2.
- §6 requirement/architecture → Task 8 Steps 3–4.
- §7 tests → embedded in Tasks 1, 2, 3, 4, 6.
- §8 out of scope → nothing to build; the existing Altersklasse panel is untouched (Task 7 only adds).
- §9 deploy prerequisite → covered by architecture.md §14.1 (already present from PR #36); Task 8 §13.4 note reinforces the `IS NOT NULL` exclusion of pre-migration rows.

**Placeholder scan:** none — every step carries concrete code. Task 8's doc edits give example prose explicitly marked "adapt to actual wording", with the required facts spelled out.

**Type consistency:**
- `AgeBand` / `AGE_BANDS` — defined Task 1, consumed Tasks 3, 4, 7 with matching names.
- Payload field `ageBand` — consistent across Tasks 3, 4; comparator input `birthYear` (Tasks 3, 5).
- Stats response key `ageBands`, row shape `{ band, n }` — identical in Tasks 6 and 7.
- INSERT positional order (10 values ending `age_band`) — consistent between Task 4's route change and its test assertions.
- `ALTER_TABLE_SQL` stays `string[]` — Task 2 only appends an element.
