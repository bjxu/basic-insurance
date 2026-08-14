import type { ServiceQualityRating } from "./types";

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
//
// NOTE: the Mio./Tsd. cutover below effectively triggers starting ~950'000, not at a
// clean 1'000'000 — because the boundary check compares the *rounded-to-one-decimal*
// Mio. value (e.g. 960'000 -> "1.0" -> >= 1.0 -> "1.0 Mio."), not the raw count against
// 1_000_000. This is intentional: it's what makes 999'999 round up to "1.0 Mio." instead
// of the confusing "1000 Tsd." a naive `rounded >= 1_000_000` check would produce. Don't
// "fix" this back to a raw threshold without re-introducing that bug — see the
// formatMemberCount tests around 949'999/960'000/999'999 for the pinned behavior.
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

// Disclosed cross-source average for the service-quality badge (PlanRow). "Ø" (German
// for "average") is part of the label deliberately — the badge shouldn't read as more
// authoritative than an average across differing methodologies actually is. See
// docs/superpowers/specs/2026-08-14-service-quality-badge-design.md.
export function formatServiceQualityPct(pct: number): string {
  return `Ø ${Math.round(pct)}%`;
}

// Full disclosure for the badge's tooltip: every contributing source's own raw score
// and scale, not just the blended output, so a skeptical user can see exactly what was
// averaged.
export function formatServiceQualityDetail(rating: ServiceQualityRating, averagePct: number): string {
  const year = rating.sources[0].sourceYear;
  const count = rating.sources.length;
  const header = `${formatServiceQualityPct(averagePct)} aus ${count} Quelle${count === 1 ? "" : "n"} (${year})`;
  const lines = rating.sources.map((s) => `${s.sourceName}: ${s.rawScore.toFixed(1)}/${s.scaleMax}`);
  return [header, ...lines].join("\n");
}
