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
