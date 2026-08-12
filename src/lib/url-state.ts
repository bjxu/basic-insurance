// URL ↔ app state encode/decode (architecture.md §5, REQ-11). Malformed or
// out-of-range values are dropped rather than thrown, so an edited shared URL
// degrades gracefully (§5.2).

import type { Tarifart } from "./types";

export type ComparisonState = {
  plz: string | null;
  bfsNr: number | null;
  birthYear: number | null;
  franchise: number | null;
  year: number | null;
  unfalldeckung: boolean;
  models: Tarifart[];
  currentInsurerCode: string | null;
  currentFranchise: number | null;
  currentTarifart: Tarifart | null;
  currentTarifCode: string | null;
  currentUnfalldeckung: boolean | null;
};

const VALID_TARIFARTEN: Tarifart[] = ["standard", "hmo", "hausarzt", "telmed", "andere"];

export function encodeState(state: ComparisonState): URLSearchParams {
  const params = new URLSearchParams();
  if (state.plz) params.set("plz", state.plz);
  if (state.bfsNr != null) params.set("bfs", String(state.bfsNr));
  if (state.birthYear != null) params.set("by", String(state.birthYear));
  if (state.franchise != null) params.set("fran", String(state.franchise));
  if (state.year != null) params.set("year", String(state.year));
  params.set("acc", state.unfalldeckung ? "1" : "0");
  if (state.models.length) params.set("models", state.models.join(","));
  if (state.currentInsurerCode) params.set("ci", state.currentInsurerCode);
  if (state.currentFranchise != null) params.set("cf", String(state.currentFranchise));
  if (state.currentTarifart) params.set("cm", state.currentTarifart);
  if (state.currentTarifCode) params.set("ct", state.currentTarifCode);
  if (state.currentUnfalldeckung != null) params.set("ca", state.currentUnfalldeckung ? "1" : "0");
  return params;
}

export function decodeState(params: URLSearchParams): ComparisonState {
  const plz = params.get("plz");
  const bfsRaw = params.get("bfs");
  const byRaw = params.get("by");
  const franRaw = params.get("fran");
  const yearRaw = params.get("year");
  const modelsRaw = params.get("models");
  const cfRaw = params.get("cf");
  const cmRaw = params.get("cm");
  const ctRaw = params.get("ct");
  const caRaw = params.get("ca");

  return {
    plz: plz && /^\d{4}$/.test(plz) ? plz : null,
    bfsNr: bfsRaw && /^\d+$/.test(bfsRaw) ? Number(bfsRaw) : null,
    birthYear: byRaw && /^\d{4}$/.test(byRaw) ? Number(byRaw) : null,
    franchise: franRaw && /^\d+$/.test(franRaw) ? Number(franRaw) : null,
    year: yearRaw && /^\d{4}$/.test(yearRaw) ? Number(yearRaw) : null,
    unfalldeckung: params.get("acc") !== "0", // included by default (§5.3)
    models: modelsRaw
      ? (modelsRaw.split(",").filter((m): m is Tarifart => VALID_TARIFARTEN.includes(m as Tarifart)))
      : ["standard"],
    currentInsurerCode: params.get("ci") || null,
    currentFranchise: cfRaw && /^\d+$/.test(cfRaw) ? Number(cfRaw) : null,
    currentTarifart: cmRaw && VALID_TARIFARTEN.includes(cmRaw as Tarifart) ? (cmRaw as Tarifart) : null,
    currentTarifCode: ctRaw || null,
    currentUnfalldeckung: caRaw === "0" || caRaw === "1" ? caRaw === "1" : null,
  };
}
