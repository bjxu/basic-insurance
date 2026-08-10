# Basic Insurance — Requirements

A web app for comparing Swiss mandatory basic health insurance (*Grundversicherung* / OKP)
premiums, built to give users a clearer, faster overview than existing tools like
priminfo.ch and comparis.ch, and to surface the savings they're leaving on the table by
not switching.

Status: draft, pending review.
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

**Out of scope (v1)** — see also §11:
- Household/multi-person comparison.
- Any language other than German.
- Initiating a switch, generating cancellation letters, or linking to insurers' sites.
- User accounts, saved profiles, or any persistence beyond the current session/URL.
- Premium subsidy (*Prämienverbilligung*) calculations.
- Peer percentile badges and year-over-year "mover" flags (considered and deferred, see §11).

## 3. Domain Glossary

| Term | Meaning |
|---|---|
| Grundversicherung / OKP | Mandatory basic health insurance every Swiss resident must hold. |
| Franchise (deductible) | Annual amount paid out of pocket before insurance covers costs. Fixed tiers, different for adults and children. |
| Prämienregion | Premium region. Many cantons are split into 1–3 regions with different premium levels; determined by municipality (*Gemeinde*), not just postal code. |
| Altersklasse (age band) | Premiums differ for children (0–18), young adults (19–25), and adults (26+). |
| Unfalldeckung (accident coverage) | Can be excluded from the premium if the person is already covered for accidents through an employer (works ≥8h/week). |
| Tarifart (insurance model) | Standard (free choice of doctor) vs. alternative models (HMO, family-doctor/*Hausarztmodell*, Telmed) that restrict first point of contact in exchange for a lower premium. |

## 4. Core Principles

These constraints apply across every feature and should guide any ambiguous decision
during implementation:

1. **Only price-relevant inputs.** The user is never asked for anything that doesn't
   affect which premium applies — no name, email, phone number, or account creation.
2. **Pure comparison tool.** No lead generation, no insurer referral links, no switching
   workflow. The app's job ends at giving the user accurate numbers.
3. **Real data only.** Every premium shown must trace back to officially published data
   (BAG / *Bundesamt für Gesundheit* open data). Nothing is estimated or synthesized.
4. **Minimal friction.** One page, no wizard, no required navigation between input and
   results.

## 5. User Flow

Single page, no navigation between input and results.

### 5.1 Input

Required:
- **Postal code (PLZ)** — if it maps to municipalities in more than one premium region
  (e.g. PLZ 8044, which spans Zürich and part of Dübendorf), the user is shown a
  municipality (*Gemeinde*) picker to disambiguate. Otherwise resolved silently.
- **Birth year** — determines age band (child / young adult / adult), which in turn
  determines both applicable premiums and available deductible tiers.
- **Deductible** — offered as a dropdown scoped to the age band implied by birth year.

Optional, collapsed by default:
- **Current plan** — current insurer + current deductible + current insurance model.
  Framed as *"What do you pay now? (to see your savings)"*. Providing this unlocks the
  "cost of doing nothing" headline (§5.2); omitting it is fully supported.

### 5.2 Results & Headline

Results render inline below the input, no page reload. A headline sits above the full list:

- **If current plan was provided and next year's data is published:**
  *"If you do nothing: CHF X/month next year with [current insurer]. Cheapest match for
  you: CHF Y/month with [insurer] — save CHF Z/year by switching."*
  - If the current plan is already the cheapest (or near-cheapest) match, the headline
    must say so plainly (e.g. *"You already have one of the best prices for your
    profile"*) rather than force a savings pitch that doesn't exist.
- **If current plan was provided but next year's data isn't published yet:** compare
  current-year current-plan cost vs. current-year cheapest match instead.
- **If current plan was not provided:** *"Cheapest available to you next year: CHF
  Y/month with [insurer]."* plus a nudge to add their current plan to see savings.

The "cheapest match" used in the headline always respects whatever filters are currently
active in the list below (§5.3) — i.e. it's the top row of the currently filtered list,
not a hidden global minimum.

### 5.3 Filters & List

Below the headline, all matching plans are listed, sorted by price ascending. Defaults:
- Insurance model: **Standard only**. Alternative models (HMO, Hausarztmodell, Telmed) are
  opt-in via a filter toggle, and always clearly labeled with their restriction when shown.
- Accident coverage: **included** by default (the safer assumption when we don't know the
  user's employment status); toggle to exclude it.
- Year: current year by default; toggle to next year once published.

Each row shows: insurer name, model badge (with restriction note for alternative models),
monthly premium, and — when next year's data is available and the premium differs — that
plan's own year-over-year change.

Comparison state (inputs + active filters) is reflected in the page's URL so a result can
be bookmarked or shared without requiring an account.

## 6. Data Requirements

### 6.1 Source

Official premium data published by the *Bundesamt für Gesundheit* (BAG) as open data
(the same source underlying priminfo.ch), covering all insurers, cantons, premium
regions, age bands, deductible tiers, accident-coverage variants, and insurance models.

### 6.2 Location resolution

Postal code alone is not always sufficient to determine the premium region — some postal
codes span multiple municipalities that fall in different regions. Location must resolve
to a specific municipality (*Gemeinde*), using the postal code to narrow the choices and
disambiguating with the user when more than one municipality/region applies.

### 6.3 Time scope

- Current calendar year's premiums are always shown.
- Next year's premiums are shown once BAG has published them (historically around
  September/October for the following year). Before publication, all next-year-dependent
  behavior (toggle, headline framing) gracefully falls back to current-year-only, per §5.2.
- No other historical years are in scope for v1.

## 7. Functional Requirements

| ID | Requirement |
|---|---|
| REQ-1 | User can locate their premium region via postal code, disambiguating by municipality when a postal code spans multiple regions. |
| REQ-2 | User can specify birth year and deductible; deductible options are scoped to the resulting age band. |
| REQ-3 | System returns all matching plans (Standard model, accident coverage included, current year) sorted by price ascending, by default. |
| REQ-4 | User can toggle in alternative insurance models, each labeled with its restriction. |
| REQ-5 | User can toggle accident coverage off. |
| REQ-6 | User can toggle between current-year and next-year results when next-year data is published. |
| REQ-7 | User can optionally enter their current insurer, deductible, and model to enable savings comparison. |
| REQ-8 | When a current plan is provided, the results headline states the cost of staying vs. the cheapest currently-filtered alternative, and their difference. |
| REQ-9 | The headline degrades gracefully (cheapest-only framing) when no current plan is provided, and falls back to current-year comparison when next year isn't published yet. |
| REQ-10 | The headline states clearly when the user's current plan is already optimal, instead of manufacturing a savings claim. |
| REQ-11 | Comparison state (inputs + filters) is reflected in the URL for sharing/bookmarking. |
| REQ-12 | No input field is collected beyond what determines an applicable premium (no name/email/phone/account). |

## 8. Edge Cases & Error Handling

- **Invalid/unrecognized postal code:** inline validation message; no results shown.
- **Unrealistic birth year** (e.g. in the future, or implying age > ~120): inline validation
  message.
- **No matching plans for the chosen combination** (e.g. an insurer doesn't operate in
  that region): show a clear empty state, not a blank list.
- **Current plan not found in the data** (typo, discontinued insurer/product, or that
  insurer doesn't offer that exact deductible/model in the user's region): show a clear
  notice and fall back to the cheapest-only headline (§5.2) rather than failing silently.
- **User's age band changes between current and next year** (e.g. turning 19 or 26):
  next-year lookups must use the age band applicable to next year, not the current one.
  (Exact BAG cutoff rule — age as of which reference date — to be confirmed against the
  official data dictionary during implementation; flagged in §10.)

## 9. Non-Functional Assumptions

- The app must be usable on mobile as well as desktop (public-facing comparison tool).
- All data shown must be traceable to the official BAG source and its publication date,
  so numbers can be trusted/verified.

These are carried as baseline assumptions rather than settled requirements; flag if either
should be treated differently.

## 10. Open Questions / Assumptions for Review

1. Accident-coverage default (included) — confirmed reasonable, but worth an explicit
   sign-off since it affects the default premium shown to everyone.
2. Exact age-band cutoff rule (reference date used to compute age for a given premium
   year) needs verification against BAG's official data documentation during
   implementation — noted as a data-accuracy risk, not a product decision.
3. "Current plan" lookup assumes insurer + deductible + model uniquely identifies a
   premium row (together with the region/age band/accident-coverage already entered).
   If BAG data has additional product-level distinctions within the same model type,
   this may need a further disambiguation step.

## 11. Future Considerations (explicitly not v1)

- Household/multi-person comparison view.
- French/Italian language support.
- Peer percentile badge ("you're paying more than X% of similar profiles").
- Year-over-year "mover" flag for insurers with fast-rising rank/price — deferred because
  two data points (current + next year) is a thin trend signal.
- Premium subsidy (*Prämienverbilligung*) eligibility/estimation.
