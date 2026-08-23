// Fallback-safe lookup for hand/crawler-maintained product groupings — which tarifCodes
// represent the same underlying plan sold as separately-priced tiers (e.g. Helsana's BeneFit
// PLUS Hausarzt R1-R4), so ProductList can nest them under one shared name/description
// (docs/superpowers/specs/2026-08-22-provider-product-grouping-design.md). Pure — the caller
// owns importing src/data/product-groups.json and applying the singleton default (no entry ->
// group of one, named after the product's own productName).

export type ProductGroups = Record<string, Record<string, string>>; // insurerCode -> tarifCode -> groupName

export function getProductGroupName(
  groups: ProductGroups,
  insurerCode: string,
  tarifCode: string,
): string | undefined {
  return groups[insurerCode]?.[tarifCode];
}
