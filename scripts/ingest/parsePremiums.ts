//
// Parses the real BAG "Praemien_CH.csv" export into PremiumRow[] (architecture.md §3.2/§3.3).
// Column mapping and edge cases verified against the live file during planning
// (2026-08-11) — see docs/superpowers/plans/2026-08-11-real-bag-data-ingestion.md
// Global Constraints for how each was confirmed.
//
// After mapping, rows are deduped to one per (insurerCode, praemienregionId,
// altersklasse, franchise, unfalldeckung, tarifart, year) key, keeping the
// lowest monthlyPremium — see dedupeByLowestPremium below (requirement.md §11.2).

import { parse } from "csv-parse/sync";
import type { Altersklasse, PremiumRow, Tarifart } from "../../src/lib/types";

const VALID_CANTONS = new Set([
  "AG", "AI", "AR", "BE", "BL", "BS", "FR", "GE", "GL", "GR", "JU", "LU", "NE",
  "NW", "OW", "SG", "SH", "SO", "SZ", "TG", "TI", "UR", "VD", "VS", "ZG", "ZH",
]);

const ALTERSKLASSE_MAP: Record<string, Altersklasse> = {
  "AKL-KIN": "kind",
  "AKL-JUG": "jung",
  "AKL-ERW": "erwachsen",
};

const TARIFART_MAP: Record<string, Tarifart> = {
  "TAR-BASE": "standard",
  "TAR-HAM": "hausarzt",
  "TAR-HMO": "hmo",
  "TAR-DIV": "telmed",
};

export type ParsePremiumsResult = {
  rows: PremiumRow[];
  skippedCantons: Map<string, number>;
  unknownTariftypes: Set<string>;
};

export function parsePremiumRows(
  csvText: string,
  insurerNames: Record<string, string>,
): ParsePremiumsResult {
  const records: Record<string, string>[] = parse(csvText, {
    columns: true,
    bom: true,
    trim: true,
  });

  const rows: PremiumRow[] = [];
  const skippedCantons = new Map<string, number>();
  const unknownTariftypes = new Set<string>();

  for (const r of records) {
    // Sibling/multi-child discount sub-tiers (K3/K4/K5) — out of scope for a
    // single-person comparison (requirement.md §2). Only K1, the base child rate
    // (always present), is kept. Non-child rows have no Altersuntergruppe.
    if (r.Altersklasse === "AKL-KIN" && r.Altersuntergruppe !== "K1") continue;

    if (!VALID_CANTONS.has(r.Kanton)) {
      skippedCantons.set(r.Kanton, (skippedCantons.get(r.Kanton) ?? 0) + 1);
      continue; // e.g. ZE/ZR: cross-border/special-region rows with no Gemeinde/PLZ
                // mapping — unreachable via the app's PLZ-based lookup (REQ-1).
    }

    const altersklasse = ALTERSKLASSE_MAP[r.Altersklasse];
    if (!altersklasse) {
      throw new Error(`parsePremiumRows: unrecognized Altersklasse "${r.Altersklasse}"`);
    }

    let tarifart = TARIFART_MAP[r.Tariftyp];
    if (!tarifart) {
      unknownTariftypes.add(r.Tariftyp);
      tarifart = "andere"; // requirement.md §11.4 — BAG-classification-driven, not hardcoded
    }

    let unfalldeckung: boolean;
    if (r.Unfalleinschluss === "MIT-UNF") unfalldeckung = true;
    else if (r.Unfalleinschluss === "OHN-UNF") unfalldeckung = false;
    else throw new Error(`parsePremiumRows: unrecognized Unfalleinschluss "${r.Unfalleinschluss}"`);

    const insurerName = insurerNames[r.Versicherer];
    if (!insurerName) {
      throw new Error(
        `parsePremiumRows: unknown insurer code "${r.Versicherer}" — add it to scripts/ingest/insurers.ts`,
      );
    }

    rows.push({
      year: Number(r["Geschäftsjahr"]),
      insurerCode: r.Versicherer,
      insurerName,
      praemienregionId: `${r.Kanton}-${parseRegionNumber(r.Region)}`,
      altersklasse,
      franchise: parseFranchise(r.Franchise),
      unfalldeckung,
      tarifart,
      monthlyPremium: Number(r["Prämie"]),
    });
  }

  return { rows: dedupeByLowestPremium(rows), skippedCantons, unknownTariftypes };
}

// requirement.md §11.2 — BAG publishes multiple named products (distinct
// Tarif/Tarifbezeichnung values, which we don't otherwise retain) under the
// same (insurerCode, praemienregionId, altersklasse, franchise, unfalldeckung,
// tarifart, year) key for some insurers, with genuinely different prices.
// Without this, findCurrentPlan's `rows.find(...)` would pick an arbitrary
// (file-order) row for that key, making it non-deterministic and able to
// overstate the user's current premium. Keeping the lowest-priced row per key
// resolves this conservatively: it can never overstate savings, and it's a
// no-op for the results list, whose cheapestPerInsurer already takes a min
// over the same field set. Ties (identical price) keep whichever row was
// encountered first — no meaningful tiebreak signal is available.
function dedupeByLowestPremium(rows: PremiumRow[]): PremiumRow[] {
  const byKey = new Map<string, PremiumRow>();
  for (const row of rows) {
    const key = [
      row.insurerCode,
      row.praemienregionId,
      row.altersklasse,
      row.franchise,
      row.unfalldeckung,
      row.tarifart,
      row.year,
    ].join("|");
    const existing = byKey.get(key);
    if (!existing || row.monthlyPremium < existing.monthlyPremium) {
      byKey.set(key, row);
    }
  }
  return [...byKey.values()];
}

function parseFranchise(code: string): number {
  const match = /^FRA-(\d+)$/.exec(code);
  if (!match) throw new Error(`parsePremiumRows: unrecognized Franchise code "${code}"`);
  return Number(match[1]);
}

function parseRegionNumber(code: string): string {
  const match = /^PR-REG CH(\d+)$/.exec(code);
  if (!match) throw new Error(`parsePremiumRows: unrecognized Region code "${code}"`);
  return match[1];
}
