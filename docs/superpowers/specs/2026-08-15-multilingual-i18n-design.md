# Multilingual Support (DE/FR/IT/EN) — Design

**Date:** 2026-08-15
**Status:** Approved

## Problem

The site ([requirement.md](../../../requirement.md) §12) shipped v1 German-only,
explicitly deferring "non-German languages." The comparator now needs to reach
French/Italian-speaking Swiss regions and English-speaking residents, and the languages
need to be genuinely discoverable — indexed and rankable per language, not just toggled
client-side — so this is a proper i18n project, not a translation-string patch.

**Goal:** serve the comparator in German (existing default), French, Italian, and
English, each on its own crawlable URL, with a switcher to move between them.

**Explicitly out of scope:**
- The admin panel (`/admin`, `/admin/login`, `/api/admin/**`) — internal tool, stays
  German-only, unprefixed, untouched.
- Translating data content (insurer names, BAG figures) — only UI copy is translated.
- Professional/native-speaker translation review — see Content & Translation below.
- Dedicated per-locale SEO landing pages/content strategy (still deferred per §12) —
  this covers the existing comparator surface in 4 languages, not new content.

## Architecture: next-intl, locale-prefixed routing

Using `next-intl` rather than hand-rolling middleware/routing/hreflang: it's the
established App Router i18n library, and the SEO requirements here (locale routing,
`Accept-Language` negotiation, per-locale metadata, `hreflang` alternates) are exactly
what it's built to get right. Hand-rolling this is a lot of easy-to-get-subtly-wrong
surface for a one-time setup cost that's not the interesting part of this project.

- **Locales:** `de` (default), `fr`, `it`, `en`. All four are URL-prefixed —
  `prixio.ch/de/`, `/fr/`, `/it/`, `/en/` — including German, so there's one canonical
  URL shape and no ambiguity between `/` and `/de/` for search engines.
- Existing comparator routes move under `src/app/[locale]/...`. `src/app/page.tsx`
  becomes `src/app/[locale]/page.tsx`; layout gains a `[locale]` param and sets
  `<html lang={locale}>` dynamically (replacing the current hardcoded `lang="de"`).
- `/admin`, `/admin/login`, `/api/**` stay exactly where they are today, outside the
  `[locale]` segment. The i18n middleware matcher excludes them explicitly, and the
  existing admin token-gate middleware logic is unaffected.
- Bare `/` redirects to the best-matching locale using the request's `Accept-Language`
  header, falling back to `de` when no supported language matches. This is a standard
  redirect (not a client-side flash) so crawlers land on a real locale URL immediately.

## Content & translation

- All hardcoded German UI strings move out of components into
  `messages/{de,fr,it,en}.json`, namespaced by feature area: `inputs`, `results`,
  `currentPlan`, `headline`, `filterBar`, `footer`, `languageSwitcher`, `meta`.
  Components read them via `useTranslations()`.
- `src/lib/copy.ts` (`TARIFART_LABELS`, `TARIFART_DESCRIPTIONS`, `ALTERSKLASSE_LABELS`)
  is replaced by message-file entries under a `copy` namespace — these are exactly the
  kind of user-facing label/description text the other components' strings are, so they
  belong in the same translation system rather than a separate hardcoded module.
- **`src/lib/validate.ts` changes to return error codes, not literal strings** — e.g.
  `{ valid: false, code: "invalidPlzFormat" }` instead of a hardcoded German sentence.
  The three call sites (`PlzInput`, `BirthYearInput`, `CurrentPlanSection`) map the code
  to translated text via `useTranslations()`. Pure lib code shouldn't own display text
  once there's more than one language to display it in.
- `src/lib/format.ts`: `formatMemberCount`/`formatMemberCountDetail` take a `locale`
  parameter and use a per-locale unit/word set (e.g. "Mio."/"Tsd."/"Versicherte" for
  German vs. "M"/"k"/"insured" for English, and FR/IT equivalents).
  **`formatChf`'s apostrophe thousands-separator and `CHF` prefix stay identical across
  all four locales** — that's a Swiss currency convention independent of UI language
  (requirement.md §9), not something that changes with the reader's language.
- The footer's `new Date(...).toLocaleDateString("de-CH", ...)` becomes locale-aware:
  `de-CH` / `fr-CH` / `it-CH` / `en-CH` based on the active locale.
- Translations for FR/IT/EN are written directly as part of this implementation.
  Insurance terminology (Franchise/franchise/franchigia, Grundversicherung/assurance de
  base/assicurazione di base, Prämie/prime/premio, etc.) will be used correctly, but
  this is machine-authored copy, not reviewed by a native speaker or insurance
  professional. **Recommended follow-up (not blocking this implementation):** a native
  FR and IT review pass before treating those locales as production-final, since users
  may make coverage/switching decisions based on this text.

## Language switcher

- A small control near the "Prämienvergleich" heading at the top of the input card,
  showing the current language and expanding to the other three
  (Deutsch/Français/Italiano/English).
- Switching replaces the locale segment in the current path and **preserves all query
  parameters** — a shared comparison link (`?plz=8000&birthYear=1990&...`) keeps working
  identically after a language switch, just rendered in the new language.

## SEO

- Per-locale `generateMetadata`: translated `title`/`description`/OpenGraph/Twitter
  tags for all four locales (replacing the current single hardcoded German metadata
  block in `layout.tsx`).
- Every page emits `alternates.languages` (`hreflang`) linking to all 4 locale versions
  of itself plus `x-default` (pointing at the `de` version, the negotiation fallback).
- `sitemap.ts` emits one entry per locale (4 URLs total) instead of the single base URL,
  each carrying its language alternates for hreflang-in-sitemap.
- `robots.ts` is unchanged — it already points at the one `sitemap.xml`, which now just
  lists 4 URLs instead of 1.

## Testing

- `validate.test.ts` updates to assert on error codes instead of German literal
  messages.
- `format.test.ts` updates for the locale-parameterized `formatMemberCount`/
  `formatMemberCountDetail` signatures.
- Manual verification pass: `/`, `/de`, `/fr`, `/it`, `/en` all render correctly;
  `Accept-Language`-based redirect from `/`; switcher preserves query state across a
  language change; per-locale `<title>`/meta tags and `hreflang` tags spot-checked via
  view-source.
