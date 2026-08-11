// Age band = age reached during the calendar year (year - birthYear).
// Confirmed against BAG data documentation (requirement.md open question §11.1).

import type { Altersklasse } from "./types";

export function getAltersklasse(birthYear: number, calendarYear: number): Altersklasse {
  const age = calendarYear - birthYear;
  if (age <= 18) return "kind";
  if (age <= 25) return "jung";
  return "erwachsen";
}

const CHILD_FRANCHISE_TIERS = [0, 100, 200, 300, 400, 500, 600];
const ADULT_FRANCHISE_TIERS = [300, 500, 1000, 1500, 2000, 2500];

export function getFranchiseTiers(altersklasse: Altersklasse): number[] {
  return altersklasse === "kind" ? CHILD_FRANCHISE_TIERS : ADULT_FRANCHISE_TIERS;
}
