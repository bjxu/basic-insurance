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

// Coarse client-side bucketing of the user's age, derived from the birth year
// they entered (architecture.md §10.3). The birth year and exact age are never
// sent to the server — only the band string — so the inquiry log keeps no
// re-identifiable age. Boundaries at 18 and 25 mirror the statutory
// Altersklasse split above; the rest are decades.

export type AgeBand =
  | "0-18" | "19-25" | "26-35" | "36-45" | "46-55" | "56-65" | "66-75" | "76+";

export const AGE_BANDS: readonly AgeBand[] = [
  "0-18", "19-25", "26-35", "36-45", "46-55", "56-65", "66-75", "76+",
];

export function ageBand(age: number): AgeBand | null {
  if (!Number.isFinite(age) || age < 0) return null;
  if (age <= 18) return "0-18";
  if (age <= 25) return "19-25";
  if (age <= 35) return "26-35";
  if (age <= 45) return "36-45";
  if (age <= 55) return "46-55";
  if (age <= 65) return "56-65";
  if (age <= 75) return "66-75";
  return "76+";
}
