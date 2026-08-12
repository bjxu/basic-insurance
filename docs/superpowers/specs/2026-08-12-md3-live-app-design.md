# Material Design 3 for the Live App — Design

Status: approved, ready for implementation planning.

## 1. Context

`mockups/main.html` and `mockups/admin.html` already carry a full Material Design 3
(MD3) visual redesign — color tokens and a type scale generated from the app's
existing accent color, documented in `docs/design/material-design-guideline.md`.
The live Next.js app (`src/`) has not been updated to match: its components still
use Tailwind's default palette directly (`bg-white`, `text-gray-500`, `bg-blue-600`,
…) and the Geist font, with no MD3 tokens wired in anywhere.

This spec covers bringing the live app — the main comparator and the admin
dashboard — visually in line with the approved mockups. No behavior, business
logic, or data changes are in scope; this is a re-skin.

## 2. Goal

Every screen a user or admin sees in the running app should match the color,
typography, and component styling already established in `mockups/main.html` /
`mockups/admin.html`, implemented in a way that fits the app's existing
all-Tailwind authoring style.

## 3. Token wiring

- Copy the full MD3 token set (colors + type scale) from
  `docs/design/material-design-guideline.md` into `src/app/globals.css` as CSS
  custom properties on `:root`. Values are taken as-is from the guideline — they've
  already been generated/validated in the mockups, not re-derived here.
- Register those tokens in Tailwind's `@theme inline` block (colors as
  `--color-primary`, `--color-on-primary`, `--color-surface-variant`, etc.; type
  scale as font-size/line-height/tracking vars where Tailwind supports it), so
  components consume them as ordinary Tailwind utilities — `bg-primary`,
  `text-on-surface-variant`, `border-outline-variant` — rather than hand-written
  CSS classes or Tailwind's arbitrary-value bracket syntax referencing a raw CSS
  variable in the class name.
- Existing ad-hoc Tailwind colors are replaced 1:1 per the guideline's
  consolidation table (`bg-blue-600` → `bg-primary`, `text-gray-500`/`600`/`700` →
  `text-on-surface-variant`, `border-gray-200` → `border-outline-variant`, etc.).
- `color-scheme: light` stays as-is app-wide (already correctly set); no dark-mode
  work — the mockups are light-only and so is the app.

## 4. Font

Replace `Geist`/`Geist_Mono` in `src/app/layout.tsx` with `next/font/google`'s
`Roboto` (weights 400/500/700, per the guideline), exposed as a CSS variable and
set as the body font family. This mirrors the mockups' Google Fonts include, loaded
via Next's font optimizer instead of a `<link>` tag (self-hosted, no extra request
waterfall, same visual result). The admin section inherits the same root font — no
separate typeface for the dashboard.

## 5. Component restyle scope

### 5.1 Main comparator

`InsuranceComparator` and its children — `PlzInput`, `BirthYearInput`,
`DeductibleSelect`, `CurrentPlanSection`, `Headline`, `FilterBar`,
`PlanList`/`PlanRow`, `EmptyState` — are re-skinned in place. React structure,
props, and behavior are unchanged; only `className` strings move from the old
Tailwind grays/blues to the new MD3 tokens. This pass also picks up visual details
present in the mockup that today's components lack:

- Pill-shaped gemeinde-picker buttons and filter chips (`rounded-full`,
  active/inactive token colors), replacing today's plain buttons.
- Model badges/tags colored by model type (HMO / Telmed / Hausarzt each get their
  own container color per the guideline's tag colors), replacing today's single
  flat badge style.
- The three headline banner variants (savings / cheapest / already-cheapest) using
  `success-container` / `primary-container` per case, matching the mockup's three
  headline states.
- The current-plan row highlighted with the `error` token pairing, as in the
  mockup.

### 5.2 Admin

`/admin` and `/admin/login`: the live dashboard today is a stub (range-preset
buttons plus one total-count panel; chart panels are unimplemented pending
`POSTGRES_URL` / the aggregation queries in `architecture.md` §13.2), and it has
no `<nav>` element, unlike `mockups/admin.html`. This pass restyles what exists —
the range-picker pill buttons and the stat panel — to match
`mockups/admin.html`'s corresponding styling, plus the login page's form and
button. Adding the mockup's nav bar (with its logout affordance, which would need
new session-clearing logic) is new structure/behavior, not a re-skin, so it's out
of scope here; so are the chart panels, since that code doesn't exist yet.

### 5.3 Out of scope

No new features, no markup/behavior changes beyond what's needed to carry visual
states already present in the mockups (e.g. the pill chips), no changes to
`src/lib/*` logic, no changes to test assertions beyond what's incidentally
required by class-name changes (the current test suite is logic-focused, not
snapshot/class-based, so is expected to be unaffected).

## 6. Verification

- **Automated tests**: `npm test` (Vitest) — covers `src/lib/*` and
  `scripts/ingest/*` logic, not styling; expected to pass unchanged.
- **Visual check**: launch the dev server and screenshot the comparator (all
  headline states, gemeinde picker, alt-models-on list, empty state) and the admin
  pages, comparing against `mockups/main.html` / `mockups/admin.html`.
- **Contrast spot-check**: MD3's tonal system targets accessible contrast by
  design, but this hasn't been explicitly verified for this app's usage. Spot-check
  the text/background pairs actually used (body text, chip labels, error/success
  containers) against WCAG AA (REQ-17) during implementation rather than assuming
  it's pre-proven.

## 7. Rollout order

1. Token wiring (`globals.css` + Tailwind `@theme`) + font swap — foundation, no
   visible change until components consume it.
2. Main comparator components — larger, user-facing surface.
3. Admin dashboard + login page.

Each step is independently committable.
