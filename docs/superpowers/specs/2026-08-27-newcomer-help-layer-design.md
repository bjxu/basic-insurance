# Newcomer Help Layer — Design

**Date:** 2026-08-27
**Status:** Approved

## Problem

The comparator is built for someone who already knows the Swiss basic-insurance
system: the inputs are named in domain terms (*Franchise*, *Prämienregion*,
*Altersklasse*, *Unfalldeckung*, *Tarifart*), the [domain glossary](../../../requirement.md)
that explains them lives only in the requirements doc, and nothing on the page tells a
newcomer how the system works — that it is mandatory, that basic coverage is identical
by law at every insurer, that you get three months to sign up after moving, that you
can switch once a year. Someone who just moved to Switzerland lands on a form they
can't fill in with confidence.

This spec adds an **ambient, optional help layer** for that user without changing the
fast path for everyone else. It is Spec A of a two-part initiative; the opt-in
step-by-step **guided mode** and the interactive **franchise break-even helper** are
Spec B, deferred.

Ranked gaps this closes (from brainstorming): vocabulary first, system mechanics
second, decision confidence third.

> **Amendment (2026-08-27, post-implementation):**
> 1. The dismissible first-run card was dropped after review — on a first visit it
>    stacked with the always-present banner and both opened the same guide. The quiet
>    always-present banner is now the sole newcomer entry point; the `localStorage`
>    first-run tracking is gone.
> 2. The insurance-model ⓘ moved from every result row to a single trigger next to the
>    "alternative models" filter toggle (it was redundant on ~30 rows).
> 3. The Layer-3 "full explainer" link opens the guide drawer scrolled to the section
>    (as this spec's Layer 3 always described) — an interim implementation had it
>    navigate to the standalone page instead.
>
> Sections below are updated to match.

## Constraints

`requirement.md` Core Principle #4 (minimal friction — one page, no wizard, no required
navigation, no submit step) stands. Everything here is ambient or opt-in: a persistent
one-liner, a quiet always-present banner, an opt-in ⓘ, an opt-in guide. Nothing adds a
required step or blocks the input→results flow.

`requirement.md` Core Principle #2 (pure comparison tool) also stands: the help
explains the system and the terms. It gives no insurer-specific advice and makes no
"you should pick X" recommendation.

## Content core

One set of plain-language copy, authored in German and translated to FR/IT/EN (later
ES/PT), living as message-file entries under a new **`help`** namespace — the same
system as all other UI copy (`src/messages/{de,fr,it,en}.json`). No separate content
module, no CMS.

Three content areas:

1. **Term explainers.** One entry each for: Franchise, Prämienregion, Altersklasse,
   Unfalldeckung, Tarifart / insurance models, the member-count badge (REQ-24), the
   discount badge (REQ-23). Each entry has:
   - a **one-liner** — the single most useful fact, one line;
   - a **short form** — 2–3 sentences: what it is, what choosing it does, the honest
     tradeoff.
2. **How the system works.** Mandatory (OKP); sign up within three months of moving,
   cover backdated to arrival; every insurer must accept you for basic insurance, no
   health questions; you can switch insurer once a year, notice by 30 November, new
   cover 1 January; basic coverage is set by federal law and is therefore identical at
   every insurer — a cheaper insurer is not "less" insurance, you are only shopping on
   price, model, and service.
3. **What you give up with an alternative model.** Telmed / Hausarzt / HMO framed as
   "who you contact first," with the tradeoff stated plainly: a lower premium in
   exchange for less freedom over your first point of contact. Reuses the same
   tarifart descriptions the result rows already carry (REQ-4), expanded.

The term one-liners and short forms are the exact text shown by both the inline layer
(§Inline help) and the guide (§Explainer surfaces) — one source, two renderings.

## Inline help — three layers

### Layer 1 — persistent one-liner

An always-visible single line beneath each of the three inputs and on the model-badge
row of each result. The birth-year field already does this ("→ Erwachsen (26+) ·
Franchise CHF 300–2500"); this generalises the pattern:

| Anchor | One-liner (DE, indicative) |
|---|---|
| PLZ | "Bestimmt deine Prämienregion — Prämien unterscheiden sich nach Gemeinde, nicht nur Kanton." |
| Jahrgang | *(unchanged — the existing age-band / franchise-tier line)* |
| Franchise | "Eine höhere Franchise senkt deine monatliche Prämie." |
| Model badge | *(unchanged — the existing one-line restriction note, REQ-4)* |

### Layer 2 — ⓘ trigger → short form

A small ⓘ button next to each field label, plus one next to the "alternative models"
filter toggle for the insurance-model concept (one ⓘ, not one per result row — the
per-row model badge keeps only its Layer-1 restriction note). Activating it shows that
concept's short-form explainer. Responsive rendering:

- **Wide viewport (≥ the existing `sm` breakpoint):** an anchored **popover** —
  dismiss on tap-away, Esc, or re-activating the trigger; does not shift layout.
- **Narrow viewport:** an **inline disclosure** — the explainer expands in place under
  the field, pushing subsequent content down, like a native `<details>`.

Both renderings are keyboard-operable: the trigger is a `<summary>` (implicit button
role + `aria-expanded`); Esc or re-activating the trigger closes it and focus stays on
the trigger. The popover is dismissed on outside click; the disclosure is not modal.

The **models** popover additionally renders a grouped breakdown — one line per BAG
Tarifart (`Standard: …`, `Hausarzt: …`, `Telmed: …`, `HMO: …`, `Alternativmodell: …`)
from the shared `copy.tarifart.*` catalog (`ModelList` component, reused by the guide's
models section). The generic `help.terms.models.short` above it is trimmed to a
one-sentence framing.

### Layer 3 — "Full explainer →" link

Every popover / disclosure ends with a link that opens the drawer (§Explainer
surfaces) scrolled to the matching section.

## Explainer surfaces — drawer + standalone page

### Banner

At the top of the input card, above the heading row, an always-present banner:

> 🇨🇭 New to Swiss basic insurance? — **How the system works →**

(localised). Activating it opens the drawer.

### Drawer

An on-page slide-over: scrim behind, the comparator stays mounted underneath, closes
on Esc / ✕ / scrim click, focus trapped while open, returns focus to the banner on
close. Holds the essentials of all three content areas (§Content core). Footer link:
**"Read the full guide →"**, which navigates to the standalone page.

### Standalone page — `/[locale]/how-it-works`

- Lives under the existing `[locale]` segment; one URL per locale
  (`/de/how-it-works`, `/fr/…`, `/it/…`, `/en/…`).
- Full-length versions of the same three content areas.
- Indexable (unlike the parameterised comparison URLs): added to `sitemap.ts` (one
  entry per locale), per-locale `generateMetadata`, `hreflang` alternates including
  `x-default`. This is a single evergreen guide, distinct from the per-canton
  landing-page content strategy still deferred in `requirement.md` §12.
- A "← Back to comparison" link at the top and bottom. It carries the current query
  string back to `/[locale]/`, so a user who opened the guide mid-comparison returns
  to their in-progress inputs rather than a blank form. (The drawer path has no such
  problem — the comparator is never unmounted.)

### First-run

*Cut (see amendment at the top).* There is no first-run treatment: the always-present
banner is the only newcomer entry point, and nothing auto-opens the drawer or the
standalone page.

## Components (indicative, follows existing structure)

- `src/components/help/HelpTip.tsx` — the ⓘ trigger + responsive popover/disclosure,
  parameterised by content key.
- `src/components/help/HowItWorksDrawer.tsx` — the slide-over.
- `src/components/help/NewcomerBanner.tsx` — the always-present banner.
- `src/app/[locale]/how-it-works/page.tsx` — the standalone guide + its
  `generateMetadata`.
- `src/lib/help.ts` — content-key list / helpers if needed; the copy itself is in the
  message files.
- `HelpTip` is consumed by `PlzInput`, `BirthYearInput`, `DeductibleSelect`, and
  `FilterBar` (the alternative-models toggle); `NewcomerBanner` and `HowItWorksDrawer`
  are mounted by `InsuranceComparator`, which owns the drawer open/section state and
  passes an `onOpenGuide(section?)` callback down to every `HelpTip`.

## requirement.md changes (in this branch, alongside the reconciliation pass)

- **§2 In scope** — new bullet: plain-language help for people new to the Swiss system
  (inline explainers + a how-it-works guide).
- **§4 Principle #4** — qualifying sentence: newcomer help (§5.5) is ambient and
  opt-in and never adds a required step or blocks the input→results flow.
- **New §5.5 Newcomer help** — the three inline layers, the banner/drawer/standalone
  page.
- **§7** — REQ-28 (three-layer inline help), REQ-29 (banner → drawer → standalone
  `/how-it-works`), REQ-30 (help content is real and plain-language; no insurer-specific
  advice or recommendation, per Principle #2).
- **§10** — `/[locale]/how-it-works` is indexable, one per locale, in the sitemap
  with `hreflang` alternates.

## Testing

- `HelpTip`: renders the one-liner anchor; ⓘ toggles the panel; `aria-expanded`
  tracks state; Esc closes and restores focus; wide vs. narrow rendering switches at
  the breakpoint (jsdom matchMedia mock).
- `HowItWorksDrawer`: opens from the banner and the Layer-3 link; closes on Esc /
  scrim; focus trap; scrolls to the requested section.
- `NewcomerBanner`: the banner always renders and its CTA opens the drawer.
- `how-it-works/page.tsx`: renders all three content areas; `generateMetadata`
  produces per-locale title/description + `hreflang`; "back to comparison" preserves
  the query string.
- `messages.test.ts`: the existing locale-completeness check extends to the new
  `help` namespace across all four locales.
- `sitemap.ts`: emits the four `how-it-works` URLs.
- Manual: keyboard-only pass through a field ⓘ, the drawer, and the standalone page;
  screen-reader spot check of the ⓘ and drawer; mobile (~360px) disclosure and drawer.

## Out of scope (Spec B and beyond)

- Guided step-by-step mode.
- Interactive franchise break-even helper.
- Spanish / Portuguese locales (own spec).
- Native-speaker review of the machine-authored help copy (tracked in `requirement.md`
  §12 alongside the existing FR/IT UI-copy note).
