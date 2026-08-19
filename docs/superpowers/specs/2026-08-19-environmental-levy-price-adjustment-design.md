# Environmental Levy Price Adjustment — Design

**Date:** 2026-08-19
**Status:** Approved

## Problem

The app displays raw BAG-approved tariff premiums (`public/data/premiums-2026.json`). Real
insurer websites don't: we verified, by cross-referencing screenshots against this app's own
BAG dataset, that both Swica and Helsana subtract a flat CHF 5.15/month from every product's
tariff before displaying it — the monthly equivalent of the 2026 federal CO₂/VOC levy
redistribution (CHF 61.80/year), credited to every person with Swiss basic insurance
regardless of insurer. Seven products across two insurers matched the raw BAG tariff minus
CHF 5.15 exactly.

This creates two problems:

1. **User-facing mismatch.** Someone cross-checking this app's price against an insurer's own
   site sees a CHF 5.15/month higher number here, with no explanation.
2. **Latent inconsistency in the app's own savings math.** The headline's "you could save
   CHF X/year" compares the user's self-reported current premium (their real bill — already
   net of the levy, since that's what their insurer actually charges them) against the
   dataset's raw gross cheapest tariff. Mixing a net figure against a gross one understates
   the true savings by CHF 61.80/year.

## Goal

Subtract the flat, insurer-uniform environmental levy credit from every displayed *absolute*
premium price, and declare this clearly so users understand what changed and why it can't
affect ranking.

## Non-goals

- **Not applied to relative comparisons**: `discountVsStandardPct` (alt-model vs. Standard,
  same insurer) and the year-over-year badge stay computed on raw BAG tariffs. Both are
  ratios/deltas between two dataset values — the flat levy cancels out of nothing there and
  folding it in would just perturb numbers that are supposed to reflect tariff differences,
  not a government rebate.
- **Not baked into the ingest pipeline** (`scripts/ingest.ts`) or `premiums-2026.json`. That
  file stays a faithful, auditable copy of BAG's official tariff data. The levy figure comes
  from a different federal office (BAFU, not BAG) on a different publication cadence — mixing
  it into the BAG dataset would blur that provenance.
- **No multi-person/family handling.** The app is single-person only (one PLZ/birth
  year/franchise per search) — the levy is a flat per-capita amount, so this is a non-issue,
  not a deferred feature.

## Data model

New field in `src/data/metadata.json`, year-keyed like `availableYears`/`memberCountAsOf`:

```json
{
  "environmentalLevyPerMonth": { "2026": 5.15 }
}
```

Maintained manually, sourced from BAFU's annual redistribution figure (published each year
as a "Merkblatt Rückverteilung CO2- und VOC-Abgaben"; CHF 61.80/year ÷ 12 for 2026). If a
selected year has no entry, the adjustment is skipped (premium shown unchanged) and the
footer declaration is silently omitted for that year — a safe default, not an error state.

## New module: `src/lib/environmentalLevy.ts`

```ts
export function applyEnvironmentalLevy(monthlyPremium: number, year: number): number
```

Pure function: looks up `environmentalLevyPerMonth[year]` from `metadata.json` and subtracts
it if present, otherwise returns `monthlyPremium` unchanged. Unit-tested in isolation
(known year, missing year), same pattern as `src/lib/format.ts` and `src/lib/ageband.ts`.

## Call sites (display layer only)

1. **`PlanRow.tsx`** — `formatChf(plan.monthlyPremium)` becomes
   `formatChf(applyEnvironmentalLevy(plan.monthlyPremium, plan.year))`. This covers every
   plan row, including the "Deine Kasse" (current-insurer) row, which already renders the
   matched dataset row rather than the self-reported figure.
2. **`InsuranceComparator.tsx`**, in the `results` memo — before calling `computeHeadline`,
   build a shallow copy of `cheapestRows[0]` with `monthlyPremium` replaced by
   `applyEnvironmentalLevy(cheapestRows[0].monthlyPremium, year)`, and pass that copy as
   `computeHeadline`'s `cheapest` argument instead of the raw row. `results.plans` (fed to
   `PlanList`) keeps the raw `cheapestRows` — `PlanRow` does its own adjustment per point 1.
3. **`lookup.ts` / `computeHeadline` stay untouched.** They receive an already-adjusted number
   for `cheapest.monthlyPremium` and compute `savingsPerYear` the same way as today — no
   changes to the function, its signature, or its existing tests.
4. **Headline's self-reported "current" figure is never touched** — `headline.current.monthlyPremium`
   is what the user typed in as their real bill, not a dataset value.
5. **Explicitly not touched**: `standardPremiumsByInsurer` / `discountVsStandardPct` inputs,
   and the `yoy` calculation in `PlanRow` (both operate on raw dataset values, per Non-goals).

## Overall declaration (footer)

New message key `footer.levyNotice`, rendered as a second sentence after the existing
`footer.dataNotice` line, only when `environmentalLevyPerMonth[year]` exists for the
currently selected year. Kept as a separate key (not merged into `dataNotice`'s existing
interpolation) to avoid touching that string's params across all four locale files.

German wording (as landed in the mockup, `mockups/main.html`):

> Preise enthalten die Rückerstattung der CO₂-/VOC-Lenkungsabgabe (CHF {amount}/Monat,
> {year}) — für alle Kassen gleich hoch, ohne Einfluss auf die Rangfolge

French, Italian, and English equivalents, matching the tone of the existing
`footer.dataNotice` entries in each file:

- **fr**: "Les prix incluent la restitution de la taxe d'incitation CO₂/COV (CHF
  {amount}/mois, {year}) — identique pour toutes les caisses, sans effet sur le classement"
- **it**: "I prezzi includono la restituzione della tassa d'incentivazione CO₂/COV (CHF
  {amount}/mese, {year}) — uguale per tutte le casse, senza effetto sulla classifica"
- **en**: "Prices include the CO₂/VOC levy redistribution (CHF {amount}/month, {year}) — the
  same for every insurer, with no effect on ranking"

## Testing

- `environmentalLevy.test.ts`: known year returns adjusted value; missing year returns input
  unchanged; verify against the real 2026 constant (5.15) with a couple of the confirmed
  reference values (e.g. 311.60 → 306.45) as a regression anchor tied to the verified
  Swica/Helsana cross-check.
- `lookup.test.ts`: unaffected, no changes needed.
- `format.test.ts`: unaffected.
- `messages.test.ts` (existing locale-completeness check): extend coverage to the new
  `footer.levyNotice` key across all four locales.

## Yearly maintenance note

Whoever refreshes `premiums-YYYY.json` for a new year must separately add that year's BAFU
levy figure to `metadata.json`'s `environmentalLevyPerMonth` map. These are two different
data sources on two different publication schedules — call this out in a code comment next
to the field so it isn't forgotten when a new year is onboarded.
