// Hand-maintained, NOT part of the automated BAG ingest pipeline (scripts/ingest.ts).
// Sources: three Swiss consumer-satisfaction surveys, none of them open/licensed data
// — see docs/superpowers/specs/2026-08-14-service-quality-badge-design.md for the full
// provenance/legal reasoning. Re-verify and update by hand whenever a source publishes
// a new edition; there is no automated feed.
//
// Deliberately excluded: moneyland.ch's 2026 Groupe Mutuel figure (6.5) measures
// price/value, not "Gesamtzufriedenheit" like its other 7 scores — not the same metric,
// so not included here as if comparable.
//
// Groupe Mutuel's sub-brands (Avenir Assurance, Philos Assurance, AMB Assurances,
// Mutuel Assurance — BAG codes 343/1535/1507/1479) are rated independently by bonus.ch,
// not as one combined "Groupe Mutuel" figure — each gets its own entry below, no
// duplication needed.

import type { ServiceQualityRating } from "@/lib/types";

const MONEYLAND_2026 = {
  sourceName: "moneyland.ch",
  scaleMax: 10,
  sourceYear: 2026,
  sourceUrl: "https://www.moneyland.ch/de/krankenkassen-zufriedenheit-2026",
} as const;

const COMPARIS_2026 = {
  sourceName: "comparis.ch",
  scaleMax: 6,
  sourceYear: 2026,
  sourceUrl: "https://www.presseportal.ch/de/pm/100003671/100941089",
} as const;

const BONUS_CH_2026 = {
  sourceName: "bonus.ch",
  scaleMax: 6,
  sourceYear: 2026,
  sourceUrl: "https://www.bonus.ch/Krankenkasse/Vergleich/Krankenkassenpraemie.aspx",
} as const;

export const SERVICE_QUALITY_RATINGS: ServiceQualityRating[] = [
  { insurerCode: "8", sources: [{ ...COMPARIS_2026, rawScore: 4.9 }, { ...BONUS_CH_2026, rawScore: 5.2 }] }, // CSS
  { insurerCode: "32", sources: [{ ...COMPARIS_2026, rawScore: 5.0 }, { ...BONUS_CH_2026, rawScore: 5.4 }] }, // Aquilana
  { insurerCode: "290", sources: [{ ...MONEYLAND_2026, rawScore: 7.9 }, { ...COMPARIS_2026, rawScore: 5.0 }, { ...BONUS_CH_2026, rawScore: 5.2 }] }, // Concordia
  { insurerCode: "312", sources: [{ ...MONEYLAND_2026, rawScore: 7.9 }, { ...COMPARIS_2026, rawScore: 4.9 }, { ...BONUS_CH_2026, rawScore: 5.2 }] }, // Atupri
  { insurerCode: "343", sources: [{ ...BONUS_CH_2026, rawScore: 5.2 }] }, // Avenir Assurance (Groupe Mutuel)
  { insurerCode: "376", sources: [{ ...COMPARIS_2026, rawScore: 5.0 }, { ...BONUS_CH_2026, rawScore: 5.1 }] }, // KPT
  { insurerCode: "455", sources: [{ ...MONEYLAND_2026, rawScore: 8.0 }, { ...COMPARIS_2026, rawScore: 5.1 }, { ...BONUS_CH_2026, rawScore: 5.3 }] }, // ÖKK
  { insurerCode: "509", sources: [{ ...COMPARIS_2026, rawScore: 4.9 }, { ...BONUS_CH_2026, rawScore: 5.2 }] }, // Sympany
  { insurerCode: "881", sources: [{ ...COMPARIS_2026, rawScore: 5.0 }, { ...BONUS_CH_2026, rawScore: 5.3 }] }, // EGK
  { insurerCode: "941", sources: [{ ...BONUS_CH_2026, rawScore: 5.2 }] }, // sodalis
  { insurerCode: "1384", sources: [{ ...MONEYLAND_2026, rawScore: 8.0 }, { ...COMPARIS_2026, rawScore: 5.1 }, { ...BONUS_CH_2026, rawScore: 5.4 }] }, // Swica
  { insurerCode: "1386", sources: [{ ...BONUS_CH_2026, rawScore: 5.2 }] }, // Galenos
  { insurerCode: "1509", sources: [{ ...MONEYLAND_2026, rawScore: 8.0 }, { ...COMPARIS_2026, rawScore: 5.0 }, { ...BONUS_CH_2026, rawScore: 5.2 }] }, // Sanitas
  { insurerCode: "1535", sources: [{ ...BONUS_CH_2026, rawScore: 5.2 }] }, // Philos Assurance (Groupe Mutuel)
  { insurerCode: "1542", sources: [{ ...COMPARIS_2026, rawScore: 4.7 }, { ...BONUS_CH_2026, rawScore: 4.9 }] }, // Assura
  { insurerCode: "1555", sources: [{ ...MONEYLAND_2026, rawScore: 7.9 }, { ...COMPARIS_2026, rawScore: 5.0 }, { ...BONUS_CH_2026, rawScore: 5.2 }] }, // Visana
  { insurerCode: "1560", sources: [{ ...BONUS_CH_2026, rawScore: 5.2 }] }, // Agrisano
  { insurerCode: "1562", sources: [{ ...MONEYLAND_2026, rawScore: 8.0 }, { ...COMPARIS_2026, rawScore: 5.1 }, { ...BONUS_CH_2026, rawScore: 5.2 }] }, // Helsana
  { insurerCode: "1568", sources: [{ ...COMPARIS_2026, rawScore: 5.0 }, { ...BONUS_CH_2026, rawScore: 5.2 }] }, // sana24
];
