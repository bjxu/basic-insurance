// scripts/ingest/parseRegions.ts
//
// Parses BAG's "praemienregionen.xlsx" sheet A_COM into the Gemeinde/PLZ/region
// shapes src/lib/location.ts already expects (architecture.md §3.2). Verified against
// the live file during planning (2026-08-11): columns are
// [BFS-Nr, Kanton, Gemeinde, Region, Bezirk, PLZ, Ort]; a Gemeinde can have several
// PLZ and a PLZ can span several Gemeinden (possibly in different regions — the
// REQ-1 disambiguation case).

import type { Gemeinde } from "../../src/lib/types";

export type RawRegionRow = (string | number)[];

export type ParseRegionsResult = {
  gemeinden: Gemeinde[];
  plzMap: Record<string, Gemeinde[]>;
  gemeindeRegionMap: Record<string, string>;
};

export function parseRegionRows(rows: RawRegionRow[]): ParseRegionsResult {
  const gemeindeByBfsNr = new Map<number, Gemeinde>();
  const plzMap: Record<string, Gemeinde[]> = {};

  for (const row of rows) {
    const bfsNr = Number(row[0]);
    const kanton = String(row[1]);
    const name = String(row[2]);
    const region = String(row[3]);
    const plz = String(row[5]);

    if (!Number.isFinite(bfsNr) || !kanton || !name || !region || !plz) {
      throw new Error(`parseRegionRows: malformed row ${JSON.stringify(row)}`);
    }

    const praemienregionId = `${kanton}-${region}`;
    const existing = gemeindeByBfsNr.get(bfsNr);
    if (existing && existing.praemienregionId !== praemienregionId) {
      throw new Error(
        `parseRegionRows: Gemeinde ${bfsNr} (${name}) has conflicting regions ` +
          `${existing.praemienregionId} and ${praemienregionId}`,
      );
    }

    const gemeinde: Gemeinde = existing ?? { bfsNr, name, kanton, praemienregionId };
    gemeindeByBfsNr.set(bfsNr, gemeinde);

    const list = (plzMap[plz] ??= []);
    if (!list.some((g) => g.bfsNr === bfsNr)) list.push(gemeinde);
  }

  const gemeinden = Array.from(gemeindeByBfsNr.values());
  const gemeindeRegionMap: Record<string, string> = {};
  for (const g of gemeinden) gemeindeRegionMap[String(g.bfsNr)] = g.praemienregionId;

  return { gemeinden, plzMap, gemeindeRegionMap };
}
