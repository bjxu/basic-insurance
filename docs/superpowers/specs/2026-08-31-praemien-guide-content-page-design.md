# Prämien guide content page (SEO)

Date: 2026-08-31

## Problem

The comparator app is a transactional tool — a filter/results UI — with no
content that ranks for informational Swiss health-insurance queries like
"prämien 2027". BAG publishes each year's official premium rates in late
September, and search volume for "prämien {year}" spikes hard from
publication through the 30 November switching deadline. A new domain has
essentially no chance of ranking for the bare head term "krankenkassen"
(dominated by comparis.ch, priminfo.ch, bonus.ch), but a well-built,
timely, canton-specific informational page has a real shot at "prämien
{year}"-style queries, which reward freshness and specificity more than
raw domain authority.

This is the first of two planned SEO pieces (the second, JSON-LD structured
data, is a separate follow-up spec). It is German-only for now —
"krankenkassen"/"prämien" are German-language terms; French/Italian
equivalents ("primes {year}", "premi {year}") are a different keyword
research and copy exercise, deliberately deferred.

## Scope

- A new evergreen content page at `/de/praemien`, covering how premiums are
  set, a real canton-by-canton average premium table computed from the
  app's existing ingest data, key switching deadlines, and an FAQ.
- Ships now (before BAG's 2027 data exists) with whatever premium year is
  currently loaded (2026), so it's indexed and has some standing before the
  autumn search spike. The canton table and year-mentioning copy update
  automatically once the ingest pipeline is re-run against BAG's 2027 CSV —
  no code change needed for the yearly refresh.
- **Stable URL, not year-specific**: `/de/praemien`, never `/de/praemien-2027`.
  A year-specific URL matches the exact query string but restarts the SEO
  clock (backlinks, any accumulated ranking) every single year. A stable
  URL keeps accumulating authority indefinitely, with the current year
  expressed in the page's title/H1/copy instead of its path.
- Out of scope, deliberately: JSON-LD/FAQPage structured data (own spec,
  next); French/Italian versions; any admin/CMS tooling for editing the
  prose (it's a normal translation-message-file page, edited like
  `how-it-works` is).

## Route and page structure

Follows the existing `src/app/[locale]/how-it-works/page.tsx` pattern
exactly, minus the multi-locale ceremony that page carries (it's on every
locale; this page is German-only):

- `src/app/[locale]/praemien/page.tsx` — `generateMetadata` (title/description
  from a new `meta.praemienGuide*` message key group, `alternates.languages`
  only pointing at the German URL plus `x-default`) and the page shell
  (`BackToComparisonLink` at top and bottom, same as `how-it-works`).
  For any locale other than `de`, the page calls `notFound()` — the route
  exists, but only the German version is real content.
- `src/components/help/PraemienGuideContent.tsx` — the actual content
  component, mirroring `HowItWorksContent`'s role. Takes no `full`/summary
  variant (unlike `HowItWorksContent`, which is also embedded inline
  elsewhere) — this content only ever appears on its own page.
- Copy lives in `src/messages/de.json` under a new `praemienGuide` message
  namespace (section intros, FAQ question/answer pairs, deadline text).
  The exact German prose is drafted during implementation, not spelled out
  here — this spec fixes the section list and each section's purpose,
  not its wording.

### Sections, in order

1. **H1/intro** — "Krankenkassenprämien {currentYear}: Was Sie wissen
   müssen." States when BAG announces rates (late September) and what
   typically drives year-over-year change.
2. **How premiums are set** — canton/region, age group (Kind/Jung/
   Erwachsen), franchise, model (Standard/Hausarzt/Telmed/HMO), accident
   coverage — written for a reader who has never used the comparator,
   introducing the same concepts the tool's filters use.
3. **Canton premium table** — see below.
4. **Key deadlines** — the 30 November switching deadline (cancellation
   must reach the current insurer by then; the switch takes effect
   1 January), reusing the same fact already stated in
   `help.guide.rules.item3` rather than re-deriving it.
5. **FAQ** — 4-6 question/answer pairs ("Wann muss ich wechseln?", "Was ist
   die Franchise?", "Steigen die Prämien jedes Jahr?", "Was bedeutet
   Standardmodell?", etc.), stored as structured question/answer pairs (not
   free prose) so the upcoming JSON-LD spec can consume them directly as
   `FAQPage` entities without restructuring.
6. **CTA back to the comparator** — same `BackToComparisonLink`-style
   pattern used at the top/bottom of `how-it-works`.

A one-line note near the table states plainly that it reflects the most
recently published BAG data (naming the year), so the page reads correctly
both before and after the 2027 refresh without needing a special "coming
soon" state.

## Canton premium table

New pure module `src/lib/praemienGuide.ts`:

```ts
export type CantonAverage = { kanton: string; averagePremium: number };

// Pure — no I/O. rows are the raw (pre-levy) PremiumRow[] for `year`;
// levyPerMonthByYear is metadata.json's environmentalLevyPerMonth.
export function averagePremiumByCanton(
  rows: PremiumRow[],
  year: number,
  levyPerMonthByYear: Record<string, number>,
): CantonAverage[]

// I/O — reads public/data/premiums-{year}.json off disk.
export function readPremiumRows(year: number): Promise<PremiumRow[]>

// I/O — lists public/data/, returns the max year found among
// premiums-{year}.json files.
export function getPremiumDataYear(): Promise<number>
```

- Canton is derived from `praemienregionId.split("-")[0]` — confirmed exact:
  `scripts/ingest/parseRegions.ts` builds every `praemienregionId` as
  `${kanton}-${region}`, so no join against `Gemeinde` data is needed.
- Filtered first to a **fixed reference profile**, stated in a named
  constant (not buried inline) and echoed in the page's own copy next to
  the table so the numbers are self-explanatory:
  `{ altersklasse: "erwachsen", franchise: 300, tarifart: "standard",
  unfalldeckung: true }`.
- `cheapestPerInsurer` (already in `src/lib/lookup.ts`) is applied *before*
  averaging, per canton, so an insurer with many overlapping product rows
  in the same canton doesn't skew that canton's average.
- Each row's `monthlyPremium` has `applyEnvironmentalLevy` (already in
  `src/lib/environmentalLevy.ts`) applied *before* averaging, via the
  `year`/`levyPerMonthByYear` parameters — the same adjustment
  `InsuranceComparator.tsx` applies before displaying any price. Skipping
  this would show pre-levy tariff numbers nobody actually pays, and would
  visibly disagree with the comparator tool's own results for the same
  inputs. The caller passes `metadata.json`'s `environmentalLevyPerMonth`
  (already imported the same way `InsuranceComparator.tsx` does).
- Result: one row per canton (up to 26), each `{ kanton, averagePremium }`,
  sorted by `kanton` ascending — a plain, predictable table, not a ranked
  "cheapest canton" list (that framing invites the kind of stale/misleading
  claim a hand-maintained page risks — the whole point of computing this
  from real data is to avoid it).

**Corrected during planning — there is no existing server-side data load.**
The comparator only ever loads `PremiumRow[]` client-side, lazily per year,
via `fetch("/data/premiums-{year}.json")` in `InsuranceComparator.tsx`.
Since this page must be server-rendered with the table already in the HTML
(that's the entire SEO point), it needs its own server-side loader — a new
small function, `readPremiumRows(year)` (in `src/lib/praemienGuide.ts`),
reading `public/data/premiums-{year}.json` directly off disk with
`node:fs/promises` (`readFile(join(process.cwd(), "public", "data",
"premiums-" + year + ".json"), "utf-8")` then `JSON.parse`), mirroring how
`scripts/ingest.ts` already writes to that same path
(`PUBLIC_DATA_DIR = join(process.cwd(), "public", "data")`). This runs at
request/build time in a Server Component — never shipped to the client, so
it doesn't touch the existing client-side fetch path at all.

`getPremiumDataYear()` (below) is what tells this loader *which* year's
file to read — it doesn't hard-code a year.

## Metadata

- New `meta.praemienGuideTitle` / `meta.praemienGuideDescription` (and
  `og`/`twitter` variants, matching the existing `meta.howItWorksTitle`
  pattern) in `src/messages/de.json`, interpolating the current premium
  data year rather than hard-coding it.
- The "current premium data year" comes from a small helper,
  `getPremiumDataYear()` (in `src/lib/praemienGuide.ts`) — lists
  `public/data/` (`node:fs/promises` `readdir`), matches filenames against
  `premiums-(\d+)\.json`, and returns the max year found. This determines
  which file `readPremiumRows(year)` reads, so the title/H1 and the table
  can never drift apart (e.g. title says 2027 while the table is still
  showing 2026 rows) — both are driven by the same source of truth, and
  neither hard-codes a year.
- `sitemap.ts` gains one new entry for `/de/praemien` — German only, not
  looped across `routing.locales` like the other `INDEXABLE_PATHS` — with a
  `priority` comparable to `how-it-works`'s 0.6.

## Testing

- `src/lib/praemienGuide.test.ts` — `averagePremiumByCanton` (pure, no I/O)
  table-driven against small synthetic `PremiumRow[]` fixtures: correct
  per-canton grouping from `praemienregionId` prefixes, correct
  reference-profile filtering (rows outside the fixed profile excluded),
  `cheapestPerInsurer`-before-average ordering (an insurer with two rows in
  the same canton at different prices only contributes its cheaper one),
  correct averaging arithmetic, and that the levy is actually subtracted
  before averaging (a fixture with a known `levyPerMonthByYear` entry
  produces the levy-adjusted, not raw, average). `readPremiumRows` and
  `getPremiumDataYear` are I/O and get a couple of focused tests against
  fixture files in a temp directory (or against the real `public/data/`
  contents, whichever the implementer finds cleaner given how the rest of
  the ingest pipeline's tests are already structured) — not exhaustively
  unit-tested the way the pure function is.
- `sitemap.test.ts` extended to cover the new `/de/praemien` entry
  (present, German-only, not duplicated across other locales).
- No test for the prose content itself — consistent with `how-it-works`/
  `HowItWorksContent`, which also isn't prose-tested; the FAQ's
  question/answer *structure* (not wording) is implicitly exercised by
  whatever component renders it, same as any other translated content.

## Out of scope (explicitly deferred)

- JSON-LD/`FAQPage` structured data — separate spec, next.
- French (`primes {year}`) and Italian (`premi {year}`) versions — different
  keyword research and copy, not a translation pass of this page.
- Any "data last updated" banner beyond the one-line note described above.
- Automating the yearly BAG-CSV re-ingest itself — that pipeline already
  exists (`scripts/ingest/*`); this page just consumes its output.
