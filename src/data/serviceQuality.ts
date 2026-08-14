// Hand-maintained, NOT part of the automated BAG ingest pipeline (scripts/ingest.ts).
// Sources: three Swiss consumer-satisfaction surveys, none of them open/licensed data
// — see docs/superpowers/specs/2026-08-14-service-quality-badge-design.md for the full
// provenance/legal reasoning. Re-verify and update by hand whenever a source publishes
// a new edition; there is no automated feed.
//
// Correction (2026-08-14, from a direct screenshot of moneyland's own results table):
// moneyland.ch's 2026 "Gesamtzufriedenheit" table covers 12 insurers, not 7 — a prior
// version of this file, based on an indirect web-search summary, undercounted it at 7
// and separately claimed Groupe Mutuel's figure was a different metric (6.5,
// "price/value only"). Neither claim survived checking the real table: Groupe Mutuel
// appears in the same Punkte/Note columns as every other insurer, scored 7.4 ("Gut") —
// the same "Gesamtzufriedenheit" scale as the rest, not a separate metric. The 7
// insurers already in this file matched the real table exactly; the correction only
// adds the 5 that were missing (CSS, KPT, Sympany, Groupe Mutuel, Assura).
//
// Groupe Mutuel's sub-brands (Avenir Assurance, Philos Assurance, AMB Assurances,
// Mutuel Assurance — BAG codes 343/1535/1507/1479) are rated independently by bonus.ch —
// there's still no single BAG code for "Groupe Mutuel" as a whole. moneyland's
// brand-level 7.4 is applied to Avenir (343) and Philos (1535), the two sub-brands that
// already carry their own bonus.ch score — each now has 2 independent sources and
// requalifies under the >=2-source policy below. AMB (1507) and Mutuel Assurance (1479)
// have no other source, so a moneyland-only entry for either would still fail that
// policy — they're not added.
//
// Policy: a badge requires at least 2 independent sources. A final whole-branch review
// (2026-08-14) found 5 insurers relying on bonus.ch as their SOLE source — Avenir
// Assurance (343), sodalis (941), Galenos (1386), Philos Assurance (1535), Agrisano
// (1560) — and removed them. bonus.ch normalizes higher than moneyland/comparis once on
// a common 0-100% scale, so single-bonus.ch-source insurers were showing HIGHER badges
// than Helsana/Swica/ÖKK, which are tied for first place in all 3 real surveys —
// a misleading cross-row ranking. bonus.ch also has undisclosed methodology and an
// insurance-broker conflict of interest (see "Data provenance & legal read" in the
// design doc) — the same "too conflicted to use alone" problem the design spec already
// used to reject the HSLU/IFZ source. Requiring >=2 independent sources means no single
// conflicted/undisclosed source can, by itself, produce a badge.

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

// bonus.ch doesn't date-stamp its rankings the way moneyland/comparis publish dated
// editions — 2026 here is the retrieval/verification date during planning, not a
// confirmed bonus.ch publication year. Don't read this as "bonus.ch's 2026 edition."
const BONUS_CH_2026 = {
  sourceName: "bonus.ch",
  scaleMax: 6,
  sourceYear: 2026,
  sourceUrl: "https://www.bonus.ch/Krankenkasse/Vergleich/Krankenkassenpraemie.aspx",
} as const;

export const SERVICE_QUALITY_RATINGS: ServiceQualityRating[] = [
  { insurerCode: "8", sources: [{ ...MONEYLAND_2026, rawScore: 7.8 }, { ...COMPARIS_2026, rawScore: 4.9 }, { ...BONUS_CH_2026, rawScore: 5.2 }] }, // CSS
  { insurerCode: "32", sources: [{ ...COMPARIS_2026, rawScore: 5.0 }, { ...BONUS_CH_2026, rawScore: 5.4 }] }, // Aquilana
  { insurerCode: "290", sources: [{ ...MONEYLAND_2026, rawScore: 7.9 }, { ...COMPARIS_2026, rawScore: 5.0 }, { ...BONUS_CH_2026, rawScore: 5.2 }] }, // Concordia
  { insurerCode: "312", sources: [{ ...MONEYLAND_2026, rawScore: 7.9 }, { ...COMPARIS_2026, rawScore: 4.9 }, { ...BONUS_CH_2026, rawScore: 5.2 }] }, // Atupri
  { insurerCode: "343", sources: [{ ...MONEYLAND_2026, rawScore: 7.4 }, { ...BONUS_CH_2026, rawScore: 5.2 }] }, // Avenir Assurance (Groupe Mutuel)
  { insurerCode: "376", sources: [{ ...MONEYLAND_2026, rawScore: 7.8 }, { ...COMPARIS_2026, rawScore: 5.0 }, { ...BONUS_CH_2026, rawScore: 5.1 }] }, // KPT
  { insurerCode: "455", sources: [{ ...MONEYLAND_2026, rawScore: 8.0 }, { ...COMPARIS_2026, rawScore: 5.1 }, { ...BONUS_CH_2026, rawScore: 5.3 }] }, // ÖKK
  { insurerCode: "509", sources: [{ ...MONEYLAND_2026, rawScore: 7.5 }, { ...COMPARIS_2026, rawScore: 4.9 }, { ...BONUS_CH_2026, rawScore: 5.2 }] }, // Sympany
  { insurerCode: "881", sources: [{ ...COMPARIS_2026, rawScore: 5.0 }, { ...BONUS_CH_2026, rawScore: 5.3 }] }, // EGK
  { insurerCode: "1384", sources: [{ ...MONEYLAND_2026, rawScore: 8.0 }, { ...COMPARIS_2026, rawScore: 5.1 }, { ...BONUS_CH_2026, rawScore: 5.4 }] }, // Swica
  { insurerCode: "1509", sources: [{ ...MONEYLAND_2026, rawScore: 8.0 }, { ...COMPARIS_2026, rawScore: 5.0 }, { ...BONUS_CH_2026, rawScore: 5.2 }] }, // Sanitas
  { insurerCode: "1535", sources: [{ ...MONEYLAND_2026, rawScore: 7.4 }, { ...BONUS_CH_2026, rawScore: 5.2 }] }, // Philos Assurance (Groupe Mutuel)
  { insurerCode: "1542", sources: [{ ...MONEYLAND_2026, rawScore: 7.2 }, { ...COMPARIS_2026, rawScore: 4.7 }, { ...BONUS_CH_2026, rawScore: 4.9 }] }, // Assura
  { insurerCode: "1555", sources: [{ ...MONEYLAND_2026, rawScore: 7.9 }, { ...COMPARIS_2026, rawScore: 5.0 }, { ...BONUS_CH_2026, rawScore: 5.2 }] }, // Visana
  { insurerCode: "1562", sources: [{ ...MONEYLAND_2026, rawScore: 8.0 }, { ...COMPARIS_2026, rawScore: 5.1 }, { ...BONUS_CH_2026, rawScore: 5.2 }] }, // Helsana
  { insurerCode: "1568", sources: [{ ...COMPARIS_2026, rawScore: 5.0 }, { ...BONUS_CH_2026, rawScore: 5.2 }] }, // sana24
];
