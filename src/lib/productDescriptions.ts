// Fallback-safe lookup for provider-specific product descriptions
// (docs/superpowers/specs/2026-08-19-provider-product-descriptions-design.md). Pure —
// the caller owns importing src/data/product-descriptions.json and choosing the
// fallback (ProductList.tsx falls back to copy.tarifart.{tarifart}.description).

import type { ProductDescription } from "./types";

export type ProductDescriptions = Record<string, Record<string, ProductDescription>>;

const LOCALES = ["de", "en", "fr", "it"] as const;
type Locale = (typeof LOCALES)[number];

function isLocale(locale: string): locale is Locale {
  return (LOCALES as readonly string[]).includes(locale);
}

export function getProductDescription(
  descriptions: ProductDescriptions,
  insurerCode: string,
  tarifCode: string,
  locale: string,
): string | undefined {
  const entry = descriptions[insurerCode]?.[tarifCode];
  if (!entry || !isLocale(locale)) return undefined;
  return entry[locale];
}
