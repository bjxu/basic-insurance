# Provider Product Grouping — Design

**Date:** 2026-08-22
**Status:** Approved

## Problem

[`ProductList`](../../../src/components/results/ProductList.tsx) shows one row per
`(insurerCode, tarifCode)`, grouped by `tarifart`. Several insurers sell what is really one
underlying product as multiple separately-priced risk/discount tiers under near-identical
names — e.g. Helsana's `BeneFit PLUS Hausarzt R1`–`R4` (tarifCodes `BFP_CP`/`BFP_CM`/`BFP_CA`/
`BFP_BF`) and Sanitas's `Hausarztmodell 1`–`4`. Today each tier renders as a fully separate row,
repeating the identical name-minus-suffix and the identical description (crawled or generic
fallback) once per tier — noisy, and it obscures that these are variants of one plan rather
than four distinct products.

**Goal:** nest same-plan tiers under one shared product entry — tarifart → product name →
product description → premium row(s) — showing the shared name/description once and each
tier's price as a sub-row underneath, while leaving today's behavior completely unchanged for
every insurer that hasn't been reviewed for this yet.

## Data model

New hand-maintained file, alongside `insurer-sources.json` and `product-descriptions.json`:

```json
// src/data/product-groups.json
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

`Record<insurerCode, Record<tarifCode, string>>` — same composite-key shape as
`product-descriptions.json`, since `tarifCode` alone isn't globally unique. Starts as `{}`.

**A tarifCode with no entry is its own singleton group**, named after its own `productName`.
This is the default for every insurer not yet reviewed — nothing needs to be added here for
grouping to be "off"; the file is populated incrementally, insurer by insurer, same workflow as
`product-descriptions.json`. `product-descriptions.json` itself is unchanged — still keyed
directly by `tarifCode`, no migration needed.

## Grouping & lookup logic

`src/lib/lookup.ts`'s `groupProductsByTarifart` gains a nesting level:

```ts
export type ProductGroup = {
  groupName: string;
  tarifart: Tarifart;
  variants: PremiumRow[]; // sorted by monthlyPremium asc, tie-break productName (unchanged sort)
};
export type TarifartGroup = { tarifart: Tarifart; groups: ProductGroup[] };
```

Within each tarifart bucket (unchanged: bucketed and ordered by `TARIFART_PRIORITY` first),
products are bucketed by group name — `productGroups[insurerCode]?.[tarifCode] ?? productName`
— preserving the existing price-ascending order, so groups themselves come out ordered by
their cheapest variant and variants within a group stay price-ascending. `TarifartGroup` and
`ProductGroup` are used only by `lookup.ts`/`lookup.test.ts`/`ProductList.tsx` today, so this
reshape has no other call sites to update.

New helper, `src/lib/productGroups.ts`:

```ts
function getProductGroupName(
  groups: ProductGroups,
  insurerCode: string,
  tarifCode: string,
): string | undefined
```

Mirrors `getProductDescription`'s fallback shape — returns `undefined` (not the raw
`productName`) when absent, so the caller applies the singleton default explicitly.

**Description resolution** (in `ProductList.tsx`): within a group, walk `variants` in their
existing sorted order and use the first one with a `product-descriptions.json` entry for the
current locale; if none has one, fall back to the generic
`copy.tarifart.{tarifart}.description` — the same per-product fallback logic as today, just
resolved once per group instead of once per row. No new merge/conflict handling: hand-entered
descriptions are reviewed before being added, so grouped variants are expected to agree.

**Sub-row label** (the "R1"/"R2" text next to each price): derive by stripping the group name
as a literal prefix from that variant's `productName` (e.g. `"BeneFit PLUS Hausarzt R1"` minus
`"BeneFit PLUS Hausarzt"` → `"R1"`, trimmed). If `productName` doesn't start with the group
name — shouldn't happen with correct data, but hand-edited files can drift — fall back to
showing the full `productName` as the label rather than a blank or broken string. No 3rd
hand-maintained field for this. Singleton groups strip to `""` and show only the price, with no
label.

A group is always tarifart-scoped: it's built from products already bucketed by `tarifart`, so
two tarifCodes sharing a `groupName` but different `tarifart` (a data-entry mistake, since real
variants share a tarifart in every case seen so far) silently produce two separate
same-named groups in two different tarifart sections rather than erroring — acceptable given
this is hand-reviewed data, consistent with the "no guessing, degrade gracefully" pattern
elsewhere in this data layer.

## Crawler auto-population

`product-groups.json` is filled two ways, same dual pattern as `product-descriptions.json`:
the crawler populates it incrementally as insurers are crawled, and hand edits remain a full
backup/override path (useful for insurers with no `seedUrl`, or to correct/pre-empt a bad
auto-derived grouping).

In `scripts/crawl/crawlDescriptions.ts`, after matching that insurer's products to crawled
pages (existing `matchProductPage` step): group the *matched* products by which page URL they
landed on. Multiple tarifCodes landing on the same page is itself the grouping signal — no
separate similarity heuristic on names.

This does **not** cover Helsana's own `BeneFit PLUS Hausarzt R1`–`R4` example: `matchProductPage`
requires a page's `<title>` to contain the product's full BAG name, and Helsana's page for that
product — title *and* `<h1>` — is just "Hausarztmodell"; "BeneFit PLUS Hausarzt" doesn't appear
on the page at all. That's a genuine vocabulary mismatch between BAG's product naming and the
insurer's own marketing copy, not a matching-strictness bug — loosening the rule to catch it
(e.g. word-overlap instead of full-string substring) would reopen exactly the nav/footer
false-positive problem `matchProductPage` was deliberately tightened against (see its module
comment). So `matchProductPage` is intentionally left as-is here. Helsana's Hausarzt/Flexmed
groups stay on the **manual-edit path** — expected, not a gap: this is precisely the case the
hand-maintained backup exists for. Other insurers whose product pages do echo the BAG name
(commonly true — Sanitas's `Hausarztmodell 1`–`4` example, unlike Helsana's, uses that exact
wording as both the tarifCode-adjacent name and likely the page title) get auto-grouped as
described below without needing this exception.

For each such multi-tarifCode-one-page group: derive the group name as the **shared leading
words** across their `productName`s — split each on whitespace, take the longest common prefix
at the word level (not character level, so `"...Hausarzt R1"` / `"...Hausarzt R2"` correctly
yields `"...Hausarzt"` rather than cutting mid-token at `"...Hausarzt R"`). If the derived name
is empty (no shared leading word — shouldn't happen given they share a page, but never write a
guess), leave those tarifCodes ungrouped for this run rather than writing a blank/nonsense name.

**Hand edits always win**: before writing, the crawler only sets `productGroups[insurerCode]
[tarifCode]` for a tarifCode that has no existing entry — mirrors `buildInsurerSources`'s
`existing[insurerCode]?.seedUrl ?? null` merge in `insurerSources.ts`. A grouping you've
corrected or added by hand is never touched by a later crawl run.

## UI integration

`ProductList.tsx` restructures each tarifart section from a flat list of product rows into:

```
[tarifart label]
  for each group:
    [tag] [group name]                                  ← header row, no price
    [resolved description]                               ← one line, as today
    for each variant:
      [stripped label]  [discount badge]  [price]         ← indented sub-row
        border-primary + "shown above" badge iff variant.tarifCode === shownTarifCode
```

- Discount-vs-standard badge stays per-variant (price-dependent), same `discountVsStandardPct`
  call as today.
- The `isShown`/`results.shownAboveTag` highlight moves from the (now removed) single row to
  the specific variant row matching `shownTarifCode` — preserves today's exact behavior of
  pointing at the one plan being compared above, now at the more precise variant level.
- Groups with a single variant — the common case, since most insurers have no
  `product-groups.json` entries yet — render via today's exact flat single-row JSX (tag + name +
  discount badge + price all on one line, price inline not indented below). This *is* a render-
  level branch on `variants.length`, not a data-level one: both cases still flow through the same
  `groupProductsByTarifart` output and the same `ProductGroup` shape — only `ProductList.tsx`
  chooses which JSX shape to paint. Only `variants.length > 1` gets the new header/description/
  indented-variants shape. This matches the mockup, where Sanitas/Assura's ungrouped rows stayed
  pixel-identical and only the Helsana Hausarzt example used the new nested shape.
- No new collapse/expand interaction: groups and their variants render fully open, same as
  `ProductList` itself renders fully open once its parent `PlanRow` is expanded today.

## Mockup

[`mockups/main.html`](../../../mockups/main.html)'s `.plan-detail-row` section (kept in sync
with `ProductList.tsx` since the product-descriptions work) got one illustrative grouped example
added — Helsana's BeneFit PLUS Hausarzt R1–R4 under one header/description with four price
sub-rows — alongside its existing ungrouped rows, demonstrating both the grouped and singleton
(unchanged) rendering paths side by side. **Done** ahead of the rest of this plan, as a design
preview (`.plan-detail-product-header` / `.plan-detail-variants` / `.plan-detail-variant` CSS
added, no JS/data changes).

## Testing

- `lookup.test.ts`: `groupProductsByTarifart` — grouped variants nest correctly and stay
  price-sorted within a group; groups without a `product-groups.json` entry come out as
  singletons; group order follows each group's cheapest variant.
- `productGroups.test.ts`: `getProductGroupName` — present, missing tarifCode, missing insurer.
- Component test: `ProductList` renders one header/description with N price sub-rows for a
  grouped product; renders today's single-row shape for an ungrouped one; the
  `shownTarifCode` highlight lands on the correct variant row, not the group header.
- `crawlDescriptions.ts`: unit test for the group-derivation step (word-level longest-common-
  prefix, same-page detection, empty-prefix → no group, existing hand entry → not overwritten)
  against fixture data, same style as `insurerSources.test.ts`'s merge test. `matchProductPage`
  itself is untouched — no test changes there.
