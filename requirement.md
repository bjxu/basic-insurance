# Basic Insurance — Requirements

A web app for comparing Swiss mandatory basic health insurance (*Grundversicherung* / OKP)
premiums, built to give users a clearer, faster overview than existing tools like
priminfo.ch and comparis.ch, and to surface the savings they're leaving on the table by
not switching.

Status: draft, incorporating requirements-engineering review round 1.
Technical architecture (stack, hosting, data storage) is intentionally **not** covered here —
it belongs to the implementation plan, not this requirements doc.

## 1. Purpose

Grundversicherung premiums in Switzerland are not risk-underwritten — for a given insurer,
canton/region, age group, deductible, accident-coverage choice, and insurance model, the
premium is a fixed, publicly known number. This makes the product a **lookup and
comparison problem**, not a pricing/actuarial one: the app looks up real, officially
published premiums and presents them so a user can quickly find their cheapest valid
option and see what switching would save them.

## 2. Users & Scope

**Primary user (v1):** a single individual comparing insurance options for themselves.

**In scope (v1):**
- Comparing current-year (and next-year, once published) premiums for one person.
- A "switch & save" comparison against the user's current plan.
- The comparator UI in German, French, Italian, and English, each on its own
  locale-prefixed URL (§5.4).
- Plain-language help for people new to the Swiss basic-insurance system: inline
  explainers on the inputs and badges, and a standalone "how the system works" guide
  (§5.5).

**Out of scope (v1):** see §12 for the full list and rationale (household comparison,
subsidy calculations, peer/percentile and trend-flag features, and any accounts, forms,
or switching workflow).

## 3. Domain Glossary

| Term | Meaning |
|---|---|
| Grundversicherung / OKP | Mandatory basic health insurance every Swiss resident must hold. |
| Franchise (deductible) | Annual amount paid out of pocket before insurance covers costs. Two tiers apply: children (0–18) choose from CHF 0–600; everyone 19 and over (young adults and adults share the same deductible menu, even though their premiums differ by age band) chooses from the standard CHF 300–2500 tiers. |
| Prämienregion | Premium region. Many cantons are split into 1–3 regions with different premium levels; determined by municipality (*Gemeinde*), not just postal code. |
| Altersklasse (age band) | Premiums differ for children (0–18), young adults (19–25), and adults (26+). |
| Unfalldeckung (accident coverage) | Can be excluded from the premium if the person is already covered for accidents through an employer (works ≥8h/week). Premium-determining, same as deductible and model. |
| Tarifart (insurance model) | Standard (free choice of doctor) vs. alternative models (HMO, family-doctor/*Hausarztmodell*, Telmed, and other BAG-classified alternative variants) that restrict first point of contact in exchange for a lower premium. |

## 4. Core Principles

These constraints apply across every feature and should guide any ambiguous decision
during implementation:

1. **Only price-relevant inputs.** Every required input (location, birth year, deductible)
   directly determines which premiums are shown. The optional "current plan" fields are
   an explicit exception: they don't change which premiums are *shown*, only whether the
   savings headline (§5.2) can be computed — the user is never asked for anything
   unrelated to premium determination or the savings comparison itself (no name, email,
   phone number, or account creation).
2. **Pure comparison tool.** No lead generation, no insurer referral links, no switching
   workflow. The app's job ends at giving the user accurate numbers.
3. **Real data only.** Every premium shown — the results list, and the discount badges
   (§5.3) — must trace back to officially published data (BAG / *Bundesamt für Gesundheit*
   open data) via an exact match on all premium-determining fields. Nothing is estimated,
   defaulted from an unrelated toggle, or synthesized. Two deliberate exceptions: (a) the
   current-plan premium (§5.1) is what the user says they pay, entered directly and used
   as-is for the savings comparison, not verified against the dataset — see §5.1 for why;
   (b) the environmental-levy adjustment (§6.4) subtracts a flat, officially published
   federal levy credit from displayed absolute premiums so they reconcile with what
   insurers themselves show — an exact, auditable transformation of the BAG figure, not
   an estimate.
4. **Minimal friction.** One page, no wizard, no required navigation between input and
   results, no explicit "submit" step once inputs are valid (§5.1). The newcomer help
   layer (§5.5) is consistent with this: it is ambient (a persistent one-liner per
   input) or opt-in (an ⓘ explainer, a "how it works" guide, a dismissible first-run
   card) — it never adds a required step and never blocks the input→results flow.

## 5. User Flow

Single page, no navigation between input and results.

### 5.1 Input

Required:
- **Postal code (PLZ)** — if it maps to municipalities in more than one premium region
  (e.g. PLZ 8044, which spans Zürich and part of Dübendorf), the user is shown a
  municipality (*Gemeinde*) picker to disambiguate. The resolved municipality is always
  displayed on screen (even when resolved silently from an unambiguous PLZ), so the user
  can see and correct what location the results are based on.
- **Birth year** — determines age band (child / young adult / adult), which in turn
  determines both applicable premiums and available deductible tiers (§3).
- **Deductible** — offered as a dropdown scoped to the deductible tier applicable to the
  resulting age band (child tiers vs. the shared 19+ tiers, per §3).

The results list (§5.3) recomputes live as soon as all three required fields are valid —
there is no separate "Compare"/submit action.

Optional, collapsed by default:
- **Current plan** — current insurer (chosen from the real BAG insurer list) and monthly
  premium (CHF, entered directly by the user — see REQ-7). Framed as *"What do you pay
  now? (to see your savings)"*. Providing this unlocks the "cost of doing nothing" headline
  (§5.2); omitting it is fully supported.
  - Earlier drafts of this section asked for deductible, insurance model, and
    accident-coverage status too, so the app could look up the user's exact premium row in
    the dataset (matching Core Principle #3 in its original, stricter form). That was
    dropped: knowing your exact Tarifart/deductible/accident-coverage combination is a lot
    to ask, most people just know their monthly bill, and the app's savings message doesn't
    actually need a verified figure to be useful — the discount badges (§5.3, REQ-23)
    already carry the "how would I save" signal from real data; the self-reported premium
    just gives the user's own number to compare it against.

### 5.2 Results & Headline

Results render inline below the input, no page reload. A headline sits above the full
list. The headline's year always matches whichever year is currently active in the list's
year toggle (§5.3) — the headline and the list never show different years at the same
time.

- **If a current plan was provided:** compare the current plan's self-reported premium
  (the number the user typed in — the same figure regardless of which year is toggled,
  since it isn't itself dated) against the cheapest plan in the currently-filtered list for
  the active year.
  - If the current plan's premium is *not* the cheapest: *"If you do nothing: CHF X/month
    with [current insurer]. Cheapest match for you [this year / next year]: CHF Y/month
    with [insurer] — save CHF Z/year by switching."*
  - If the current plan's premium *is exactly* the cheapest currently-filtered match (a
    tie for the top rank — no fuzzy "near-cheapest" threshold): *"You already have the
    cheapest matching plan for your profile."* No savings figure is shown in this case.
  - If the current plan's premium is *strictly lower* than the cheapest currently-filtered
    match (possible because the self-reported premium carries no franchise/model/region of
    its own, so it isn't guaranteed to be comparable to the currently-filtered profile): the
    headline avoids claiming the user's plan is confirmed cheapest for the profile and
    instead prompts them to check their franchise/model against what's currently selected —
    e.g. *"Your premium is below every match for this profile — check whether your
    deductible and model are comparable."*
- **If no current plan was provided:** *"Cheapest available to you [this year / next
  year]: CHF Y/month with [insurer]."* plus a nudge to add their current plan to see
  savings.

### 5.3 Filters & List

Below the headline, one row per insurer is listed, showing that insurer's **cheapest available plan** at the selected franchise and active filters, sorted by price ascending with ties broken alphabetically by insurer name. Defaults:
- Insurance model: **Standard only**. When alternative models are toggled on, the row for each insurer shows whichever model (Standard or alternative) is cheapest for that insurer at the selected franchise — so a single Helsana row might switch from showing Standard to Telmed if Telmed is cheaper. Each row's model badge carries a one-line, plain-language description of its restriction (not just a name/badge) — e.g. "Telmed: must call a hotline before seeing a doctor."
- Accident coverage: **included** by default (the safer assumption when we don't know the user's employment status); toggle to exclude it.
- Year: current year by default; toggle to next year once published. This toggle also
  drives the headline's year, per §5.2.

Each row shows: insurer name, model badge with its restriction note, monthly premium, and
— when next year's data is available and the premium differs — that plan's own
year-over-year change. Alternative-model rows additionally show a **discount badge** next
to the model badge — see REQ-23.

The list is not paginated (realistic result-set sizes are on the order of dozens of
insurers, not hundreds).

All comparison state — required inputs, active filters, and the optional current-plan
fields — is reflected in the page's URL, and the page reconstructs its full state
(including re-running the lookup and re-rendering the headline/list) when loaded from such
a URL. This makes a full comparison, including its savings headline, shareable/bookmarkable
without an account. Because this means a shared link can expose the sender's postal code,
birth year, and current insurer/premium, this is a deliberate, accepted trade-off in
favor of shareability (per product owner decision), not an oversight — no further consent
step is required beyond the "current plan" fields being opt-in themselves.

### 5.4 Language

The comparator UI is served in German (default), French, Italian, and English. Each
locale is a URL prefix — `/de/`, `/fr/`, `/it/`, `/en/` — so every locale has one
canonical URL shape. A bare `/` redirects to the best `Accept-Language` match, falling
back to German.

A language switcher sits next to the input heading; switching languages replaces the
locale segment and preserves every query parameter, so a shared comparison link (§5.3)
keeps working and simply renders in the new language.

Only UI copy is translated. Insurer names and BAG figures are shown as published. The
admin dashboard (§7, REQ-22) is an internal tool and stays German-only. FR/IT/EN copy is
machine-authored using correct insurance terminology; a native-speaker review is a
recommended follow-up before those locales are treated as production-final (§12).

### 5.5 Newcomer help

An ambient, optional help layer for users new to the Swiss basic-insurance system.
It does not change the fast path (§4, Principle #4).

**Content.** Plain-language copy in three areas, authored in German and translated to
the other locales (§5.4): (a) term explainers — one per input/badge concept
(Franchise, Prämienregion, Altersklasse, Unfalldeckung, Tarifart/models, the
member-count and discount badges), each a one-liner plus a 2–3 sentence short form;
(b) how the system works — mandatory cover, the three-month sign-up window after
moving, guaranteed acceptance, once-a-year switching (notice by 30 November), and that
basic coverage is identical by law at every insurer; (c) what an alternative model
trades away — lower premium for less freedom over the first point of contact. The copy
explains the system and the terms only; it gives no insurer-specific advice and makes
no recommendation (§4, Principle #2).

**Inline layer.** Three parts on each relevant control: a persistent one-line hint
below the input (the birth-year field already does this); an ⓘ trigger by the label
that opens the short-form explainer (an anchored popover on wide viewports, an inline
disclosure that expands in place on narrow ones); and a link from that explainer into
the guide. All keyboard-operable and screen-reader-labelled (REQ-17).

**Guide.** A banner at the top of the input card ("New to Swiss basic insurance? — How
the system works") opens an on-page drawer with the essentials, the comparator staying
mounted underneath. The drawer links to a standalone guide page at
`/[locale]/how-it-works` (§10) with the full content and a "back to comparison" link
that preserves the user's in-progress inputs.

**First run.** On a first visit (tracked in `localStorage`), a dismissible slim card
above the inputs points to the guide. It never auto-opens the drawer or the page;
after dismissal only the always-present banner remains. If `localStorage` is
unavailable the card simply always shows.

## 6. Data Requirements

### 6.1 Source

Official premium data published by the *Bundesamt für Gesundheit* (BAG) as open data
(the same source underlying priminfo.ch), covering all insurers, cantons, premium
regions, age bands, deductible tiers, accident-coverage variants, and insurance models.
The page displays the BAG publication date the currently-shown data is sourced from, so
users can judge how current the numbers are.

### 6.2 Location resolution

Postal code alone is not always sufficient to determine the premium region — some postal
codes span multiple municipalities that fall in different regions. Location must resolve
to a specific municipality (*Gemeinde*), using the postal code to narrow the choices and
disambiguating with the user when more than one municipality/region applies. The resolved
municipality is always visible on screen (§5.1).

### 6.3 Time scope

- Current calendar year's premiums are always shown.
- Next year's premiums are shown once BAG has published them (historically around
  September/October for the following year). Before publication, the year toggle (§5.3)
  offers current year only, and the headline (§5.2) is computed against the current year.
- No other historical years are in scope for v1.

### 6.4 Environmental levy adjustment

Every displayed *absolute* premium — the results list rows, the headline's cheapest
figure (§5.2), and the current-insurer row — is shown net of the flat federal CO₂/VOC
levy redistribution credit. This credit is a fixed per-person amount, identical for every
insurer, published annually by BAFU (CHF 5.15/month for 2026); it is applied as a
year-keyed constant, kept separate from the BAG premium file (different federal office,
different publication cadence).

Rationale: insurers subtract this same credit on their own websites, so matching it keeps
this app's numbers reconcilable against an insurer's own quote, and keeps the savings
comparison (§5.2) net-against-net rather than mixing a net self-reported premium against
a gross dataset premium.

Because the credit is flat and insurer-uniform, it never changes the ranking. It is
**not** applied to relative figures — the alternative-model discount badge (REQ-23) and
the year-over-year change — which stay computed on raw BAG tariffs. The adjustment and
its amount are stated in the on-page data notice. If a shown year has no published levy
figure, premiums are displayed unadjusted and the declaration is omitted for that year.

## 7. Functional Requirements

| ID | Requirement |
|---|---|
| REQ-1 | User can locate their premium region via postal code, disambiguating by municipality when a postal code spans multiple regions; the resolved municipality is always displayed. |
| REQ-2 | User can specify birth year and deductible; deductible options are scoped to the applicable tier (children 0–18 vs. everyone 19+, per §3). |
| REQ-3 | System returns one row per insurer showing that insurer’s cheapest plan at the selected franchise and active filters (Standard model only by default, accident coverage included, current year), sorted by price ascending (ties broken alphabetically by insurer), recomputed live as soon as all required inputs are valid — no explicit submit action. |
| REQ-4 | User can toggle in alternative insurance models; when active, each insurer’s row shows whichever model (Standard or alternative) is cheapest for that insurer at the selected franchise, with a one-line plain-language description of its restriction. |
| REQ-5 | User can toggle accident coverage off. |
| REQ-6 | User can toggle between current-year and next-year results when next-year data is published; this toggle also determines the year shown in the headline (§5.2). |
| REQ-7 | User can optionally enter their current insurer and their monthly premium (CHF, self-reported) to enable the savings comparison. |
| REQ-8 | When a current plan is provided, the results headline states the current plan's self-reported premium vs. the cheapest currently-filtered alternative for the active year, and their difference. |
| REQ-9 | The headline shows the no-current-plan (cheapest-only) framing when no current plan is provided. |
| REQ-10 | When the current plan's premium exactly equals the cheapest currently-filtered match, the headline states the user already has the cheapest matching plan, with no savings figure shown — no fuzzy "near-cheapest" threshold applies. |
| REQ-11 | All comparison state (required inputs, active filters, and optional current-plan fields) is written to the URL, and is read back from the URL to fully reconstruct the page (including headline/list) on load. |
| REQ-12 | No input field is collected beyond what determines an applicable premium or powers the optional savings comparison (no name/email/phone/account). |
| REQ-13 | Invalid postal codes, unrealistic birth years (future dates, or implying age beyond a plausible human lifespan), and non-positive or non-numeric self-reported current-plan premiums are rejected with an inline validation message; no results (or, for the premium field, no savings headline) are computed from the invalid value. |
| REQ-14 | *(Removed.)* Superseded by the current-plan simplification (2026-08-14 design doc, §11 item 2): the current-plan premium is now self-reported rather than matched against a dataset row, so a "combination not found in the data" case no longer applies. |
| REQ-15 | If no plans match the current required inputs and active filters (e.g. an insurer doesn't operate in that region), a clear empty-state message is shown instead of a blank list. |
| REQ-16 | Next-year lookups (list and headline) use the age band and deductible tier applicable to next year, not the current year, for users whose age band changes between the two (e.g. turning 19 or 26). |
| REQ-17 | The page is usable at viewport widths from ~360px up (mobile) through desktop, and meets WCAG 2.1 AA. |
| REQ-18 | Page `<title>` and meta description reflect the active comparison, in the page's locale, when loaded from a stateful URL, with a generic keyword-appropriate default otherwise. |
| REQ-19 | Open Graph / Twitter Card metadata mirrors the title/description, so shared comparison links (REQ-11) preview correctly. |
| REQ-20 | Parameterized comparison URLs are `noindex` with a canonical tag to their locale's base URL; only the locale base URLs are indexed, and they are the sitemap's only entries (one per locale, per REQ-26). |
| REQ-21 | Every price inquiry (defined as: all required inputs valid and results rendered) is logged server-side for activity monitoring. Each log entry records timestamp, resolved Prämienregion, Altersklasse, Franchise, active year, and active filters (model set, accident coverage). It does **not** record IP address, the optional current-plan fields, or any other data not needed for aggregate usage analysis. Logged data is used solely for understanding usage patterns (popular regions, peak times, filter usage) and is never sold or shared. |
| REQ-22 | A password-protected admin dashboard at `/admin` visualises aggregate inquiry activity. It is not publicly linked or indexed. Access is restricted by a secret token stored in an environment variable (no user account system required). The dashboard has a time-range selector (presets: Today, Last 7 days, Last 30 days, This month, Last 3 months, This year, and any custom from/to date; defaults to Last 30 days) that drives every panel on the page simultaneously. Panels: total inquiries in the selected range; a time-series trend chart (granularity auto-adapts: hourly for ≤2 days, daily for ≤90 days, monthly for >90 days); top 10 Prämienregionen by count; breakdown by Altersklasse; breakdown by Franchise tier; breakdown by active insurance model set; breakdown by accident-coverage toggle. The selected range is reflected in the page URL so it is bookmarkable. All figures are aggregate counts — no raw log rows are exposed through the UI. |
| REQ-23 | Each alternative-model row in the results list (REQ-4) shows a discount badge next to its model badge, stating how much cheaper that row's premium is than the same insurer's own Standard premium at the same region/franchise/age band/accident-coverage — phrased "bis zu −X% ggü. Standard" (not a bare percentage), since a row shows that insurer's single cheapest matching product and the insurer may have other products in the same model that discount less. Standard rows show no badge. If that insurer has no Standard-tarifart premium for the same region/franchise/age band/accident-coverage to compare against, the badge is omitted for that row (not observed in current BAG data — every insurer offers Standard — but handled defensively, not as a crash/blank state). |
| REQ-24 | Each row in the results list shows a badge stating that insurer's total OKP membership count (BAG Versichertenbestand data), abbreviated (e.g. "1.5 Mio.", "813 Tsd."), sourced from real BAG open data — not an estimate or placeholder. If that insurer has no matching Versichertenbestand row, the badge is omitted for that row (not a placeholder), the same defensive-omission pattern as the discount badge (REQ-23). |
| REQ-25 | The comparator UI is available in German, French, Italian, and English on locale-prefixed URLs (`/de/`, `/fr/`, `/it/`, `/en/`); a bare `/` redirects to the best `Accept-Language` match, falling back to German. A language switcher preserves all comparison state (§5.4) across a language change. Only UI copy is translated — insurer names and BAG figures are not. The admin dashboard (REQ-22) stays German-only. |
| REQ-26 | Each locale emits its own translated `<title>`, meta description, and Open Graph / Twitter Card tags, plus `hreflang` alternates for all locales including `x-default` (pointing at the German version). The sitemap lists one URL per locale. |
| REQ-27 | Every displayed absolute premium (results list, headline, current-insurer row) is shown net of the year's flat federal CO₂/VOC levy credit (§6.4). Relative figures — the REQ-23 discount badge and the year-over-year change — are not adjusted. The adjustment, its amount, and the fact that it does not affect ranking are stated on-page. A year with no published levy figure shows unadjusted premiums and omits the declaration. |
| REQ-28 | Each of the three required inputs, and each result row's model badge, carries a persistent one-line plain-language hint and an ⓘ trigger that opens a short-form explainer (§5.5) — an anchored popover on wide viewports, an inline disclosure on narrow ones. Triggers are keyboard-operable and screen-reader-labelled per concept (REQ-17). The explainer links into the guide (REQ-29). |
| REQ-29 | A persistent banner at the top of the input card opens an on-page drawer summarising how the Swiss basic-insurance system works (§5.5), with the comparator still mounted underneath; the drawer links to a standalone guide at `/[locale]/how-it-works` carrying the full content and a "back to comparison" link that preserves the current query state. On a first visit (tracked in `localStorage`), a dismissible slim card above the inputs also points to the guide; it never auto-opens the drawer or page, and degrades to always-shown if `localStorage` is unavailable. |
| REQ-30 | The newcomer help content explains the system and the domain terms only. It contains no insurer-specific advice and no recommendation to choose a particular plan or insurer (§4, Principle #2). |

## 8. Edge Cases & Error Handling

- **Invalid/unrecognized postal code:** inline validation message; no results shown (REQ-13).
- **Unrealistic birth year** (e.g. in the future, or implying age > ~120): inline validation
  message (REQ-13).
- **No matching plans for the chosen combination** (e.g. an insurer doesn't operate in
  that region): clear empty state, not a blank list (REQ-15).
- **Self-reported current-plan premium is invalid** (empty, non-numeric, zero, or
  negative): inline validation message; current-plan fields are treated as not provided,
  so the headline falls back to the no-current-plan framing (REQ-13).
- **An alternative-model row's insurer has no Standard premium to compare against** for the
  discount badge (REQ-23): the badge is simply omitted for that row; not currently
  reachable with real BAG data (every insurer offers Standard) but handled defensively.
- **An insurer has no Versichertenbestand match** for the member-count badge (REQ-24): the
  badge is simply omitted for that row; not currently reachable with real BAG data (every
  known insurer has a match) but handled defensively.
- **User's age band changes between current and next year** (e.g. turning 19 or 26):
  next-year lookups must use the age band and deductible tier applicable to next year, not
  the current one (REQ-16). Per known BAG methodology, the age band is based on age
  reached during the relevant calendar year — this should be a quick confirmation against
  BAG's official data documentation during implementation, not an open design question.

## 9. Non-Functional Requirements

- Usable on mobile (from ~360px viewport width) through desktop; WCAG 2.1 AA (REQ-17).
- The BAG publication date of the currently-displayed data is visibly shown (§6.1), so
  numbers are independently verifiable against the source.
- Monetary values are displayed in Swiss convention (e.g. "CHF 1'234.50", apostrophe
  thousands separator). The self-reported monthly-premium input (REQ-7) accepts the same
  convention on entry (decimal input for Rappen; a "CHF" affix, not a typed-in prefix).
  This convention is independent of the UI language (§5.4) — it renders identically in
  all four locales.
- Displayed premiums are shown net of the federal CO₂/VOC levy credit (§6.4); the on-page
  data notice states the amount and that it does not affect ranking.
- Results render without a noticeable stall; a lightweight loading indicator covers any
  lookup that isn't effectively instant, consistent with the "minimal friction" principle
  (§4) — this is a UX expectation, not a technical performance target, which stays out of
  scope per this document's boundaries.

## 10. SEO & Discoverability

Scope: general findability and clean sharing hygiene only — v1 does not include a
dedicated landing-page/content strategy (e.g. per-canton pages built to rank for specific
searches); that's deferred, see §12.

Because comparison state lives entirely in URL query parameters (§5.3, REQ-11), the space
of possible URLs is effectively unbounded (every combination of location × birth year ×
deductible × optional current-plan fields is its own URL). That's good for shareability
but would be harmful for SEO if left unmanaged — search engines would see it as
near-infinite thin/duplicate content. v1 handles this by keeping only the locale base
URLs indexable (one per locale, with no query parameters) while still allowing every
parameterized URL to be crawled, shared, and correctly previewed.

- The page's `<title>` and meta description reflect the active comparison, in the page's
  language, when the page is loaded from a URL with state in it (e.g. *"Krankenkassenvergleich
  Zürich – ab CHF 245/Monat"*), and fall back to a generic, keyword-appropriate default
  (mentioning Grundversicherung/Krankenkassenvergleich) when no comparison has been entered yet.
- Open Graph and Twitter Card metadata mirror that title/description, so a shared
  comparison link (REQ-11) renders a correct, specific preview on social/messaging
  platforms rather than a generic one.
- Each locale page emits `hreflang` alternates for all four locales plus `x-default`
  (the German version), so search engines serve the right language version (REQ-26).
- Every parameterized comparison URL carries a canonical tag pointing to its locale's
  base URL and is marked `noindex`; only the locale base URLs are intended to be indexed
  by search engines. This does not affect crawling for link-preview purposes (Open Graph
  scraping is independent of search-index `noindex` directives).
- The sitemap contains the locale base URLs and the `/[locale]/how-it-works` guide
  pages (§5.5) — one of each per locale — each carrying its `hreflang` language
  alternates; robots.txt allows them. The `how-it-works` guide is a single evergreen
  page per locale, indexable like the base URL; it is not the per-canton content
  strategy still deferred in §12.
- Semantic HTML (proper heading hierarchy, landmark regions) is used throughout — this
  serves SEO and is also required for the accessibility bar already in place (REQ-17).

## 11. Open Questions / Assumptions for Review

1. Age-band reference date (§8) — believed to be "age reached during the calendar year"
   per known BAG methodology; flagged for a quick confirmation against the official data
   documentation during implementation rather than a product decision.
2. ~~"Current plan" lookup assumes insurer + deductible + model + accident coverage
   uniquely identifies a premium row...~~ — resolved by the 2026-08-14 current-plan
   simplification: the app no longer looks up a dataset row for the current plan at all
   (premium is self-reported), so this dataset-matching/disambiguation question no longer
   applies.
3. Some BAG-registered insurers are subsidiary brands of larger groups under distinct BAG
   insurer codes. The "Aktuelle Kasse" dropdown should be checked against the full BAG
   insurer list including subsidiaries during implementation, so a user can always find
   their real current insurer in the list.
4. The alternative-model list in §3 (HMO, Hausarztmodell, Telmed, "other variants") should
   be driven by BAG's actual Tarifart classification during implementation rather than
   hardcoded to these three named models, in case the official classification is broader.

## 12. Future Considerations (explicitly not v1)

- Household/multi-person comparison view.
- Native-speaker French/Italian review of the machine-authored UI copy before those
  locales are treated as production-final (§5.4).
- Peer percentile badge ("you're paying more than X% of similar profiles").
- Year-over-year "mover" flag for insurers with fast-rising rank/price — deferred because
  two data points (current + next year) is a thin trend signal.
- Premium subsidy (*Prämienverbilligung*) eligibility/estimation.
- Dedicated SEO landing pages / content strategy (e.g. static per-canton or per-region
  pages built to rank for specific searches) — v1 covers only general findability and
  sharing hygiene (§10).
- Any user accounts, saved profiles, switching workflow, or insurer referral links —
  deliberately excluded from this tool's purpose (§4), not merely deferred for later.
