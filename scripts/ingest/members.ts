//
// Parses BAG's "Versichertenbestand_CH.csv" (per-insurer, per-canton OKP enrollment)
// into per-insurer national totals. This is a separate BAG file from Praemien_CH.csv, with
// its own quirks handled here. Both have varied by year rather than being fixed facts:
// delimiter was semicolon in 2026, comma in 2027 (both recognized below); the Versicherer
// code was zero-padded in 2026's file ("0008") and unpadded in 2027's ("8") —
// normalizeInsurerCode handles either via Number() round-tripping. Column mapping
// verified against the live file during planning (2026-08-14) — see
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
  // 2026's file is semicolon-delimited; 2027's is comma-delimited. csv-parse auto-detects
  // which of these two is actually used per call, so both are listed rather than picking one.
  const records: Record<string, string>[] = parse(csvText, {
    columns: true,
    bom: true,
    trim: true,
    delimiter: [";", ","],
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

    const value = Number(r.Durchschnittsbestand);
    if (!Number.isFinite(value)) {
      throw new Error(
        `parseMemberCounts: non-numeric Durchschnittsbestand "${r.Durchschnittsbestand}" for code ${code}`,
      );
    }
    sums.set(code, (sums.get(code) ?? 0) + value);
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
