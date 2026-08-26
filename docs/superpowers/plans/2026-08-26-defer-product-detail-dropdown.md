# Defer Product Detail Dropdown Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `main` shows exactly one collapsed price row per provider (no expand affordance, no per-product dropdown) by default, while the full provider-product-detail feature (accordion + `ProductList` + grouping) stays in `main`'s codebase, gated off behind a single compile-time flag, ready to flip back on when the feature resumes.

**Architecture:** A single boolean constant, `PRODUCT_DETAIL_DROPDOWN_ENABLED`, lives in a new `src/lib/featureFlags.ts`. `InsuranceComparator.tsx` only does the (otherwise wasted) per-insurer product grouping work when the flag is on; `PlanRow.tsx` renders either a plain single-price row (flag off) or the existing `<details>/<summary>` accordion + `ProductList` body (flag on) — both branches share the same summary markup, extracted once, so there's no duplicated JSX to keep in sync. This supersedes the earlier branch-based plan (preservation branch + revert branch): with a flag, the feature's code stays live in `main`, evolves alongside everything else, and never needs a rebase-and-reconcile when resumed.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS, next-intl, Vitest.

## Global Constraints

- This work happens on the current branch (`worktree-flag-product-detail-dropdown`, already checked out in an isolated worktree, branched fresh from `origin/main`) — no task creates or switches branches.
- The flag is a plain exported `const`, not an env var or runtime toggle — flipping it requires a code change + redeploy, by design.
- `src/lib/lookup.ts`'s grouping functions (`groupByInsurer`, `groupProductsByTarifart`, `ProductGroup`, `deriveVariantLabel`), `ALL_TARIFARTS`, `ProductList.tsx`, and the product-descriptions/product-groups data + crawler are **not touched** — they keep working exactly as today; only *whether they run/render* changes.
- This repo has zero `*.test.tsx` files and no `@testing-library/react` dependency — component changes are verified via typecheck/build/lint plus a manual dev-server check in both flag states, not new component tests.
- Do not remove or rename any prop on `PlanList.tsx` — it keeps passing `productsByInsurer` and `products` exactly as it does today; the flag lives inside `InsuranceComparator.tsx` (what gets computed) and `PlanRow.tsx` (what gets rendered), so `PlanList` needs no changes at all.
- All four locale files stay untouched — no translation keys are added, removed, or become newly orphaned by this plan.

---

## Task 1: Add the feature flag

**Files:**
- Create: `src/lib/featureFlags.ts`

**Interfaces:**
- Produces: `export const PRODUCT_DETAIL_DROPDOWN_ENABLED: boolean`

- [ ] **Step 1: Create the flag file**

```ts
// src/lib/featureFlags.ts
//
// Compile-time feature flags for functionality that's implemented but
// intentionally not shown yet. Flip the value and redeploy to resume —
// see docs/superpowers/plans/2026-08-26-defer-product-detail-dropdown.md.

// Per-provider accordion (PlanRow) showing every product/tarifart tier
// (ProductList) instead of just the one cheapest price. Implemented in
// full; paused so the results list ships with one price per provider
// while the grouping/description work (src/lib/productGroups.ts,
// src/lib/productDescriptions.ts) keeps maturing.
export const PRODUCT_DETAIL_DROPDOWN_ENABLED = false;
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/featureFlags.ts
git commit -m "feat(flags): add PRODUCT_DETAIL_DROPDOWN_ENABLED, default off"
```

---

## Task 2: Gate the per-insurer product computation in `InsuranceComparator`

**Files:**
- Modify: `src/components/InsuranceComparator.tsx`

**Interfaces:**
- Consumes: `PRODUCT_DETAIL_DROPDOWN_ENABLED` (Task 1).
- Produces: no change to `InsuranceComparator`'s output shape — `results.productsByInsurer` is still always a `Map<string, PremiumRow[]>`, just empty when the flag is off.

- [ ] **Step 1: Import the flag**

```diff
 import { encodeState, decodeState } from "@/lib/url-state";
 import { validateCurrentPremium } from "@/lib/validate";
 import { buildInquiryLogPayload } from "@/lib/inquiryLog";
+import { PRODUCT_DETAIL_DROPDOWN_ENABLED } from "@/lib/featureFlags";
 import type { CurrentPlan, Insurer, SelfReportedPlan } from "@/lib/types";
```

- [ ] **Step 2: Only do the grouping work when the flag is on**

```diff
-    // Every one of each insurer's products at this context, independent of altModelsActive
-    // — the provider-product-detail accordion always shows all model types, even when the
-    // main list is currently filtered to Standard-only (design spec: "Data & filtering").
-    const allProducts = filterPlans(ALL_PREMIUMS, {
-      praemienregionId,
-      altersklasse,
-      franchise,
-      models: ALL_TARIFARTS,
-      unfalldeckung,
-      year,
-    });
-    const productsByInsurer = groupByInsurer(allProducts);
+    // Every one of each insurer's products at this context, independent of altModelsActive
+    // — the provider-product-detail accordion always shows all model types, even when the
+    // main list is currently filtered to Standard-only (design spec: "Data & filtering").
+    // Skipped entirely while PRODUCT_DETAIL_DROPDOWN_ENABLED is off: PlanRow doesn't render
+    // ProductList in that state, so this Map would just be discarded unread.
+    const productsByInsurer = PRODUCT_DETAIL_DROPDOWN_ENABLED
+      ? groupByInsurer(
+          filterPlans(ALL_PREMIUMS, {
+            praemienregionId,
+            altersklasse,
+            franchise,
+            models: ALL_TARIFARTS,
+            unfalldeckung,
+            year,
+          }),
+        )
+      : new Map<string, PremiumRow[]>();
```

- [ ] **Step 3: Commit**

```bash
git add src/components/InsuranceComparator.tsx
git commit -m "feat(flags): skip per-insurer product grouping when dropdown flag is off"
```

---

## Task 3: Gate the accordion in `PlanRow`

**Files:**
- Modify: `src/components/results/PlanRow.tsx`

**Interfaces:**
- Consumes: `PRODUCT_DETAIL_DROPDOWN_ENABLED` (Task 1). Props are unchanged from today (`products` stays required, same as `PlanList.tsx` already passes).

- [ ] **Step 1: Import the flag**

```diff
 import { MODEL_TAG_CLASSES, DEFAULT_MODEL_TAG_CLASSES } from "@/lib/tarifart-style";
 import { ProductList } from "./ProductList";
+import { PRODUCT_DETAIL_DROPDOWN_ENABLED } from "@/lib/featureFlags";
```

- [ ] **Step 2: Extract the shared summary content, then branch on the flag**

Everything currently inside `<summary>` except the trailing chevron `<span>` is identical to what a flag-off plain row needs, so pull it into a fragment once and render it both ways:

```diff
   const discountPct =
     plan.tarifart === "standard" ? null : discountVsStandardPct(standardPremium, plan.monthlyPremium);

+  const summary = (
+    <>
+      <div className={`w-5 text-center text-sm font-bold ${rank === 1 ? "text-primary" : "text-outline"}`}>
+        {rank}
+      </div>
+      <div className="flex-1 min-w-0">
+        <div className="flex items-center gap-1.5 min-w-0">
+          <div className="font-semibold text-[15px] truncate min-w-0">{plan.insurerName}</div>
+          {isCurrentPlan && (
+            <span className="text-[11px] font-semibold px-1.5 py-px rounded bg-error-container text-error flex-shrink-0">
+              {t("results.yourInsurerBadge")}
+            </span>
+          )}
+        </div>
+        <div className="text-xs text-on-surface-variant mt-0.5 flex flex-wrap items-center gap-1">
+          <span
+            className={`inline-block px-1.5 py-px rounded text-[11px] font-semibold ${
+              MODEL_TAG_CLASSES[plan.tarifart] ?? DEFAULT_MODEL_TAG_CLASSES
+            }`}
+          >
+            {t(`copy.tarifart.${plan.tarifart}.label`)}
+          </span>
+          {discountPct != null && discountPct > 0 && (
+            <span className="inline-block px-1.5 py-px rounded text-[11px] font-bold bg-primary-container text-on-primary-container whitespace-nowrap">
+              {t("results.discountBadge", { pct: discountPct.toFixed(1) })}
+            </span>
+          )}
+          <span>· {t(`copy.tarifart.${plan.tarifart}.description`)}</span>
+        </div>
+      </div>
+      {memberCount != null && (
+        <div
+          className="hidden sm:flex flex-col items-end gap-0.5 flex-shrink-0"
+          title={formatMemberCountDetail(memberCount, memberCountAsOf, locale)}
+          aria-label={formatMemberCountDetail(memberCount, memberCountAsOf, locale)}
+        >
+          <span className="text-[11px] font-semibold px-1.5 py-px rounded bg-surface-variant text-on-surface-variant whitespace-nowrap">
+            <span aria-hidden="true">👥</span> {formatMemberCount(memberCount, locale)}
+          </span>
+        </div>
+      )}
+      {yoy != null && (
+        <div
+          className={`text-xs font-semibold px-1.5 py-px rounded ${
+            yoy > 0 ? "bg-error-container text-error" : yoy < 0 ? "bg-success-container text-success" : "text-outline font-normal"
+          }`}
+        >
+          {yoy > 0 ? "+" : ""}
+          {yoy.toFixed(1)}%
+        </div>
+      )}
+      <div className="text-right">
+        <div className={`text-headline-small ${isCheapest ? "text-primary" : "text-on-surface"}`}>
+          {formatChf(applyEnvironmentalLevy(plan.monthlyPremium, plan.year, ENVIRONMENTAL_LEVY_PER_MONTH))}
+        </div>
+        <div className="text-body-small text-outline">{t("results.perMonth")}</div>
+      </div>
+    </>
+  );
+
+  if (!PRODUCT_DETAIL_DROPDOWN_ENABLED) {
+    return (
+      <div
+        role="listitem"
+        className={`flex items-center gap-3 rounded-lg border p-3.5 shadow-sm ${
+          isCurrentPlan ? "border-error bg-error-container" : "border-outline-variant bg-surface"
+        }`}
+      >
+        {summary}
+      </div>
+    );
+  }
+
   return (
     <details
       role="listitem"
       className={`rounded-lg border shadow-sm ${
         isCurrentPlan ? "border-error bg-error-container" : "border-outline-variant bg-surface"
       }`}
     >
       <summary className="flex items-center gap-3 p-3.5 cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden">
-        <div className={`w-5 text-center text-sm font-bold ${rank === 1 ? "text-primary" : "text-outline"}`}>
-          {rank}
-        </div>
-        <div className="flex-1 min-w-0">
-          <div className="flex items-center gap-1.5 min-w-0">
-            <div className="font-semibold text-[15px] truncate min-w-0">{plan.insurerName}</div>
-            {isCurrentPlan && (
-              <span className="text-[11px] font-semibold px-1.5 py-px rounded bg-error-container text-error flex-shrink-0">
-                {t("results.yourInsurerBadge")}
-              </span>
-            )}
-          </div>
-          <div className="text-xs text-on-surface-variant mt-0.5 flex flex-wrap items-center gap-1">
-            <span
-              className={`inline-block px-1.5 py-px rounded text-[11px] font-semibold ${
-                MODEL_TAG_CLASSES[plan.tarifart] ?? DEFAULT_MODEL_TAG_CLASSES
-              }`}
-            >
-              {t(`copy.tarifart.${plan.tarifart}.label`)}
-            </span>
-            {discountPct != null && discountPct > 0 && (
-              <span className="inline-block px-1.5 py-px rounded text-[11px] font-bold bg-primary-container text-on-primary-container whitespace-nowrap">
-                {t("results.discountBadge", { pct: discountPct.toFixed(1) })}
-              </span>
-            )}
-            <span>· {t(`copy.tarifart.${plan.tarifart}.description`)}</span>
-          </div>
-        </div>
-        {memberCount != null && (
-          <div
-            className="hidden sm:flex flex-col items-end gap-0.5 flex-shrink-0"
-            title={formatMemberCountDetail(memberCount, memberCountAsOf, locale)}
-            aria-label={formatMemberCountDetail(memberCount, memberCountAsOf, locale)}
-          >
-            <span className="text-[11px] font-semibold px-1.5 py-px rounded bg-surface-variant text-on-surface-variant whitespace-nowrap">
-              <span aria-hidden="true">👥</span> {formatMemberCount(memberCount, locale)}
-            </span>
-          </div>
-        )}
-        {yoy != null && (
-          <div
-            className={`text-xs font-semibold px-1.5 py-px rounded ${
-              yoy > 0 ? "bg-error-container text-error" : yoy < 0 ? "bg-success-container text-success" : "text-outline font-normal"
-            }`}
-          >
-            {yoy > 0 ? "+" : ""}
-            {yoy.toFixed(1)}%
-          </div>
-        )}
-        <div className="text-right">
-          <div className={`text-headline-small ${isCheapest ? "text-primary" : "text-on-surface"}`}>
-            {formatChf(applyEnvironmentalLevy(plan.monthlyPremium, plan.year, ENVIRONMENTAL_LEVY_PER_MONTH))}
-          </div>
-          <div className="text-body-small text-outline">{t("results.perMonth")}</div>
-        </div>
+        {summary}
         <span
           aria-hidden="true"
           className="text-outline text-xs w-3 text-center flex-shrink-0 before:content-['▸'] [details[open]_&]:before:content-['▾']"
         />
       </summary>
       <div className="px-3.5 pb-3.5">
         <ProductList
           products={products}
           standardPremium={standardPremium}
           shownTarifCode={plan.tarifCode}
           levyPerMonthByYear={ENVIRONMENTAL_LEVY_PER_MONTH}
         />
       </div>
     </details>
   );
 }
```

- [ ] **Step 3: Commit**

```bash
git add src/components/results/PlanRow.tsx
git commit -m "feat(flags): render single price row when dropdown flag is off"
```

---

## Task 4: Verify both flag states

**Files:** none (verification only).

- [ ] **Step 1: Typecheck / build with the flag off (default)**

```bash
npm run build
```

Expected: succeeds — this is the state that ships.

- [ ] **Step 2: Lint**

```bash
npm run lint
```

Expected: no new errors (in particular, no unused-variable warnings on `products`/`ProductList` — they're still referenced in the flag-on branch, so this should be clean).

- [ ] **Step 3: Unit tests**

```bash
npm test
```

Expected: all pass, unchanged — this plan touches no tested pure functions, only component rendering and one call site's condition.

- [ ] **Step 4: Manual smoke check — flag off**

```bash
npm run dev
```

Run a comparison. Confirm each provider renders as a single flat row with no expand chevron and no click-to-expand behavior.

- [ ] **Step 5: Manual smoke check — flag on**

Temporarily edit `src/lib/featureFlags.ts` to `PRODUCT_DETAIL_DROPDOWN_ENABLED = true`, restart `npm run dev`, and confirm the accordion + `ProductList` dropdown still works exactly as it did before this plan (click a row, see per-tarifart grouped products, "shown above" tag, discount badges). Then revert the file back to `false` before committing anything further — Task 3's commit already has it `false`; this step is a read-only check, not a code change to keep.

- [ ] **Step 6: Confirm the flag is off in the diff about to ship**

```bash
git diff origin/main -- src/lib/featureFlags.ts
```

Expected: shows the new file with `PRODUCT_DETAIL_DROPDOWN_ENABLED = false`.

---

## Task 5: Open the PR into `main`

**Files:** none (git/GitHub only).

- [ ] **Step 1: Push the branch**

```bash
git push -u origin worktree-flag-product-detail-dropdown
```

- [ ] **Step 2: Open the PR**

```bash
gh pr create --base main --head worktree-flag-product-detail-dropdown \
  --title "Gate provider-product-detail dropdown behind a feature flag, default off" \
  --body "Results list ships with one price per provider again. The accordion/ProductList/grouping feature is untouched and still fully implemented — it's now gated behind PRODUCT_DETAIL_DROPDOWN_ENABLED (src/lib/featureFlags.ts), default false. Flip it to true and redeploy to resume. See docs/superpowers/plans/2026-08-26-defer-product-detail-dropdown.md."
```

- [ ] **Step 3: Merge once green**

After merging, `main` ships one price per provider by default. Resuming the feature later is a one-line flip of `PRODUCT_DETAIL_DROPDOWN_ENABLED` back to `true` — no branch to rebase, no re-wiring, no risk of the feature having drifted out of sync with the rest of `main` in the meantime.
