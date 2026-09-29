// Pure lookup functions (architecture.md §6). Testable in isolation, no I/O.

import type { HeadlineState, PremiumRow, SelfReportedPlan, Tarifart } from "./types";
import { getProductGroupName, type ProductGroups } from "./productGroups";

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
  praxis: 2,
  telmed: 3,
  flex: 4,
  hmo: 5,
  andere: 6,
};

// All seven Tarifart values, in the same priority order as TARIFART_PRIORITY above — the
// filter used when the provider-product-detail accordion needs every model type for an
// insurer, independent of whichever models are currently toggled into the main list
// (docs/superpowers/specs/2026-08-16-provider-product-detail-design.md).
export const ALL_TARIFARTS: Tarifart[] = ["standard", "hausarzt", "praxis", "telmed", "flex", "hmo", "andere"];

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

/** Year-over-year change of `premium` vs. this same plan's premium the year before, as a
 *  percentage — shown in brackets next to a next-year premium (§5.3), never next to a
 *  current-year one (there's nothing earlier in scope to compare it against, §6.3). Returns
 *  null (bracket omitted) when there's no prior-year premium for this plan to compare
 *  against, e.g. the plan didn't exist in BAG's prior-year data. */
export function yearOverYearChangePct(previousYearPremium: number | undefined, premium: number): number | null {
  if (previousYearPremium == null || previousYearPremium <= 0) return null;
  return ((premium - previousYearPremium) / previousYearPremium) * 100;
}

/** Maps each product (`insurerCode::tarifCode`) to its premium in `previousYearRows`, at the
 *  given region/age-band/franchise/accident-coverage — the year-over-year baseline for
 *  next-year rows (§5.3). Keyed on tarifCode rather than tarifart so a product that BAG
 *  reclassified into a different Tarifart between years (§3, the 2027 Hausarzt/HMO → Praxis
 *  merge) still matches its own prior-year premium. Mirrors `standardPremiumsByInsurer`'s
 *  "same params, one axis fixed" shape, fixing year instead of model. */
export function previousYearPremiumByProduct(
  previousYearRows: PremiumRow[],
  params: Omit<FilterParams, "models" | "year">,
): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of previousYearRows) {
    if (
      row.praemienregionId === params.praemienregionId &&
      row.altersklasse === params.altersklasse &&
      row.franchise === params.franchise &&
      row.unfalldeckung === params.unfalldeckung
    ) {
      map.set(`${row.insurerCode}::${row.tarifCode}`, row.monthlyPremium);
    }
  }
  return map;
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

export type ProductGroup = {
  groupName: string;
  tarifart: Tarifart;
  variants: PremiumRow[]; // sorted by monthlyPremium asc, tie-break productName (de-CH)
};
export type TarifartGroup = { tarifart: Tarifart; groups: ProductGroup[] };

/** Groups one insurer's products by tarifart (Standard → Hausarzt → Telmed → HMO → Andere),
 *  then within each tarifart by product group — `productGroups[insurerCode]?.[tarifCode]`, or
 *  the product's own `productName` when absent (a group of one) — the provider-product-detail
 *  accordion's row order (docs/superpowers/specs/2026-08-22-provider-product-grouping-design.md).
 *  Variants are sorted by price ascending within each group, ties broken alphabetically by
 *  productName ("de-CH"); groups come out ordered by their own cheapest variant, since that's
 *  the order their first member appears in the already price-sorted tarifart bucket. */
export function groupProductsByTarifart(
  products: PremiumRow[],
  productGroups: ProductGroups,
): TarifartGroup[] {
  const byTarifart = new Map<Tarifart, PremiumRow[]>();
  for (const p of products) {
    if (!byTarifart.has(p.tarifart)) byTarifart.set(p.tarifart, []);
    byTarifart.get(p.tarifart)!.push(p);
  }
  return Array.from(byTarifart.entries())
    .sort(([a], [b]) => TARIFART_PRIORITY[a] - TARIFART_PRIORITY[b])
    .map(([tarifart, tarifartProducts]) => {
      const sorted = [...tarifartProducts].sort((a, b) =>
        a.monthlyPremium !== b.monthlyPremium
          ? a.monthlyPremium - b.monthlyPremium
          : a.productName.localeCompare(b.productName, "de-CH"),
      );
      const byGroupName = new Map<string, PremiumRow[]>();
      for (const p of sorted) {
        const groupName = getProductGroupName(productGroups, p.insurerCode, p.tarifCode) ?? p.productName;
        if (!byGroupName.has(groupName)) byGroupName.set(groupName, []);
        byGroupName.get(groupName)!.push(p);
      }
      const groups: ProductGroup[] = Array.from(byGroupName.entries()).map(([groupName, variants]) => ({
        groupName,
        tarifart,
        variants,
      }));
      return { tarifart, groups };
    });
}

/** The text shown next to a grouped variant's price (e.g. "R1") — the group name stripped as a
 *  literal prefix off that variant's own productName, trimmed. Returns the full productName
 *  unchanged if it doesn't start with groupName (shouldn't happen with correct data, but
 *  hand-edited files can drift — never show a blank/broken label). A singleton group's variant
 *  always has productName === groupName, so this correctly returns "". */
export function deriveVariantLabel(groupName: string, productName: string): string {
  if (!productName.startsWith(groupName)) return productName;
  return productName.slice(groupName.length).trim();
}
