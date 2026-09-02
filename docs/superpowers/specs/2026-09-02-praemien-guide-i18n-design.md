# Prämien guide — translate to all locales

## Problem

The Prämien guide shipped German-only (`docs/superpowers/specs/2026-08-31-
praemien-guide-content-page-design.md`):

- `src/app/[locale]/praemien/page.tsx` calls `notFound()` for every locale
  except `de`, and `generateMetadata` returns `{}` for non-`de`.
- `src/components/help/PraemienGuideTeaser.tsx` renders German copy on every
  locale's homepage, wrapped in `lang="de"` with `locale="de"` forced on its
  link, so a `/fr` or `/it` visitor sees a German promo block above the
  comparator.
- The `praemienGuide` message namespace was copied verbatim (German text) into
  all six locale files as dead keys (`0ec19d8`), only ever read on `/de`.
- `src/app/sitemap.ts` special-cases a single `/de/praemien` entry with no
  hreflang alternates.

The 2026-08-31 spec deferred the other locales deliberately: "krankenkassen"/
"prämien" are German terms and the French/Italian keyword plays ("primes",
"premi") were called a separate follow-up. This spec is that follow-up. It
makes the guide real content in all six locales, at full SEO parity with
`how-it-works`.

## Decisions

- **All six locales.** fr, it, en, es, pt each get a fully translated guide,
  same as `how-it-works`.
- **SEO parity with `how-it-works`.** Per-locale `<title>`/description,
  hreflang alternates for all locales + `x-default`, one sitemap entry per
  locale. Titles/H1 are keyword-tuned per language, not literal glosses of the
  German.
- **URL path stays `/praemien` on every locale.** No localized slugs
  (`/fr/primes`). Matches how `how-it-works` keeps one path across locales.
- **Canton names: a typed per-locale map.** New `src/lib/cantonNames.ts`.
  Canton names are stable reference data, not prose, so they live in a typed
  module (same shape as today's `CANTON_NAMES_DE`), not in the message
  catalogs.
- **Machine-authored translations.** Consistent with requirement §5.4; a
  native-speaker review is already a documented §12 follow-up.

Out of scope: localized URL slugs; any CMS/editing tooling; automating the
hand-maintained projection figures; touching the canton-average aggregation
(it is locale-independent).

## Changes

### 1. `src/app/[locale]/praemien/page.tsx`

- Remove `if (locale !== "de") notFound()` from the page component.
- Remove `if (locale !== "de") return {}` from `generateMetadata`.
- Replace the German-only `alternates` with the `how-it-works` shape:

  ```ts
  alternates: {
    languages: {
      ...Object.fromEntries(
        routing.locales.map((l) => [l, `${baseUrl}/${l}/praemien`]),
      ),
      "x-default": `${baseUrl}/${routing.defaultLocale}/praemien`,
    },
  },
  ```

  Drop the self-referential `canonical` (how-it-works doesn't set one).
- `year`, `readPremiumRows`, `averagePremiumByCanton` and the projection
  wiring are unchanged — the numbers are the same in every locale.
- Rewrite the file header comment (no longer "German-only").

### 2. `src/components/help/PraemienGuideTeaser.tsx`

- Remove the `lang="de"` wrapper attribute.
- Remove `locale="de"` from the `<Link>` — it now points at `/praemien` in
  the active locale.
- Copy comes from the `praemienGuide` namespace in the active locale (no code
  change beyond removing the forcing); rewrite the header comment.
- Still renders its title as a styled `<p>`, not a heading (it sits above the
  page's own `<h1>`).
- Number/month formatting for the projection line: see §4.

### 3. `src/lib/cantonNames.ts` (new)

```ts
import type { Locale } from "@/i18n/routing";

export type CantonCode = "AG" | "AI" | /* … all 26 … */ "ZH";

export const CANTON_NAMES: Record<Locale, Record<CantonCode, string>> = {
  de: { /* moved verbatim from praemienGuide.ts */ },
  fr: { /* Genève, Berne, Bâle-Ville, Bâle-Campagne, Fribourg, Grisons,
           Lucerne, Neuchâtel, Argovie, Thurgovie, Zoug, Tessin, Valais,
           Vaud, Saint-Gall, Schaffhouse, Soleure, Appenzell Rh.-Ext.,
           Appenzell Rh.-Int., … */ },
  it: { /* Ginevra, Berna, Basilea Città, Basilea Campagna, Friburgo,
           Grigioni, Lucerna, Neuchâtel, Argovia, Turgovia, Zugo, Ticino,
           Vallese, Vaud, San Gallo, Sciaffusa, Soletta, … */ },
  en: { /* Geneva, Berne, Basel-Stadt, Basel-Landschaft, Fribourg, Grisons,
           Lucerne, Neuchâtel, Aargau, Thurgau, Zug, Ticino, Valais, Vaud,
           St. Gallen, Schaffhausen, Solothurn, Appenzell Ausserrhoden,
           Appenzell Innerrhoden, … */ },
  es: { /* Ginebra, Zúrich, Berna, Basilea-Ciudad, Basilea-Campiña, Friburgo,
           Grisones, Lucerna, Neuchâtel, Argovia, Turgovia, Zug, Tesino,
           Valais, Vaud, San Galo, Schaffhausen, Soleura, … */ },
  pt: { /* Genebra, Zurique, Berna, Basileia-Cidade, Basileia-Campo,
           Friburgo, Grisões, Lucerna, Neuchâtel, Argóvia, Turgóvia, Zug,
           Tessino, Valais, Vaud, São Galo, Schaffhausen, Solothurn, … */ },
};
```

Where no established exonym exists, the local (German/French/Italian) name is
kept. The exact spellings are filled in during implementation and flagged for
the §12 native-speaker review pass.

- `src/lib/praemienGuide.ts`: delete the inline `CANTON_NAMES_DE`. It may
  re-export `CANTON_NAMES_DE` from the new module for back-compat, or callers
  are updated — the implementation plan picks one. The module must stay
  browser-safe (no Node built-ins) because the client component imports it.

### 4. `src/components/help/PraemienGuideContent.tsx`

- Canton column: `CANTON_NAMES[locale]?.[kanton] ?? CANTON_NAMES.de[kanton] ??
  kanton`, with `locale` from `useLocale()`.
- Projection line: format `projection.comparis`, `projection.bag.low`,
  `projection.bag.high` with `new Intl.NumberFormat(locale)` and
  `projection.asOf` (an ISO `YYYY-MM` string) with
  `new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" })`, then
  pass the formatted strings plus `projYear: projection.year` into
  `t("projected", …)`.
- The same formatting is needed in `PraemienGuideTeaser`. Extract a pure
  helper — `formatProjection(projection, locale)` returning
  `{ projYear, comparis, bagLow, bagHigh, asOf }` — into `praemienGuide.ts`
  so both components share it. It stays pure and browser-safe.

### 5. `src/data/praemienProjection.json`

Restructure to language-neutral values (today's `"4,5 bis 5 %"` embeds the
German word *bis*; `"Mai 2026"` is a German month):

```json
{
  "_comment": "… (unchanged intent) …",
  "year": 2027,
  "asOf": "2026-05",
  "comparis": { "increase": 3.7, "source": "https://www.comparis.ch/…" },
  "bag": { "low": 4.5, "high": 5, "source": "https://www.20min.ch/…" }
}
```

- `src/data/praemienProjection.test.ts` updates to the new shape.

### 6. `src/messages/*.json`

**`praemienGuide` namespace** — translate every leaf into fr/it/en/es/pt with
correct insurance terminology:

- `h1` — keyword-tuned per language (fr *Primes d'assurance-maladie {year}*,
  it *Premi cassa malati {year}*, en *Swiss health insurance premiums
  {year}*, es *Primas del seguro de salud {year}*, pt *Prémios do seguro de
  saúde {year}*), not a literal gloss.
- `intro`, `howSet.{heading,intro,region,age,franchise,model,accident}`,
  `table.{heading,note,cantonHeader,premiumHeader}`,
  `deadlines.{heading,text}`, `faq.{heading,q1..q5,a1..a5}`, `teaserCta`.
- `table.note` names the CO₂/VOC levy credit — translate the term, don't drop
  it.
- `projected` — reworded per language with the connective ("bis" → "à" / "–")
  and the office acronym localized (BAG → OFSP / UFSP / FOPH; es/pt keep an
  acronym + gloss). New placeholder set, identical in all six files:
  `{projYear} {comparis} {bagLow} {bagHigh} {asOf}`. (Drops the currently
  hardcoded "2027" in the German string.)

**`meta` namespace** — `praemienGuideTitle` / `praemienGuideDescription`
translated and keyword-tuned per language. Keep the `{year}` / `{nextYear}`
placeholders exactly as the German has them so `messages.test.ts` parity
holds.

### 7. `src/app/sitemap.ts`

- Add `"/praemien"` to `INDEXABLE_PATHS`.
- Delete the special-cased `praemienEntry` and the `return [...localizedEntries,
  praemienEntry]` — just `return localizedEntries`.
- Result: 18 entries (6 locales × `["", "/how-it-works", "/praemien"]`), each
  with hreflang alternates for all six locales.
- Priority for `/praemien` falls in the existing `path === "" ? … : 0.6`
  branch (0.6), same as `/how-it-works`.

### 8. Tests

- **`src/app/sitemap.test.ts`**: update the entry-count test (13 → 18, and
  the URL-set expectation now includes `/{locale}/praemien` for all six);
  remove the `e.url !== ".../de/praemien"` filter in the hreflang test and
  extend its per-path targeting to the `/praemien` path.
- **`src/lib/praemienGuide.test.ts`**: retarget the `CANTON_NAMES_DE` describe
  block to `CANTON_NAMES` from the new module; assert every locale's map has
  all 26 codes and spot-check a couple of exonyms (e.g. `CANTON_NAMES.fr.GE
  === "Genève"`, `CANTON_NAMES.it.TI === "Ticino"`). `averagePremiumByCanton`
  and `buildFaqJsonLd` tests unchanged.
- **`src/messages/messages.test.ts`**: unchanged — it now also verifies the
  new `projected` placeholder set is consistent across locales.
- **`src/data/praemienProjection.test.ts`**: update to the new JSON shape.
- No new page-render test beyond what exists; `how-it-works` has none either.

## Risks

- **Translation quality.** Machine-authored; the §12 native-speaker review now
  covers this page too. Canton exonyms in es/pt are the least certain — the
  fallback chain (`locale → de → raw code`) means a missing entry degrades to
  the German name, never a crash.
- **`praemienGuide.ts` staying browser-safe.** The new shared
  `formatProjection` helper and the canton map must not pull in Node built-ins
  (the client component imports them). Same constraint the file already
  documents.
