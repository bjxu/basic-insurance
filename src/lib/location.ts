// PLZ → Gemeinde(n) → Prämienregion resolution (requirement.md §6.2).

import type { Gemeinde } from "./types";
import plzMap from "@/data/plz-map.json";
import gemeindeMap from "@/data/gemeinde-region-map.json";

type PlzMap = Record<string, Gemeinde[]>;

/** Returns the Gemeinde(n) a PLZ maps to. Empty array = unrecognized PLZ (REQ-13). */
export function resolveGemeinden(plz: string): Gemeinde[] {
  return (plzMap as PlzMap)[plz] ?? [];
}

/** True when the PLZ spans more than one premium region and needs disambiguation (REQ-1). */
export function needsDisambiguation(gemeinden: Gemeinde[]): boolean {
  const regions = new Set(gemeinden.map((g) => g.praemienregionId));
  return regions.size > 1;
}

export function getPraemienregion(bfsNr: number): string | null {
  return (gemeindeMap as Record<string, string>)[String(bfsNr)] ?? null;
}
