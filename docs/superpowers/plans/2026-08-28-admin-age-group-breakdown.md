# Admin Age-Group Breakdown Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a nine-bucket "Altersgruppe" breakdown to the admin dashboard, derived client-side from the visitor's birth year (age measured at the time of the visit), stored as a band string only.

**Architecture:** A new pure helper `getAgeGroup(birthYear, visitYear)` buckets age into nine life-stage bands. The comparator computes the band with the *real current year* (not the premium-year toggle) and sends it on the existing `POST /api/log-inquiry` request. A new nullable `age_group` column stores it. The stats route adds one `GROUP BY age_group` query; the dashboard renders it in a new full-width panel below the existing KVG `Altersklasse` panel. This mirrors the existing `current_premium_band` feature end-to-end.

**Tech Stack:** Next.js 15 App Router (Route Handlers), React 19 client component, `@neondatabase/serverless` tagged-template SQL, Vitest, Tailwind.

## Global Constraints

- **No PII / no re-identifiable data** (REQ-21). The raw birth year must never leave the browser — only the band string is transmitted and stored.
- **Logging must never surface to the user** — `/api/log-inquiry` always returns 204; failures are swallowed client-side.
- **Age at time of visit** — the age group uses `new Date().getFullYear() - birthYear`, independent of the comparator's premium-`year` state (which drives `altersklasse` via `getAltersklasse` and can be toggled to next year).
- **Nine buckets, exact labels:** `0` → "Neugeboren (0)", `1-5` → "1–5 Jahre", `6-12` → "6–12 Jahre", `13-18` → "13–18 Jahre", `19-25` → "19–25 Jahre", `26-35` → "26–35 Jahre", `36-50` → "36–50 Jahre", `51-65` → "51–65 Jahre", `66+` → "66+ Jahre". En-dash (`–`) in labels, hyphen (`-`) in band keys.
- **Admin dashboard is German-only** (REQ-25).
- **Backward tolerance:** `age_group` is optional on the API payload — an absent value stores `NULL` (older cached client), a present value must be a known band or the request is 400.
- Single-file-per-responsibility; follow existing patterns in each file. Test runner: `npx vitest run <path>`.

---

### Task 1: `getAgeGroup` bucketing helper

**Files:**
- Create: `src/lib/ageGroup.ts`
- Test: `src/lib/ageGroup.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type AgeGroup = "0" | "1-5" | "6-12" | "13-18" | "19-25" | "26-35" | "36-50" | "51-65" | "66+"`
  - `const AGE_GROUPS: readonly AgeGroup[]` — youngest→oldest, used for validation and dashboard row order.
  - `function getAgeGroup(birthYear: number, visitYear: number): AgeGroup`

- [ ] **Step 1: Write the failing test**

Create `src/lib/ageGroup.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { getAgeGroup, AGE_GROUPS } from "@/lib/ageGroup";

describe("getAgeGroup", () => {
  it("buckets a newborn (age 0) as '0'", () => {
    expect(getAgeGroup(2026, 2026)).toBe("0");
  });

  it("buckets each band by its upper boundary", () => {
    expect(getAgeGroup(2021, 2026)).toBe("1-5");   // age 5
    expect(getAgeGroup(2014, 2026)).toBe("6-12");  // age 12
    expect(getAgeGroup(2008, 2026)).toBe("13-18"); // age 18
    expect(getAgeGroup(2001, 2026)).toBe("19-25"); // age 25
    expect(getAgeGroup(1991, 2026)).toBe("26-35"); // age 35
    expect(getAgeGroup(1976, 2026)).toBe("36-50"); // age 50
    expect(getAgeGroup(1961, 2026)).toBe("51-65"); // age 65
    expect(getAgeGroup(1960, 2026)).toBe("66+");   // age 66
  });

  it("buckets each band by its lower boundary", () => {
    expect(getAgeGroup(2025, 2026)).toBe("1-5");   // age 1
    expect(getAgeGroup(2020, 2026)).toBe("6-12");  // age 6
    expect(getAgeGroup(2007, 2026)).toBe("19-25"); // age 19
    expect(getAgeGroup(2000, 2026)).toBe("26-35"); // age 26
  });

  it("uses the passed visitYear verbatim (no calendar-year shift)", () => {
    expect(getAgeGroup(2000, 2026)).toBe("26-35");
    expect(getAgeGroup(2000, 2025)).toBe("19-25");
  });

  it("clamps a defensively-negative age to '0'", () => {
    expect(getAgeGroup(2030, 2026)).toBe("0");
  });

  it("AGE_GROUPS lists all nine bands youngest to oldest", () => {
    expect(AGE_GROUPS).toEqual([
      "0", "1-5", "6-12", "13-18", "19-25", "26-35", "36-50", "51-65", "66+",
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/ageGroup.test.ts`
Expected: FAIL — cannot resolve `@/lib/ageGroup`.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/ageGroup.ts`:

```ts
// Coarse client-side bucketing of the visitor's age AT THE TIME OF THE VISIT
// (architecture.md §10.3). Unlike getAltersklasse (which uses the age reached
// during the selected premium year, and shifts with the year toggle — REQ-16),
// this always uses the real current year. Only the band string is ever sent to
// the server, so the inquiry log keeps no re-identifiable age (REQ-21).

export type AgeGroup =
  | "0" | "1-5" | "6-12" | "13-18" | "19-25" | "26-35" | "36-50" | "51-65" | "66+";

export const AGE_GROUPS: readonly AgeGroup[] = [
  "0", "1-5", "6-12", "13-18", "19-25", "26-35", "36-50", "51-65", "66+",
];

export function getAgeGroup(birthYear: number, visitYear: number): AgeGroup {
  const age = visitYear - birthYear;
  if (age <= 0) return "0";
  if (age <= 5) return "1-5";
  if (age <= 12) return "6-12";
  if (age <= 18) return "13-18";
  if (age <= 25) return "19-25";
  if (age <= 35) return "26-35";
  if (age <= 50) return "36-50";
  if (age <= 65) return "51-65";
  return "66+";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/ageGroup.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/ageGroup.ts src/lib/ageGroup.test.ts
git commit -m "feat: add getAgeGroup client-side age bucketing helper"
```

---

### Task 2: Add the `age_group` migration column

**Files:**
- Modify: `scripts/migrateSql.ts` (`CREATE_TABLE_SQL` body + `ALTER_TABLE_SQL` array)
- Test: `scripts/migrateSql.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `inquiry_log.age_group TEXT` (nullable) available to the log-inquiry INSERT (Task 4) and the stats query (Task 6).

- [ ] **Step 1: Write the failing test**

In `scripts/migrateSql.test.ts`, add `"age_group"` to the column list in the `"declares every column..."` test (line ~12) and to the `ALTER_TABLE_SQL` column loop (line ~34):

```ts
// in "declares every column the stats and log-inquiry queries expect"
for (const column of [
  "id", "ts", "region_id", "altersklasse", "franchise", "year", "models", "accident",
  "locale", "current_insurer", "current_premium_band", "age_group",
]) {
  expect(CREATE_TABLE_SQL).toContain(column);
}
```

```ts
// in "adds each new column idempotently"
for (const column of ["locale", "current_insurer", "current_premium_band", "age_group"]) {
  expect(joined).toContain(`ADD COLUMN IF NOT EXISTS ${column}`);
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run scripts/migrateSql.test.ts`
Expected: FAIL — `age_group` not found in `CREATE_TABLE_SQL` / `ALTER_TABLE_SQL`.

- [ ] **Step 3: Write minimal implementation**

In `scripts/migrateSql.ts`, add the column to the `CREATE TABLE` body (after `current_premium_band TEXT`, keep the existing alignment style — the column name is padded to the same width as `current_premium_band`, so use a single space before `TEXT`):

```
  current_premium_band TEXT,
  age_group            TEXT
```

(Note: `current_premium_band` currently has no trailing comma as it is last — add the comma when inserting `age_group` after it.)

And append to `ALTER_TABLE_SQL`:

```ts
export const ALTER_TABLE_SQL = [
  "ALTER TABLE inquiry_log ADD COLUMN IF NOT EXISTS locale TEXT;",
  "ALTER TABLE inquiry_log ADD COLUMN IF NOT EXISTS current_insurer TEXT;",
  "ALTER TABLE inquiry_log ADD COLUMN IF NOT EXISTS current_premium_band TEXT;",
  "ALTER TABLE inquiry_log ADD COLUMN IF NOT EXISTS age_group TEXT;",
];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run scripts/migrateSql.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/migrateSql.ts scripts/migrateSql.test.ts
git commit -m "feat: migration adds inquiry_log.age_group column"
```

---

### Task 3: Carry `ageGroup` through the payload builder

**Files:**
- Modify: `src/lib/inquiryLog.ts`
- Test: `src/lib/inquiryLog.test.ts`

**Interfaces:**
- Consumes: `AgeGroup` from `@/lib/ageGroup` (Task 1).
- Produces:
  - `InquiryLogPayload` gains required field `ageGroup: string`.
  - `buildInquiryLogPayload` input gains required field `ageGroup: string | null`; the function returns `null` when it is falsy (same as `altersklasse` / `franchise`).

- [ ] **Step 1: Write the failing test**

In `src/lib/inquiryLog.test.ts`:

1. Add `ageGroup: "26-35"` to `BASE_INPUT` (line ~8).
2. In `"maps the resolved query state to the log-inquiry payload shape"`, add `ageGroup: "26-35"` to the expected object.
3. Add these tests inside the `describe`:

```ts
it("carries the age group through unchanged", () => {
  expect(buildInquiryLogPayload({ ...BASE_INPUT, ageGroup: "66+" })?.ageGroup).toBe("66+");
});

it("returns null when the age group is not resolved yet", () => {
  expect(buildInquiryLogPayload({ ...BASE_INPUT, ageGroup: null })).toBeNull();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/inquiryLog.test.ts`
Expected: FAIL — `ageGroup` missing from payload; type error on `ageGroup: null`.

- [ ] **Step 3: Write minimal implementation**

In `src/lib/inquiryLog.ts`:

```ts
import type { Tarifart } from "./types";

export type InquiryLogPayload = {
  regionId: string;
  altersklasse: string;
  ageGroup: string;
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
  ageGroup: string | null;
  franchise: number | null;
  year: number;
  altModelsActive: boolean;
  unfalldeckung: boolean;
  locale: string;
  currentInsurerCode: string | null;
  currentMonthlyPremium: number | null;
}): InquiryLogPayload | null {
  if (!input.praemienregionId || !input.altersklasse || !input.ageGroup || !input.franchise) {
    return null;
  }

  const payload: InquiryLogPayload = {
    regionId: input.praemienregionId,
    altersklasse: input.altersklasse,
    ageGroup: input.ageGroup,
    franchise: input.franchise,
    year: input.year,
    models: input.altModelsActive ? ALL_TARIFARTS : ["standard"],
    accident: input.unfalldeckung,
    locale: input.locale,
  };
  // ...rest unchanged (currentInsurer / currentPremiumBand blocks)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/inquiryLog.test.ts`
Expected: PASS (all tests, including the pre-existing `"returns null when altersklasse is not resolved yet"` etc.).

- [ ] **Step 5: Commit**

```bash
git add src/lib/inquiryLog.ts src/lib/inquiryLog.test.ts
git commit -m "feat: buildInquiryLogPayload carries the age group"
```

---

### Task 4: Validate + store `age_group` in the log-inquiry route

**Files:**
- Modify: `src/app/api/log-inquiry/route.ts`
- Test: `src/app/api/log-inquiry/route.test.ts`

**Interfaces:**
- Consumes: `AGE_GROUPS` from `@/lib/ageGroup` (Task 1); the `age_group` column (Task 2).
- Produces: rows in `inquiry_log` with `age_group` set. INSERT value order becomes:
  `region_id, altersklasse, franchise, year, models, accident, locale, current_insurer, current_premium_band, age_group`.

- [ ] **Step 1: Write the failing test**

In `src/app/api/log-inquiry/route.test.ts`:

1. Add `ageGroup: "26-35"` to `validPayload` (line ~16).
2. Update the two `expect(values).toEqual([...])` assertions to append the age group:
   - `"inserts the validated fields..."` → `["ZH-1", "erwachsen", 300, 2026, ["standard"], true, "de", null, null, "26-35"]`
   - `"stores current insurer and premium band when valid"` → `["ZH-1", "erwachsen", 300, 2026, ["standard"], true, "de", "1542", "350-449", "26-35"]`
3. Update `"inserts NULL locale when locale is omitted"` — it destructures `locale` off `validPayload`; its expected `values` becomes `["ZH-1", "erwachsen", 300, 2026, ["standard"], true, null, null, null, "26-35"]`.
4. Add tests:

```ts
it("returns 400 on an unknown age group", async () => {
  const res = await POST(makeRequest({ ...validPayload, ageGroup: "999" }));
  expect(res.status).toBe(400);
});

it("inserts NULL age_group when ageGroup is omitted", async () => {
  process.env.POSTGRES_URL = "postgres://test";
  const fakeSql = vi.fn().mockResolvedValue([]);
  vi.mocked(db.getSql).mockReturnValue(fakeSql as unknown as ReturnType<typeof db.getSql>);

  const { ageGroup, ...noAgeGroup } = validPayload;
  void ageGroup;
  const res = await POST(makeRequest(noAgeGroup));

  expect(res.status).toBe(204);
  const [, ...values] = fakeSql.mock.calls[0];
  expect(values).toEqual(["ZH-1", "erwachsen", 300, 2026, ["standard"], true, "de", null, null, null]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/api/log-inquiry/route.test.ts`
Expected: FAIL — value arrays are length 9, not 10; unknown age group returns 204 not 400.

- [ ] **Step 3: Write minimal implementation**

In `src/app/api/log-inquiry/route.ts`:

```ts
import { AGE_GROUPS } from "@/lib/ageGroup";
// ...
const AGE_GROUP_SET: readonly string[] = AGE_GROUPS;
```

Add to `InquiryPayload`:

```ts
  ageGroup?: string;
```

In `isValidPayload`, after the `currentPremiumBand` check and before `return true;`:

```ts
  if (b.ageGroup !== undefined) {
    if (typeof b.ageGroup !== "string" || !AGE_GROUP_SET.includes(b.ageGroup)) return false;
  }
```

Update the INSERT — add `age_group` as the last column and `${body.ageGroup ?? null}` as the last value:

```ts
    await sql`INSERT INTO inquiry_log
              (region_id, altersklasse, franchise, year, models, accident, locale, current_insurer, current_premium_band, age_group)
              VALUES (${body.regionId}, ${body.altersklasse}, ${body.franchise}, ${body.year},
                      ${body.models}, ${body.accident}, ${body.locale ?? null},
                      ${body.currentInsurer ?? null}, ${body.currentPremiumBand ?? null},
                      ${body.ageGroup ?? null})`;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/api/log-inquiry/route.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/log-inquiry/route.ts src/app/api/log-inquiry/route.test.ts
git commit -m "feat: log-inquiry validates and stores age_group"
```

---

### Task 5: Send the age group from the comparator

**Files:**
- Modify: `src/components/InsuranceComparator.tsx`

**Interfaces:**
- Consumes: `getAgeGroup` from `@/lib/ageGroup` (Task 1); `buildInquiryLogPayload` input field `ageGroup` (Task 3).
- Produces: nothing for later tasks (leaf wiring). No unit test exists for this component; verified by typecheck + build.

- [ ] **Step 1: Add the import**

Near the other `@/lib` imports (the file already imports `getAltersklasse, getFranchiseTiers` from `@/lib/ageband`):

```ts
import { getAgeGroup } from "@/lib/ageGroup";
```

- [ ] **Step 2: Derive the age group with the real current year**

Immediately after line ~88 (`const altersklasse = parsedBirthYear ? getAltersklasse(parsedBirthYear, year) : null;`):

```ts
// Age group uses the visitor's age NOW — deliberately NOT `year` (which can be
// toggled to next year and drives `altersklasse`). See src/lib/ageGroup.ts.
const ageGroup = parsedBirthYear ? getAgeGroup(parsedBirthYear, new Date().getFullYear()) : null;
```

- [ ] **Step 3: Pass it into the log payload + effect deps**

In the `buildInquiryLogPayload({ ... })` call inside the logging `useEffect` (line ~166), add `ageGroup,` next to `altersklasse,`. Then add `ageGroup` to that effect's dependency array (line ~189):

```ts
  }, [praemienregionId, altersklasse, ageGroup, franchise, year, altModelsActive, unfalldeckung, ALL_PREMIUMS.length]);
```

- [ ] **Step 4: Verify typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/InsuranceComparator.tsx
git commit -m "feat: comparator sends age group to the inquiry log"
```

---

### Task 6: Aggregate `age_group` in the stats route

**Files:**
- Modify: `src/app/api/admin/stats/route.ts`
- Test: `src/app/api/admin/stats/route.test.ts`

**Interfaces:**
- Consumes: the `age_group` column (Task 2).
- Produces: response field `ageGroups: { ageGroup: string; n: number }[]` — consumed by the Dashboard (Task 7).

- [ ] **Step 1: Write the failing test**

In `src/app/api/admin/stats/route.test.ts`:

1. In `"returns an empty-but-well-formed payload..."`, add `ageGroups: []` to the expected object.
2. In the `fakeSql` matcher (the `"runs the aggregation queries..."` test), add a branch — place it **before** the generic fallback and be specific enough not to collide with the `altersklasse` branch:

```ts
if (text.includes("age_group")) return Promise.resolve([{ ageGroup: "26-35", n: 18 }]);
```

3. In that test's final `expect(json).toEqual({...})`, add:

```ts
      ageGroups: [{ ageGroup: "26-35", n: 18 }],
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/api/admin/stats/route.test.ts`
Expected: FAIL — `ageGroups` missing from both payloads.

- [ ] **Step 3: Write minimal implementation**

In `src/app/api/admin/stats/route.ts`:

Add the row type near the others (line ~17):

```ts
type AgeGroupRow = { ageGroup: string; n: number };
```

Add `ageGroups: [],` to the no-DB empty payload object (after `premiumBands: [],`).

Add `let ageGroupRows: AgeGroupRow[];` with the other `let` declarations.

Add `ageGroupRows` to the destructuring target list and the tuple cast, and add the query as the **last** entry in the `Promise.all([...])` array:

```ts
      sql`SELECT age_group AS "ageGroup", COUNT(*)::int AS n FROM inquiry_log WHERE ts >= ${from} AND ts < ${to} AND age_group IS NOT NULL GROUP BY 1`,
```

Update the tuple type to append `AgeGroupRow[]` and the destructuring `[..., premiumBandRows, ageGroupRows]`.

Add to the success response object (after `premiumBands: premiumBandRows,`):

```ts
    ageGroups: ageGroupRows,
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/api/admin/stats/route.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/admin/stats/route.ts src/app/api/admin/stats/route.test.ts
git commit -m "feat: admin stats returns age_group breakdown"
```

---

### Task 7: Render the "Altersgruppe" panel

**Files:**
- Modify: `src/components/admin/Dashboard.tsx`

**Interfaces:**
- Consumes: `AGE_GROUPS` from `@/lib/ageGroup` (Task 1); stats field `ageGroups` (Task 6); `BreakdownBar` (existing).
- Produces: nothing for later tasks. No unit test exists for `Dashboard`; verified by typecheck + build (consistent with the other panels).

- [ ] **Step 1: Add the import + label map + ordering helper**

Add near the top imports:

```ts
import { AGE_GROUPS } from "@/lib/ageGroup";
```

Add after `PREMIUM_BAND_LABEL` / `orderedBandRows`:

```ts
const AGE_GROUP_LABEL: Record<string, string> = {
  "0": "Neugeboren (0)",
  "1-5": "1–5 Jahre",
  "6-12": "6–12 Jahre",
  "13-18": "13–18 Jahre",
  "19-25": "19–25 Jahre",
  "26-35": "26–35 Jahre",
  "36-50": "36–50 Jahre",
  "51-65": "51–65 Jahre",
  "66+": "66+ Jahre",
};

function orderedAgeGroupRows(
  rows: { ageGroup: string; n: number }[],
): { label: string; value: number }[] {
  const byGroup = new Map(rows.map((r) => [r.ageGroup, r.n]));
  return AGE_GROUPS.filter((g) => byGroup.has(g)).map((g) => ({
    label: AGE_GROUP_LABEL[g] ?? g,
    value: byGroup.get(g) ?? 0,
  }));
}
```

- [ ] **Step 2: Extend the `Stats` type**

Add to the `Stats` type (after `premiumBands: ...`):

```ts
  ageGroups: { ageGroup: string; n: number }[];
```

- [ ] **Step 3: Add the panel markup**

Insert this block **immediately after** the closing `</div>` of the `grid grid-cols-2 gap-4 mb-4` block that contains "Top 10 Prämienregionen" / "Altersklasse" (i.e. right before the `grid grid-cols-2 gap-4` block containing "Franchise-Verteilung"):

```tsx
          <div className="bg-surface border border-outline-variant rounded-lg shadow-sm p-5 mb-4">
            <h2 className="text-title-medium text-on-surface-variant uppercase tracking-wide mb-4">
              Altersgruppe
            </h2>
            <BreakdownBar rows={orderedAgeGroupRows(stats?.ageGroups ?? [])} />
          </div>
```

(The preceding grid block currently has `mb-4`; keep it. The Franchise/Model grid that follows has no top margin — the new card's `mb-4` provides the gap.)

- [ ] **Step 4: Verify typecheck + lint + build**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: no errors; build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/Dashboard.tsx
git commit -m "feat: admin dashboard shows the Altersgruppe panel"
```

---

### Task 8: Mirror the panel in the mockup

**Files:**
- Modify: `mockups/admin.html`

**Interfaces:**
- Consumes: nothing. The mockup is kept 1:1 with `Dashboard.tsx` (per its header comment).

- [ ] **Step 1: Add the Altersgruppe card**

After the `<div class="grid-2">` block containing "Top 10 Prämienregionen" / "Altersklasse" / "Unfalldeckung" (closes at the `</div>` on line ~408), and before the `<!-- ── Franchise + Model ── -->` comment, insert a full-width card matching the existing `.card` / `.bar-chart` markup:

```html
  <!-- ── Age group ── -->
  <div class="card" style="margin-top:16px;">
    <h2>Altersgruppe</h2>
    <div class="bar-chart">
      <div class="bar-row"><span class="bar-row-label">36–50 Jahre</span>  <div class="bar-track"><div class="bar-fill" style="width:100%"></div></div><span class="bar-value">9'870 · 29%</span></div>
      <div class="bar-row"><span class="bar-row-label">26–35 Jahre</span>  <div class="bar-track"><div class="bar-fill" style="width:78%"></div></div> <span class="bar-value">7'700 · 22%</span></div>
      <div class="bar-row"><span class="bar-row-label">51–65 Jahre</span>  <div class="bar-track"><div class="bar-fill" style="width:61%"></div></div> <span class="bar-value">6'040 · 18%</span></div>
      <div class="bar-row"><span class="bar-row-label">19–25 Jahre</span>  <div class="bar-track"><div class="bar-fill" style="width:34%"></div></div> <span class="bar-value">3'380 · 10%</span></div>
      <div class="bar-row"><span class="bar-row-label">13–18 Jahre</span>  <div class="bar-track"><div class="bar-fill" style="width:18%"></div></div> <span class="bar-value">1'800 · 5%</span></div>
      <div class="bar-row"><span class="bar-row-label">66+ Jahre</span>    <div class="bar-track"><div class="bar-fill" style="width:16%"></div></div> <span class="bar-value">1'600 · 5%</span></div>
      <div class="bar-row"><span class="bar-row-label">6–12 Jahre</span>   <div class="bar-track"><div class="bar-fill" style="width:14%"></div></div> <span class="bar-value">1'380 · 4%</span></div>
      <div class="bar-row"><span class="bar-row-label">1–5 Jahre</span>    <div class="bar-track"><div class="bar-fill" style="width:12%"></div></div> <span class="bar-value">1'150 · 3%</span></div>
      <div class="bar-row"><span class="bar-row-label">Neugeboren (0)</span><div class="bar-track"><div class="bar-fill" style="width:9%"></div></div>  <span class="bar-value">  890 · 3%</span></div>
    </div>
  </div>
```

(Numbers are illustrative only, ordered by count descending like the other mockup bar charts. The live panel orders by age; that difference already exists between mockup and component for other panels.)

- [ ] **Step 2: Verify visually**

Run: open `mockups/admin.html` in a browser (or `npx serve mockups`) and confirm the card renders between the region/age grid and the franchise/model grid with no layout break.

- [ ] **Step 3: Commit**

```bash
git add mockups/admin.html
git commit -m "docs: admin mockup shows the Altersgruppe panel"
```

---

### Task 9: Reconcile the docs

**Files:**
- Modify: `requirement.md` (REQ-21, REQ-22)
- Modify: `architecture.md` (§3.3 types, §10.1, §10.2, §10.3, §11 function list, §13.2, §13.4, §15 migration note)

**Interfaces:**
- Consumes: nothing. Documentation must match the shipped behaviour from Tasks 1–8.

- [ ] **Step 1: Update `requirement.md`**

REQ-21 — in the sentence listing the additionally-recorded fields ("It additionally records the UI language, the selected current insurer ... and a coarse band of the self-reported current premium (five ~100-CHF buckets, computed in the browser)."), append:

```
 It also records a coarse age group based on the visitor's age at the time of the visit (nine life-stage buckets: 0, 1–5, 6–12, 13–18, 19–25, 26–35, 36–50, 51–65, 66+ — computed in the browser; the birth year itself is never transmitted).
```

REQ-22 — in the `Panels:` list, after "breakdown by Altersklasse;" add:

```
breakdown by Altersgruppe (finer, life-stage bands derived from birth year);
```

- [ ] **Step 2: Update `architecture.md` §3.3**

After the `type AgeKlasse = ...` line (line ~74) add:

```ts
type AgeGroup =
  | '0' | '1-5' | '6-12' | '13-18'
  | '19-25' | '26-35' | '36-50' | '51-65' | '66+'; // life-stage bands for analytics only; NOT a premium input
```

- [ ] **Step 3: Update `architecture.md` §10.1 / §10.2**

§10.1: note that the payload also carries `ageGroup`, computed from the visitor's age in the *current* calendar year (not the selected premium year).

§10.2 step 1: after the `currentInsurer` / `currentPremiumBand` sentence add:

```
`ageGroup` (one of the nine fixed life-stage bands) is optional; if present it must be valid (400 otherwise), if absent it is stored as NULL.
```

- [ ] **Step 4: Update `architecture.md` §10.3**

Add the column to the `CREATE TABLE` block:

```sql
  current_premium_band TEXT,         -- see below; NULL when no current plan provided
  age_group            TEXT          -- life-stage band (see below); NULL for pre-feature rows
```

Extend the prose after the block:

```
`age_group` is one of `0 | 1-5 | 6-12 | 13-18 | 19-25 | 26-35 | 36-50 | 51-65 | 66+`,
bucketed client-side from the visitor's age in the current calendar year — the birth
year is never transmitted. It is NULL for rows logged before this feature shipped.
Unlike `altersklasse` (age in the selected premium year), `age_group` always reflects
the visitor's age at the time of the visit.
```

- [ ] **Step 5: Update `architecture.md` §11 function list**

After `function getAltersklasse(birthYear: number, calendarYear: number): AgeKlasse` (line ~224) add:

```ts
function getAgeGroup(birthYear: number, visitYear: number): AgeGroup   // analytics bucketing; visitYear = real current year
```

- [ ] **Step 6: Update `architecture.md` §13.2**

After query `-- 4. Age band breakdown` add:

```sql
-- 4b. Age group breakdown (finer; NULL age_group = pre-feature rows, excluded)
-- No ORDER BY: bands come back arbitrary and are sorted client-side into the
-- fixed AGE_GROUPS sequence.
SELECT age_group AS "ageGroup", COUNT(*) AS n
FROM inquiry_log
WHERE ts >= $1 AND ts < $2 AND age_group IS NOT NULL
GROUP BY 1;
```

- [ ] **Step 7: Update `architecture.md` §13.4**

In the breakdown-panels description, add the Altersgruppe panel: full-width, below the Altersklasse panel, `BreakdownBar` with rows ordered youngest→oldest via `AGE_GROUPS`, percentages relative to the sum of age-group rows (pre-feature NULL rows excluded). Note the row-count guidance exception: this panel shows up to 9 rows.

- [ ] **Step 8: Update `architecture.md` §15 migration note**

The note near line ~608 ("This feature adds three columns (`locale`, `current_insurer`, `current_premium_band`); it must not be deployed until `npm run db:migrate`...") — add a sibling sentence:

```
A later change adds a fourth column (`age_group`), same constraint: run `npm run db:migrate` before deploying the code that writes it.
```

- [ ] **Step 9: Verify the full test suite + build**

Run: `npx vitest run && npm run lint && npm run build`
Expected: all pass.

- [ ] **Step 10: Commit**

```bash
git add requirement.md architecture.md
git commit -m "docs: reconcile REQ-21/22 and architecture with the age-group panel"
```

---

## Self-Review

**Spec coverage:**

| Spec item | Task |
|---|---|
| Nine life-stage buckets, exact boundaries | Task 1 |
| Age at time of visit (not premium-year toggle) | Task 1 (signature), Task 5 (`new Date().getFullYear()`) |
| Bucket in browser, store band string only | Task 1 + Task 5 (no birth year sent) |
| `age_group` nullable column | Task 2 |
| Payload carries `ageGroup` | Task 3 |
| API validates (400 on unknown, NULL when absent) | Task 4 |
| Comparator wiring | Task 5 |
| Stats `GROUP BY age_group`, exclude NULL | Task 6 |
| New full-width panel below Altersklasse, KVG panel untouched | Task 7 |
| Row order youngest→oldest | Task 7 (`orderedAgeGroupRows`) |
| Mockup mirror | Task 8 |
| REQ-21 / REQ-22 / architecture updates | Task 9 |
| Tests: ageGroup, inquiryLog, log-inquiry, stats, migrateSql | Tasks 1, 3, 4, 6, 2 |
| No `Dashboard.test.tsx` added | Tasks 7, 9 (documented) |

**Placeholder scan:** none — every code step has literal content.

**Type consistency:** `AgeGroup` / `AGE_GROUPS` / `getAgeGroup(birthYear, visitYear)` used identically in Tasks 1, 3, 4, 5, 7, 9. Payload field `ageGroup: string` (matches existing `altersklasse: string`). Stats field `ageGroups: { ageGroup: string; n: number }[]` consistent Tasks 6↔7. INSERT value order (10 values, `age_group` last) consistent Tasks 2↔4.
