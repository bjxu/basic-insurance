//
// Validates that scripts/ingest.ts's output is a faithful, complete transform of the
// real BAG source CSV it was ingested from
// (docs/superpowers/specs/2026-08-12-ingest-data-validation-design.md). Runs on every
// `npm run ingest`, before any file is written, so a transform bug can never reach
// committed data.
//
// Reuses parsePremiums.ts's mapping tables/helpers (one source of truth for *how* a
// value maps) but deliberately restates the two drop predicates (sibling-discount
// subgroup, invalid canton) rather than importing them — if that business rule ever
// drifts between the parser and this validator, the conservation check below fails
// loudly instead of silently passing.

import { parse } from "csv-parse/sync";
import type { PremiumRow } from "../../src/lib/types";
import {
  VALID_CANTONS,
  ALTERSKLASSE_MAP,
  TARIFART_MAP,
  parseFranchise,
  parseRegionNumber,
  parseUnfalldeckung,
} from "./parsePremiums";

export type ValidationResult = { ok: boolean; errors: string[] };

const MAX_EXAMPLES = 10;

function naturalKey(fields: {
  insurerCode: string;
  praemienregionId: string;
  altersklasse: string;
  franchise: number;
  unfalldeckung: boolean;
  tarifart: string;
  tarifCode: string;
  year: number;
}): string {
  return [
    fields.insurerCode,
    fields.praemienregionId,
    fields.altersklasse,
    fields.franchise,
    fields.unfalldeckung,
    fields.tarifart,
    fields.tarifCode,
    fields.year,
  ].join("|");
}

export function validateIngestOutput(csvText: string, rows: PremiumRow[]): ValidationResult {
  const errors: string[] = [];
  const records: Record<string, string>[] = parse(csvText, {
    columns: true,
    bom: true,
    trim: true,
  });

  const sourceByKey = new Map<string, string>();
  let droppedSiblingRows = 0;
  let droppedCantonRows = 0;

  for (const r of records) {
    if (r.Altersklasse === "AKL-KIN" && r.Altersuntergruppe !== "K1") {
      droppedSiblingRows++;
      continue;
    }
    if (!VALID_CANTONS.has(r.Kanton)) {
      droppedCantonRows++;
      continue;
    }

    const key = naturalKey({
      insurerCode: r.Versicherer,
      praemienregionId: `${r.Kanton}-${parseRegionNumber(r.Region)}`,
      altersklasse: ALTERSKLASSE_MAP[r.Altersklasse],
      franchise: parseFranchise(r.Franchise),
      unfalldeckung: parseUnfalldeckung(r.Unfalleinschluss),
      tarifart: TARIFART_MAP[r.Tariftyp] ?? "andere",
      tarifCode: r.Tarif,
      year: Number(r["Geschäftsjahr"]),
    });
    sourceByKey.set(key, r["Prämie"]);
  }

  const expectedKeptCount = records.length - droppedSiblingRows - droppedCantonRows;
  if (rows.length !== expectedKeptCount) {
    errors.push(
      `conservation: expected ${expectedKeptCount} kept rows ` +
        `(${records.length} source rows - ${droppedSiblingRows} sibling-discount - ` +
        `${droppedCantonRows} invalid-canton), got ${rows.length} output rows`,
    );
  }

  const seenKeys = new Set<string>();
  let duplicateCount = 0;
  let missingSourceCount = 0;
  let valueMismatchCount = 0;

  for (const row of rows) {
    const key = naturalKey({
      insurerCode: row.insurerCode,
      praemienregionId: row.praemienregionId,
      altersklasse: row.altersklasse,
      franchise: row.franchise,
      unfalldeckung: row.unfalldeckung,
      tarifart: row.tarifart,
      tarifCode: row.tarifCode,
      year: row.year,
    });

    if (seenKeys.has(key)) {
      duplicateCount++;
      if (duplicateCount <= MAX_EXAMPLES) errors.push(`uniqueness: duplicate output row for key "${key}"`);
      continue;
    }
    seenKeys.add(key);

    const sourcePremium = sourceByKey.get(key);
    if (sourcePremium === undefined) {
      missingSourceCount++;
      if (missingSourceCount <= MAX_EXAMPLES) {
        errors.push(`value: no source row found for output key "${key}"`);
      }
      continue;
    }

    if (Number(sourcePremium) !== row.monthlyPremium) {
      valueMismatchCount++;
      if (valueMismatchCount <= MAX_EXAMPLES) {
        errors.push(
          `value: key "${key}" expected monthlyPremium ${sourcePremium}, got ${row.monthlyPremium}`,
        );
      }
    }
  }

  return { ok: errors.length === 0, errors };
}

export function verifyWrittenFile(expectedJson: string, writtenJson: string): ValidationResult {
  if (expectedJson === writtenJson) return { ok: true, errors: [] };
  return {
    ok: false,
    errors: [
      `read-after-write: file on disk (${writtenJson.length} bytes) does not match the ` +
        `JSON that was written (${expectedJson.length} bytes)`,
    ],
  };
}
