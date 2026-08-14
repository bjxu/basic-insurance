# Service-Quality Badge — Design

**Date:** 2026-08-14
**Status:** Approved

> **Note (added during a later fix wave):** read this doc alongside the
> [implementation plan](../plans/2026-08-14-service-quality-badge.md), which supersedes
> parts of it with real verified data:
> (a) the Groupe Mutuel duplication guidance below turned out not to be needed — real
> data showed sub-brands (Avenir Assurance, Philos Assurance, etc.) are rated
> independently by bonus.ch, each with its own entry, no duplication;
> (b) the "Open Items" section below was resolved during plan-writing with real,
> verified source figures, not left open at implementation time;
> (c) **as of this fix wave, the design also requires at least 2 independent sources per
> badge** — a policy added after a final whole-branch review found that insurers with
> only a single, undisclosed-methodology, conflicted source (bonus.ch) were showing
> misleadingly higher badges than insurers rated by multiple independent surveys. See
> the plan and `src/data/serviceQuality.ts`'s header comment for the full reasoning.
>
> **Further correction (2026-08-14, post-PR):** the moneyland figures below were
> re-checked against a direct screenshot of moneyland's own table, which covers 12
> insurers, not the 7 reported by an earlier indirect web-search summary — and shows
> Groupe Mutuel scored 7.4 on the same "Gesamtzufriedenheit" scale as everyone else, not
> a separate excluded metric as this doc originally claimed. `src/data/serviceQuality.ts`
> now reflects the corrected data; 16 insurers carry a badge (was 14).

## Problem

The member-count badge design ([2026-08-14-member-count-badge-design.md](2026-08-14-member-count-badge-design.md))
explicitly reserved a second badge slot — the results row's new column is
`flex-direction: column` specifically so a future "quality" badge can stack under the
👥 member-count badge without a layout rework. That doc deferred the second badge
because no BAG/official open dataset covers customer satisfaction or service quality.

This doc re-investigated that gap (2026-08-14) and confirms it's still true:

- **BAG**: publishes enrollment, premiums, reserves, and administrative costs — no
  satisfaction/quality data.
- **Ombudsstelle Krankenversicherung** (the official KVG complaints-mediation body):
  publishes real annual statistics, but only as CH-wide totals (by topic, language,
  intervention outcome) — never broken down per insurer. Structurally unusable as a
  per-insurer data source, unlike the Ombudsman reports some other countries publish.
- **HSLU/IFZ "Touchpoints Insurance"** (2022): the one genuinely academic source found
  (Hochschule Luzern, n=1,005 survey, disclosed NPS methodology) — but its public PDF
  only names 3 of the 19 insurers it studied (Smile 57.1, Concordia 43.2, KPT 37.2 NPS),
  and it was co-sponsored by two of the insurers it scored (CSS, Groupe Mutuel). Too
  sparse and too conflicted to use alone.

**Decision**: rather than wait indefinitely for a clean public source, or pick a single
commercial survey, this badge uses a **disclosed average across three commercial
consumer-satisfaction surveys** (moneyland.ch, comparis.ch, bonus.ch), each normalized
to its own scale and shown individually in the tooltip. This is a deliberate divergence
from this project's usual "real data only" sourcing (requirement.md Core Principle #3),
which up to now has always meant one traceable primary/official source. That principle
is preserved in spirit — every number is real, published, and cited — but not in its
usual form, since no official source exists here. See "Data provenance & legal read"
below for why this divergence is considered acceptable.

## Data provenance & legal read

Three sources, none of them open/licensed government data:

| Source | Methodology | Scale | Sample | Coverage confirmed so far |
|---|---|---|---|---|
| moneyland.ch | Ipsos survey, single "Gesamtzufriedenheit" question | 1–10 | n=1,500 (DE-/FR-CH, 18–74) | 12 insurers (see below) |
| comparis.ch | Innofact survey, composite of 5 criteria | ~1–6 (Swiss school-grade style) | n=4,500 | 3 of 18 confirmed (Helsana/Swica/ÖKK=5.1, Assura=4.7) |
| bonus.ch | Undisclosed algorithm; bonus.ch is an insurance broker with paid "Partner" insurers | ~1–6 | undisclosed | ~12 of ~35 confirmed |

**Verified 2026 moneyland figures** (own the cleanest methodology, used as-is) —
corrected 2026-08-14 against a direct screenshot of moneyland's own results table,
which covers 12 insurers, not the 7 an earlier indirect web-search summary reported:
Helsana 8.0, ÖKK 8.0, Sanitas 8.0, Swica 8.0, Atupri 7.9, Concordia 7.9, Visana 7.9,
CSS 7.8, KPT 7.8, Sympany 7.5, Groupe Mutuel 7.4, Assura 7.2. The earlier claim that
Groupe Mutuel's figure (reported then as 6.5) was a different, excluded metric did not
hold up against the real table — Groupe Mutuel appears in the same Punkte/Note columns
as every other insurer, scored 7.4 ("Gut"), the same "Gesamtzufriedenheit" scale as the
rest. Applied to Avenir Assurance (343) and Philos Assurance (1535) — the two Groupe
Mutuel sub-brands that also carry a bonus.ch score — giving each 2 independent sources.

**Verified 2026 comparis figures**: Helsana/Swica/ÖKK = 5.1 (tied first), Assura = 4.7
(lowest of 18 rated). The remaining ~14 insurers' individual scores need verification
before implementation — flagged, not guessed at.

**Verified bonus.ch figures** (undated snapshot, re-verify at implementation time):
Assura 4.9, CSS 5.2, KPT 5.1, Sanitas 5.2, Aquilana 5.4, Atupri 5.2, EGK 5.3, Helsana
5.2, ÖKK 5.3, Swica 5.4, Visana 5.2, Vivao Sympany 5.2.

**Why averaging across incompatible scales/methodologies is acceptable here, with
conditions**: raw scores from a 1–10 survey and a ~1–6 composite can't be meaningfully
compared as-is. The mitigation is (a) normalize each to a 0–100% fraction of its own
scale before averaging, and (b) **disclose every input, not just the output** — the
badge tooltip lists each contributing source's raw score, scale, and year, so a
skeptical user can see exactly what was averaged rather than trusting an opaque number.
This doesn't make the average methodologically rigorous (it still blends a
single-question survey, a 5-criteria composite, and an undisclosed algorithm), but full
disclosure is the honest way to ship it rather than presenting a fabricated-looking
single figure.

**Why manual/cited instead of automated ingest**: none of these three publish an open,
licensed data feed — they're commercial survey write-ups. Facts/scores aren't
copyrightable under Swiss law (only the expression — article wording, chart design —
is), so citing a handful of published numbers with visible attribution is standard,
low-risk practice, the same way news outlets cite each other's polling data. This is
materially different from BAG's open-government-data license the rest of this app
relies on, so the data is **hand-transcribed once a year, not scraped**, matching each
source's own publish cadence, with the source name/year/URL always visible in the UI.

## Design

### Data storage — hand-maintained, separate from the BAG ingest pipeline

New file `src/data/serviceQuality.ts`. Deliberately **not** part of `scripts/ingest.ts`
or merged into `insurers.json` — that pipeline is specifically "parsed from BAG's
published files," and this data has a different provenance, license posture, and
refresh cadence (annual manual re-check per source, not a `npm run ingest` re-run).
Keeping them separate means a reader of `insurers.ts`/`ingest.ts` never has to wonder
whether commercial survey data is hiding in the "real BAG data" pipeline.

```ts
export type ServiceQualitySourceScore = {
  sourceName: string; // "moneyland.ch" | "comparis.ch" | "bonus.ch"
  rawScore: number; // as published, e.g. 8.0 or 5.1
  scaleMax: number; // the source's own ceiling — 10 for moneyland, 6 for comparis/bonus.ch
  sourceYear: number;
  sourceUrl: string;
};

export type ServiceQualityRating = {
  insurerCode: string; // BAG insurer code — see INSURER_NAMES
  sources: ServiceQualitySourceScore[]; // 1–3 entries, whichever sources cover this insurer
};

export const SERVICE_QUALITY_RATINGS: ServiceQualityRating[] = [
  // Populated at implementation time from the verified figures above, plus the
  // remaining comparis/bonus.ch figures still needing verification (see Open Items).
];
```

Storing each source's raw score (not a pre-computed blend) means the tooltip can show
its work, and an insurer covered by only 1–2 of the 3 sources is handled the same way
as one covered by all 3 — no special case.

`insurerCode` mapping note: moneyland/comparis/bonus.ch rate insurer *brands*, which
mostly map 1:1 to a single BAG code (e.g. Helsana → `1562`), except **Groupe Mutuel**,
which is 4 separate BAG codes (`343`, `1479`, `1507`, `1535` — see `INSURER_NAMES` in
[insurers.ts](../../../scripts/ingest/insurers.ts)). If Groupe Mutuel ends up covered
by comparis/bonus.ch's genuine overall-satisfaction figures (its moneyland figure is
excluded, see above), the same `sources` array is duplicated across all 4 of its
`ServiceQualityRating` entries — one real rating, applied to every legal entity under
that brand, the same way a customer experiences "Groupe Mutuel" as one brand regardless
of which entity underwrites their specific product.

### Computation — `lookup.ts`

New pure function alongside the existing derivation helpers (`computeHeadline`,
`discountVsStandardPct`):

```ts
/** Mean of each source's (rawScore / scaleMax), as a 0–100 percentage. Rounds to the
 *  nearest integer for display. Works the same whether `sources` has 1, 2, or 3 entries
 *  — there's no special-casing for partial coverage. */
export function averageServiceQualityPct(sources: ServiceQualitySourceScore[]): number
```

### UI — stacks under the member-count badge, same column

`PlanRow` renders a second line under the 👥 badge, only for insurers with a
`ServiceQualityRating`:

- Content: ⭐ icon + `formatServiceQualityPct` — e.g. `"⭐ Ø 82%"`. The `Ø` (German for
  "average") is part of the label deliberately, so the badge itself signals "this is an
  average across sources," not a single authoritative score — consistent with the
  disclosure principle above; it shouldn't read as more definitive than it is.
- Tooltip (native `title`, same convention as the member-count badge): every
  contributing source's raw score, its own scale, and the shared year — e.g.:
  ```
  Ø 82 % aus 3 Quellen (2026)
  moneyland.ch: 8.0/10
  comparis.ch: 5.1/6
  bonus.ch: 5.2/6
  ```
- New `formatServiceQualityPct(pct: number): string` and
  `formatServiceQualityDetail(rating: ServiceQualityRating, averagePct: number): string`
  in [format.ts](../../../src/lib/format.ts), alongside `formatMemberCount`.
- No badge (not a placeholder) for a row whose insurer has no `ServiceQualityRating` —
  same defensive-omission pattern as the member-count badge and the discount badge.
- Prop-threaded `InsuranceComparator → PlanList → PlanRow` the same way `memberCounts`
  is: a `Record<string, ServiceQualityRating>` built once from `SERVICE_QUALITY_RATINGS`.

### Coverage note

Because bonus.ch and comparis cover insurers moneyland doesn't (e.g. Aquilana, EGK), the
badge's effective coverage is the **union** of all three sources' insurers, further
narrowed by the >=2-source policy (see the fix-wave note at the top of this doc). As
shipped: 16 of the 34 known insurer codes carry a badge.

## Testing strategy

- `format.test.ts`: `formatServiceQualityPct` (rounding to nearest integer) and
  `formatServiceQualityDetail` (exact multi-line tooltip text, including the disclosed
  per-source breakdown).
- `lookup.test.ts`: `averageServiceQualityPct` — single source (average = its own
  fraction), multiple sources with different scales (verifies normalization, not a
  naive raw average), and a real example using the verified moneyland/comparis/bonus.ch
  Helsana figures (8.0/10, 5.1/6, 5.2/6) with a hand-computed expected result.
- `serviceQuality.test.ts` (new): sanity-checks the hand-typed data itself, since unlike
  the member-count badge there's no CSV parser to catch typos —
  - every `insurerCode` in `SERVICE_QUALITY_RATINGS` exists in `INSURER_NAMES`;
  - every `rawScore` is `> 0` and `<= scaleMax`;
  - Groupe Mutuel's 4 codes (if present) carry identical `sources` arrays.
- `PlanRow` component: no test file (project has no React testing infra — see the
  member-count badge plan's Global Constraints); verified by running the app.

## Open Items (implementation-start work, not guessed at here)

1. **Complete comparis.ch figures** for the ~14 insurers beyond Helsana/Swica/ÖKK/Assura
   (of its 18 rated) — needs direct verification against comparis's 2026 published
   ranking before writing `SERVICE_QUALITY_RATINGS`.
2. **Complete bonus.ch figures** for insurers beyond the ~12 confirmed above, and
   confirmation that bonus.ch's scale ceiling is really 6 (not verified from its site
   directly — inferred from comparis's similar range).
3. **Whether Groupe Mutuel gets a badge at all**: depends on whether comparis/bonus.ch's
   figures for it (if any) are genuine overall-satisfaction numbers, not another
   different-metric case like moneyland's.
4. **Sequencing**: this design assumes the member-count badge
   ([2026-08-14-member-count-badge.md](../plans/2026-08-14-member-count-badge.md)) is
   implemented first, since the column layout and prop-threading pattern build directly
   on top of it. If that plan hasn't landed yet, the implementation plan for this badge
   needs to build both, in order.

## Self-Review

- **Placeholders**: none in the design decisions themselves; the three Open Items above
  are genuinely open (real data not yet collected) and are explicitly scoped as
  implementation-start verification work, not left ambiguous about *what* to do.
- **Internal consistency**: follows the member-count badge's established patterns
  (defensive omission, `flex-direction: column` stacking, native-`title` tooltips,
  prop-threading shape) everywhere they apply, and explicitly calls out every place this
  design diverges from that precedent (separate hand-maintained file instead of the
  ingest pipeline; disclosed multi-source average instead of one official figure) along
  with the reasoning, rather than silently reusing a pattern that doesn't fit.
- **Scope**: covers the service-quality badge end-to-end (data provenance → storage →
  computation → UI), building on top of the already-approved member-count badge design.
  Does not re-litigate that design's own decisions.
- **Ambiguity check**: "insurer covered by 0/1/2/3 sources" is explicitly specified as
  handled uniformly (average of whatever's available, or no badge if none); the
  Groupe-Mutuel-different-metric case and the multi-BAG-code brand-mapping case are both
  called out with concrete handling rather than left for implementation to guess.
