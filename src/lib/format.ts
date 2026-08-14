// Swiss-convention monetary formatting (requirement.md §9): apostrophe thousands
// separator, two decimal places, "CHF" prefix.

function groupThousands(intPart: string): string {
  return intPart.replace(/\B(?=(\d{3})+(?!\d))/g, "'");
}

export function formatChf(amount: number): string {
  const parts = amount.toFixed(2).split(".");
  return `CHF ${groupThousands(parts[0])}.${parts[1]}`;
}

// Abbreviated OKP enrollment count for the member-count badge (PlanRow). Real BAG 2024
// range: ~2'800 (smallest regional Kasse) to ~1.5 Mio. (largest).
export function formatMemberCount(count: number): string {
  const rounded = Math.round(count);
  const milliFormat = (rounded / 1_000_000).toFixed(1);
  if (parseFloat(milliFormat) >= 1.0) return `${milliFormat} Mio.`;
  if (rounded >= 1_000) return `${Math.round(rounded / 1_000)} Tsd.`;
  return String(rounded);
}

// Exact count + the enrollment data's own publication year, for the badge's tooltip
// (the enrollment data lags the premium year — see Metadata.memberCountAsOf).
export function formatMemberCountDetail(count: number, asOfYear: number): string {
  return `${groupThousands(String(Math.round(count)))} Versicherte · Stand ${asOfYear}`;
}
