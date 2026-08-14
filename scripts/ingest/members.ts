//
// Parses BAG's "Versichertenbestand_CH.csv" (per-insurer, per-canton OKP enrollment)
// into per-insurer national totals. This is a separate BAG file from Praemien_CH.csv:
// semicolon-delimited (the premium file is comma-delimited) and the Versicherer code is
// zero-padded (the premium file's is not) — both handled here. Column mapping verified
// against the live file during planning (2026-08-14) — see
// docs/superpowers/plans/2026-08-14-member-count-badge.md Global Constraints.
//
// Unlike parsePremiums.ts, every Kanton row is summed regardless of canton validity
// (including BAG's cross-border/special-region codes like ZE/ZR) — those still represent
// real insured people for a total membership count, even though they're not mappable to
// a Swiss Prämienregion for pricing.

import { parse } from "csv-parse/sync";

export type ParseMemberCountsResult = {
  counts: Record<string, number>; // insurerCode (unpadded, matches INSURER_NAMES) -> total OKP Versichertenbestand, rounded
  year: number; // Geschäftsjahr — the file is expected to carry exactly one
  unmatchedCodes: Set<string>; // codes present in the file but not in insurerNames — excluded from counts
};

export function normalizeInsurerCode(raw: string): string {
  const n = Number(raw);
  if (!Number.isFinite(n)) throw new Error(`normalizeInsurerCode: unrecognized code "${raw}"`);
  return String(n);
}

export function parseMemberCounts(
  csvText: string,
  insurerNames: Record<string, string>,
): ParseMemberCountsResult {
  const records: Record<string, string>[] = parse(csvText, {
    columns: true,
    bom: true,
    trim: true,
    delimiter: ";",
  });

  const sums = new Map<string, number>();
  const years = new Set<string>();
  const unmatchedCodes = new Set<string>();

  for (const r of records) {
    const code = normalizeInsurerCode(r.Versicherer);
    years.add(r["Geschäftsjahr"]);

    if (!insurerNames[code]) {
      unmatchedCodes.add(code);
      continue;
    }

    sums.set(code, (sums.get(code) ?? 0) + Number(r.Durchschnittsbestand));
  }

  if (years.size !== 1) {
    throw new Error(
      `parseMemberCounts: expected exactly one Geschäftsjahr in the file, found ${[...years].join(", ")}`,
    );
  }

  const counts: Record<string, number> = {};
  for (const [code, total] of sums) counts[code] = Math.round(total);

  return { counts, year: Number([...years][0]), unmatchedCodes };
}
