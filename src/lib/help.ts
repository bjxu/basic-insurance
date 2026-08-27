// Newcomer help layer — shared term/anchor constants.
// Design: docs/superpowers/specs/2026-08-27-newcomer-help-layer-design.md
//
// Dependency-free (no imports from src/i18n or src/components) so it unit-tests
// in the node env like the rest of src/lib.

// Terms that get an inline ⓘ HelpTip: the three inputs, plus the two result-filter
// toggles (alternative models, accident coverage).
export const TERM_KEYS = ["plz", "birthYear", "franchise", "unfalldeckung", "models"] as const;
export type TermKey = (typeof TERM_KEYS)[number];

// Terms listed in the standalone /how-it-works guide (spec §"Content core").
// Currently identical to TERM_KEYS; kept as its own list so the guide and the
// inline set can diverge without a refactor.
export const GUIDE_TERM_KEYS = TERM_KEYS;
export type GuideTermKey = (typeof GUIDE_TERM_KEYS)[number];

// Section ids rendered by HowItWorksContent (drawer + /how-it-works page).
export const GUIDE_SECTION_IDS = ["regeln", "begriffe", "modelle"] as const;
export type GuideSectionId = (typeof GUIDE_SECTION_IDS)[number];

// Section id on /[locale]/how-it-works that each term's "full guide" link targets.
export const HELP_ANCHORS: Record<TermKey, GuideSectionId> = {
  plz: "begriffe",
  birthYear: "begriffe",
  franchise: "begriffe",
  unfalldeckung: "begriffe",
  models: "modelle",
};

// Coerce whatever a caller passed as the drawer's target section to a known id,
// or undefined. Guards the drawer's `querySelector("#" + section)` against bad
// input — notably a click handler wired as `onClick={onOpenGuide}`, which hands
// React's SyntheticEvent through as `section`.
export function normalizeGuideSection(section: unknown): GuideSectionId | undefined {
  return typeof section === "string" && (GUIDE_SECTION_IDS as readonly string[]).includes(section)
    ? (section as GuideSectionId)
    : undefined;
}

