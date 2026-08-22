# Provider Product Grouping Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** In `ProductList`, nest same-plan price tiers (e.g. Helsana's `BeneFit PLUS Hausarzt`
R1–R4) under one shared product name + description with each tier as a price sub-row, instead of
repeating the name/description once per tier — driven by a new hand-and-crawler-maintained
`src/data/product-groups.json`, with every insurer that has no entries there rendering exactly
as today.

**Architecture:** A new `ProductGroups` lookup (`src/lib/productGroups.ts`) mirrors the existing
`ProductDescriptions` pattern. `groupProductsByTarifart` (`src/lib/lookup.ts`) gains a nesting
level — tarifart → product group → variants — and `ProductList.tsx` renders singleton groups via
today's unchanged flat row and multi-variant groups via a new header/description/indented-variants
shape. `scripts/crawl/crawlDescriptions.ts` auto-populates the same file when multiple tarifCodes
land on the same crawled page, with hand edits always taking precedence.

**Tech Stack:** TypeScript, Next.js/React (existing), Vitest (existing), Tailwind utility classes
(existing) — no new dependencies.

## Global Constraints

- `product-groups.json` is `Record<insurerCode, Record<tarifCode, string>>`, starts as `{}`. A
  tarifCode with no entry is its own singleton group named after its own `productName` — this is
  the default and must never require an entry to "turn grouping off."
- `product-descriptions.json` is unchanged — still keyed directly by `tarifCode`, no migration.
- Hand-entered `product-groups.json` entries always win over the crawler: it only ever writes a
  tarifCode that has no existing entry.
- The crawler derives a group name only from tarifCodes that matched to the *same* crawled page
  (the grouping signal) — never from name-similarity alone. If the derived name is empty, it
  leaves those tarifCodes ungrouped rather than writing a guess.
- `matchProductPage` (`scripts/crawl/matchProductPage.ts`) is not modified by this plan.
- Singleton groups (`variants.length === 1`) render via today's exact flat single-row JSX (tag +
  name + discount badge + price on one line) — not the new nested shape.
- Full spec: `docs/superpowers/specs/2026-08-22-provider-product-grouping-design.md`.

Note: `mockups/main.html` already has the new grouped-variant CSS/example (done ahead of this
plan, as a design preview) — no task below touches it.

---

## File Structure

```
src/lib/productGroups.ts                (new — ProductGroups type, getProductGroupName)
src/lib/productGroups.test.ts           (new)
src/data/product-groups.json            (new — starts as {}, then hand-populated for Helsana)

src/lib/lookup.ts                       (modify — groupProductsByTarifart reshape, deriveVariantLabel)
src/lib/lookup.test.ts                  (modify)

src/components/results/ProductList.tsx  (modify — render the new nested structure)

scripts/crawl/deriveProductGroups.ts    (new — deriveProductGroups, pure)
scripts/crawl/deriveProductGroups.test.ts (new)
scripts/crawl/crawlDescriptions.ts      (modify — wire deriveProductGroups into the crawl loop)
```

---

### Task 1: `ProductGroups` type, empty data file, and the lookup helper

**Files:**
- Create: `src/data/product-groups.json`
- Create: `src/lib/productGroups.ts`
- Test: `src/lib/productGroups.test.ts`

**Interfaces:**
- Produces: `export type ProductGroups = Record<string, Record<string, string>>` (insurerCode → tarifCode → groupName) (in `productGroups.ts`)
- Produces: `export function getProductGroupName(groups: ProductGroups, insurerCode: string, tarifCode: string): string | undefined`

- [ ] **Step 1: Write the failing test**

Create `src/lib/productGroups.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { getProductGroupName, type ProductGroups } from "@/lib/productGroups";

describe("getProductGroupName", () => {
  const groups: ProductGroups = {
    "1562": {
      BFP_BF: "BeneFit PLUS Hausarzt",
      BFP_CA: "BeneFit PLUS Hausarzt",
    },
  };

  it("returns the group name for a known insurer/tarifCode", () => {
    expect(getProductGroupName(groups, "1562", "BFP_BF")).toBe("BeneFit PLUS Hausarzt");
  });

  it("returns undefined for an unknown tarifCode", () => {
    expect(getProductGroupName(groups, "1562", "BASE")).toBeUndefined();
  });

  it("returns undefined for an unknown insurerCode", () => {
    expect(getProductGroupName(groups, "9999", "BFP_BF")).toBeUndefined();
  });

  it("returns undefined against an empty groups map", () => {
    expect(getProductGroupName({}, "1562", "BFP_BF")).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/productGroups.test.ts`
Expected: FAIL — `Cannot find module '@/lib/productGroups'` (file doesn't exist yet).

- [ ] **Step 3: Create the empty data file**

Create `src/data/product-groups.json`:

```json
{}
```

- [ ] **Step 4: Write the implementation**

Create `src/lib/productGroups.ts`:

```ts
// Fallback-safe lookup for hand/crawler-maintained product groupings — which tarifCodes
// represent the same underlying plan sold as separately-priced tiers (e.g. Helsana's BeneFit
// PLUS Hausarzt R1-R4), so ProductList can nest them under one shared name/description
// (docs/superpowers/specs/2026-08-22-provider-product-grouping-design.md). Pure — the caller
// owns importing src/data/product-groups.json and applying the singleton default (no entry ->
// group of one, named after the product's own productName).

export type ProductGroups = Record<string, Record<string, string>>; // insurerCode -> tarifCode -> groupName

export function getProductGroupName(
  groups: ProductGroups,
  insurerCode: string,
  tarifCode: string,
): string | undefined {
  return groups[insurerCode]?.[tarifCode];
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/lib/productGroups.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 6: Commit**

```bash
git add src/data/product-groups.json src/lib/productGroups.ts src/lib/productGroups.test.ts
git commit -m "feat(grouping): add ProductGroups type and getProductGroupName lookup"
```

---

### Task 2: Reshape `groupProductsByTarifart`, add `deriveVariantLabel`

**Files:**
- Modify: `src/lib/lookup.ts:124-146` (replace `TarifartGroup` + `groupProductsByTarifart`)
- Modify: `src/lib/lookup.test.ts:2-11` (import list), `src/lib/lookup.test.ts:173-205` (`groupProductsByTarifart` describe block)

**Interfaces:**
- Consumes: `getProductGroupName(groups: ProductGroups, insurerCode: string, tarifCode: string): string | undefined` (Task 1)
- Produces: `export type ProductGroup = { groupName: string; tarifart: Tarifart; variants: PremiumRow[] }`
- Produces: `export type TarifartGroup = { tarifart: Tarifart; groups: ProductGroup[] }` (shape change — was `{ tarifart: Tarifart; products: PremiumRow[] }`)
- Produces: `export function groupProductsByTarifart(products: PremiumRow[], productGroups: ProductGroups): TarifartGroup[]` (signature change — new required 2nd param)
- Produces: `export function deriveVariantLabel(groupName: string, productName: string): string`

- [ ] **Step 1: Write the failing tests**

In `src/lib/lookup.test.ts`, change the import at the top of the file from:

```ts
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
```

to:

```ts
import {
  filterPlans,
  cheapestPerInsurer,
  sortPlans,
  computeHeadline,
  standardPremiumsByInsurer,
  discountVsStandardPct,
  groupByInsurer,
  groupProductsByTarifart,
  deriveVariantLabel,
} from "@/lib/lookup";
```

Then replace the entire `describe("groupProductsByTarifart", ...)` block (currently the last
block in the file) with:

```ts
describe("groupProductsByTarifart", () => {
  const products: PremiumRow[] = [
    { ...ROWS[0], tarifart: "hmo", tarifCode: "HMO-B", productName: "Bonus Care", monthlyPremium: 233.6 },
    { ...ROWS[0], tarifart: "standard", tarifCode: "STD", productName: "Grundversicherung", monthlyPremium: 270.5 },
    { ...ROWS[0], tarifart: "telmed", tarifCode: "TEL-A", productName: "Callmed", monthlyPremium: 221.8 },
    { ...ROWS[0], tarifart: "telmed", tarifCode: "TEL-B", productName: "Sana24", monthlyPremium: 229.4 },
    { ...ROWS[0], tarifart: "hausarzt", tarifCode: "HAM", productName: "Casamed", monthlyPremium: 238.9 },
  ];

  it("groups by tarifart in Standard → Hausarzt → Telmed → HMO → Andere order", () => {
    const result = groupProductsByTarifart(products, {});
    expect(result.map((g) => g.tarifart)).toEqual(["standard", "hausarzt", "telmed", "hmo"]);
  });

  it("sorts each tarifart's groups by price ascending when ungrouped (one variant each)", () => {
    const result = groupProductsByTarifart(products, {});
    const telmedGroup = result.find((g) => g.tarifart === "telmed")!;
    expect(telmedGroup.groups.map((g) => g.groupName)).toEqual(["Callmed", "Sana24"]);
    expect(telmedGroup.groups.every((g) => g.variants.length === 1)).toBe(true);
  });

  it("breaks price ties alphabetically by productName (de-CH)", () => {
    const tiedProducts: PremiumRow[] = [
      { ...ROWS[0], tarifart: "hmo", tarifCode: "HMO-Z", productName: "Zeta HMO", monthlyPremium: 200 },
      { ...ROWS[0], tarifart: "hmo", tarifCode: "HMO-A", productName: "Alpha HMO", monthlyPremium: 200 },
    ];
    const result = groupProductsByTarifart(tiedProducts, {});
    expect(result[0].groups.map((g) => g.groupName)).toEqual(["Alpha HMO", "Zeta HMO"]);
  });

  it("returns an empty array for empty input", () => {
    expect(groupProductsByTarifart([], {})).toEqual([]);
  });

  it("nests tarifCodes sharing a product-groups.json entry into one group's variants", () => {
    const variants: PremiumRow[] = [
      { ...ROWS[0], insurerCode: "1562", tarifart: "hausarzt", tarifCode: "BFP_CP", productName: "BeneFit PLUS Hausarzt R1", monthlyPremium: 400.15 },
      { ...ROWS[0], insurerCode: "1562", tarifart: "hausarzt", tarifCode: "BFP_BF", productName: "BeneFit PLUS Hausarzt R4", monthlyPremium: 451.65 },
    ];
    const productGroups = {
      "1562": { BFP_CP: "BeneFit PLUS Hausarzt", BFP_BF: "BeneFit PLUS Hausarzt" },
    };
    const result = groupProductsByTarifart(variants, productGroups);
    const hausarzt = result.find((g) => g.tarifart === "hausarzt")!;
    expect(hausarzt.groups).toHaveLength(1);
    expect(hausarzt.groups[0].groupName).toBe("BeneFit PLUS Hausarzt");
    expect(hausarzt.groups[0].variants.map((v) => v.tarifCode)).toEqual(["BFP_CP", "BFP_BF"]); // price ascending
  });

  it("orders groups by their own cheapest variant", () => {
    const variants: PremiumRow[] = [
      { ...ROWS[0], insurerCode: "1562", tarifart: "hausarzt", tarifCode: "BFP_CAF", productName: "BeneFit PLUS Flexmed R3", monthlyPremium: 432.35 },
      { ...ROWS[0], insurerCode: "1562", tarifart: "hausarzt", tarifCode: "BFP_CP", productName: "BeneFit PLUS Hausarzt R1", monthlyPremium: 400.15 },
      { ...ROWS[0], insurerCode: "1562", tarifart: "hausarzt", tarifCode: "BFP_BF", productName: "BeneFit PLUS Hausarzt R4", monthlyPremium: 451.65 },
    ];
    const productGroups = {
      "1562": {
        BFP_CP: "BeneFit PLUS Hausarzt",
        BFP_BF: "BeneFit PLUS Hausarzt",
        BFP_CAF: "BeneFit PLUS Flexmed",
      },
    };
    const result = groupProductsByTarifart(variants, productGroups);
    const hausarzt = result.find((g) => g.tarifart === "hausarzt")!;
    // Hausarzt's cheapest variant (400.15) undercuts Flexmed's only variant (432.35).
    expect(hausarzt.groups.map((g) => g.groupName)).toEqual(["BeneFit PLUS Hausarzt", "BeneFit PLUS Flexmed"]);
  });
});

describe("deriveVariantLabel", () => {
  it("strips the group name prefix and trims the remainder", () => {
    expect(deriveVariantLabel("BeneFit PLUS Hausarzt", "BeneFit PLUS Hausarzt R1")).toBe("R1");
  });

  it("returns an empty string for a singleton group (productName === groupName)", () => {
    expect(deriveVariantLabel("Grundversicherung", "Grundversicherung")).toBe("");
  });

  it("falls back to the full productName when it doesn't start with the group name", () => {
    expect(deriveVariantLabel("BeneFit PLUS Hausarzt", "Completely Different Name")).toBe(
      "Completely Different Name",
    );
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/lookup.test.ts`
Expected: FAIL — `groupProductsByTarifart(products, {})` type/argument mismatch (current signature
takes one argument), `result[0].groups` is `undefined` (current shape has `.products`),
`deriveVariantLabel` is not exported.

- [ ] **Step 3: Write the implementation**

In `src/lib/lookup.ts`, add this import alongside the existing type import at the top of the file
(line 3):

```ts
import type { HeadlineState, PremiumRow, SelfReportedPlan, Tarifart } from "./types";
import { getProductGroupName, type ProductGroups } from "./productGroups";
```

Then replace lines 124-146 (`export type TarifartGroup = ...` through the end of
`groupProductsByTarifart`) with:

```ts
export type ProductGroup = {
  groupName: string;
  tarifart: Tarifart;
  variants: PremiumRow[]; // sorted by monthlyPremium asc, tie-break productName (de-CH)
};
export type TarifartGroup = { tarifart: Tarifart; groups: ProductGroup[] };

/** Groups one insurer's products by tarifart (Standard → Hausarzt → Telmed → HMO → Andere),
 *  then within each tarifart by product group — `productGroups[insurerCode]?.[tarifCode]`, or
 *  the product's own `productName` when absent (a group of one) — the provider-product-detail
 *  accordion's row order (docs/superpowers/specs/2026-08-22-provider-product-grouping-design.md).
 *  Variants are sorted by price ascending within each group, ties broken alphabetically by
 *  productName ("de-CH"); groups come out ordered by their own cheapest variant, since that's
 *  the order their first member appears in the already price-sorted tarifart bucket. */
export function groupProductsByTarifart(
  products: PremiumRow[],
  productGroups: ProductGroups,
): TarifartGroup[] {
  const byTarifart = new Map<Tarifart, PremiumRow[]>();
  for (const p of products) {
    if (!byTarifart.has(p.tarifart)) byTarifart.set(p.tarifart, []);
    byTarifart.get(p.tarifart)!.push(p);
  }
  return Array.from(byTarifart.entries())
    .sort(([a], [b]) => TARIFART_PRIORITY[a] - TARIFART_PRIORITY[b])
    .map(([tarifart, tarifartProducts]) => {
      const sorted = [...tarifartProducts].sort((a, b) =>
        a.monthlyPremium !== b.monthlyPremium
          ? a.monthlyPremium - b.monthlyPremium
          : a.productName.localeCompare(b.productName, "de-CH"),
      );
      const byGroupName = new Map<string, PremiumRow[]>();
      for (const p of sorted) {
        const groupName = getProductGroupName(productGroups, p.insurerCode, p.tarifCode) ?? p.productName;
        if (!byGroupName.has(groupName)) byGroupName.set(groupName, []);
        byGroupName.get(groupName)!.push(p);
      }
      const groups: ProductGroup[] = Array.from(byGroupName.entries()).map(([groupName, variants]) => ({
        groupName,
        tarifart,
        variants,
      }));
      return { tarifart, groups };
    });
}

/** The text shown next to a grouped variant's price (e.g. "R1") — the group name stripped as a
 *  literal prefix off that variant's own productName, trimmed. Returns the full productName
 *  unchanged if it doesn't start with groupName (shouldn't happen with correct data, but
 *  hand-edited files can drift — never show a blank/broken label). A singleton group's variant
 *  always has productName === groupName, so this correctly returns "". */
export function deriveVariantLabel(groupName: string, productName: string): string {
  if (!productName.startsWith(groupName)) return productName;
  return productName.slice(groupName.length).trim();
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/lookup.test.ts`
Expected: PASS (all tests, including the pre-existing ones in this file)

- [ ] **Step 5: Run the full test suite to check for regressions**

Run: `npm test`
Expected: PASS, no failures. Vitest transpiles TS via esbuild without type-checking, and no test
file imports `ProductList.tsx`, so its now-stale call to `groupProductsByTarifart` (missing the
new required 2nd argument, reading the old `.products` shape) does not surface here — `npx tsc
--noEmit` would flag it, but that's expected until Task 3 fixes it, not something to chase in
this step.

- [ ] **Step 6: Commit**

```bash
git add src/lib/lookup.ts src/lib/lookup.test.ts
git commit -m "feat(grouping): nest groupProductsByTarifart by product group, add deriveVariantLabel"
```

---

### Task 3: Render grouped products in `ProductList`, populate Helsana's real groups

**Files:**
- Modify: `src/components/results/ProductList.tsx` (full rewrite of the file body)
- Modify: `src/data/product-groups.json` (hand-populate the real, already-verified Helsana entries)

**Interfaces:**
- Consumes: `groupProductsByTarifart(products, productGroups)` → `TarifartGroup[]` with
  `.groups: ProductGroup[]` (Task 2); `deriveVariantLabel(groupName, productName)` (Task 2);
  `getProductGroupName`/`ProductGroups` (Task 1, via the `product-groups.json` import)
- No new exports — this is the leaf UI consumer.

This task has no separate failing-test step: there's no component-test infrastructure in this
repo (no `.tsx` test files, no jsdom/`@testing-library/react` — every other UI change here is
verified by running the app, not by an automated component test), so this task is implemented
directly and verified manually against the running app, consistent with how the rest of
`ProductList.tsx` has always been verified.

- [ ] **Step 1: Replace `ProductList.tsx`**

Replace the entire contents of `src/components/results/ProductList.tsx` with:

```tsx
"use client";

import { useLocale, useTranslations } from "next-intl";
import type { PremiumRow } from "@/lib/types";
import { groupProductsByTarifart, discountVsStandardPct, deriveVariantLabel, type ProductGroup } from "@/lib/lookup";
import { MODEL_TAG_CLASSES, DEFAULT_MODEL_TAG_CLASSES } from "@/lib/tarifart-style";
import { formatChf } from "@/lib/format";
import { applyEnvironmentalLevy } from "@/lib/environmentalLevy";
import { getProductDescription, type ProductDescriptions } from "@/lib/productDescriptions";
import type { ProductGroups } from "@/lib/productGroups";
import rawProductDescriptions from "@/data/product-descriptions.json";
import rawProductGroups from "@/data/product-groups.json";

// Cast, not inferred: both JSON files start as `{}` and are edited by hand/by
// scripts/crawl/crawlDescriptions.ts — their structural shape isn't statically known.
const PRODUCT_DESCRIPTIONS = rawProductDescriptions as ProductDescriptions;
const PRODUCT_GROUPS = rawProductGroups as ProductGroups;

type Props = {
  products: PremiumRow[];
  standardPremium: number | undefined;
  shownTarifCode: string;
  // Passed down from PlanRow (which already imports metadata.json) rather than importing
  // metadata.json here too — keeps this leaf component's data dependencies to just its props,
  // same pattern as standardPremium.
  levyPerMonthByYear: Record<string, number>;
};

type RowProps = {
  standardPremium: number | undefined;
  shownTarifCode: string;
  levyPerMonthByYear: Record<string, number>;
};

export function ProductList({ products, standardPremium, shownTarifCode, levyPerMonthByYear }: Props) {
  const t = useTranslations();
  const tarifartGroups = groupProductsByTarifart(products, PRODUCT_GROUPS);

  return (
    <div className="mt-2 ml-8 pl-3 border-l-2 border-outline-variant flex flex-col gap-2.5">
      {tarifartGroups.map((tarifartGroup) => (
        <div key={tarifartGroup.tarifart}>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-outline mb-1">
            {t(`copy.tarifart.${tarifartGroup.tarifart}.label`)}
          </p>
          <div className="flex flex-col gap-1">
            {tarifartGroup.groups.map((group) =>
              group.variants.length === 1 ? (
                <SingleProductRow
                  key={group.variants[0].tarifCode}
                  product={group.variants[0]}
                  standardPremium={standardPremium}
                  shownTarifCode={shownTarifCode}
                  levyPerMonthByYear={levyPerMonthByYear}
                />
              ) : (
                <GroupedProductRow
                  key={`${group.tarifart}:${group.groupName}`}
                  group={group}
                  standardPremium={standardPremium}
                  shownTarifCode={shownTarifCode}
                  levyPerMonthByYear={levyPerMonthByYear}
                />
              ),
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// Unchanged from before this feature — a group of one renders as a single flat row, tag+name+
// discount+price on one line, description below. Used for every insurer with no
// product-groups.json entries (the common case today).
function SingleProductRow({ product, standardPremium, shownTarifCode, levyPerMonthByYear }: RowProps & { product: PremiumRow }) {
  const t = useTranslations();
  const locale = useLocale();
  const discountPct =
    product.tarifart === "standard" ? null : discountVsStandardPct(standardPremium, product.monthlyPremium);
  const isShown = product.tarifCode === shownTarifCode;
  return (
    <div className={`rounded-md px-1.5 py-1 border-l-[3px] ${isShown ? "border-primary" : "border-transparent"}`}>
      <div className="flex items-center gap-2">
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
        {discountPct != null && discountPct > 0 && (
          <span className="inline-block px-1.5 py-px rounded text-[11px] font-bold bg-primary-container text-on-primary-container whitespace-nowrap">
            {t("results.discountBadgeExact", { pct: discountPct.toFixed(1) })}
          </span>
        )}
        <span className="text-[13px] font-semibold w-20 text-right flex-shrink-0">
          {formatChf(applyEnvironmentalLevy(product.monthlyPremium, product.year, levyPerMonthByYear))}
        </span>
      </div>
      <p className="text-[11px] text-on-surface-variant mt-0.5">
        {getProductDescription(PRODUCT_DESCRIPTIONS, product.insurerCode, product.tarifCode, locale) ??
          t(`copy.tarifart.${product.tarifart}.description`)}
      </p>
    </div>
  );
}

// New shape for a group with 2+ price tiers: one name + one description, then each tier as an
// indented VariantRow underneath (design: provider-product-grouping).
function GroupedProductRow({ group, standardPremium, shownTarifCode, levyPerMonthByYear }: RowProps & { group: ProductGroup }) {
  const t = useTranslations();
  const locale = useLocale();
  const description =
    group.variants
      .map((v) => getProductDescription(PRODUCT_DESCRIPTIONS, v.insurerCode, v.tarifCode, locale))
      .find((d): d is string => d != null) ?? t(`copy.tarifart.${group.tarifart}.description`);

  return (
    <div className="rounded-md px-1.5 py-1">
      <div className="flex items-center gap-2">
        <span
          className={`inline-block px-1.5 py-px rounded text-[11px] font-semibold ${
            MODEL_TAG_CLASSES[group.tarifart] ?? DEFAULT_MODEL_TAG_CLASSES
          }`}
        >
          {t(`copy.tarifart.${group.tarifart}.label`)}
        </span>
        <span className="flex-1 min-w-0 text-[13px] truncate">{group.groupName}</span>
      </div>
      <p className="text-[11px] text-on-surface-variant mt-0.5">{description}</p>
      <div className="mt-1 ml-2 pl-2 border-l-2 border-outline-variant flex flex-col gap-0.5">
        {group.variants.map((variant) => (
          <VariantRow
            key={variant.tarifCode}
            variant={variant}
            label={deriveVariantLabel(group.groupName, variant.productName)}
            standardPremium={standardPremium}
            isShown={variant.tarifCode === shownTarifCode}
            levyPerMonthByYear={levyPerMonthByYear}
          />
        ))}
      </div>
    </div>
  );
}

function VariantRow({
  variant,
  label,
  standardPremium,
  isShown,
  levyPerMonthByYear,
}: {
  variant: PremiumRow;
  label: string;
  standardPremium: number | undefined;
  isShown: boolean;
  levyPerMonthByYear: Record<string, number>;
}) {
  const t = useTranslations();
  const discountPct =
    variant.tarifart === "standard" ? null : discountVsStandardPct(standardPremium, variant.monthlyPremium);
  return (
    <div className={`flex items-center gap-2 rounded-md px-1.5 py-0.5 border-l-[3px] ${isShown ? "border-primary" : "border-transparent"}`}>
      <span className="flex-1 min-w-0 text-[12px] text-on-surface-variant truncate">
        {label}
        {isShown && (
          <span className="ml-1.5 inline-block px-1.5 py-px rounded text-[10px] font-semibold border border-primary text-primary bg-surface whitespace-nowrap">
            {t("results.shownAboveTag")}
          </span>
        )}
      </span>
      {discountPct != null && discountPct > 0 && (
        <span className="inline-block px-1.5 py-px rounded text-[11px] font-bold bg-primary-container text-on-primary-container whitespace-nowrap">
          {t("results.discountBadgeExact", { pct: discountPct.toFixed(1) })}
        </span>
      )}
      <span className="text-[13px] font-semibold w-20 text-right flex-shrink-0">
        {formatChf(applyEnvironmentalLevy(variant.monthlyPremium, variant.year, levyPerMonthByYear))}
      </span>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Run the full test suite**

Run: `npm test`
Expected: PASS (all tests, including Task 1/2's new ones — this task added no new `.test.ts`
file, so the count doesn't change here).

- [ ] **Step 4: Hand-populate Helsana's real, already-verified groups**

Replace the contents of `src/data/product-groups.json` (still `{}` from Task 1) with:

```json
{
  "1562": {
    "BFP_BF": "BeneFit PLUS Hausarzt",
    "BFP_CA": "BeneFit PLUS Hausarzt",
    "BFP_CM": "BeneFit PLUS Hausarzt",
    "BFP_CP": "BeneFit PLUS Hausarzt",
    "BFP_CAF": "BeneFit PLUS Flexmed",
    "BFP_CPF": "BeneFit PLUS Flexmed"
  }
}
```

(These six tarifCode → groupName mappings were confirmed against the live BAG premium data and
Helsana's own site during design — `docs/superpowers/specs/2026-08-22-provider-product-grouping-design.md`.)

- [ ] **Step 5: Manually verify against the running app**

Run: `npm run dev`, open the app, enter a PLZ that resolves to a region Helsana sells in, and
expand Helsana's row in the results list.
Expected: under "Hausarzt", one entry named "BeneFit PLUS Hausarzt" with 4 indented price
sub-rows (R1–R4); under "Flexmed" (or wherever Flexmed's tarifart buckets it), one entry named
"BeneFit PLUS Flexmed" with 2 sub-rows. Every other insurer's rows look exactly as they did
before this change.

- [ ] **Step 6: Commit**

```bash
git add src/components/results/ProductList.tsx src/data/product-groups.json
git commit -m "feat(grouping): render grouped product variants in ProductList; add Helsana's groups"
```

---

### Task 4: `deriveProductGroups` + `mergeProductGroups` — pure crawler-grouping helpers

**Files:**
- Create: `scripts/crawl/deriveProductGroups.ts`
- Test: `scripts/crawl/deriveProductGroups.test.ts`

**Interfaces:**
- Consumes: `ProductGroups` type (Task 1, `src/lib/productGroups.ts`)
- Produces: `export type MatchedProduct = { tarifCode: string; productName: string; pageUrl: string }`
- Produces: `export function deriveProductGroups(matches: MatchedProduct[]): Record<string, string>` (tarifCode → groupName, only for tarifCodes worth grouping)
- Produces: `export function mergeProductGroups(existing: ProductGroups, insurerCode: string, derived: Record<string, string>): ProductGroups` (hand-entered tarifCodes always win; returns a new object, doesn't mutate `existing`)

- [ ] **Step 1: Write the failing tests**

Create `scripts/crawl/deriveProductGroups.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { deriveProductGroups, mergeProductGroups, type MatchedProduct } from "./deriveProductGroups";
import type { ProductGroups } from "../../src/lib/productGroups";

describe("deriveProductGroups", () => {
  it("groups tarifCodes that matched the same page, naming the group by shared leading words", () => {
    const matches: MatchedProduct[] = [
      { tarifCode: "BFP_CP", productName: "BeneFit PLUS Hausarzt R1", pageUrl: "https://x.ch/hausarzt.html" },
      { tarifCode: "BFP_CM", productName: "BeneFit PLUS Hausarzt R2", pageUrl: "https://x.ch/hausarzt.html" },
      { tarifCode: "BFP_CA", productName: "BeneFit PLUS Hausarzt R3", pageUrl: "https://x.ch/hausarzt.html" },
      { tarifCode: "BFP_BF", productName: "BeneFit PLUS Hausarzt R4", pageUrl: "https://x.ch/hausarzt.html" },
    ];
    expect(deriveProductGroups(matches)).toEqual({
      BFP_CP: "BeneFit PLUS Hausarzt",
      BFP_CM: "BeneFit PLUS Hausarzt",
      BFP_CA: "BeneFit PLUS Hausarzt",
      BFP_BF: "BeneFit PLUS Hausarzt",
    });
  });

  it("does not group a tarifCode that matched a page alone", () => {
    const matches: MatchedProduct[] = [
      { tarifCode: "BASE", productName: "Grundversicherung", pageUrl: "https://x.ch/std.html" },
    ];
    expect(deriveProductGroups(matches)).toEqual({});
  });

  it("does not group tarifCodes on the same page with no shared leading word", () => {
    const matches: MatchedProduct[] = [
      { tarifCode: "A", productName: "Alpha Plan", pageUrl: "https://x.ch/shared.html" },
      { tarifCode: "B", productName: "Beta Plan", pageUrl: "https://x.ch/shared.html" },
    ];
    expect(deriveProductGroups(matches)).toEqual({});
  });

  it("keeps unrelated pages' groups independent", () => {
    const matches: MatchedProduct[] = [
      { tarifCode: "H1", productName: "Hausarztmodell 1", pageUrl: "https://x.ch/haus.html" },
      { tarifCode: "H2", productName: "Hausarztmodell 2", pageUrl: "https://x.ch/haus.html" },
      { tarifCode: "T1", productName: "Telmed Callmed", pageUrl: "https://x.ch/telmed.html" },
      { tarifCode: "T2", productName: "Telmed Sana24", pageUrl: "https://x.ch/telmed.html" },
    ];
    expect(deriveProductGroups(matches)).toEqual({
      H1: "Hausarztmodell",
      H2: "Hausarztmodell",
      T1: "Telmed",
      T2: "Telmed",
    });
  });

  it("cuts at word boundaries, not mid-token", () => {
    // "...Hausarzt R" is NOT the correct group name — the shared token is "Hausarzt", not "R".
    const matches: MatchedProduct[] = [
      { tarifCode: "R1", productName: "Modell Hausarzt R1", pageUrl: "https://x.ch/p.html" },
      { tarifCode: "R2", productName: "Modell Hausarzt R2", pageUrl: "https://x.ch/p.html" },
    ];
    expect(deriveProductGroups(matches)).toEqual({
      R1: "Modell Hausarzt",
      R2: "Modell Hausarzt",
    });
  });

  it("returns an empty object for empty input", () => {
    expect(deriveProductGroups([])).toEqual({});
  });
});

describe("mergeProductGroups", () => {
  it("adds derived groups for tarifCodes with no existing entry", () => {
    const result = mergeProductGroups({}, "1562", { BFP_BF: "BeneFit PLUS Hausarzt" });
    expect(result).toEqual({ "1562": { BFP_BF: "BeneFit PLUS Hausarzt" } });
  });

  it("never overwrites an existing hand-entered groupName", () => {
    const existing: ProductGroups = { "1562": { BFP_BF: "Hand-Corrected Name" } };
    const result = mergeProductGroups(existing, "1562", { BFP_BF: "Auto-Derived Name" });
    expect(result).toEqual({ "1562": { BFP_BF: "Hand-Corrected Name" } });
  });

  it("preserves other insurers untouched", () => {
    const existing: ProductGroups = { "9999": { X: "Y" } };
    const result = mergeProductGroups(existing, "1562", { BFP_BF: "BeneFit PLUS Hausarzt" });
    expect(result).toEqual({ "9999": { X: "Y" }, "1562": { BFP_BF: "BeneFit PLUS Hausarzt" } });
  });

  it("returns existing unchanged when there's nothing to merge", () => {
    const existing: ProductGroups = { "9999": { X: "Y" } };
    expect(mergeProductGroups(existing, "1562", {})).toEqual(existing);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run scripts/crawl/deriveProductGroups.test.ts`
Expected: FAIL — `Cannot find module './deriveProductGroups'`

- [ ] **Step 3: Write the implementation**

Create `scripts/crawl/deriveProductGroups.ts`:

```ts
// Derives product-groups.json entries from a crawl run's matched pages — multiple tarifCodes
// landing on the same page is itself the grouping signal (docs/superpowers/specs/2026-08-22-
// provider-product-grouping-design.md), not a separate name-similarity heuristic.

import type { ProductGroups } from "../../src/lib/productGroups";

export type MatchedProduct = { tarifCode: string; productName: string; pageUrl: string };

/** Groups matched products by shared pageUrl, deriving each group's name as the longest common
 *  prefix of their productNames at the word level (not character level, so "...Hausarzt R1" /
 *  "...Hausarzt R2" yields "...Hausarzt" rather than cutting mid-token at "...Hausarzt R").
 *  Returns only tarifCodes worth grouping: a tarifCode that matched a page alone, or a same-page
 *  cluster with no shared leading word, is omitted entirely — never written with a guess. */
export function deriveProductGroups(matches: MatchedProduct[]): Record<string, string> {
  const byPage = new Map<string, MatchedProduct[]>();
  for (const m of matches) {
    if (!byPage.has(m.pageUrl)) byPage.set(m.pageUrl, []);
    byPage.get(m.pageUrl)!.push(m);
  }

  const result: Record<string, string> = {};
  for (const pageMatches of byPage.values()) {
    if (pageMatches.length < 2) continue;
    const groupName = commonLeadingWords(pageMatches.map((m) => m.productName));
    if (!groupName) continue;
    for (const m of pageMatches) result[m.tarifCode] = groupName;
  }
  return result;
}

function commonLeadingWords(names: string[]): string {
  const wordLists = names.map((n) => n.trim().split(/\s+/));
  const shortestLength = Math.min(...wordLists.map((w) => w.length));
  const common: string[] = [];
  for (let i = 0; i < shortestLength; i++) {
    const word = wordLists[0][i];
    if (!wordLists.every((w) => w[i] === word)) break;
    common.push(word);
  }
  return common.join(" ");
}

/** Merges freshly-derived groups for one insurer into the existing productGroups map,
 *  preserving any hand-entered tarifCode already present — never overwritten by a
 *  crawler-derived guess. Mirrors buildInsurerSources's `existing[insurerCode]?.seedUrl ??
 *  null` merge (insurerSources.ts). Returns a new ProductGroups object; does not mutate
 *  `existing`. */
export function mergeProductGroups(
  existing: ProductGroups,
  insurerCode: string,
  derived: Record<string, string>,
): ProductGroups {
  const existingForInsurer = existing[insurerCode] ?? {};
  const merged = { ...existingForInsurer };
  for (const [tarifCode, groupName] of Object.entries(derived)) {
    if (!(tarifCode in merged)) merged[tarifCode] = groupName;
  }
  if (Object.keys(merged).length === 0) return existing;
  return { ...existing, [insurerCode]: merged };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run scripts/crawl/deriveProductGroups.test.ts`
Expected: PASS (10 tests)

- [ ] **Step 5: Commit**

```bash
git add scripts/crawl/deriveProductGroups.ts scripts/crawl/deriveProductGroups.test.ts
git commit -m "feat(crawl): add deriveProductGroups/mergeProductGroups (same-page grouping, hand-edit-wins merge)"
```

---

### Task 5: Wire `deriveProductGroups` into `crawlDescriptions.ts`

**Files:**
- Modify: `scripts/crawl/crawlDescriptions.ts`

**Interfaces:**
- Consumes: `deriveProductGroups(matches: MatchedProduct[]): Record<string, string>` and
  `mergeProductGroups(existing: ProductGroups, insurerCode: string, derived: Record<string, string>): ProductGroups`
  (Task 4); `ProductGroups` type (Task 1)
- No new exports — this is the CLI orchestrator, already covered by Task 4's unit tests for the
  logic it now calls. (`crawlDescriptions.ts` itself has no existing test file — it's the
  network/LLM-driven orchestrator, same category as `downloadRaw.ts`; see the original
  product-descriptions plan's Testing section for this project's existing convention on that.)

- [ ] **Step 1: Add the `product-groups.json` path constant and load/write it**

In `scripts/crawl/crawlDescriptions.ts`, add this import alongside the existing ones near the top
of the file:

```ts
import { deriveProductGroups, mergeProductGroups, type MatchedProduct } from "./deriveProductGroups";
import type { ProductGroups } from "../../src/lib/productGroups";
```

Add a new path constant next to `PRODUCT_DESCRIPTIONS_PATH`:

```ts
const PRODUCT_GROUPS_PATH = join(DATA_DIR, "product-groups.json");
```

In `main()`, alongside the existing `const descriptions = await readJson<ProductDescriptions>(...)`
line, add — `let`, not `const`, since `mergeProductGroups` returns a new object each call rather
than mutating in place:

```ts
let productGroups = await readJson<ProductGroups>(PRODUCT_GROUPS_PATH, {});
```

- [ ] **Step 2: Collect matched products per insurer and merge groups after each insurer**

Inside the `for (const insurerCode of insurerCodes)` loop, declare a new `matchedProducts`
array once per insurer, right after the existing
`console.log(\`Crawling ${source.insurerName}...\`)` line (the existing `let matched = 0; let
noPageMatch = 0; let extractionFailed = 0;` counters stay exactly where they are, outside this
loop — they accumulate across all insurers; this is a separate, new, per-insurer array):

```ts
const matchedProducts: MatchedProduct[] = [];
```

Inside the `for (const product of insurerProducts)` inner loop, right after the existing
`if (!page) { ...; continue; }` block (so only products that *did* match a page reach this line),
add:

```ts
matchedProducts.push({ tarifCode: product.tarifCode, productName: product.productName, pageUrl: page.url });
```

Then, immediately before the existing
`// Persist after each insurer so one later failure doesn't lose earlier progress.` comment and its
`await writeFile(PRODUCT_DESCRIPTIONS_PATH, ...)` call, add the group-merging step and its own
persist:

```ts
// Hand-entered groups always win — mergeProductGroups only fills in a tarifCode with no
// existing entry.
productGroups = mergeProductGroups(productGroups, insurerCode, deriveProductGroups(matchedProducts));
await writeFile(PRODUCT_GROUPS_PATH, JSON.stringify(productGroups, null, 2) + "\n");
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Run the full test suite**

Run: `npm test`
Expected: PASS (no test file covers `crawlDescriptions.ts`'s orchestration directly — this step
confirms the change didn't break anything it imports).

- [ ] **Step 5: Manually verify against a real insurer**

Run: `npm run crawl-descriptions -- --insurer 1509` (Sanitas — its `Hausarztmodell 1`–`4` example
is expected to actually auto-group, unlike Helsana's, since Sanitas's naming is more likely to be
echoed on its own product pages; confirm by checking the printed match log). Requires
`ANTHROPIC_API_KEY` set (see README.md) and Sanitas's `seedUrl` filled in in
`src/data/insurer-sources.json` — fill it in by hand first if it's still `null`.
Expected: `src/data/product-groups.json` gains a `"1509"` entry if 2+ Hausarztmodell tarifCodes
matched the same page; if Sanitas's page titles don't happen to include "Hausarztmodell 1"
literally (per `matchProductPage`'s exact-substring rule), some or all of those tarifCodes may
still report "no page match" — that's expected, not a bug in this task; note the outcome so it's
clear whether Sanitas needs the same manual-edit fallback Helsana does.

- [ ] **Step 6: Commit**

```bash
git add scripts/crawl/crawlDescriptions.ts
git commit -m "feat(crawl): auto-populate product-groups.json from same-page tarifCode matches"
```

(If Step 5 also produced real `product-groups.json`/`product-descriptions.json` content worth
keeping, commit those data files separately with a message describing what was crawled, same
pattern as the earlier Helsana descriptions PR — don't fold hand-reviewed crawl output into the
same commit as a code change.)
