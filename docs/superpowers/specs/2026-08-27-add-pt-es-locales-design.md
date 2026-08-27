# Add Portuguese & Spanish locales (PT/ES) — Design

**Date:** 2026-08-27
**Status:** Approved

## Problem

The comparator ships in four languages (DE default, FR, IT, EN) via the
[2026-08-15 multilingual i18n design](2026-08-15-multilingual-i18n-design.md).
Two of the largest resident populations in Switzerland — the Portuguese- and
Spanish-speaking communities — have no localized version. This adds `pt` and
`es` as first-class locales on the same footing as the existing four:
crawlable locale-prefixed URLs, a switcher entry, per-locale metadata and
`hreflang`.

**Goal:** serve the existing comparator surface (`/`, `/how-it-works`) in
Portuguese and Spanish, each on its own indexed URL.

**Out of scope:**
- New per-locale SEO content — this covers the existing surface, not new pages.
- Translating crawled provider product descriptions (`product-descriptions.json`).
- Translating data content (insurer names, BAG figures).
- Native/professional translation review — see Content & translation below.
- Admin panel — stays German-only, unprefixed, untouched.

## Architecture

No architectural change. The i18n system built in the 2026-08-15 design is
entirely driven by `routing.locales`: the middleware matcher, `generateStaticParams`,
`generateMetadata` `hreflang` alternates, `sitemap.ts`, and the language switcher
all iterate that array. Adding two codes to it wires up routing, negotiation,
static generation, and SEO for the new locales automatically.

The remaining work is (a) two new message catalogs and (b) extending the small
number of spots that hardcode the four-locale set rather than reading `routing.locales`.

## Changes

### Core wiring

- **`src/i18n/routing.ts`** — `locales: ["de", "fr", "it", "en", "pt", "es"]`.
  `defaultLocale` and `localePrefix` unchanged.
- **New `src/messages/pt.json`** and **`src/messages/es.json`** — a full
  translation of every key in `src/messages/de.json` (11 namespaces: `meta`,
  `inputs`, `validation`, `currentPlan`, `filterBar`, `results`, `headline`,
  `footer`, `help`, `copy`, `languageSwitcher`). Identical key paths and
  identical `{placeholder}` names as `de.json` — the `messages.test.ts` parity
  test enforces both.

### Hardcoded four-locale spots to extend

- **`src/components/LanguageSwitcher.tsx`** — add `pt: "Português"`,
  `es: "Español"` to `LANGUAGE_NAMES` (each language's endonym, matching the
  existing convention).
- **`src/components/InsuranceComparator.tsx`** (`DATE_LOCALE`, line ~47) — add
  `pt: "pt-PT"`, `es: "es-ES"`. Typed `Record<Locale, string>`, so this is a
  compile error until done. European variants chosen to match the largest
  resident communities in Switzerland; only affects the footer publication-date
  display.
- **`src/lib/format.ts`** — extend the module-local `Locale` type to include
  `"pt" | "es"` and add entries to the three lookup maps:
  - `MEMBER_COUNT_UNITS`: `pt: { million: "mi.", thousand: "mil" }`,
    `es: { million: "M", thousand: "mil" }`
  - `INSURED_WORD`: `pt: "segurados"`, `es: "asegurados"`
  - `AS_OF_WORD`: `pt: "em"`, `es: "en"`

  The existing `?? …de` fallbacks mean a missing entry degrades gracefully
  rather than crashing, but the design philosophy from 2026-08-15 is to carry a
  proper per-locale set.

### Deliberately unchanged

- **`src/lib/productDescriptions.ts`** `LOCALES` — stays `de/en/fr/it`.
  `getProductDescription` returns `undefined` for an unrecognized locale, and
  callers already fall back to the generic per-Tarifart description
  (`copy.tarifart.{tarifart}.description`), which *is* translated in the new
  catalogs.
- **`formatChf`** — apostrophe thousands separator + `CHF` prefix is a Swiss
  currency convention independent of UI language (requirement.md §9).
- **Admin** (`/admin`, `/admin/login`, `/api/admin/**`) — outside `[locale]`,
  German-only, untouched.
- **`robots.ts`** — already points at the single `sitemap.xml`.

### Insurance terminology (PT / ES)

Machine-authored copy will use standard terms consistently:

| Concept | DE | PT | ES |
|---|---|---|---|
| Basic insurance (OKP) | Grundversicherung | seguro de base obrigatório | seguro básico obligatorio |
| Deductible | Franchise | franquia | franquicia |
| Premium | Prämie | prémio | prima |
| Health insurer | Krankenkasse | seguradora de saúde | aseguradora de salud |
| Free choice of doctor | freie Arztwahl | livre escolha do médico | libre elección de médico |
| Accident coverage | Unfalldeckung | cobertura de acidentes | cobertura de accidentes |

## Testing

- **`src/messages/messages.test.ts`** — add `["pt", pt]` and `["es", es]` to the
  `it.each` parity table so key-set and placeholder-set equality with `de.json`
  is enforced for the new catalogs.
- **`src/app/sitemap.test.ts`** — 8 → 12 entries (6 locales × 2 paths); the
  expected URL list and the per-entry `hreflang` key list become
  `["de", "en", "es", "fr", "it", "pt"]`; the per-locale alternate-target loop
  iterates all six. Update the two stale `it(...)` titles ("all four" → "all six",
  "8 entries" → "12 entries").
- **`src/lib/format.test.ts`** — add `formatMemberCount` and
  `formatMemberCountDetail` assertions for `pt` and `es` (e.g.
  `formatMemberCount(813080, "es")` → `"813 mil"`,
  `formatMemberCountDetail(1537730, 2024, "pt")` → `"1'537'730 segurados · em 2024"`).
- **Automated:** `npm test`, `npm run build` (type-check + static generation of
  the two new locale routes).
- **Manual pass:** `/pt` and `/es` render the comparator and `/how-it-works`;
  `Accept-Language: pt` / `es` on `/` redirects to the right locale; switcher
  preserves query params (`?plz=…&birthYear=…`) across a switch to PT/ES;
  `<html lang="pt">` / `"es"`; per-locale `<title>` and `hreflang` (including
  the two new entries and `x-default`) present in view-source.

## Follow-up (non-blocking)

Native FR/IT review was already flagged as a recommended follow-up in the
2026-08-15 design; PT and ES join that list. Users may make coverage/switching
decisions based on this text, so a native review pass before treating these
locales as production-final is advisable.
