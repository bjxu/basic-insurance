// Coarse client-side bucketing of the user's age, derived from the birth year
// they entered (architecture.md §10.3). The birth year and exact age are never
// sent to the server — only the band string — so the inquiry log keeps no
// re-identifiable age. Boundaries at 18 and 25 mirror the statutory
// Altersklasse split (src/lib/ageband.ts); the rest are decades.

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
