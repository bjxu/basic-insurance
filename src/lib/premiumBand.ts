// Coarse client-side bucketing of the user's self-reported current premium
// (architecture.md §10.3). The exact figure is never sent to the server —
// only the band string — so the inquiry log keeps no re-identifiable premium.

export type PremiumBand = "<250" | "250-349" | "350-449" | "450-549" | "550+";

export const PREMIUM_BANDS: readonly PremiumBand[] = [
  "<250",
  "250-349",
  "350-449",
  "450-549",
  "550+",
];

export function premiumBand(chf: number): PremiumBand | null {
  if (!Number.isFinite(chf) || chf <= 0) return null;
  if (chf < 250) return "<250";
  if (chf < 350) return "250-349";
  if (chf < 450) return "350-449";
  if (chf < 550) return "450-549";
  return "550+";
}
