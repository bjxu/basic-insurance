// Swiss-convention monetary formatting (requirement.md §9): apostrophe thousands
// separator, two decimal places, "CHF" prefix — identical across all UI languages,
// since this is a currency convention, not a language one.

function groupThousands(intPart: string): string {
  return intPart.replace(/\B(?=(\d{3})+(?!\d))/g, "'");
}

export function formatChf(amount: number): string {
  const parts = amount.toFixed(2).split(".");
  return `CHF ${groupThousands(parts[0])}.${parts[1]}`;
}

// Local to this module rather than imported from @/i18n/routing: src/lib is a
// dependency-free layer today (no imports from src/i18n or src/components), and
// these lookup maps only need the literal set of codes, not the routing config.
type Locale = "de" | "fr" | "it" | "en";

const MEMBER_COUNT_UNITS: Record<Locale, { million: string; thousand: string }> = {
  de: { million: "Mio.", thousand: "Tsd." },
  fr: { million: "mio", thousand: "k" },
  it: { million: "mio", thousand: "mila" },
  en: { million: "M", thousand: "k" },
};

// Abbreviated OKP enrollment count for the member-count badge (PlanRow). Real BAG 2024
// range: ~2'800 (smallest regional Kasse) to ~1.5 Mio. (largest).
//
// NOTE: the million/thousand cutover below effectively triggers starting ~950'000, not
// at a clean 1'000'000 — because the boundary check compares the *rounded-to-one-decimal*
// million value (e.g. 960'000 -> "1.0" -> >= 1.0 -> million unit), not the raw count
// against 1_000_000. This is intentional: it's what makes 999'999 round up to the
// "1.0 million" form instead of the confusing "1000 thousand" a naive
// `rounded >= 1_000_000` check would produce. Don't "fix" this back to a raw threshold
// without re-introducing that bug — see the formatMemberCount tests around
// 949'999/960'000/999'999 for the pinned behavior.
export function formatMemberCount(count: number, locale: string): string {
  const units = MEMBER_COUNT_UNITS[locale as Locale] ?? MEMBER_COUNT_UNITS.de;
  const rounded = Math.round(count);
  const milliFormat = (rounded / 1_000_000).toFixed(1);
  if (parseFloat(milliFormat) >= 1.0) return `${milliFormat} ${units.million}`;
  if (rounded >= 1_000) return `${Math.round(rounded / 1_000)} ${units.thousand}`;
  return String(rounded);
}

const INSURED_WORD: Record<Locale, string> = {
  de: "Versicherte",
  fr: "assurés",
  it: "assicurati",
  en: "insured",
};

const AS_OF_WORD: Record<Locale, string> = {
  de: "Stand",
  fr: "en",
  it: "nel",
  en: "as of",
};

// Exact count + the enrollment data's own publication year, for the badge's tooltip
// (the enrollment data lags the premium year — see Metadata.memberCountAsOf).
export function formatMemberCountDetail(count: number, asOfYear: number, locale: string): string {
  const insured = INSURED_WORD[locale as Locale] ?? INSURED_WORD.de;
  const asOf = AS_OF_WORD[locale as Locale] ?? AS_OF_WORD.de;
  return `${groupThousands(String(Math.round(count)))} ${insured} · ${asOf} ${asOfYear}`;
}

// Thousands-grouped integer count, no currency (admin dashboard stat/breakdown panels).
export function formatCount(n: number): string {
  return groupThousands(String(Math.round(n)));
}
