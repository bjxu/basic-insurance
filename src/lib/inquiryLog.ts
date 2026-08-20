// Builds the /api/log-inquiry request payload from the comparator's resolved
// query state (REQ-21, architecture.md §10.1). Pure: the caller decides when
// to fire the request (debounced, on the fields below changing) — this module
// only decides whether there's a loggable query yet and what it looks like.

import { ALL_TARIFARTS } from "./lookup";
import type { Tarifart } from "./types";

export type InquiryLogPayload = {
  regionId: string;
  altersklasse: string;
  franchise: number;
  year: number;
  models: Tarifart[];
  accident: boolean;
};

export function buildInquiryLogPayload(input: {
  praemienregionId: string | null;
  altersklasse: string | null;
  franchise: number | null;
  year: number;
  altModelsActive: boolean;
  unfalldeckung: boolean;
}): InquiryLogPayload | null {
  if (!input.praemienregionId || !input.altersklasse || !input.franchise) return null;

  return {
    regionId: input.praemienregionId,
    altersklasse: input.altersklasse,
    franchise: input.franchise,
    year: input.year,
    models: input.altModelsActive ? ALL_TARIFARTS : ["standard"],
    accident: input.unfalldeckung,
  };
}
