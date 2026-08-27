// Newcomer help layer — shared term/anchor constants.
// Design: docs/superpowers/specs/2026-08-27-newcomer-help-layer-design.md
//
// Dependency-free (no imports from src/i18n or src/components) so it unit-tests
// in the node env like the rest of src/lib.

// Terms that get an inline ⓘ HelpTip (REQ-28: inputs + model badge only).
export const TERM_KEYS = ["plz", "birthYear", "franchise", "models"] as const;
export type TermKey = (typeof TERM_KEYS)[number];

// Terms listed in the standalone /how-it-works guide (spec §"Content core").
// Superset of TERM_KEYS: adds "unfalldeckung", which is explained in the guide
// only — it has no inline ⓘ and no HELP_ANCHORS entry.
export const GUIDE_TERM_KEYS = [
  "plz",
  "birthYear",
  "franchise",
  "unfalldeckung",
  "models",
] as const;
export type GuideTermKey = (typeof GUIDE_TERM_KEYS)[number];

// Section id on /[locale]/how-it-works that each term's "full guide" link targets.
export const HELP_ANCHORS: Record<TermKey, string> = {
  plz: "begriffe",
  birthYear: "begriffe",
  franchise: "begriffe",
  models: "modelle",
};

