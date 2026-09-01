// src/lib/praemienGuide.ts
// Canton-level average premium aggregation for the /de/praemien SEO guide
// (docs/superpowers/specs/2026-08-31-praemien-guide-content-page-design.md).
//
// Pure, browser-safe: PraemienGuideContent.tsx ("use client") imports
// CANTON_NAMES_DE and the CantonAverage type from here, so this module must
// stay free of Node built-ins. The disk read lives in ./praemienGuideData.

import type { PremiumRow } from "./types";
import { cheapestPerInsurer } from "./lookup";
import { applyEnvironmentalLevy } from "./environmentalLevy";

export type CantonAverage = { kanton: string; averagePremium: number };

// German canton display names, keyed by the 2-letter code already used
// throughout the app's data (praemienregionId's "<KANTON>-<region>" prefix;
// scripts/ingest/parsePremiums.ts's VALID_CANTONS). All 26 cantons.
export const CANTON_NAMES_DE: Record<string, string> = {
  AG: "Aargau",
  AI: "Appenzell Innerrhoden",
  AR: "Appenzell Ausserrhoden",
  BE: "Bern",
  BL: "Basel-Landschaft",
  BS: "Basel-Stadt",
  FR: "Freiburg",
  GE: "Genf",
  GL: "Glarus",
  GR: "Graubünden",
  JU: "Jura",
  LU: "Luzern",
  NE: "Neuenburg",
  NW: "Nidwalden",
  OW: "Obwalden",
  SG: "St. Gallen",
  SH: "Schaffhausen",
  SO: "Solothurn",
  SZ: "Schwyz",
  TG: "Thurgau",
  TI: "Tessin",
  UR: "Uri",
  VD: "Waadt",
  VS: "Wallis",
  ZG: "Zug",
  ZH: "Zürich",
};

// Fixed reference profile for the guide's canton table — stated here (not
// buried inline) and echoed in the page's own copy (praemienGuide.table.note)
// so the numbers are self-explanatory.
export const REFERENCE_PROFILE = {
  altersklasse: "erwachsen",
  franchise: 300,
  tarifart: "standard",
  unfalldeckung: true,
} as const;

/** Average monthly premium per canton, for REFERENCE_PROFILE, levy-adjusted
 *  (matching what InsuranceComparator.tsx actually displays — see
 *  applyEnvironmentalLevy). Pure, no I/O. One row per canton present in
 *  `rows`, sorted by canton code. */
export function averagePremiumByCanton(
  rows: PremiumRow[],
  year: number,
  levyPerMonthByYear: Record<string, number>,
): CantonAverage[] {
  const matching = rows.filter(
    (row) =>
      row.altersklasse === REFERENCE_PROFILE.altersklasse &&
      row.franchise === REFERENCE_PROFILE.franchise &&
      row.tarifart === REFERENCE_PROFILE.tarifart &&
      row.unfalldeckung === REFERENCE_PROFILE.unfalldeckung,
  );

  const byCanton = new Map<string, PremiumRow[]>();
  for (const row of matching) {
    const kanton = row.praemienregionId.split("-")[0];
    const existing = byCanton.get(kanton);
    if (existing) existing.push(row);
    else byCanton.set(kanton, [row]);
  }

  const result: CantonAverage[] = [];
  for (const [kanton, cantonRows] of byCanton) {
    const cheapest = cheapestPerInsurer(cantonRows);
    const adjusted = cheapest.map((row) =>
      applyEnvironmentalLevy(row.monthlyPremium, year, levyPerMonthByYear),
    );
    const average = adjusted.reduce((sum, p) => sum + p, 0) / adjusted.length;
    result.push({ kanton, averagePremium: Math.round(average * 100) / 100 });
  }

  return result.sort((a, b) => a.kanton.localeCompare(b.kanton));
}
