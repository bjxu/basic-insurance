# Current-Plan Self-Reported Premium & Discount Badge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 4-field "Was zahlst du heute?" current-plan input with 2 fields (insurer + self-reported monthly premium), and add a per-row "bis zu −X% ggü. Standard" discount badge to the results list.

**Architecture:** `CurrentPlan` shrinks to `{ insurerCode, monthlyPremium }` — no more dataset lookup/disambiguation for the current plan. `computeHeadline` compares that self-reported figure directly against the existing filtered "cheapest" row. A new pure helper (`standardPremiumsByInsurer`) reuses the existing `filterPlans`/`cheapestPerInsurer` pipeline restricted to the Standard model to build a per-insurer baseline, which a second helper (`discountVsStandardPct`) turns into each results row's discount percentage.

**Tech Stack:** Next.js 15 / React 19 / TypeScript, Tailwind v4, Vitest for pure-function unit tests (no component-test framework exists in this repo — don't add one).

## Global Constraints

- Every premium shown in the results list and discount badges traces back to official BAG data via exact match; the current-plan premium is the one deliberate exception — self-reported, not verified (requirement.md Core Principle #3).
- No input field beyond what determines a premium or powers the savings comparison — no name/email/phone/account (REQ-12).
- All comparison state, including the optional current-plan fields, lives in the URL and round-trips through it (REQ-11).
- Monetary values use Swiss convention: "CHF 1'234.50", apostrophe thousands separator, via the existing `formatChf` (§9).
- UI copy is German-only, centralized in `src/lib/copy.ts` where it already exists (§12).
- This codebase's only test infrastructure is Vitest against pure functions in `src/lib/*.ts` — no React component test harness exists. Don't introduce one; verify component changes via `npx tsc --noEmit`, `npm run lint`, and manual checks with `npm run dev`.

---

### Task 1: Core types & pure lookup functions

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/lib/lookup.ts`
- Modify: `src/lib/lookup.test.ts`

**Interfaces:**
- Produces: `CurrentPlan = { insurerCode: string; monthlyPremium: number }`; `SelfReportedPlan = { insurerCode: string; insurerName: string; monthlyPremium: number }`; `HeadlineState` (3 variants, `current-plan-not-found` removed); `computeHeadline(current: SelfReportedPlan | null, cheapest: PremiumRow | null): HeadlineState`; `standardPremiumsByInsurer(rows: PremiumRow[], params: Omit<FilterParams, "models">): Map<string, number>`; `discountVsStandardPct(standardPremium: number | undefined, premium: number): number | null`.
- Consumes: nothing outside this task (foundational).

- [ ] **Step 1: Update `src/lib/types.ts`**

Replace the `CurrentPlan` and `HeadlineState` types:

```ts
export type CurrentPlan = {
  insurerCode: string;
  monthlyPremium: number; // CHF, self-reported by the user — not matched against the dataset (requirement.md Core Principle #3)
};

// The current-plan side of the headline comparison — deliberately narrower than
// PremiumRow (no region/franchise/tarifart/etc.) since it's a self-reported figure,
// not a matched dataset row (requirement.md §5.1).
export type SelfReportedPlan = {
  insurerCode: string;
  insurerName: string;
  monthlyPremium: number;
};

export type HeadlineState =
  | { kind: "savings"; current: SelfReportedPlan; cheapest: PremiumRow; savingsPerYear: number }
  | { kind: "already-cheapest"; current: SelfReportedPlan }
  | { kind: "no-current-plan"; cheapest: PremiumRow | null };
```

This removes the `tarifCode?`/`franchise`/`tarifart`/`unfalldeckung` fields from `CurrentPlan`, the `current-plan-not-found` `HeadlineState` variant, and changes `current`'s type in the remaining two variants from `PremiumRow` to `SelfReportedPlan`.

- [ ] **Step 2: Rewrite `src/lib/lookup.test.ts` (failing tests first)**

Replace the whole file:

```ts
import { describe, it, expect } from "vitest";
import { filterPlans, cheapestPerInsurer, sortPlans, computeHeadline, standardPremiumsByInsurer, discountVsStandardPct } from "@/lib/lookup";
import type { PremiumRow, SelfReportedPlan } from "@/lib/types";

const ROWS: PremiumRow[] = [
  { year: 2026, insurerCode: "A", insurerName: "Assura", praemienregionId: "ZH-1", altersklasse: "erwachsen", franchise: 500, unfalldeckung: true, tarifart: "standard", monthlyPremium: 301.1, tarifCode: "A-STD", productName: "Grundversicherung" },
  { year: 2026, insurerCode: "B", insurerName: "Sanitas", praemienregionId: "ZH-1", altersklasse: "erwachsen", franchise: 500, unfalldeckung: true, tarifart: "telmed", monthlyPremium: 221.8, tarifCode: "B-TEL", productName: "Sanitas Telmed" },
  { year: 2026, insurerCode: "B", insurerName: "Sanitas", praemienregionId: "ZH-1", altersklasse: "erwachsen", franchise: 500, unfalldeckung: true, tarifart: "standard", monthlyPremium: 290.0, tarifCode: "B-STD", productName: "Grundversicherung" },
  { year: 2026, insurerCode: "C", insurerName: "Helsana", praemienregionId: "ZH-1", altersklasse: "erwachsen", franchise: 500, unfalldeckung: true, tarifart: "standard", monthlyPremium: 412.4, tarifCode: "C-STD", productName: "Grundversicherung" },
  { year: 2026, insurerCode: "C", insurerName: "Helsana", praemienregionId: "ZH-1", altersklasse: "erwachsen", franchise: 500, unfalldeckung: true, tarifart: "hmo", monthlyPremium: 362.1, tarifCode: "C-HMO", productName: "Helsana HMO" },
  // Different region — should be filtered out.
  { year: 2026, insurerCode: "D", insurerName: "Visana", praemienregionId: "BE-1", altersklasse: "erwachsen", franchise: 500, unfalldeckung: true, tarifart: "standard", monthlyPremium: 100, tarifCode: "D-STD", productName: "Grundversicherung" },
  // No Standard row for insurer E — the "no baseline" case for the discount helpers.
  { year: 2026, insurerCode: "E", insurerName: "NoStandardKasse", praemienregionId: "ZH-1", altersklasse: "erwachsen", franchise: 500, unfalldeckung: true, tarifart: "hmo", monthlyPremium: 200, tarifCode: "E-HMO", productName: "NoStandardKasse HMO" },
];

describe("filterPlans", () => {
  it("filters by region, age band, franchise, accident coverage, year, and model set", () => {
    const result = filterPlans(ROWS, {
      praemienregionId: "ZH-1",
      altersklasse: "erwachsen",
      franchise: 500,
      models: ["standard"],
      unfalldeckung: true,
      year: 2026,
    });
    expect(result.map((r) => r.insurerCode).sort()).toEqual(["A", "B", "C"]);
  });
});

describe("cheapestPerInsurer", () => {
  it("keeps only each insurer's cheapest row (REQ-3/REQ-4)", () => {
    const filtered = filterPlans(ROWS, {
      praemienregionId: "ZH-1",
      altersklasse: "erwachsen",
      franchise: 500,
      models: ["standard", "telmed", "hmo"],
      unfalldeckung: true,
      year: 2026,
    });
    const result = cheapestPerInsurer(filtered);
    const sanitas = result.find((r) => r.insurerCode === "B");
    const helsana = result.find((r) => r.insurerCode === "C");
    expect(sanitas?.tarifart).toBe("telmed"); // cheaper than Sanitas Standard
    expect(helsana?.tarifart).toBe("hmo"); // cheaper than Helsana Standard
    expect(result).toHaveLength(3);
  });
});

describe("sortPlans", () => {
  it("sorts price ascending", () => {
    const sorted = sortPlans([
      { ...ROWS[0], monthlyPremium: 300 },
      { ...ROWS[0], monthlyPremium: 100 },
      { ...ROWS[0], monthlyPremium: 200 },
    ]);
    expect(sorted.map((r) => r.monthlyPremium)).toEqual([100, 200, 300]);
  });

  it("breaks ties alphabetically by insurer name", () => {
    const sorted = sortPlans([
      { ...ROWS[0], insurerName: "Zurich", monthlyPremium: 100 },
      { ...ROWS[0], insurerName: "Assura", monthlyPremium: 100 },
    ]);
    expect(sorted.map((r) => r.insurerName)).toEqual(["Assura", "Zurich"]);
  });
});

describe("standardPremiumsByInsurer", () => {
  it("maps each insurer to its Standard premium at the given filter context", () => {
    const result = standardPremiumsByInsurer(ROWS, {
      praemienregionId: "ZH-1",
      altersklasse: "erwachsen",
      franchise: 500,
      unfalldeckung: true,
      year: 2026,
    });
    expect(result.get("A")).toBe(301.1);
    expect(result.get("B")).toBe(290.0);
    expect(result.get("C")).toBe(412.4);
  });

  it("omits insurers with no Standard row in that context (REQ-23 defensive case)", () => {
    const result = standardPremiumsByInsurer(ROWS, {
      praemienregionId: "ZH-1",
      altersklasse: "erwachsen",
      franchise: 500,
      unfalldeckung: true,
      year: 2026,
    });
    expect(result.has("E")).toBe(false);
  });
});

describe("discountVsStandardPct", () => {
  it("computes the percentage discount vs. the Standard baseline", () => {
    expect(discountVsStandardPct(400, 300)).toBeCloseTo(25);
  });

  it("returns null when there's no Standard baseline", () => {
    expect(discountVsStandardPct(undefined, 300)).toBeNull();
  });

  it("returns null when the Standard baseline is zero or negative (defensive)", () => {
    expect(discountVsStandardPct(0, 300)).toBeNull();
    expect(discountVsStandardPct(-10, 300)).toBeNull();
  });
});

describe("computeHeadline", () => {
  const cheapest = ROWS[1]; // Sanitas telmed 221.80

  it("returns no-current-plan when none provided", () => {
    expect(computeHeadline(null, cheapest)).toEqual({ kind: "no-current-plan", cheapest });
  });

  it("returns no-current-plan (with no cheapest) when neither is available", () => {
    expect(computeHeadline(null, null)).toEqual({ kind: "no-current-plan", cheapest: null });
  });

  it("returns savings when the self-reported premium is pricier than cheapest", () => {
    const current: SelfReportedPlan = { insurerCode: "C", insurerName: "Helsana", monthlyPremium: 412.4 };
    const result = computeHeadline(current, cheapest);
    expect(result.kind).toBe("savings");
    if (result.kind === "savings") {
      expect(result.savingsPerYear).toBeCloseTo((412.4 - 221.8) * 12);
    }
  });

  it("returns already-cheapest when the self-reported premium equals the cheapest", () => {
    const current: SelfReportedPlan = { insurerCode: "B", insurerName: "Sanitas", monthlyPremium: cheapest.monthlyPremium };
    const result = computeHeadline(current, cheapest);
    expect(result.kind).toBe("already-cheapest");
  });

  it("returns already-cheapest (not savings) when the self-reported premium is strictly cheaper than the filtered cheapest", () => {
    // The self-reported premium isn't filtered by model/region at all — it's just a
    // number the user typed in — so it can legitimately undercut the filtered cheapest (REQ-10).
    const current: SelfReportedPlan = { insurerCode: "Z", insurerName: "SomeInsurer", monthlyPremium: cheapest.monthlyPremium - 10 };
    const result = computeHeadline(current, cheapest);
    expect(result.kind).toBe("already-cheapest");
  });
});
```

This deletes the `findMatchingProducts`/`findCurrentPlan` describe blocks entirely (those functions are being removed) and rewrites `computeHeadline`'s tests for the new 2-argument signature.

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test -- lookup.test.ts`
Expected: FAIL — `standardPremiumsByInsurer` and `discountVsStandardPct` are not exported yet (`TypeError: ... is not a function`), and the `computeHeadline` "savings"/"already-cheapest" tests fail because the old 3-arg signature's `currentPlanProvided` is now `undefined` (falsy), so every call currently returns `{ kind: "no-current-plan" }`.

- [ ] **Step 4: Update `src/lib/lookup.ts`**

Change the import line at the top from:

```ts
import type { CurrentPlan, HeadlineState, PremiumRow, Tarifart } from "./types";
```

to:

```ts
import type { HeadlineState, PremiumRow, SelfReportedPlan, Tarifart } from "./types";
```

Delete `findMatchingProducts` and `findCurrentPlan` entirely (including their doc comments) — everything between the `sortPlans` function and `computeHeadline`.

Replace `computeHeadline` with:

```ts
/** REQ-8/9/10: derive which headline variant to render. `current` is the user's
 *  self-reported plan (or null if not provided/invalid) — there's no "provided but not
 *  found in the data" case (REQ-14, removed) since nothing is matched against the
 *  dataset anymore. */
export function computeHeadline(current: SelfReportedPlan | null, cheapest: PremiumRow | null): HeadlineState {
  if (!current) {
    return { kind: "no-current-plan", cheapest };
  }
  // REQ-10 defines this for the exact-equal case; <= also covers the self-reported
  // premium being strictly cheaper than the filtered "cheapest" — it isn't filtered by
  // model/region at all, it's just a number the user typed in, so it can legitimately
  // undercut the filtered cheapest. Without this, that case would fall into "savings"
  // with a negative amount.
  if (!cheapest || current.monthlyPremium <= cheapest.monthlyPremium) {
    return { kind: "already-cheapest", current };
  }
  const savingsPerYear = (current.monthlyPremium - cheapest.monthlyPremium) * 12;
  return { kind: "savings", current, cheapest, savingsPerYear };
}
```

Add two new functions after it (end of file):

```ts
/** Map from insurerCode to that insurer's Standard-tarifart monthlyPremium, for the given
 *  filter context (region/age band/franchise/accident-coverage/year) — the baseline the
 *  results list's discount badge (REQ-23) compares alternative-model rows against. Built
 *  from a single filterPlans + cheapestPerInsurer pass (same pipeline as the results list
 *  itself), independent of which models are currently toggled into view. */
export function standardPremiumsByInsurer(
  rows: PremiumRow[],
  params: Omit<FilterParams, "models">,
): Map<string, number> {
  const standardRows = cheapestPerInsurer(filterPlans(rows, { ...params, models: ["standard"] }));
  return new Map(standardRows.map((r) => [r.insurerCode, r.monthlyPremium]));
}

/** Discount of `premium` vs. `standardPremium`, as a percentage — the results list's
 *  "bis zu −X% ggü. Standard" badge (REQ-23). Returns null when there's no Standard
 *  baseline for this insurer to compare against — not reachable with current BAG data
 *  (every insurer offers Standard) but handled defensively rather than assumed
 *  impossible (requirement.md §8). */
export function discountVsStandardPct(standardPremium: number | undefined, premium: number): number | null {
  if (standardPremium == null || standardPremium <= 0) return null;
  return ((standardPremium - premium) / standardPremium) * 100;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- lookup.test.ts`
Expected: PASS — all `describe` blocks green.

- [ ] **Step 6: Commit**

```bash
git add src/lib/types.ts src/lib/lookup.ts src/lib/lookup.test.ts
git commit -m "feat(lookup): self-reported current plan, discount-vs-standard helpers

CurrentPlan drops franchise/tarifart/unfalldeckung/tarifCode — down to
insurerCode + monthlyPremium (self-reported). computeHeadline compares
that directly against the filtered cheapest row (2-arg signature,
currentPlanProvided folded into current being non-null). Removes
findMatchingProducts/findCurrentPlan (unused once nothing matches a
current-plan combination against the dataset).

Adds standardPremiumsByInsurer + discountVsStandardPct, the pure logic
behind the results list's new discount badge (REQ-23).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: URL state encode/decode

**Files:**
- Modify: `src/lib/url-state.ts`
- Modify: `src/lib/url-state.test.ts`

**Interfaces:**
- Produces: `ComparisonState` with `currentMonthlyPremium: number | null` replacing `currentFranchise`/`currentTarifart`/`currentTarifCode`/`currentUnfalldeckung`.
- Consumes: nothing from Task 1 (independent).

- [ ] **Step 1: Rewrite `src/lib/url-state.test.ts` (failing tests first)**

Replace the whole file:

```ts
import { describe, it, expect } from "vitest";
import { encodeState, decodeState, type ComparisonState } from "./url-state";

const BASE_STATE: ComparisonState = {
  plz: "8001",
  bfsNr: 261,
  birthYear: 1990,
  franchise: 300,
  year: 2026,
  unfalldeckung: true,
  models: ["standard"],
  currentInsurerCode: "8",
  currentMonthlyPremium: 350.5,
};

describe("encodeState / decodeState — currentMonthlyPremium round-trip", () => {
  it("encodes currentMonthlyPremium as the cp param", () => {
    const params = encodeState(BASE_STATE);
    expect(params.get("cp")).toBe("350.5");
  });

  it("decodes cp back into currentMonthlyPremium", () => {
    const params = encodeState(BASE_STATE);
    const decoded = decodeState(params);
    expect(decoded.currentMonthlyPremium).toBe(350.5);
  });

  it("omits cp when currentMonthlyPremium is null, and decodes its absence as null", () => {
    const params = encodeState({ ...BASE_STATE, currentMonthlyPremium: null });
    expect(params.has("cp")).toBe(false);
    expect(decodeState(params).currentMonthlyPremium).toBeNull();
  });

  it("rejects a zero or negative cp value on decode (defensive — REQ-13)", () => {
    expect(decodeState(new URLSearchParams("cp=0")).currentMonthlyPremium).toBeNull();
    expect(decodeState(new URLSearchParams("cp=-5")).currentMonthlyPremium).toBeNull();
  });

  it("rejects a non-numeric cp value on decode", () => {
    expect(decodeState(new URLSearchParams("cp=abc")).currentMonthlyPremium).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- url-state.test.ts`
Expected: FAIL — `ComparisonState` doesn't yet have a `currentMonthlyPremium` field (TypeScript error) and there's no `cp` param handling, so `params.get("cp")` is `null`.

- [ ] **Step 3: Update `src/lib/url-state.ts`**

Replace the `ComparisonState` type:

```ts
export type ComparisonState = {
  plz: string | null;
  bfsNr: number | null;
  birthYear: number | null;
  franchise: number | null;
  year: number | null;
  unfalldeckung: boolean;
  models: Tarifart[];
  currentInsurerCode: string | null;
  currentMonthlyPremium: number | null;
};
```

Replace `encodeState`:

```ts
export function encodeState(state: ComparisonState): URLSearchParams {
  const params = new URLSearchParams();
  if (state.plz) params.set("plz", state.plz);
  if (state.bfsNr != null) params.set("bfs", String(state.bfsNr));
  if (state.birthYear != null) params.set("by", String(state.birthYear));
  if (state.franchise != null) params.set("fran", String(state.franchise));
  if (state.year != null) params.set("year", String(state.year));
  params.set("acc", state.unfalldeckung ? "1" : "0");
  if (state.models.length) params.set("models", state.models.join(","));
  if (state.currentInsurerCode) params.set("ci", state.currentInsurerCode);
  if (state.currentMonthlyPremium != null) params.set("cp", String(state.currentMonthlyPremium));
  return params;
}
```

Replace `decodeState`:

```ts
export function decodeState(params: URLSearchParams): ComparisonState {
  const plz = params.get("plz");
  const bfsRaw = params.get("bfs");
  const byRaw = params.get("by");
  const franRaw = params.get("fran");
  const yearRaw = params.get("year");
  const modelsRaw = params.get("models");
  const cpRaw = params.get("cp");

  return {
    plz: plz && /^\d{4}$/.test(plz) ? plz : null,
    bfsNr: bfsRaw && /^\d+$/.test(bfsRaw) ? Number(bfsRaw) : null,
    birthYear: byRaw && /^\d{4}$/.test(byRaw) ? Number(byRaw) : null,
    franchise: franRaw && /^\d+$/.test(franRaw) ? Number(franRaw) : null,
    year: yearRaw && /^\d{4}$/.test(yearRaw) ? Number(yearRaw) : null,
    unfalldeckung: params.get("acc") !== "0", // included by default (§5.3)
    models: modelsRaw
      ? (modelsRaw.split(",").filter((m): m is Tarifart => VALID_TARIFARTEN.includes(m as Tarifart)))
      : ["standard"],
    currentInsurerCode: params.get("ci") || null,
    currentMonthlyPremium: cpRaw && /^\d+(\.\d{1,2})?$/.test(cpRaw) && Number(cpRaw) > 0 ? Number(cpRaw) : null,
  };
}
```

`VALID_TARIFARTEN` and the top-of-file comment are unchanged.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- url-state.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/url-state.ts src/lib/url-state.test.ts
git commit -m "feat(url-state): replace current-plan franchise/model/accident params with cp

ci (current insurer) stays; cf/cm/ct/ca (franchise/model/tarifCode/
accident-coverage) are replaced by a single cp (current monthly
premium) param, matching the CurrentPlan type change. Old bookmarked
URLs carrying the removed params simply have them ignored on decode.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: CurrentPlanSection — 2-field UI

**Files:**
- Modify: `src/components/current-plan/CurrentPlanSection.tsx`

**Interfaces:**
- Consumes: `CurrentPlan` from Task 1 (`{ insurerCode, monthlyPremium }`).
- Produces: `CurrentPlanSection` with props `{ insurers: { insurerCode: string; insurerName: string }[]; value: Partial<CurrentPlan>; onChange: (value: Partial<CurrentPlan>) => void }` — `franchiseTiers` and `productOptions` props are removed.

- [ ] **Step 1: Replace the file**

```tsx
"use client";

import type { CurrentPlan } from "@/lib/types";

type Insurer = { insurerCode: string; insurerName: string };

type Props = {
  insurers: Insurer[];
  value: Partial<CurrentPlan>;
  onChange: (value: Partial<CurrentPlan>) => void;
};

export function CurrentPlanSection({ insurers, value, onChange }: Props) {
  return (
    <details className="mt-5 pt-4 border-t border-surface-variant">
      <summary className="flex items-center gap-2 cursor-pointer select-none text-title-medium text-primary list-none [&::-webkit-details-marker]:hidden before:content-['▸'] before:text-xs [details[open]_&]:before:content-['▾']">
        Was zahlst du heute?{" "}
        <span className="font-normal text-on-surface-variant">&nbsp;(optional — zeigt deine Ersparnis)</span>
      </summary>
      <div className="mt-3.5 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label htmlFor="current-insurer" className="block text-label-large text-on-surface-variant mb-1.5">
            Aktuelle Kasse
          </label>
          <select
            id="current-insurer"
            value={value.insurerCode ?? ""}
            onChange={(e) => onChange({ ...value, insurerCode: e.target.value })}
            className="w-full h-10 px-3 rounded-md border border-outline-variant text-[15px] bg-surface outline-none focus:border-primary"
          >
            <option value="">–</option>
            {insurers.map((i) => (
              <option key={i.insurerCode} value={i.insurerCode}>
                {i.insurerName}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="current-premium" className="block text-label-large text-on-surface-variant mb-1.5">
            Monatliche Prämie
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[15px] text-on-surface-variant pointer-events-none">
              CHF
            </span>
            <input
              id="current-premium"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.05"
              placeholder="z.B. 350"
              value={value.monthlyPremium ?? ""}
              onChange={(e) => {
                const raw = e.target.value;
                onChange({ ...value, monthlyPremium: raw === "" ? undefined : Number(raw) });
              }}
              className="w-full h-10 pl-11 pr-3 rounded-md border border-outline-variant text-[15px] bg-surface outline-none focus:border-primary"
            />
          </div>
        </div>
      </div>
    </details>
  );
}
```

This drops the `MODELS` array, the `Franchise`/`Modell`/`Unfalldeckung` fields, the `ProductOption` type, and the whole "Genaues Produkt" disambiguation block — there's nothing left to disambiguate once the app doesn't match a dataset row for the current plan.

- [ ] **Step 2: Type-check and lint**

Run: `npx tsc --noEmit`
Expected: errors in `src/components/InsuranceComparator.tsx` (still passing the old `franchiseTiers`/`productOptions` props — fixed in Task 6) but **no errors originating from `CurrentPlanSection.tsx` itself**. Confirm by checking the error file paths.

Run: `npm run lint -- src/components/current-plan/CurrentPlanSection.tsx`
Expected: no lint errors for this file.

- [ ] **Step 3: Commit**

```bash
git add src/components/current-plan/CurrentPlanSection.tsx
git commit -m "feat(current-plan): reduce to 2 fields — Kasse + monatliche Prämie

Removes Franchise/Modell/Unfalldeckung and the 'Genaues Produkt'
disambiguation step. InsuranceComparator.tsx still passes the old
props at this point — fixed in a later task in this same series.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Discount badge — PlanRow & PlanList

**Files:**
- Modify: `src/components/results/PlanRow.tsx`
- Modify: `src/components/results/PlanList.tsx`

**Interfaces:**
- Consumes: `discountVsStandardPct` from Task 1 (`src/lib/lookup.ts`).
- Produces: `PlanRow` with new prop `discountPct: number | null`; `PlanList` with new prop `standardBaseline: Map<string, number>`.

- [ ] **Step 1: Update `src/components/results/PlanRow.tsx`**

Replace the file:

```tsx
import type { PremiumRow } from "@/lib/types";
import { TARIFART_LABELS, TARIFART_DESCRIPTIONS } from "@/lib/copy";
import { formatChf } from "@/lib/format";

type Props = {
  plan: PremiumRow;
  rank: number;
  isCheapest: boolean;
  isCurrentPlan: boolean;
  discountPct: number | null;
  previousYearPremium?: number;
};

// Model tag color per Tarifart, matching mockups/main.html's .model-tag.hmo/.telmed/.haus
// (hausarzt maps to the mockup's "haus" class — same success-container treatment).
const MODEL_TAG_CLASSES: Record<string, string> = {
  hmo: "bg-warning-container text-on-warning-container",
  telmed: "bg-tertiary-container text-on-tertiary-container",
  hausarzt: "bg-success-container text-on-success-container",
};
const DEFAULT_MODEL_TAG_CLASSES = "bg-surface-variant text-on-surface-variant";

export function PlanRow({ plan, rank, isCheapest, isCurrentPlan, discountPct, previousYearPremium }: Props) {
  const yoy =
    previousYearPremium != null && previousYearPremium !== plan.monthlyPremium
      ? ((plan.monthlyPremium - previousYearPremium) / previousYearPremium) * 100
      : null;

  return (
    <div
      role="listitem"
      className={`flex items-center gap-3 rounded-lg border p-3.5 shadow-sm ${
        isCurrentPlan ? "border-error bg-error-container" : "border-outline-variant bg-surface"
      }`}
    >
      <div className={`w-5 text-center text-sm font-bold ${rank === 1 ? "text-primary" : "text-outline"}`}>
        {rank}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-[15px] truncate">{plan.insurerName}</div>
        <div className="text-xs text-on-surface-variant mt-0.5 flex flex-wrap items-center gap-1">
          <span
            className={`inline-block px-1.5 py-px rounded text-[11px] font-semibold ${
              MODEL_TAG_CLASSES[plan.tarifart] ?? DEFAULT_MODEL_TAG_CLASSES
            }`}
          >
            {TARIFART_LABELS[plan.tarifart]}
          </span>
          {discountPct != null && (
            <span className="inline-block px-1.5 py-px rounded text-[11px] font-bold bg-primary-container text-on-primary-container whitespace-nowrap">
              bis zu −{discountPct.toFixed(1)}% ggü. Standard
            </span>
          )}
          <span>· {TARIFART_DESCRIPTIONS[plan.tarifart]}</span>
        </div>
      </div>
      {isCurrentPlan && (
        <span className="text-[11px] font-semibold px-1.5 py-px rounded bg-error-container text-error">
          Deine Kasse
        </span>
      )}
      {yoy != null && (
        <div
          className={`text-xs font-semibold px-1.5 py-px rounded ${
            yoy > 0 ? "bg-error-container text-error" : yoy < 0 ? "bg-success-container text-success" : "text-outline font-normal"
          }`}
        >
          {yoy > 0 ? "+" : ""}
          {yoy.toFixed(1)}%
        </div>
      )}
      <div className="text-right">
        <div className={`text-headline-small ${isCheapest ? "text-primary" : "text-on-surface"}`}>
          {formatChf(plan.monthlyPremium)}
        </div>
        <div className="text-body-small text-outline">/Monat</div>
      </div>
    </div>
  );
}
```

The model-badge line changes from a plain block with inline text to a `flex flex-wrap items-center gap-1` row so the new discount chip sits between the model tag and the "· description" text without breaking layout at narrow widths (matches `mockups/main.html`'s `.model-badge` treatment, `PR #12`).

- [ ] **Step 2: Update `src/components/results/PlanList.tsx`**

Replace the file:

```tsx
import type { PremiumRow } from "@/lib/types";
import { discountVsStandardPct } from "@/lib/lookup";
import { PlanRow } from "./PlanRow";

type Props = {
  plans: PremiumRow[];
  currentInsurerCode: string | null;
  standardBaseline: Map<string, number>;
};

export function PlanList({ plans, currentInsurerCode, standardBaseline }: Props) {
  return (
    <div role="list" className="flex flex-col gap-1.5">
      {plans.map((plan, i) => (
        <PlanRow
          key={plan.insurerCode}
          plan={plan}
          rank={i + 1}
          isCheapest={i === 0}
          isCurrentPlan={plan.insurerCode === currentInsurerCode}
          discountPct={plan.tarifart === "standard" ? null : discountVsStandardPct(standardBaseline.get(plan.insurerCode), plan.monthlyPremium)}
        />
      ))}
    </div>
  );
}
```

Standard rows always get `discountPct: null` (nothing to compare against itself) — checked before calling `discountVsStandardPct` rather than relying on the helper alone, since a Standard row's own insurer will always be present as its own baseline and would otherwise show a nonsensical "bis zu −0.0%".

- [ ] **Step 3: Type-check and lint**

Run: `npx tsc --noEmit`
Expected: errors only in `src/components/InsuranceComparator.tsx` (not yet passing `standardBaseline` to `PlanList` — fixed in Task 6); no errors from `PlanRow.tsx`/`PlanList.tsx` themselves.

Run: `npm run lint -- src/components/results/PlanRow.tsx src/components/results/PlanList.tsx`
Expected: no lint errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/results/PlanRow.tsx src/components/results/PlanList.tsx
git commit -m "feat(results): discount badge on alternative-model rows (REQ-23)

PlanRow renders 'bis zu −X.X% ggü. Standard' next to the model tag,
sourced from PlanList's new standardBaseline map (built upstream via
lookup.ts's standardPremiumsByInsurer). Standard rows never show a
badge. InsuranceComparator.tsx doesn't pass standardBaseline yet —
fixed in a later task in this same series.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: Headline — drop the removed HeadlineState kind

**Files:**
- Modify: `src/components/results/Headline.tsx`

**Interfaces:**
- Consumes: `HeadlineState` from Task 1 (3 variants, `current-plan-not-found` removed).
- Produces: nothing new — same `Headline` component signature.

- [ ] **Step 1: Replace the file**

```tsx
import type { HeadlineState, PremiumRow } from "@/lib/types";
import { formatChf } from "@/lib/format";

type Props = {
  headline: HeadlineState;
  year: number;
};

export function Headline({ headline, year }: Props) {
  if (headline.kind === "savings") {
    return (
      <div role="status" className="mt-6 rounded-lg p-5 flex gap-3.5 bg-success-container border border-success-container">
        <span className="text-xl" aria-hidden>💡</span>
        <p className="text-sm text-on-success-container">
          <strong className="block text-base font-bold text-on-surface mb-0.5">
            Wenn du nichts tust: {formatChf(headline.current.monthlyPremium)}/Monat bei{" "}
            {headline.current.insurerName}.
          </strong>
          Günstigstes Angebot für dein Profil {year}: {formatChf(headline.cheapest.monthlyPremium)}/Monat bei{" "}
          {headline.cheapest.insurerName} —{" "}
          <span className="text-success font-bold">
            spare {formatChf(headline.savingsPerYear)}/Jahr durch einen Wechsel.
          </span>
        </p>
      </div>
    );
  }

  if (headline.kind === "already-cheapest") {
    return (
      <div role="status" className="mt-6 rounded-lg p-5 flex gap-3.5 bg-success-container border border-success-container">
        <span className="text-xl" aria-hidden>✅</span>
        <p className="text-sm text-on-success-container">
          <strong className="block text-base font-bold text-on-surface mb-0.5">
            Du hast bereits das günstigste Angebot für dein Profil.
          </strong>
          {headline.current.insurerName} · {formatChf(headline.current.monthlyPremium)}/Monat.
        </p>
      </div>
    );
  }

  return headline.cheapest ? <CheapestOnly cheapest={headline.cheapest} /> : null;
}

function CheapestOnly({ cheapest }: { cheapest: PremiumRow }) {
  return (
    <div role="status" className="mt-6 rounded-lg p-5 flex gap-3.5 bg-primary-container border border-primary-container">
      <span className="text-xl" aria-hidden>🔍</span>
      <p className="text-sm text-on-primary-container">
        <strong className="block text-base font-bold text-on-surface mb-0.5">
          Günstigstes Angebot: {formatChf(cheapest.monthlyPremium)}/Monat bei {cheapest.insurerName}.
        </strong>
        Gib deine aktuelle Kasse an, um zu sehen, wie viel du sparen könntest. ↓
      </p>
    </div>
  );
}
```

Two deliberate wording changes beyond removing the dead branch: the "Wenn du nichts tust" line drops the `{year}` suffix it used to have next to the current-plan premium (that premium is now self-reported and undated — it doesn't change when the year toggle flips, so labeling it with a specific year would misstate it), and `{year}` moves to qualify "Günstigstes Angebot für dein Profil {year}" instead, which *is* year-specific. Same fix applied to the "already-cheapest" line.

- [ ] **Step 2: Type-check and lint**

Run: `npx tsc --noEmit`
Expected: no errors originating from `Headline.tsx` — TypeScript will have already been flagging the old `current-plan-not-found` branch as comparing against a literal no longer in `HeadlineState`, so this fixes an existing compile error rather than introducing one.

Run: `npm run lint -- src/components/results/Headline.tsx`
Expected: no lint errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/results/Headline.tsx
git commit -m "feat(headline): drop current-plan-not-found (REQ-14 removed)

No more dataset-matching step for the current plan, so there's no
'provided but not found' case to render. Also stops labeling the
now-undated self-reported premium with a specific year.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: Wire it together — InsuranceComparator.tsx

**Files:**
- Modify: `src/components/InsuranceComparator.tsx`

**Interfaces:**
- Consumes: everything from Tasks 1–5 (`CurrentPlan`, `SelfReportedPlan`, `computeHeadline`, `standardPremiumsByInsurer`, updated `CurrentPlanSection`/`PlanList`/`Headline` props, updated `ComparisonState`).
- Produces: a fully wired, type-checking, lint-clean app.

- [ ] **Step 1: Update imports**

Change:

```ts
import { filterPlans, cheapestPerInsurer, sortPlans, findCurrentPlan, findMatchingProducts, computeHeadline } from "@/lib/lookup";
import { encodeState, decodeState } from "@/lib/url-state";
import type { CurrentPlan, Tarifart } from "@/lib/types";
```

to:

```ts
import { filterPlans, cheapestPerInsurer, sortPlans, computeHeadline, standardPremiumsByInsurer } from "@/lib/lookup";
import { encodeState, decodeState } from "@/lib/url-state";
import type { CurrentPlan, SelfReportedPlan, Tarifart } from "@/lib/types";
```

- [ ] **Step 2: Update `currentPlan` state initialization**

Change:

```ts
  const [currentPlan, setCurrentPlan] = useState<Partial<CurrentPlan>>({
    insurerCode: initial.currentInsurerCode ?? undefined,
    franchise: initial.currentFranchise ?? undefined,
    tarifart: initial.currentTarifart ?? undefined,
    tarifCode: initial.currentTarifCode ?? undefined,
    unfalldeckung: initial.currentUnfalldeckung ?? undefined,
  });
```

to:

```ts
  const [currentPlan, setCurrentPlan] = useState<Partial<CurrentPlan>>({
    insurerCode: initial.currentInsurerCode ?? undefined,
    monthlyPremium: initial.currentMonthlyPremium ?? undefined,
  });
```

- [ ] **Step 3: Remove the now-dead `franchiseTiers` variable**

Delete this line (nothing consumes it once `CurrentPlanSection` no longer takes a `franchiseTiers` prop — `DeductibleSelect` computes its own tiers internally from `altersklasse`):

```ts
  const franchiseTiers = altersklasse ? getFranchiseTiers(altersklasse) : [];
```

- [ ] **Step 4: Update the URL-sync effect**

Change:

```ts
      currentInsurerCode: currentPlan.insurerCode ?? null,
      currentFranchise: currentPlan.franchise ?? null,
      currentTarifart: currentPlan.tarifart ?? null,
      currentTarifCode: currentPlan.tarifCode ?? null,
      currentUnfalldeckung: currentPlan.unfalldeckung ?? null,
```

to:

```ts
      currentInsurerCode: currentPlan.insurerCode ?? null,
      currentMonthlyPremium: currentPlan.monthlyPremium ?? null,
```

- [ ] **Step 5: Replace `currentPlanCoreProvided`, remove `currentPlanProductOptions` and its reset effect**

Change:

```ts
  const currentPlanCoreProvided = Boolean(
    currentPlan.insurerCode && currentPlan.franchise != null && currentPlan.tarifart && currentPlan.unfalldeckung != null,
  );

  const currentPlanProductOptions = useMemo(() => {
    if (!currentPlanCoreProvided || !praemienregionId || !altersklasse) return null;
    return findMatchingProducts(ALL_PREMIUMS, {
      insurerCode: currentPlan.insurerCode!,
      franchise: currentPlan.franchise!,
      tarifart: currentPlan.tarifart!,
      unfalldeckung: currentPlan.unfalldeckung!,
      praemienregionId,
      altersklasse,
      year,
    }).map((r) => ({ tarifCode: r.tarifCode, productName: r.productName }));
  }, [currentPlanCoreProvided, praemienregionId, altersklasse, year, currentPlan.insurerCode, currentPlan.franchise, currentPlan.tarifart, currentPlan.unfalldeckung, ALL_PREMIUMS]);

  // currentPlan.tarifCode is only valid for the exact combination of insurer/
  // franchise/model/accident-coverage it was picked under (bug fix: without this,
  // a stale tarifCode from a since-changed combination could either produce a false
  // "not found" or, worse, silently resolve to a different, wrong product that
  // happens to share the same code under a different insurer — see
  // docs/superpowers/plans/2026-08-12-product-disambiguation-and-bundle-size.md's
  // final-review fix wave).
  useEffect(() => {
    if (ALL_PREMIUMS.length === 0) return;
    if (
      currentPlan.tarifCode &&
      currentPlanProductOptions &&
      !currentPlanProductOptions.some((o) => o.tarifCode === currentPlan.tarifCode)
    ) {
      setCurrentPlan((p) => ({ ...p, tarifCode: undefined }));
    }
  }, [currentPlanProductOptions, currentPlan.tarifCode, ALL_PREMIUMS]);
```

to:

```ts
  // A current plan is "provided" once both fields are filled with a usable value — no
  // more dataset-matching/disambiguation step (requirement.md §5.1, REQ-14 removed).
  const currentPlanProvided = Boolean(
    currentPlan.insurerCode &&
      currentPlan.monthlyPremium != null &&
      Number.isFinite(currentPlan.monthlyPremium) &&
      currentPlan.monthlyPremium > 0,
  );
```

- [ ] **Step 6: Update the `results` useMemo**

Change:

```ts
  const results = useMemo(() => {
    if (!inputsValid || !praemienregionId || !altersklasse || !franchise || ALL_PREMIUMS.length === 0) return null;

    const filtered = filterPlans(ALL_PREMIUMS, {
      praemienregionId,
      altersklasse,
      franchise,
      models: altModelsActive ? ALT_MODELS : ["standard"],
      unfalldeckung,
      year,
    });
    const cheapestRows = sortPlans(cheapestPerInsurer(filtered));

    // A current plan isn't "provided" for headline purposes until any real ambiguity
    // (>1 matching product, requirement.md §11.2) is resolved by the user's pick.
    const currentPlanProvided =
      currentPlanCoreProvided && (currentPlanProductOptions == null || currentPlanProductOptions.length <= 1 || Boolean(currentPlan.tarifCode));
    const currentRow = currentPlanProvided
      ? findCurrentPlan(ALL_PREMIUMS, {
          insurerCode: currentPlan.insurerCode!,
          franchise: currentPlan.franchise!,
          tarifart: currentPlan.tarifart!,
          unfalldeckung: currentPlan.unfalldeckung!,
          tarifCode: currentPlan.tarifCode,
          praemienregionId,
          altersklasse,
          year,
        })
      : null;

    const headline = computeHeadline(currentRow, cheapestRows[0] ?? null, currentPlanProvided);

    return { plans: cheapestRows, headline };
  }, [
    inputsValid,
    praemienregionId,
    altersklasse,
    franchise,
    altModelsActive,
    unfalldeckung,
    year,
    currentPlan,
    currentPlanCoreProvided,
    currentPlanProductOptions,
    ALL_PREMIUMS,
  ]);
```

to:

```ts
  const results = useMemo(() => {
    if (!inputsValid || !praemienregionId || !altersklasse || !franchise || ALL_PREMIUMS.length === 0) return null;

    const filtered = filterPlans(ALL_PREMIUMS, {
      praemienregionId,
      altersklasse,
      franchise,
      models: altModelsActive ? ALT_MODELS : ["standard"],
      unfalldeckung,
      year,
    });
    const cheapestRows = sortPlans(cheapestPerInsurer(filtered));

    const standardBaseline = standardPremiumsByInsurer(ALL_PREMIUMS, {
      praemienregionId,
      altersklasse,
      franchise,
      unfalldeckung,
      year,
    });

    const current: SelfReportedPlan | null = currentPlanProvided
      ? {
          insurerCode: currentPlan.insurerCode!,
          insurerName: INSURERS.find((i) => i.insurerCode === currentPlan.insurerCode)?.insurerName ?? currentPlan.insurerCode!,
          monthlyPremium: currentPlan.monthlyPremium!,
        }
      : null;

    const headline = computeHeadline(current, cheapestRows[0] ?? null);

    return { plans: cheapestRows, headline, standardBaseline };
  }, [
    inputsValid,
    praemienregionId,
    altersklasse,
    franchise,
    altModelsActive,
    unfalldeckung,
    year,
    currentPlan,
    currentPlanProvided,
    ALL_PREMIUMS,
  ]);
```

- [ ] **Step 7: Update the `CurrentPlanSection` and `PlanList` JSX**

Change:

```tsx
        <CurrentPlanSection
          insurers={INSURERS}
          franchiseTiers={franchiseTiers.length ? franchiseTiers : [300, 500, 1000, 1500, 2000, 2500]}
          value={currentPlan}
          onChange={setCurrentPlan}
          productOptions={currentPlanProductOptions}
        />
```

to:

```tsx
        <CurrentPlanSection insurers={INSURERS} value={currentPlan} onChange={setCurrentPlan} />
```

Change:

```tsx
            <PlanList plans={results.plans} currentInsurerCode={currentPlan.insurerCode ?? null} />
```

to:

```tsx
            <PlanList plans={results.plans} currentInsurerCode={currentPlan.insurerCode ?? null} standardBaseline={results.standardBaseline} />
```

- [ ] **Step 8: Full verification**

Run: `npx tsc --noEmit`
Expected: no errors anywhere in the project.

Run: `npm run lint`
Expected: no errors.

Run: `npm test`
Expected: all suites pass (`ageband`, `format`, `lookup`, `url-state`, `validate`).

Run: `npm run dev`, open the app in a browser, and manually walk through:
1. Enter a valid PLZ/birth year/franchise — results list renders.
2. Toggle "Alternative Modelle" on — confirm alternative-model rows (Hausarzt/HMO/Telmed) show a "bis zu −X.X% ggü. Standard" chip next to the model tag, and Standard rows show none.
3. Expand "Was zahlst du heute?" — confirm only 2 fields (Aktuelle Kasse, Monatliche Prämie) render, and the premium field accepts a decimal CHF value.
4. Fill in both fields with a value higher than the cheapest match — confirm the "Wenn du nichts tust" headline appears with a correct savings figure.
5. Set the premium field lower than the cheapest match — confirm the "Du hast bereits das günstigste Angebot" headline appears (REQ-10).
6. Reload the page from the resulting URL — confirm the current-plan fields and headline reconstruct correctly (REQ-11).

- [ ] **Step 9: Commit**

```bash
git add src/components/InsuranceComparator.tsx
git commit -m "feat(comparator): wire self-reported current plan + discount badges

Final integration: CurrentPlanSection/PlanList/computeHeadline/url-state
all consistent with the 2-field current-plan input. Removes the dead
franchiseTiers variable and the product-disambiguation reset effect.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 7: Docs sync — architecture.md

**Files:**
- Modify: `architecture.md`

**Interfaces:** none (documentation only).

- [ ] **Step 1: Update the §5.1 parameter table**

Change:

```markdown
| `ci` | string | BAG insurer code |
| `cf` | number | current franchise |
| `cm` | Tarifart | current model |
| `ca` | `0\|1` | current accident coverage |
```

to:

```markdown
| `ci` | string | current insurer's BAG code |
| `cp` | number | current monthly premium, CHF, self-reported |
```

- [ ] **Step 2: Update the §6 Lookup Logic signatures**

Change:

```
findCurrentPlan(rows, { insurerCode, franchise, tarifart, unfalldeckung, praemienregionId, altersklasse, year })
  → PremiumRow | null

computeHeadline(current: PremiumRow | null, cheapest: PremiumRow | null, currentPlanProvided: boolean)
  → HeadlineState
```

to:

```
standardPremiumsByInsurer(rows, { praemienregionId, altersklasse, franchise, unfalldeckung, year })
  → Map<insurerCode, monthlyPremium>  // Standard-tarifart baseline for the discount badge (REQ-23)

discountVsStandardPct(standardPremium: number | undefined, premium: number)
  → number | null

computeHeadline(current: SelfReportedPlan | null, cheapest: PremiumRow | null)
  → HeadlineState
```

And change the paragraph below it from:

> `findCurrentPlan` runs against the **unfiltered** set (all models, both accident-coverage
> variants) so the current plan is always findable regardless of active filters.

to:

> The current-plan premium is self-reported by the user (requirement.md §5.1) —
> `computeHeadline` compares it directly against the filtered `cheapest` row, with no
> dataset lookup/matching step. `standardPremiumsByInsurer` runs its own
> `filterPlans → cheapestPerInsurer` pass restricted to `models: ["standard"]`,
> independent of whichever models are currently toggled into the main results list.

- [ ] **Step 3: Commit**

```bash
git add architecture.md
git commit -m "docs(architecture): sync with self-reported current plan + discount badge

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```
