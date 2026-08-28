// Coarse client-side bucketing of the visitor's age AT THE TIME OF THE VISIT
// (architecture.md §10.3). Unlike getAltersklasse (which uses the age reached
// during the selected premium year, and shifts with the year toggle — REQ-16),
// this always uses the real current year. Only the band string is ever sent to
// the server, so the inquiry log keeps no re-identifiable age (REQ-21).

export type AgeGroup =
  | "0" | "1-5" | "6-12" | "13-18" | "19-25" | "26-35" | "36-50" | "51-65" | "66+";

export const AGE_GROUPS: readonly AgeGroup[] = [
  "0", "1-5", "6-12", "13-18", "19-25", "26-35", "36-50", "51-65", "66+",
];

export function getAgeGroup(birthYear: number, visitYear: number): AgeGroup {
  const age = visitYear - birthYear;
  if (age <= 0) return "0";
  if (age <= 5) return "1-5";
  if (age <= 12) return "6-12";
  if (age <= 18) return "13-18";
  if (age <= 25) return "19-25";
  if (age <= 35) return "26-35";
  if (age <= 50) return "36-50";
  if (age <= 65) return "51-65";
  return "66+";
}
