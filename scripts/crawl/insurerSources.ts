// Builds/merges src/data/insurer-sources.json — the hand-maintained registry of "where
// does this insurer publish its product pages" that crawlDescriptions.ts starts from
// (docs/superpowers/specs/2026-08-19-provider-product-descriptions-design.md). Reuses
// INSURER_NAMES (scripts/ingest/insurers.ts) as the single source of truth for insurer
// codes/names rather than duplicating the list.

import { INSURER_NAMES } from "../ingest/insurers";

export type InsurerSource = { insurerName: string; seedUrl: string | null };
export type InsurerSources = Record<string, InsurerSource>;

/** Merges `names` into `existing`, preserving any seedUrl already filled in and adding
 *  new insurers with `seedUrl: null`. Safe to call repeatedly (e.g. every
 *  crawl-descriptions run) — never drops a hand-entered URL. */
export function buildInsurerSources(
  existing: InsurerSources = {},
  names: Record<string, string> = INSURER_NAMES,
): InsurerSources {
  const result: InsurerSources = {};
  for (const [insurerCode, insurerName] of Object.entries(names)) {
    result[insurerCode] = { insurerName, seedUrl: existing[insurerCode]?.seedUrl ?? null };
  }
  return result;
}
