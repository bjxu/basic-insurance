// Pure lookup functions (architecture.md §6). Testable in isolation, no I/O.

import type { HeadlineState, PremiumRow, SelfReportedPlan, Tarifart } from "./types";

export type FilterParams = {
  praemienregionId: string;
  altersklasse: PremiumRow["altersklasse"];
  franchise: number;
  models: Tarifart[]; // active model filter, e.g. ["standard"] or ["standard","hmo","telmed",...]
  unfalldeckung: boolean;
  year: number;
};

export function filterPlans(rows: PremiumRow[], params: FilterParams): PremiumRow[] {
  return rows.filter(
    (row) =>
      row.praemienregionId === params.praemienregionId &&
      row.altersklasse === params.altersklasse &&
      row.franchise === params.franchise &&
      row.unfalldeckung === params.unfalldeckung &&
      row.year === params.year &&
      params.models.includes(row.tarifart),
  );
}

// Tie-break priority when an insurer has multiple equally-cheap rows (architecture.md §6).
const TARIFART_PRIORITY: Record<Tarifart, number> = {
  standard: 0,
  hausarzt: 1,
  telmed: 2,
  hmo: 3,
  andere: 4,
};

/** For each insurer, keep only the row with the lowest monthlyPremium. */
export function cheapestPerInsurer(rows: PremiumRow[]): PremiumRow[] {
  const byInsurer = new Map<string, PremiumRow>();
  for (const row of rows) {
    const existing = byInsurer.get(row.insurerCode);
    if (!existing) {
      byInsurer.set(row.insurerCode, row);
      continue;
    }
    if (
      row.monthlyPremium < existing.monthlyPremium ||
      (row.monthlyPremium === existing.monthlyPremium &&
        TARIFART_PRIORITY[row.tarifart] < TARIFART_PRIORITY[existing.tarifart])
    ) {
      byInsurer.set(row.insurerCode, row);
    }
  }
  return Array.from(byInsurer.values());
}

/** Price ascending, ties broken alphabetically by insurer name (REQ-3). */
export function sortPlans(rows: PremiumRow[]): PremiumRow[] {
  return [...rows].sort((a, b) => {
    if (a.monthlyPremium !== b.monthlyPremium) return a.monthlyPremium - b.monthlyPremium;
    return a.insurerName.localeCompare(b.insurerName, "de-CH");
  });
}

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
    return { kind: "already-cheapest", current, cheapest };
  }
  const savingsPerYear = (current.monthlyPremium - cheapest.monthlyPremium) * 12;
  return { kind: "savings", current, cheapest, savingsPerYear };
}

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
