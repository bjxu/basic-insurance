// Builds the /api/log-inquiry request payload from the comparator's resolved
// query state (REQ-21, architecture.md §10.1). Pure: the caller decides when
// to fire the request (debounced, on the fields below changing) — this module
// only decides whether there's a loggable query yet and what it looks like.

import { ALL_TARIFARTS } from "./lookup";
import { premiumBand, type PremiumBand } from "./premiumBand";
import { ageBand, type AgeBand } from "./ageBand";
import type { Tarifart } from "./types";

export type InquiryLogPayload = {
  regionId: string;
  altersklasse: string;
  franchise: number;
  year: number;
  models: Tarifart[];
  accident: boolean;
  locale: string;
  currentInsurer?: string;
  currentPremiumBand?: PremiumBand;
  ageBand?: AgeBand;
};

export function buildInquiryLogPayload(input: {
  praemienregionId: string | null;
  altersklasse: string | null;
  franchise: number | null;
  year: number;
  altModelsActive: boolean;
  unfalldeckung: boolean;
  locale: string;
  currentInsurerCode: string | null;
  currentMonthlyPremium: number | null;
  birthYear: number | null;
}): InquiryLogPayload | null {
  if (!input.praemienregionId || !input.altersklasse || !input.franchise) return null;

  const payload: InquiryLogPayload = {
    regionId: input.praemienregionId,
    altersklasse: input.altersklasse,
    franchise: input.franchise,
    year: input.year,
    models: input.altModelsActive ? ALL_TARIFARTS : ["standard"],
    accident: input.unfalldeckung,
    locale: input.locale,
  };

  if (input.currentInsurerCode) {
    payload.currentInsurer = input.currentInsurerCode;
  }

  const band =
    input.currentMonthlyPremium != null ? premiumBand(input.currentMonthlyPremium) : null;
  if (band) {
    payload.currentPremiumBand = band;
  }

  const age = input.birthYear != null ? ageBand(input.year - input.birthYear) : null;
  if (age) {
    payload.ageBand = age;
  }

  return payload;
}
