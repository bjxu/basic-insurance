// Newcomer help layer — shared constants and first-run persistence.
// Design: docs/superpowers/specs/2026-08-27-newcomer-help-layer-design.md
//
// Dependency-free (no imports from src/i18n or src/components) so it unit-tests
// in the node env like the rest of src/lib.

export const TERM_KEYS = ["plz", "birthYear", "franchise", "models"] as const;
export type TermKey = (typeof TERM_KEYS)[number];

// Section id on /[locale]/how-it-works that each term's "full guide" link targets.
export const HELP_ANCHORS: Record<TermKey, string> = {
  plz: "begriffe",
  birthYear: "begriffe",
  franchise: "begriffe",
  models: "modelle",
};

export const HELP_SEEN_KEY = "prixio.help.seen";

// True only when the user has dismissed the first-run card before. Any failure
// mode — SSR, private-mode localStorage, blocked storage — reads as "not seen",
// so the card shows again rather than an error surfacing (REQ-29).
export function readHelpSeen(): boolean {
  try {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(HELP_SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

export function markHelpSeen(): void {
  try {
    window.localStorage.setItem(HELP_SEEN_KEY, "1");
  } catch {
    // localStorage unavailable (private mode, blocked cookies). The card just
    // reappears next visit — not worth surfacing.
  }
}
