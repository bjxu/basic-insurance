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
// Mutuel Assurance — BAG codes 343/1535/1507/1479) don't share a single BAG code for
// "Groupe Mutuel" as a whole, so each is tracked as its own entry. comparis.ch rates
// three of them independently (Avenir/Philos/Mutuel Assurance, all 4.8 — apparently
// comparis scores the group once and applies it to each sub-brand it lists, rather than
// three genuinely distinct measurements); bonus.ch rates two (Avenir/Philos, not Mutuel
// Assurance); moneyland.ch rates the brand as a single 7.4 figure, applied here to
// whichever sub-brand already has at least one other real per-entity score (Avenir,
// Philos, Mutuel Assurance). AMB Assurances (1507) has no score from any of the three
// sources — not even a name match on comparis or bonus.ch's rated/unrated lists — so it
// has no entry; extending moneyland's brand-level figure to it alone, with zero
// corroboration, isn't the same situation as the other three.
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
//
// Update (2026-08-14, from a direct screenshot of comparis's own results table): 3 of
// the 5 originally-removed insurers have since requalified — comparis rates Avenir
// (343), Philos (1535), and Agrisano (1560) too, giving each a 2nd/3rd independent
// source. sodalis (941) and Galenos (1386) don't appear on comparis's table either, so
// they remain excluded (bonus.ch-only, still 1 source).

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
  sourceUrl: "https://www.bonus.ch/Krankenkasse/Note/KPT-CPT-Kundenzufriedenheitsumfrage.aspx",
} as const;

export const SERVICE_QUALITY_RATINGS: ServiceQualityRating[] = [
  { insurerCode: "8", sources: [{ ...MONEYLAND_2026, rawScore: 7.8 }, { ...COMPARIS_2026, rawScore: 4.9 }, { ...BONUS_CH_2026, rawScore: 5.2 }] }, // CSS
  { insurerCode: "32", sources: [{ ...COMPARIS_2026, rawScore: 5.0 }, { ...BONUS_CH_2026, rawScore: 5.4 }] }, // Aquilana
  { insurerCode: "290", sources: [{ ...MONEYLAND_2026, rawScore: 7.9 }, { ...COMPARIS_2026, rawScore: 5.0 }, { ...BONUS_CH_2026, rawScore: 5.2 }] }, // Concordia
  { insurerCode: "312", sources: [{ ...MONEYLAND_2026, rawScore: 7.9 }, { ...COMPARIS_2026, rawScore: 4.9 }, { ...BONUS_CH_2026, rawScore: 5.2 }] }, // Atupri
  { insurerCode: "343", sources: [{ ...MONEYLAND_2026, rawScore: 7.4 }, { ...COMPARIS_2026, rawScore: 4.8 }, { ...BONUS_CH_2026, rawScore: 5.2 }] }, // Avenir Assurance (Groupe Mutuel)
  { insurerCode: "376", sources: [{ ...MONEYLAND_2026, rawScore: 7.8 }, { ...COMPARIS_2026, rawScore: 5.0 }, { ...BONUS_CH_2026, rawScore: 5.1 }] }, // KPT
  { insurerCode: "455", sources: [{ ...MONEYLAND_2026, rawScore: 8.0 }, { ...COMPARIS_2026, rawScore: 5.1 }, { ...BONUS_CH_2026, rawScore: 5.3 }] }, // ÖKK
  { insurerCode: "509", sources: [{ ...MONEYLAND_2026, rawScore: 7.5 }, { ...COMPARIS_2026, rawScore: 4.9 }, { ...BONUS_CH_2026, rawScore: 5.2 }] }, // Sympany
  { insurerCode: "881", sources: [{ ...COMPARIS_2026, rawScore: 5.0 }, { ...BONUS_CH_2026, rawScore: 5.3 }] }, // EGK
  { insurerCode: "1384", sources: [{ ...MONEYLAND_2026, rawScore: 8.0 }, { ...COMPARIS_2026, rawScore: 5.1 }, { ...BONUS_CH_2026, rawScore: 5.4 }] }, // Swica
  { insurerCode: "1479", sources: [{ ...MONEYLAND_2026, rawScore: 7.4 }, { ...COMPARIS_2026, rawScore: 4.8 }] }, // Mutuel Assurance (Groupe Mutuel)
  { insurerCode: "1509", sources: [{ ...MONEYLAND_2026, rawScore: 8.0 }, { ...COMPARIS_2026, rawScore: 5.0 }, { ...BONUS_CH_2026, rawScore: 5.2 }] }, // Sanitas
  { insurerCode: "1535", sources: [{ ...MONEYLAND_2026, rawScore: 7.4 }, { ...COMPARIS_2026, rawScore: 4.8 }, { ...BONUS_CH_2026, rawScore: 5.2 }] }, // Philos Assurance (Groupe Mutuel)
  { insurerCode: "1542", sources: [{ ...MONEYLAND_2026, rawScore: 7.2 }, { ...COMPARIS_2026, rawScore: 4.7 }, { ...BONUS_CH_2026, rawScore: 4.9 }] }, // Assura
  { insurerCode: "1555", sources: [{ ...MONEYLAND_2026, rawScore: 7.9 }, { ...COMPARIS_2026, rawScore: 5.0 }, { ...BONUS_CH_2026, rawScore: 5.2 }] }, // Visana
  { insurerCode: "1560", sources: [{ ...COMPARIS_2026, rawScore: 4.8 }, { ...BONUS_CH_2026, rawScore: 5.2 }] }, // Agrisano
  { insurerCode: "1562", sources: [{ ...MONEYLAND_2026, rawScore: 8.0 }, { ...COMPARIS_2026, rawScore: 5.1 }, { ...BONUS_CH_2026, rawScore: 5.2 }] }, // Helsana
  { insurerCode: "1568", sources: [{ ...COMPARIS_2026, rawScore: 5.0 }, { ...BONUS_CH_2026, rawScore: 5.2 }] }, // sana24
];
