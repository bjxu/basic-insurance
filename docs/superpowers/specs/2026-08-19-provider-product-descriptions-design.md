# Provider Product Descriptions — Design

**Date:** 2026-08-19
**Status:** Approved

## Problem

`ProductList` ([provider-product-detail](./2026-08-16-provider-product-detail-design.md)) shows
every product an insurer offers, grouped by `tarifart`, each with a one-line description —
but that description is currently the *generic tarifart description*
(`copy.tarifart.{tarifart}.description`, e.g. "Anruf bei Hotline erforderlich vor jedem
Arztbesuch"), identical for every product sharing that tarifart. It doesn't reflect how
individual products actually differ: two `hausarzt` products from the same insurer can carry
different network sizes, different first-contact steps, or different included perks, and the
generic label hides that.

**Goal:** show a description specific to each `(insurerCode, tarifCode)` product where one is
available, sourced from the insurer's own product page, falling back to today's generic
tarifart description everywhere it isn't (yet) available — so partial coverage degrades
gracefully rather than blocking the feature on 100% coverage.

Content is scoped to **restriction mechanics**, not marketing copy: the same plain,
comparable, one-sentence style `copy.tarifart.*.description` already uses (e.g. "first
contact must be your registered practice; ~450 partner practices"), not a fuller pitch of
perks/positioning. This keeps rows scannable and avoids reproducing insurer ad copy.

## Data model

Two new files under `src/data/`, alongside the existing `insurers.json`/`metadata.json`.

`tarifCode` is **not** globally unique — e.g. `"BASE"` is reused by nearly every insurer for
its standard product, and Groupe Mutuel's sister insurers share codes like `"SanaTel"` — so
descriptions are keyed by the composite `(insurerCode, tarifCode)`, not `tarifCode` alone.

```ts
// types.ts
export type ProductDescription = {
  de: string;
  en: string;
  fr: string;
  it: string;
  sourceUrl: string;
  crawledAt: string; // ISO date
};
```

- **`src/data/product-descriptions.json`** — `Record<insurerCode, Record<tarifCode,
  ProductDescription>>`. Starts as `{}`; populated incrementally by the crawl script and by
  hand. Any `(insurerCode, tarifCode)` or locale not present simply isn't rendered — no
  placeholder entries, no partial `ProductDescription` objects.
- **`src/data/insurer-sources.json`** — `Record<insurerCode, { insurerName: string; seedUrl:
  string | null }>`. Pre-populated with all 34 insurer codes/names from `insurers.json`,
  `seedUrl: null` as a stub. This is a hand-maintained registry (like
  `environmentalLevyPerMonth` in `metadata.json`) — there's no directory of insurer
  product-page URLs to derive it from. The crawl script skips any insurer still `null`.

Both files are committed to the repo and edited directly (by the crawl script or by hand) —
they are not regenerated from scratch by `npm run ingest`, since their content has no
counterpart in the BAG source files.

## Crawl script

`scripts/crawl/crawlDescriptions.ts`, run manually via `npm run crawl-descriptions`
(`--insurer <code>` to scope to one insurer while iterating) — kept separate from `npm run
ingest` because it's network- and LLM-dependent, non-deterministic, and its output is meant
to be spot-checked, not blindly trusted like the BAG CSV parse.

1. Read `insurer-sources.json` for seed URLs and the current product list (`insurerCode`,
   `tarifCode`, `productName`, `tarifart`) from `public/data/premiums-{year}.json`.
2. For each insurer with a non-null `seedUrl`: fetch it, then crawl same-origin links up to a
   bounded depth/page count, honoring `robots.txt` and rate-limited between requests.
3. Match each of that insurer's products to a crawled page by `productName` occurrence
   (weighted toward `<title>`/heading matches). A product with no confident match is left
   alone — no guessing, no low-confidence writes.
4. For each matched page: strip to plain text, then call Claude (`@anthropic-ai/sdk`, new
   devDependency, reads `ANTHROPIC_API_KEY`) with the page text plus `productName` +
   `tarifart` as context, asking for a one-sentence, restriction-focused description in each
   of de/en/fr/it, matching `copy.tarifart.*.description`'s tone.
5. Write results into `product-descriptions.json` with `sourceUrl` and `crawledAt`. Print a
   summary of matched vs. unmatched products per insurer so gaps are visible for manual
   follow-up (per the user's own review/backfill pass) rather than silently missing.

## UI integration

New helper, `src/lib/productDescriptions.ts`:

```ts
function getProductDescription(
  insurerCode: string,
  tarifCode: string,
  locale: string,
): string | undefined
```

Reads `product-descriptions.json`; returns `undefined` if the insurer, the tarifCode, or that
specific locale isn't present — no throwing, no partial/placeholder text.

In `ProductList.tsx`, the description line changes from:

```ts
t(`copy.tarifart.${product.tarifart}.description`)
```

to:

```ts
getProductDescription(product.insurerCode, product.tarifCode, locale)
  ?? t(`copy.tarifart.${product.tarifart}.description`)
```

`locale` comes from `next-intl`'s `useLocale()` (new import in `ProductList.tsx`, alongside
the existing `useTranslations()`). Because both new JSON files start empty, this change is a
no-op on first merge — every row keeps showing exactly what it shows today — and each insurer
crawled afterward incrementally replaces generic text with product-specific text, with no
further code changes required.

## Mockup

`mockups/main.html`'s `.plan-detail-row` (provider-product-detail section) doesn't currently
render a description line at all — the live `ProductList.tsx` does, so the mockup is already
slightly behind. This work brings the mockup in sync and illustrates per-product descriptions
using representative (non-crawled, hand-written) text: e.g. Sanitas's two Telmed products,
"Callmed" and "Sana24," get distinct one-line descriptions instead of a shared generic Telmed
line, demonstrating the fallback (a product with no illustrative text still shows the generic
tarifart line, matching real partial-coverage behavior).

## Testing

- `productDescriptions.test.ts`: unit tests for `getProductDescription`'s fallback resolution
  — present, missing locale, missing tarifCode, missing insurer entirely.
- Crawl script: unit tests for its pure pieces (page-matching heuristic against fixture HTML,
  HTML→text cleanup) — the live network fetch and the Claude call itself aren't unit-tested,
  same spirit as `downloadRaw.ts` today.
- Component test: `ProductList` renders `getProductDescription`'s text when
  `product-descriptions.json` has an entry for that product/locale, and falls back to the
  generic tarifart description otherwise.
- Manual verification: run `npm run crawl-descriptions --insurer <code>` against one seeded
  insurer once a `seedUrl` is filled in, confirm matched products get sensible per-locale
  text and unmatched ones are reported, not silently dropped.
