# Current-Plan Self-Reported Premium & Discount Badge — Design

**Date:** 2026-08-14
**Status:** Approved

## Problem

Two related changes to how the app communicates savings:

1. **"Was zahlst du heute?" asks for too much.** The current-plan section
   ([CurrentPlanSection.tsx](../../../src/components/current-plan/CurrentPlanSection.tsx))
   currently has four fields — Kasse, Franchise, Modell, Unfalldeckung — because the app
   looks up the user's exact premium row in the BAG dataset (`findCurrentPlan` /
   `findMatchingProducts` in [lookup.ts](../../../src/lib/lookup.ts)), per
   `requirement.md`'s original "Real data only" principle. That's a lot to ask (most
   people don't know their exact Tarifart or deductible off-hand), and when an insurer
   sells several named products at the same franchise/model (e.g. Helsana's "BeneFit
   PLUS" Hausarzt line — R1 through R4, plus two Flexmed variants), it triggers a further
   "Genaues Produkt" disambiguation step.
2. **The results list doesn't show why alternative models are cheaper.** Rows just carry
   a model tag ("Hausarzt", "Telmed", ...) and a one-line restriction description. Two
   "Hausarzt" rows from different insurers look equivalent even though the discount they
   represent varies a lot — checked against the real 2026 BAG dataset, an insurer's best
   alternative-model discount vs. its own Standard premium ranges from ~5% (Glarner
   Krankenversicherung) to ~31% (Visana), and even for the *same* insurer/model it shifts
   with franchise and region (e.g. Helsana's cheapest Hausarzt product goes from −15% at
   CHF 300 deductible to −19–21% at CHF 2500).

**Goal:** cut the current-plan input to insurer + self-reported monthly premium, and add
a per-row discount badge to the results list so the "how would I save" signal comes from
real data even though the current-plan premium no longer does.

## Design

### Current-plan input: 2 fields

`CurrentPlanSection` keeps **Aktuelle Kasse** (unchanged — a `<select>` of real BAG
insurers) and replaces the other three fields with a single **Monatliche Prämie** input:
a CHF-formatted number field (decimal for Rappen, "CHF" as a visual affix not a typed
prefix), self-reported by the user, not looked up.

This removes the "Genaues Produkt" disambiguation step entirely — there's nothing left
to disambiguate once the app isn't matching a dataset row for the current plan.

**Type change** — `CurrentPlan` (`types.ts`) shrinks from

```ts
type CurrentPlan = {
  insurerCode: string;
  franchise: number;
  tarifart: Tarifart;
  unfalldeckung: boolean;
  tarifCode?: string;
};
```

to

```ts
type CurrentPlan = {
  insurerCode: string;
  monthlyPremium: number; // CHF, self-reported
};
```

A current plan is "provided" when both fields are present and `monthlyPremium` is a
positive, finite number (REQ-13) — same opt-in-as-a-whole behavior as today, just fewer
fields to fill in.

### Headline computation: same framing, simpler input

`computeHeadline` keeps its three-way result (`savings` / `already-cheapest` /
`no-current-plan`) and comparison logic (`current.monthlyPremium <= cheapest.monthlyPremium`
⇒ already-cheapest) completely unchanged. What changes is what feeds its `current`
parameter: instead of a full matched `PremiumRow`, it only ever needs
`{ insurerCode, insurerName, monthlyPremium }` — the self-reported plan, wrapped with the
insurer's display name looked up from the insurer list (already available for the
dropdown) since a self-reported plan carries no `insurerName` of its own. Suggest
loosening `computeHeadline`'s type from `PremiumRow | null` to a narrower
`{ insurerCode: string; insurerName: string; monthlyPremium: number } | null` for the
`current`/`cheapest` params it actually reads, rather than requiring a full `PremiumRow`
shape that no longer applies to self-reported data.

The `HeadlineState` wording is unaffected — REQ-8's text is the same, just sourced
differently. One behavior note formalized in `requirement.md` (§5.2): the self-reported
premium doesn't vary with the year toggle (it isn't itself dated), so the headline's "If
you do nothing: CHF X" side stays fixed across the 2026/2027 toggle; only the "cheapest
match" side changes.

**Dead code to remove:** `findMatchingProducts` and `findCurrentPlan` in `lookup.ts`
become unused once nothing needs to match a current-plan combination against the
dataset; delete them and their tests rather than leaving them unreferenced.
`currentPlanProductOptions`, the `productOptions` prop, and the "Genaues Produkt"
`<select>` in `CurrentPlanSection.tsx` go too.

### Discount badge (results list)

Formalized as REQ-23. Each alternative-model row already renders the cheapest matching
product for that insurer (`cheapestPerInsurer` in `lookup.ts` — unchanged). A new pure
helper computes, for that same winning row, the discount versus that insurer's own
Standard-tarifart premium at the identical region/franchise/age-band/accident-coverage:

```
discountPct = (standardPremium - row.monthlyPremium) / standardPremium * 100
```

Rendered as a chip right after the existing model tag, before its description text:
**"bis zu −X.X% ggü. Standard"** — "bis zu" (up to), not a bare percentage, because the
row already shows that insurer's *best* matching product for the active model; if the
insurer sells several products in the same model (Helsana's Hausarzt R1–R4), others may
discount less than the one actually shown. Standard rows get no badge (nothing to
compare against itself). If an insurer has no Standard premium for that exact
region/franchise/age-band/accident-coverage combination, the badge is omitted for that
row — not reachable with the current BAG dataset (verified: all 34 insurers in
`premiums-2026.json` offer Standard) but handled defensively rather than assumed
impossible.

Visual design already validated via the brainstorming visual companion and merged as a
mockup-only change: [PR #12](https://github.com/bjxu/basic-insurance/pull/12),
`mockups/main.html`. This design doc covers wiring it to real computed data in the app
itself, not the visual design (already settled).

### requirement.md changes

Already applied in this same change:
- Core Principle #3 ("Real data only") gets an explicit, named exception for the
  current-plan premium.
- §5.1/§5.2 rewritten for the 2-field flow and self-reported comparison.
- REQ-7, REQ-8, REQ-9, REQ-13 updated; REQ-14 marked removed (not renumbered/reused —
  the "current plan not found in the data" case it covered no longer exists).
- New REQ-23 for the discount badge.
- §8 edge cases and §11 open questions updated to match; the old "current-plan
  disambiguation" open question (§11 item 2) is resolved (struck through, not deleted,
  so the history of *why* stays visible).

### URL state

`InsuranceComparator.tsx`'s URL encode/decode drops `currentFranchise`, `currentTarifart`,
`currentTarifCode`, `currentUnfalldeckung` and adds `currentMonthlyPremium`;
`currentInsurerCode` is unchanged. Old bookmarked URLs carrying the removed params simply
have those params ignored on decode (no special migration needed — unknown query params
are inert), so a stale link degrades to "no current plan provided" rather than erroring.

## Testing strategy

- `lookup.test.ts`: update/replace tests that exercised `findCurrentPlan` /
  `findMatchingProducts` (removed) with tests for the new discount-percentage helper —
  including the "no Standard premium to compare against" case, even though it isn't
  reachable with real data today.
- `computeHeadline` tests: adjust fixtures to the narrower `current`/`cheapest` shape;
  behavior (three-way branch, tie handling) is otherwise unchanged and should keep
  passing conceptually unmodified.
- Component tests for `CurrentPlanSection`: cover the 2-field render, premium input
  validation (empty/zero/negative/non-numeric ⇒ treated as not-provided), and removal of
  the product-picker.
- `PlanList`/row rendering: snapshot or assertion coverage for the discount badge text
  and its absence on Standard rows and (synthetic fixture) no-Standard-baseline rows.

## Self-Review

- **Placeholders:** none — every section above states a concrete decision.
- **Internal consistency:** `requirement.md` and this design doc agree on field names
  (`monthlyPremium`), REQ numbering (REQ-23 new, REQ-14 removed-not-reused), and the
  "bis zu" wording confirmed with the user.
- **Scope:** this doc covers the current-plan simplification and wiring the
  already-mocked discount badge to real data. It does not cover the mockup's visual
  design (settled separately, PR #12) or unrelated app areas.
- **Ambiguity check:** "insurer with no Standard premium" is explicitly specified as
  defensively handled (badge omitted) even though unreachable today, so implementation
  doesn't have to guess whether to treat it as an error state or a silent omission.
