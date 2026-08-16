# Provider Product Detail — Design

**Date:** 2026-08-16
**Status:** Approved

## Problem

The results list (`requirement.md` §5.3) shows one row per insurer: that insurer's single
cheapest matching product for the active filters. This is deliberately compressed — but it
hides real information the BAG data already contains: an insurer's cheapest row might be
one of several products at that price point (e.g. Visana can have 4 distinct Telmed
products and 3 distinct HMO products, each independently priced, under the exact same
region/age/franchise/accident-coverage/year context). A user who wants to understand *why*
an insurer is cheap, or compare its other model options, currently has no way to see that.

**Goal:** clicking a provider row expands it in place to show every one of that insurer's
individual products for the current context, each with its own price and discount vs.
Standard — without leaving the single-page, no-modal, no-navigation model the app already
follows (Core Principle #4).

## Data & filtering

For a given insurer and the current premium-determining context (premium region, age band,
franchise, accident coverage, year), there can be up to ~9 individual BAG products spanning
multiple `tarifart` values. The detail view shows all of them, **independent of the "alternative
models" toggle** in `FilterBar` — expanding a row always reveals every model type, even when
the main list is currently Standard-only. This is the point of the feature: it lets a user
who hasn't toggled alternative models on still discover that, say, Telmed would save them
money for a specific insurer.

- `lib/lookup.ts` gains an exported constant `ALL_TARIFARTS: Tarifart[] = ["standard",
  "hausarzt", "telmed", "hmo", "andere"]`, replacing the `ALT_MODELS` literal currently
  duplicated in `InsuranceComparator.tsx`.
- `lib/lookup.ts` gains a pure helper:
  ```ts
  function groupByInsurer(rows: PremiumRow[]): Map<string, PremiumRow[]>
  ```
  Testable in isolation, same style as the file's other lookup functions.
- In `InsuranceComparator.tsx`'s `results` memo, compute once per render:
  ```ts
  const allProducts = filterPlans(ALL_PREMIUMS, { ...context, models: ALL_TARIFARTS });
  const productsByInsurer = groupByInsurer(allProducts);
  ```
  where `context` is the existing `{ praemienregionId, altersklasse, franchise,
  unfalldeckung, year }` shape (everything `FilterParams` has except `models`). This reuses
  the `standardBaseline` map already computed for the main list's discount badge — no new
  discount-calculation logic is needed, just applying `discountVsStandardPct` per product
  instead of once per insurer.
- `productsByInsurer` is threaded through `PlanList` → `PlanRow` alongside the existing
  `standardBaseline` prop.

## Component structure & interaction

- `PlanRow` changes from a `<div role="listitem">` to a `<details role="listitem">`. Its
  existing row content (rank, insurer name, model badge, discount badge, member count,
  price) moves unchanged into a `<summary>` — the same pattern `CurrentPlanSection.tsx`
  already uses (and `mockups/main.html` documents), so this stays native, keyboard-operable,
  and correctly exposed to assistive tech with no new ARIA wiring.
- A small chevron (▸ closed / ▾ open), styled via the same `::before`-on-`summary`
  convention as `CurrentPlanSection`, is added at the trailing edge of the row (after the
  price) to signal the row is expandable.
- No `<details name="...">` grouping: each row's `<details>` is fully independent, so
  multiple insurers can be expanded at once (e.g. to compare two insurers' product
  line-ups). No React state needed for open/closed — it's native DOM state.
- New component `results/ProductList.tsx` renders the expanded content: the insurer's full
  `products` array (from `productsByInsurer.get(plan.insurerCode) ?? [plan]`), grouped by
  `tarifart` in the existing `TARIFART_PRIORITY` order (standard → hausarzt → telmed → hmo
  → andere, already defined in `lookup.ts`), sorted by price ascending within each group,
  ties broken alphabetically by `productName` (`de-CH` locale — same convention as the main
  list's insurer-name tie-break).
- Each product row shows: model badge + one-line description (`TARIFART_LABELS` /
  `TARIFART_DESCRIPTIONS`), product name, price, and a discount badge (omitted for Standard
  products, same as today). `MODEL_TAG_CLASSES` moves from `PlanRow.tsx`'s module scope
  into `lib/copy.ts` so both `PlanRow`'s summary and `ProductList`'s detail rows share it.
- The product row matching what's already shown in the collapsed summary — matched by
  `tarifCode`, the actual unique key per `types.ts` — gets a small "shown above" marker.
- The accordion always renders, even for an insurer with only one matching product. No
  conditional hiding of the expand affordance; every row behaves consistently.

## Visual & copy details

- The detail rows' discount badge drops the "bis zu" ("up to") qualifier the main list's
  badge uses. That phrasing fit the collapsed row because it represents "the cheapest of
  this model type" — an implicit "up to" across a hidden set. Each detail row is one
  specific product, so its badge reads plainly: `−X.X% ggü. Standard`.
- Expanded content is visually nested — left-indented with a subtler background — so it
  reads as "inside" the collapsed row rather than a new peer in the results list.
- `isCurrentPlan` (the red "Deine Kasse" treatment) stays on the outer summary row only; it
  is not propagated to individual product rows, since the self-reported current plan
  (`SelfReportedPlan`) has no specific `tarifCode` to match against.
- The "shown above" marker is informational only — clicking a detail row does nothing
  (there is no "select this plan" workflow anywhere in the app, per Core Principle #2).
- Accordion open/closed state is plain uncontrolled `<details open>` DOM state — not synced
  to the URL or React state. REQ-11's URL-state contract covers comparison inputs, filters,
  and current-plan fields, not incidental UI state, so this is consistent with the existing
  scope and simply resets on remount (e.g. loading a shared link).
- Defensive fallback: if `productsByInsurer` has no entry for an insurer (shouldn't happen,
  since the summary row itself is drawn from the same filtered context), `ProductList`
  falls back to `[plan]` so the detail never renders empty.

## Testing

- `lookup.test.ts`: unit tests for `groupByInsurer` (groups correctly, preserves every row,
  empty input → empty map) and for `filterPlans` used with `ALL_TARIFARTS`.
- Component tests: a `PlanRow` with multiple products renders one `<details>`; opening it
  reveals all products grouped by tarifart and sorted by price within each group; the
  Standard product carries no discount badge; the product matching the collapsed summary
  carries the "shown above" marker.
- Manual verification: expand an insurer with only a Standard product (single detail row,
  no layout oddity); expand a many-product insurer (Visana-style) and confirm group
  ordering; confirm expanding one insurer doesn't collapse another; confirm toggling
  "alternative models" off in `FilterBar` does not remove alternative-model products from
  an already-expanded detail.
