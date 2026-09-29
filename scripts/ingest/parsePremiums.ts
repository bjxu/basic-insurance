//
// Parses the real BAG "Praemien_CH.csv" export into PremiumRow[] (architecture.md §3.2/§3.3).
// Column mapping and edge cases verified against the live file during planning
// (2026-08-11) — see docs/superpowers/plans/2026-08-11-real-bag-data-ingestion.md
// Global Constraints for how each was confirmed.
//
// Product identity (tarifCode and productName) is carried through the ETL so that
// src/lib/lookup.ts can resolve requirement.md §11.2 correctly by asking the user
// to disambiguate when multiple distinct BAG products share the same
// (insurerCode, praemienregionId, altersklasse, franchise, unfalldeckung, tarifart, year) key,
// rather than silently picking an arbitrary one.

import { parse } from "csv-parse/sync";
import type { Altersklasse, PremiumRow, Tarifart } from "../../src/lib/types";

export const VALID_CANTONS = new Set([
  "AG", "AI", "AR", "BE", "BL", "BS", "FR", "GE", "GL", "GR", "JU", "LU", "NE",
  "NW", "OW", "SG", "SH", "SO", "SZ", "TG", "TI", "UR", "VD", "VS", "ZG", "ZH",
]);

// BAG changed its raw code encoding between the 2026 and 2027 premium files (hyphenated
// prefixes -> underscore-delimited codes) — both are recognized here rather than one
// replacing the other, since a future fix might require re-parsing 2026's raw CSV (still
// committed under data/raw/ via git history). If a future year's ingest throws
// "unrecognized code", check whether BAG changed the encoding again before assuming a bug.
export const ALTERSKLASSE_MAP: Record<string, Altersklasse> = {
  "AKL-KIN": "kind",
  "AKL-JUG": "jung",
  "AKL-ERW": "erwachsen",
  "AKA_01_KIN": "kind",
  "AKA_02_JUG": "jung",
  "AKA_03_ERW": "erwachsen",
};

// 2027 merged Hausarzt+HMO into one "PRAXIS" category and split the old "TAR-DIV" bucket
// into "TEL_DIG" (unchanged in substance: phone/digital first contact) and a genuinely new
// "FLEX" category (choice of several first-contact options) — see
// docs/superpowers/specs/2026-09-29-bag-2027-schema-migration-design.md.
export const TARIFART_MAP: Record<string, Tarifart> = {
  "TAR-BASE": "standard",
  "TAR-HAM": "hausarzt",
  "TAR-HMO": "hmo",
  "TAR-DIV": "telmed",
  "BASE": "standard",
  "PRAXIS": "praxis",
  "FLEX": "flex",
  "TEL_DIG": "telmed",
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
    if ((r.Altersklasse === "AKL-KIN" || r.Altersklasse === "AKA_01_KIN") && r.Altersuntergruppe !== "K1") continue;

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

    const unfalldeckung = parseUnfalldeckung(r.Unfalleinschluss);

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
      tarifCode: r.Tarif,
      productName: r.Tarifbezeichnung,
      monthlyPremium: Number(r["Prämie"]),
    });
  }

  return { rows, skippedCantons, unknownTariftypes };
}

export function parseFranchise(code: string): number {
  const old = /^FRA-(\d+)$/.exec(code);
  if (old) return Number(old[1]);
  // 2027 format: FRA_<stufe>_<E|J|K altersgruppe-letter>_<amount, zero-padded>
  const neu = /^FRA_\d+_[EJK]_(\d+)$/.exec(code);
  if (neu) return Number(neu[1]);
  throw new Error(`parseFranchise: unrecognized Franchise code "${code}"`);
}

export function parseRegionNumber(code: string): string {
  const old = /^PR-REG CH(\d+)$/.exec(code);
  if (old) return old[1];
  const neu = /^PR_REG_(\d+)$/.exec(code);
  if (neu) return neu[1];
  throw new Error(`parseRegionNumber: unrecognized Region code "${code}"`);
}

export function parseUnfalldeckung(code: string): boolean {
  if (code === "MIT-UNF" || code === "MIT_UNF") return true;
  if (code === "OHN-UNF" || code === "OHN_UNF") return false;
  throw new Error(`parseUnfalldeckung: unrecognized Unfalleinschluss "${code}"`);
}
