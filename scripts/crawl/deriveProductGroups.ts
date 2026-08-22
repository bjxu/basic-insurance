// Derives product-groups.json entries from a crawl run's matched pages — multiple tarifCodes
// landing on the same page is itself the grouping signal (docs/superpowers/specs/2026-08-22-
// provider-product-grouping-design.md), not a separate name-similarity heuristic.

import type { ProductGroups } from "../../src/lib/productGroups";

export type MatchedProduct = { tarifCode: string; productName: string; pageUrl: string };

/** Groups matched products by shared pageUrl, deriving each group's name as the longest common
 *  prefix of their productNames at the word level (not character level, so "...Hausarzt R1" /
 *  "...Hausarzt R2" yields "...Hausarzt" rather than cutting mid-token at "...Hausarzt R").
 *  Returns only tarifCodes worth grouping: a tarifCode that matched a page alone, or a same-page
 *  cluster with no shared leading word, is omitted entirely — never written with a guess. */
export function deriveProductGroups(matches: MatchedProduct[]): Record<string, string> {
  const byPage = new Map<string, MatchedProduct[]>();
  for (const m of matches) {
    if (!byPage.has(m.pageUrl)) byPage.set(m.pageUrl, []);
    byPage.get(m.pageUrl)!.push(m);
  }

  const result: Record<string, string> = {};
  for (const pageMatches of byPage.values()) {
    if (pageMatches.length < 2) continue;
    const groupName = commonLeadingWords(pageMatches.map((m) => m.productName));
    if (!groupName) continue;
    for (const m of pageMatches) result[m.tarifCode] = groupName;
  }
  return result;
}

function commonLeadingWords(names: string[]): string {
  const wordLists = names.map((n) => n.trim().split(/\s+/));
  const shortestLength = Math.min(...wordLists.map((w) => w.length));
  const common: string[] = [];
  for (let i = 0; i < shortestLength; i++) {
    const word = wordLists[0][i];
    if (!wordLists.every((w) => w[i] === word)) break;
    common.push(word);
  }
  return common.join(" ");
}

/** Merges freshly-derived groups for one insurer into the existing productGroups map,
 *  preserving any hand-entered tarifCode already present — never overwritten by a
 *  crawler-derived guess. Mirrors buildInsurerSources's `existing[insurerCode]?.seedUrl ??
 *  null` merge (insurerSources.ts). Returns a new ProductGroups object; does not mutate
 *  `existing`. */
export function mergeProductGroups(
  existing: ProductGroups,
  insurerCode: string,
  derived: Record<string, string>,
): ProductGroups {
  const existingForInsurer = existing[insurerCode] ?? {};
  const merged = { ...existingForInsurer };
  for (const [tarifCode, groupName] of Object.entries(derived)) {
    if (!(tarifCode in merged)) merged[tarifCode] = groupName;
  }
  if (Object.keys(merged).length === 0) return existing;
  return { ...existing, [insurerCode]: merged };
}
