// Pure lookup functions (architecture.md §6). Testable in isolation, no I/O.

import type { CurrentPlan, HeadlineState, PremiumRow, Tarifart } from "./types";

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

/** Every row matching the current-plan's core fields (insurer, franchise, model,
 *  accident coverage, region, age band, year) regardless of product — runs against
 *  the full unfiltered dataset, same rationale as findCurrentPlan below. Used to
 *  detect whether a specific product needs to be asked for (requirement.md §11.2):
 *  BAG sometimes publishes several distinct named products at the same price-relevant
 *  combination (e.g. two different Telmed products), and callers must not guess which
 *  one the user actually has. */
export function findMatchingProducts(
  rows: PremiumRow[],
  plan: Omit<CurrentPlan, "tarifCode"> & { praemienregionId: string; altersklasse: PremiumRow["altersklasse"]; year: number },
): PremiumRow[] {
  return rows.filter(
    (row) =>
      row.insurerCode === plan.insurerCode &&
      row.franchise === plan.franchise &&
      row.tarifart === plan.tarifart &&
      row.unfalldeckung === plan.unfalldeckung &&
      row.praemienregionId === plan.praemienregionId &&
      row.altersklasse === plan.altersklasse &&
      row.year === plan.year,
  );
}

/** Runs against the full unfiltered dataset so the current plan is always findable
 *  regardless of the active model/accident-coverage filters (architecture.md §6).
 *  Resolves to a single row: if plan.tarifCode is given, matches on it too. If not
 *  given, resolves only when the core fields match exactly one product — when they
 *  match zero, that's "not found" (REQ-14); when they match more than one, that's
 *  ambiguous and this returns null too, since guessing which product the user has
 *  would misreport their real premium (requirement.md §11.2). Callers that want to
 *  distinguish "not found" from "ambiguous, ask the user" should call
 *  findMatchingProducts directly. */
export function findCurrentPlan(
  rows: PremiumRow[],
  plan: CurrentPlan & { praemienregionId: string; altersklasse: PremiumRow["altersklasse"]; year: number },
): PremiumRow | null {
  const candidates = findMatchingProducts(rows, plan);
  if (plan.tarifCode != null) {
    return candidates.find((row) => row.tarifCode === plan.tarifCode) ?? null;
  }
  return candidates.length === 1 ? candidates[0] : null;
}

/** REQ-8/9/10/14: derive which headline variant to render. */
export function computeHeadline(
  current: PremiumRow | null,
  cheapest: PremiumRow | null,
  currentPlanProvided: boolean,
): HeadlineState {
  if (!currentPlanProvided) {
    return { kind: "no-current-plan", cheapest };
  }
  if (!current) {
    return { kind: "current-plan-not-found", cheapest };
  }
  // REQ-10 defines this for the exact-equal case; <= also covers current being
  // strictly cheaper than the filtered "cheapest" (possible because findCurrentPlan
  // runs unfiltered, e.g. current uses a model excluded by the active filter) —
  // without this, that case would fall into "savings" with a negative amount.
  if (!cheapest || current.monthlyPremium <= cheapest.monthlyPremium) {
    return { kind: "already-cheapest", current };
  }
  const savingsPerYear = (current.monthlyPremium - cheapest.monthlyPremium) * 12;
  return { kind: "savings", current, cheapest, savingsPerYear };
}
