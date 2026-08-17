# Provider Product Detail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clicking a provider row in the results list expands it in place to show every one of that insurer's individual BAG products for the current filter context, each with its own price and discount vs. Standard.

**Architecture:** `PlanRow` becomes a native `<details>/<summary>` accordion (same pattern as `CurrentPlanSection`). Three new pure functions in `src/lib/lookup.ts` (`ALL_TARIFARTS`, `groupByInsurer`, `groupProductsByTarifart`) compute, once per render in `InsuranceComparator`, a `Map<insurerCode, PremiumRow[]>` covering every model type — independent of the "alternative models" filter toggle. A new `ProductList` component renders that map's per-insurer array, grouped by tarifart, inside each row's expanded detail.

**Tech Stack:** Next.js 15 (App Router), React, TypeScript, Tailwind CSS, next-intl, Vitest (node environment — no component-testing library is installed in this repo; see Global Constraints).

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-16-provider-product-detail-design.md` — read it before starting; every task below implements one piece of it.
- **Real data only** (`requirement.md` Core Principle #3): every price/discount shown must come from `PremiumRow` fields already in `public/data/premiums-{year}.json` — nothing estimated or synthesized.
- **Detail is independent of the "alternative models" toggle**: expanding a row always shows every `Tarifart`, even when the main list is filtered to Standard-only.
- **Accordion state is uncontrolled DOM state** (native `<details open>`), not synced to the URL — REQ-11's URL-state contract covers comparison inputs/filters/current-plan only.
- **No `<details name="...">` grouping** — multiple insurers can be expanded simultaneously.
- **Group order**: Standard → Hausarzt → Telmed → HMO → Andere (the existing `TARIFART_PRIORITY` order in `src/lib/lookup.ts`). Within a group: price ascending, ties broken alphabetically by `productName` (`"de-CH"` locale) — same convention as the main list's insurer-name tie-break.
- **Detail-row discount badge text drops the "bis zu"/"up to" qualifier** the summary row's badge uses (`results.discountBadgeExact`, not `results.discountBadge`) — each detail row is one specific product, not an implicit "cheapest of this type."
- **The product matching the collapsed summary row is marked** ("shown above"), matched by `tarifCode` (the actual unique key per `src/lib/types.ts`), not by price (which can tie).
- **`isCurrentPlan` styling stays on the outer summary row only** — never propagated to individual product rows (the self-reported current plan has no `tarifCode` to match against).
- **All four locale files must stay in exact key parity** — `src/messages/messages.test.ts` enforces this; every new UI string needs a real (non-placeholder) translation in `de.json`, `en.json`, `fr.json`, and `it.json`.
- **No new test infrastructure**: this repo has zero `*.test.tsx` files and no `@testing-library/react` dependency (`vitest.config.ts` uses `environment: "node"`). Follow that existing convention — new pure functions in `lookup.ts` get Vitest unit tests; the React component changes are verified manually (Task 7), not via new component-test tooling.

---

## Task 1: Pure lookup functions — `ALL_TARIFARTS`, `groupByInsurer`, `groupProductsByTarifart`

**Files:**
- Modify: `src/lib/lookup.ts`
- Test: `src/lib/lookup.test.ts`

**Interfaces:**
- Produces: `export const ALL_TARIFARTS: Tarifart[]`; `export function groupByInsurer(rows: PremiumRow[]): Map<string, PremiumRow[]>`; `export type TarifartGroup = { tarifart: Tarifart; products: PremiumRow[] }`; `export function groupProductsByTarifart(products: PremiumRow[]): TarifartGroup[]`.

- [ ] **Step 1: Write the failing tests**

Add to `src/lib/lookup.test.ts` (append after the existing `describe("computeHeadline", ...)` block, and add `groupByInsurer, groupProductsByTarifart` to the existing import on line 2):

```ts
import { describe, it, expect } from "vitest";
import {
  filterPlans,
  cheapestPerInsurer,
  sortPlans,
  computeHeadline,
  standardPremiumsByInsurer,
  discountVsStandardPct,
  groupByInsurer,
  groupProductsByTarifart,
} from "@/lib/lookup";
import type { PremiumRow, SelfReportedPlan } from "@/lib/types";
```

```ts
describe("groupByInsurer", () => {
  it("groups rows by insurerCode, preserving row order within each group", () => {
    const result = groupByInsurer(ROWS);
    expect(result.get("A")).toEqual([ROWS[0]]);
    expect(result.get("B")).toEqual([ROWS[1], ROWS[2]]);
    expect(result.get("C")).toEqual([ROWS[3], ROWS[4]]);
  });

  it("returns an empty map for empty input", () => {
    expect(groupByInsurer([]).size).toBe(0);
  });
});

describe("groupProductsByTarifart", () => {
  const products: PremiumRow[] = [
    { ...ROWS[0], tarifart: "hmo", tarifCode: "HMO-B", productName: "Bonus Care", monthlyPremium: 233.6 },
    { ...ROWS[0], tarifart: "standard", tarifCode: "STD", productName: "Grundversicherung", monthlyPremium: 270.5 },
    { ...ROWS[0], tarifart: "telmed", tarifCode: "TEL-A", productName: "Callmed", monthlyPremium: 221.8 },
    { ...ROWS[0], tarifart: "telmed", tarifCode: "TEL-B", productName: "Sana24", monthlyPremium: 229.4 },
    { ...ROWS[0], tarifart: "hausarzt", tarifCode: "HAM", productName: "Casamed", monthlyPremium: 238.9 },
  ];

  it("groups by tarifart in Standard → Hausarzt → Telmed → HMO → Andere order", () => {
    const result = groupProductsByTarifart(products);
    expect(result.map((g) => g.tarifart)).toEqual(["standard", "hausarzt", "telmed", "hmo"]);
  });

  it("sorts each group's products by price ascending", () => {
    const result = groupProductsByTarifart(products);
    const telmedGroup = result.find((g) => g.tarifart === "telmed")!;
    expect(telmedGroup.products.map((p) => p.productName)).toEqual(["Callmed", "Sana24"]);
  });

  it("breaks price ties alphabetically by productName (de-CH)", () => {
    const tiedProducts: PremiumRow[] = [
      { ...ROWS[0], tarifart: "hmo", tarifCode: "HMO-Z", productName: "Zeta HMO", monthlyPremium: 200 },
      { ...ROWS[0], tarifart: "hmo", tarifCode: "HMO-A", productName: "Alpha HMO", monthlyPremium: 200 },
    ];
    const result = groupProductsByTarifart(tiedProducts);
    expect(result[0].products.map((p) => p.productName)).toEqual(["Alpha HMO", "Zeta HMO"]);
  });

  it("returns an empty array for empty input", () => {
    expect(groupProductsByTarifart([])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/lookup.test.ts`
Expected: FAIL — `groupByInsurer`/`groupProductsByTarifart` are not exported from `@/lib/lookup`.

- [ ] **Step 3: Implement**

In `src/lib/lookup.ts`, after the `TARIFART_PRIORITY` constant (currently lines 27-33) and before `cheapestPerInsurer`, add:

```ts
// All five Tarifart values, in the same priority order as TARIFART_PRIORITY above — the
// filter used when the provider-product-detail accordion needs every model type for an
// insurer, independent of whichever models are currently toggled into the main list
// (docs/superpowers/specs/2026-08-16-provider-product-detail-design.md).
export const ALL_TARIFARTS: Tarifart[] = ["standard", "hausarzt", "telmed", "hmo", "andere"];
```

At the end of the file, add:

```ts
/** Groups rows by insurerCode, preserving each row's original relative order — used to
 *  look up "all of this insurer's products at the current filter context" for the
 *  provider-product-detail accordion. */
export function groupByInsurer(rows: PremiumRow[]): Map<string, PremiumRow[]> {
  const byInsurer = new Map<string, PremiumRow[]>();
  for (const row of rows) {
    if (!byInsurer.has(row.insurerCode)) byInsurer.set(row.insurerCode, []);
    byInsurer.get(row.insurerCode)!.push(row);
  }
  return byInsurer;
}

export type TarifartGroup = { tarifart: Tarifart; products: PremiumRow[] };

/** Groups one insurer's products by tarifart, in TARIFART_PRIORITY order (Standard →
 *  Hausarzt → Telmed → HMO → Andere), sorted by price ascending within each group, ties
 *  broken alphabetically by productName ("de-CH") — the provider-product-detail
 *  accordion's row order. */
export function groupProductsByTarifart(products: PremiumRow[]): TarifartGroup[] {
  const byTarifart = new Map<Tarifart, PremiumRow[]>();
  for (const p of products) {
    if (!byTarifart.has(p.tarifart)) byTarifart.set(p.tarifart, []);
    byTarifart.get(p.tarifart)!.push(p);
  }
  return Array.from(byTarifart.entries())
    .sort(([a], [b]) => TARIFART_PRIORITY[a] - TARIFART_PRIORITY[b])
    .map(([tarifart, group]) => ({
      tarifart,
      products: [...group].sort((a, b) =>
        a.monthlyPremium !== b.monthlyPremium
          ? a.monthlyPremium - b.monthlyPremium
          : a.productName.localeCompare(b.productName, "de-CH"),
      ),
    }));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/lookup.test.ts`
Expected: PASS, all tests including the new ones.

- [ ] **Step 5: Commit**

```bash
git add src/lib/lookup.ts src/lib/lookup.test.ts
git commit -m "feat(lookup): add ALL_TARIFARTS, groupByInsurer, groupProductsByTarifart"
```

---

## Task 2: Message catalog — discount badge and "shown above" strings, all 4 locales

**Files:**
- Modify: `src/messages/de.json`
- Modify: `src/messages/en.json`
- Modify: `src/messages/fr.json`
- Modify: `src/messages/it.json`

**Interfaces:**
- Produces: `results.discountBadgeExact` (`{pct}` param) and `results.shownAboveTag`, present with matching structure in all four files.

- [ ] **Step 1: Add the two keys to `src/messages/de.json`**

In the `"results"` object, after `"perMonth": "/Monat"`, add:

```json
    "perMonth": "/Monat",
    "discountBadgeExact": "−{pct}% ggü. Standard",
    "shownAboveTag": "oben angezeigt"
```

(i.e. change the existing `"perMonth": "/Monat"` line, which currently has no trailing comma since it's last in the object, to end with a comma, then add the two new lines before the object's closing `}`.)

- [ ] **Step 2: Add the two keys to `src/messages/en.json`**

In the `"results"` object, after `"perMonth": "/month"`:

```json
    "perMonth": "/month",
    "discountBadgeExact": "−{pct}% vs. standard",
    "shownAboveTag": "shown above"
```

- [ ] **Step 3: Add the two keys to `src/messages/fr.json`**

In the `"results"` object, after `"perMonth": "/mois"`:

```json
    "perMonth": "/mois",
    "discountBadgeExact": "−{pct}% par rapport au standard",
    "shownAboveTag": "affiché ci-dessus"
```

- [ ] **Step 4: Add the two keys to `src/messages/it.json`**

In the `"results"` object, after `"perMonth": "/mese"`:

```json
    "perMonth": "/mese",
    "discountBadgeExact": "−{pct}% rispetto allo standard",
    "shownAboveTag": "mostrato sopra"
```

- [ ] **Step 5: Run the message parity test**

Run: `npx vitest run src/messages/messages.test.ts`
Expected: PASS — `en.json`/`fr.json`/`it.json` each have exactly the same key set as `de.json`.

- [ ] **Step 6: Commit**

```bash
git add src/messages/de.json src/messages/en.json src/messages/fr.json src/messages/it.json
git commit -m "feat(i18n): add discountBadgeExact and shownAboveTag strings"
```

---

## Task 3: `ProductList` component + shared tarifart-style module

**Files:**
- Create: `src/lib/tarifart-style.ts`
- Create: `src/components/results/ProductList.tsx`

**Interfaces:**
- Consumes: `groupProductsByTarifart(products: PremiumRow[]): TarifartGroup[]` and `discountVsStandardPct(standardPremium: number | undefined, premium: number): number | null` from `@/lib/lookup` (Task 1); `results.discountBadgeExact` and `results.shownAboveTag` message keys (Task 2); `copy.tarifart.{tarifart}.label` (already exists, used elsewhere in `PlanRow.tsx`).
- Produces: `export const MODEL_TAG_CLASSES: Record<string, string>` and `export const DEFAULT_MODEL_TAG_CLASSES: string` from `src/lib/tarifart-style.ts`; `export function ProductList(props: { products: PremiumRow[]; standardPremium: number | undefined; shownTarifCode: string }): JSX.Element` from `src/components/results/ProductList.tsx`.

No new test file — this task has no new pure logic (it composes Task 1's already-tested functions); verified visually in Task 7 per the "no new component-test tooling" constraint above.

- [ ] **Step 1: Create `src/lib/tarifart-style.ts`**

```ts
// Model-tag badge color per Tarifart, matching mockups/main.html's .model-tag.hmo/.telmed/.haus
// (hausarzt maps to the mockup's "haus" class — same success-container treatment). Shared
// between PlanRow's summary badge and ProductList's per-product detail rows.
export const MODEL_TAG_CLASSES: Record<string, string> = {
  hmo: "bg-warning-container text-on-warning-container",
  telmed: "bg-tertiary-container text-on-tertiary-container",
  hausarzt: "bg-success-container text-on-success-container",
};
export const DEFAULT_MODEL_TAG_CLASSES = "bg-surface-variant text-on-surface-variant";
```

- [ ] **Step 2: Create `src/components/results/ProductList.tsx`**

```tsx
"use client";

import { useTranslations } from "next-intl";
import type { PremiumRow } from "@/lib/types";
import { groupProductsByTarifart, discountVsStandardPct } from "@/lib/lookup";
import { MODEL_TAG_CLASSES, DEFAULT_MODEL_TAG_CLASSES } from "@/lib/tarifart-style";
import { formatChf } from "@/lib/format";

type Props = {
  products: PremiumRow[];
  standardPremium: number | undefined;
  shownTarifCode: string;
};

export function ProductList({ products, standardPremium, shownTarifCode }: Props) {
  const t = useTranslations();
  const groups = groupProductsByTarifart(products);

  return (
    <div className="mt-2 ml-8 pl-3 border-l-2 border-outline-variant flex flex-col gap-2.5">
      {groups.map((group) => (
        <div key={group.tarifart}>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-outline mb-1">
            {t(`copy.tarifart.${group.tarifart}.label`)}
          </p>
          <div className="flex flex-col gap-1">
            {group.products.map((product) => {
              const discountPct =
                product.tarifart === "standard"
                  ? null
                  : discountVsStandardPct(standardPremium, product.monthlyPremium);
              const isShown = product.tarifCode === shownTarifCode;
              return (
                <div
                  key={product.tarifCode}
                  className={`flex items-center gap-2 rounded-md px-1.5 py-1 border-l-[3px] ${
                    isShown ? "border-primary" : "border-transparent"
                  }`}
                >
                  <span
                    className={`inline-block px-1.5 py-px rounded text-[11px] font-semibold ${
                      MODEL_TAG_CLASSES[product.tarifart] ?? DEFAULT_MODEL_TAG_CLASSES
                    }`}
                  >
                    {t(`copy.tarifart.${product.tarifart}.label`)}
                  </span>
                  <span className="flex-1 min-w-0 text-[13px] truncate">
                    {product.productName}
                    {isShown && (
                      <span className="ml-1.5 inline-block px-1.5 py-px rounded text-[10px] font-semibold border border-primary text-primary bg-surface whitespace-nowrap">
                        {t("results.shownAboveTag")}
                      </span>
                    )}
                  </span>
                  {discountPct != null && (
                    <span className="inline-block px-1.5 py-px rounded text-[11px] font-bold bg-primary-container text-on-primary-container whitespace-nowrap">
                      {t("results.discountBadgeExact", { pct: discountPct.toFixed(1) })}
                    </span>
                  )}
                  <span className="text-[13px] font-semibold w-20 text-right flex-shrink-0">
                    {formatChf(product.monthlyPremium)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors from these two new files. (`PlanRow.tsx` will still reference its own local `MODEL_TAG_CLASSES` at this point — that's resolved in Task 4 — so pre-existing files are unaffected here.)

- [ ] **Step 4: Commit**

```bash
git add src/lib/tarifart-style.ts src/components/results/ProductList.tsx
git commit -m "feat(results): add ProductList component for provider product detail"
```

---

## Task 4: Restructure `PlanRow` into a `<details>/<summary>` accordion

**Files:**
- Modify: `src/components/results/PlanRow.tsx` (full-file rewrite; current content is 96 lines)

**Interfaces:**
- Consumes: `ProductList` from `./ProductList` (Task 3); `MODEL_TAG_CLASSES`/`DEFAULT_MODEL_TAG_CLASSES` from `@/lib/tarifart-style` (Task 3); `discountVsStandardPct` from `@/lib/lookup` (already exported).
- Produces: `PlanRow` now takes `standardPremium: number | undefined` and `products: PremiumRow[]` instead of `discountPct: number | null` — this is a breaking prop-shape change that Task 5 (`PlanList`) must match.

- [ ] **Step 1: Replace `src/components/results/PlanRow.tsx`**

```tsx
"use client";

import { useLocale, useTranslations } from "next-intl";
import type { PremiumRow } from "@/lib/types";
import { discountVsStandardPct } from "@/lib/lookup";
import { formatChf, formatMemberCount, formatMemberCountDetail } from "@/lib/format";
import { MODEL_TAG_CLASSES, DEFAULT_MODEL_TAG_CLASSES } from "@/lib/tarifart-style";
import { ProductList } from "./ProductList";

type Props = {
  plan: PremiumRow;
  rank: number;
  isCheapest: boolean;
  isCurrentPlan: boolean;
  standardPremium: number | undefined;
  products: PremiumRow[];
  memberCount?: number;
  memberCountAsOf: number;
  previousYearPremium?: number;
};

export function PlanRow({
  plan,
  rank,
  isCheapest,
  isCurrentPlan,
  standardPremium,
  products,
  memberCount,
  memberCountAsOf,
  previousYearPremium,
}: Props) {
  const t = useTranslations();
  const locale = useLocale();
  const yoy =
    previousYearPremium != null && previousYearPremium !== plan.monthlyPremium
      ? ((plan.monthlyPremium - previousYearPremium) / previousYearPremium) * 100
      : null;
  const discountPct =
    plan.tarifart === "standard" ? null : discountVsStandardPct(standardPremium, plan.monthlyPremium);

  return (
    <details
      role="listitem"
      className={`rounded-lg border shadow-sm ${
        isCurrentPlan ? "border-error bg-error-container" : "border-outline-variant bg-surface"
      }`}
    >
      <summary className="flex items-center gap-3 p-3.5 cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden">
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
              {t(`copy.tarifart.${plan.tarifart}.label`)}
            </span>
            {discountPct != null && (
              <span className="inline-block px-1.5 py-px rounded text-[11px] font-bold bg-primary-container text-on-primary-container whitespace-nowrap">
                {t("results.discountBadge", { pct: discountPct.toFixed(1) })}
              </span>
            )}
            <span>· {t(`copy.tarifart.${plan.tarifart}.description`)}</span>
          </div>
        </div>
        {memberCount != null && (
          <div
            className="hidden sm:flex flex-col items-end gap-0.5 flex-shrink-0"
            title={formatMemberCountDetail(memberCount, memberCountAsOf, locale)}
            aria-label={formatMemberCountDetail(memberCount, memberCountAsOf, locale)}
          >
            <span className="text-[11px] font-semibold px-1.5 py-px rounded bg-surface-variant text-on-surface-variant whitespace-nowrap">
              <span aria-hidden="true">👥</span> {formatMemberCount(memberCount, locale)}
            </span>
          </div>
        )}
        {isCurrentPlan && (
          <span className="text-[11px] font-semibold px-1.5 py-px rounded bg-error-container text-error">
            {t("results.yourInsurerBadge")}
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
          <div className="text-body-small text-outline">{t("results.perMonth")}</div>
        </div>
        <span
          aria-hidden="true"
          className="text-outline text-xs w-3 text-center flex-shrink-0 before:content-['▸'] [details[open]_&]:before:content-['▾']"
        />
      </summary>
      <div className="px-3.5 pb-3.5">
        <ProductList products={products} standardPremium={standardPremium} shownTarifCode={plan.tarifCode} />
      </div>
    </details>
  );
}
```

This changes three things from the current file: (1) outer `<div role="listitem">` → `<details role="listitem">`, with all the row content moved into a `<summary>` — same accordion pattern `CurrentPlanSection.tsx` already uses, including its exact `[details[open]_&]:before:content-['▾']` chevron idiom; (2) `MODEL_TAG_CLASSES`/`DEFAULT_MODEL_TAG_CLASSES` are now imported from `@/lib/tarifart-style` instead of being defined locally; (3) the `discountPct: number | null` prop is replaced by `standardPremium: number | undefined` (the summary badge now computes its own `discountPct` from it, same as `ProductList` does for each detail row), and a new `products: PremiumRow[]` prop feeds the `<ProductList>` rendered in the detail area.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: errors in `src/components/results/PlanList.tsx` (still passing the old `discountPct` prop, not yet updated) — confirms the prop-shape change took effect. This is expected; Task 5 fixes it.

- [ ] **Step 3: Commit**

```bash
git add src/components/results/PlanRow.tsx
git commit -m "feat(results): make PlanRow an expandable details/summary accordion"
```

---

## Task 5: Wire `PlanList` to the new `PlanRow` props

**Files:**
- Modify: `src/components/results/PlanList.tsx` (full-file rewrite; current content is 30 lines)

**Interfaces:**
- Consumes: `PlanRow` with the new `standardPremium`/`products` props (Task 4).
- Produces: `PlanList` now takes a new `productsByInsurer: Map<string, PremiumRow[]>` prop — Task 6 (`InsuranceComparator`) must supply it.

- [ ] **Step 1: Replace `src/components/results/PlanList.tsx`**

```tsx
import type { PremiumRow } from "@/lib/types";
import { PlanRow } from "./PlanRow";

type Props = {
  plans: PremiumRow[];
  currentInsurerCode: string | null;
  standardBaseline: Map<string, number>;
  productsByInsurer: Map<string, PremiumRow[]>;
  memberCounts: Record<string, number>;
  memberCountAsOf: number;
};

export function PlanList({
  plans,
  currentInsurerCode,
  standardBaseline,
  productsByInsurer,
  memberCounts,
  memberCountAsOf,
}: Props) {
  return (
    <div role="list" className="flex flex-col gap-1.5">
      {plans.map((plan, i) => (
        <PlanRow
          key={plan.insurerCode}
          plan={plan}
          rank={i + 1}
          isCheapest={i === 0}
          isCurrentPlan={plan.insurerCode === currentInsurerCode}
          standardPremium={standardBaseline.get(plan.insurerCode)}
          products={productsByInsurer.get(plan.insurerCode) ?? [plan]}
          memberCount={memberCounts[plan.insurerCode]}
          memberCountAsOf={memberCountAsOf}
        />
      ))}
    </div>
  );
}
```

Note this drops the `discountVsStandardPct` import entirely — that calculation now lives in `PlanRow`/`ProductList`, called at the point each price is actually displayed, rather than precomputed once here. The `productsByInsurer.get(plan.insurerCode) ?? [plan]` fallback covers the defensive case from the spec: if an insurer somehow has no entry in the map, the accordion still shows at least the one product already in the summary row, never an empty detail.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: errors in `src/components/InsuranceComparator.tsx` (not yet passing `productsByInsurer` to `<PlanList>`) — expected; Task 6 fixes it.

- [ ] **Step 3: Commit**

```bash
git add src/components/results/PlanList.tsx
git commit -m "feat(results): thread productsByInsurer through PlanList"
```

---

## Task 6: Compute `productsByInsurer` in `InsuranceComparator`

**Files:**
- Modify: `src/components/InsuranceComparator.tsx`

**Interfaces:**
- Consumes: `ALL_TARIFARTS`, `groupByInsurer` from `@/lib/lookup` (Task 1); `PlanList` with its new `productsByInsurer` prop (Task 5).

- [ ] **Step 1: Update the `@/lib/lookup` import and drop the local `ALT_MODELS` constant**

In `src/components/InsuranceComparator.tsx`, replace line 17:

```ts
import { filterPlans, cheapestPerInsurer, sortPlans, computeHeadline, standardPremiumsByInsurer } from "@/lib/lookup";
```

with:

```ts
import {
  filterPlans,
  cheapestPerInsurer,
  sortPlans,
  computeHeadline,
  standardPremiumsByInsurer,
  groupByInsurer,
  ALL_TARIFARTS,
} from "@/lib/lookup";
```

Replace line 20:

```ts
import type { CurrentPlan, Insurer, SelfReportedPlan, Tarifart } from "@/lib/types";
```

with (drop the now-unused `Tarifart` import — it was only used by the constant being removed next):

```ts
import type { CurrentPlan, Insurer, SelfReportedPlan } from "@/lib/types";
```

Delete line 33 entirely:

```ts
const ALT_MODELS: Tarifart[] = ["standard", "hausarzt", "telmed", "hmo", "andere"];
```

- [ ] **Step 2: Replace both remaining `ALT_MODELS` usages with `ALL_TARIFARTS`**

Line 125 (inside the URL-sync `useEffect`), change:

```ts
      models: altModelsActive ? ALT_MODELS : ["standard"],
```

to:

```ts
      models: altModelsActive ? ALL_TARIFARTS : ["standard"],
```

Line 150 (inside the `results` memo's `filterPlans` call), change the same way:

```ts
      models: altModelsActive ? ALT_MODELS : ["standard"],
```

to:

```ts
      models: altModelsActive ? ALL_TARIFARTS : ["standard"],
```

- [ ] **Step 3: Compute `productsByInsurer` in the `results` memo**

In `src/components/InsuranceComparator.tsx`, the `results` memo currently reads (lines 143-186):

```ts
  const results = useMemo(() => {
    if (!inputsValid || !praemienregionId || !altersklasse || !franchise || ALL_PREMIUMS.length === 0) return null;

    const filtered = filterPlans(ALL_PREMIUMS, {
      praemienregionId,
      altersklasse,
      franchise,
      models: altModelsActive ? ALL_TARIFARTS : ["standard"],
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

(after Step 2's edit, `models: altModelsActive ? ALL_TARIFARTS : ["standard"]` is what line 150 now reads). Insert the new computation right after `standardBaseline`, and add `productsByInsurer` to the returned object:

```ts
  const results = useMemo(() => {
    if (!inputsValid || !praemienregionId || !altersklasse || !franchise || ALL_PREMIUMS.length === 0) return null;

    const filtered = filterPlans(ALL_PREMIUMS, {
      praemienregionId,
      altersklasse,
      franchise,
      models: altModelsActive ? ALL_TARIFARTS : ["standard"],
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

    // Every one of each insurer's products at this context, independent of altModelsActive
    // — the provider-product-detail accordion always shows all model types, even when the
    // main list is currently filtered to Standard-only (design spec: "Data & filtering").
    const allProducts = filterPlans(ALL_PREMIUMS, {
      praemienregionId,
      altersklasse,
      franchise,
      models: ALL_TARIFARTS,
      unfalldeckung,
      year,
    });
    const productsByInsurer = groupByInsurer(allProducts);

    const current: SelfReportedPlan | null = currentPlanProvided
      ? {
          insurerCode: currentPlan.insurerCode!,
          insurerName: INSURERS.find((i) => i.insurerCode === currentPlan.insurerCode)?.insurerName ?? currentPlan.insurerCode!,
          monthlyPremium: currentPlan.monthlyPremium!,
        }
      : null;

    const headline = computeHeadline(current, cheapestRows[0] ?? null);

    return { plans: cheapestRows, headline, standardBaseline, productsByInsurer };
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

- [ ] **Step 4: Pass `productsByInsurer` to `<PlanList>`**

The current JSX (lines 282-289):

```tsx
          {results.plans.length > 0 ? (
            <PlanList
              plans={results.plans}
              currentInsurerCode={currentPlan.insurerCode ?? null}
              standardBaseline={results.standardBaseline}
              memberCounts={MEMBER_COUNTS}
              memberCountAsOf={metadata.memberCountAsOf}
            />
          ) : (
```

becomes:

```tsx
          {results.plans.length > 0 ? (
            <PlanList
              plans={results.plans}
              currentInsurerCode={currentPlan.insurerCode ?? null}
              standardBaseline={results.standardBaseline}
              productsByInsurer={results.productsByInsurer}
              memberCounts={MEMBER_COUNTS}
              memberCountAsOf={metadata.memberCountAsOf}
            />
          ) : (
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors anywhere in the project — this closes the loop started in Tasks 4 and 5.

- [ ] **Step 6: Commit**

```bash
git add src/components/InsuranceComparator.tsx
git commit -m "feat(results): compute productsByInsurer and wire it into PlanList"
```

---

## Task 7: Full verification pass

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: PASS, including the `groupByInsurer`/`groupProductsByTarifart` tests from Task 1 and the message-parity test from Task 2.

- [ ] **Step 2: Type-check and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: production build succeeds.

- [ ] **Step 4: Manual verification**

Run: `npm run dev`, then in a browser:

1. Enter valid inputs (e.g. PLZ `8001`, birth year `1988`, franchise CHF 500) so the results list renders.
2. Click a results row that has alternative models available (toggle "Alternative Modelle" on in the filter bar first if needed, to make sure an insurer with a non-Standard cheapest row is visible) — confirm it expands to show a grouped product list (Standard first if present, then Hausarzt/Telmed/HMO/Andere in that order), each with its own price.
3. Confirm the product matching what's shown in the collapsed summary carries the "shown above" marker (`results.shownAboveTag`).
4. Confirm detail-row discount badges read `−X.X% ggü. Standard` (no "bis zu"), while the summary row's own badge still reads `bis zu −X.X% ggü. Standard`.
5. With "Alternative Modelle" toggled **off** (Standard-only main list), expand a row anyway and confirm its detail still shows HMO/Telmed/Hausarzt/Andere products if that insurer has them — the accordion must not be limited by the toggle.
6. Expand two different insurers' rows at the same time and confirm both stay open independently.
7. Find (or filter to) an insurer with only a single matching product and confirm its accordion still renders, showing that one product marked "shown above."
8. Switch the language switcher to French, Italian, and English in turn and confirm the new discount-badge and "shown above" strings render translated (not raw keys, not German fallback).
9. Confirm nothing else in the results list regressed: rank numbers, member-count badges, YoY badges (where present), and the current-plan red highlight all still look correct.

- [ ] **Step 5: Report results**

If all checks pass, this plan is complete — no commit needed for this task (verification only). If any check fails, fix the issue in the relevant task's files, re-run the affected checks, and note the fix before proceeding.
