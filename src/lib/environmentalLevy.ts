// Federal CO2-/VOC-Lenkungsabgabe redistribution (docs/superpowers/specs/
// 2026-08-19-environmental-levy-price-adjustment-design.md): every person insured under
// Swiss basic insurance is credited a flat, insurer-uniform amount each year, funded by
// two federal steering taxes (CO2 levy + VOC levy) and administered via a credit against
// the health-insurance premium bill. Verified against Swica's and Helsana's own premium
// calculators — both already net this out of the price they display, unlike the raw BAG
// tariff data this app is built on (public/data/premiums-*.json).
//
// This constant comes from BAFU (Federal Office for the Environment), not BAG — a
// different federal office and publication schedule than the premium tariff data — so it
// intentionally lives in src/data/metadata.json rather than the BAG ingest pipeline.

/** Subtracts the published levy credit for `year` from `monthlyPremium`. Returns
 *  `monthlyPremium` unchanged if no levy amount is published for that year yet — a safe
 *  default (no adjustment) rather than a crash or a wrong number. */
export function applyEnvironmentalLevy(
  monthlyPremium: number,
  year: number,
  levyPerMonthByYear: Record<string, number>,
): number {
  const levy = levyPerMonthByYear[String(year)];
  return levy != null ? monthlyPremium - levy : monthlyPremium;
}
