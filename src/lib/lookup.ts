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

// All five Tarifart values, in the same priority order as TARIFART_PRIORITY above — the
// filter used when the provider-product-detail accordion needs every model type for an
// insurer, independent of whichever models are currently toggled into the main list
// (docs/superpowers/specs/2026-08-16-provider-product-detail-design.md).
export const ALL_TARIFARTS: Tarifart[] = ["standard", "hausarzt", "telmed", "hmo", "andere"];

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
