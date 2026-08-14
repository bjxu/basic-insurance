# Member-Count Badge — Design

**Date:** 2026-08-14
**Status:** Approved

## Problem

The results list ([PlanRow.tsx](../../../src/components/results/PlanRow.tsx)) currently
differentiates insurers only by name, model, and price. A small regional Kasse and a
large national insurer look equivalent apart from the number — there's no signal for
"how established is this insurer," which is one input people actually weigh when
switching (a discount from an unfamiliar insurer reads differently than the same discount
from a well-known one).

**Goal:** show each insurer's total OKP membership as a badge on its results row, sourced
from real BAG data (per Core Principle #3, "Real data only"). This is scoped to be the
first of potentially several "quality" badges in the same spot — a customer-satisfaction
badge was raised in discussion but has no identified real data source yet (BAG doesn't
publish satisfaction/quality ratings; that would come from a private source that hasn't
been vetted for reuse), so it's explicitly **out of scope** here. The layout only needs to
leave room for it later.

## Data source

BAG publishes `Versichertenbestand_CH.csv`/`.xlsx` as part of the same
"Krankenversicherungsprämien" open-data family (opendata.swiss / opendata.bagnet.ch) that
`Praemien_CH.csv` — our existing premium source — comes from. It's the per-insurer
enrollment figure from BAG's *"Statistik der obligatorischen Krankenversicherung"*
publication.

**Confirmed OKP-only, not OKP+VVG combined:** that publication is scoped entirely to
KVG-regulated OKP business (BAG's actual regulatory mandate — supplementary/VVG insurance
is FINMA's territory). Voluntary VVG products (e.g. *Taggeldversicherung*) are reported in
a separate table section of the same publication, confirming OKP and VVG figures aren't
blended. The CH-wide OKP total (~8.79 million for 2022) lines up with Switzerland's
resident population, consistent with an OKP-only headcount. No filtering is needed to
strip out VVG numbers.

**Open item for implementation:** the exact download URL and column layout aren't
verified yet — search-based lookups today hit a 403 from opendata.swiss and an empty
response from the bagnet.ch download endpoint (both blocked automated fetching, not
evidence the file doesn't exist). This needs the same hands-on verification
`downloadRaw.ts`'s two URLs got during the 2026-08-11 planning for the original ingest —
confirm the real URL, actual column names, and which year(s) are covered before writing
the parser.

## Design

### Ingest: new `scripts/ingest/members.ts`

Parses the enrollment file and joins it to insurers by BAG insurer code (the same `ci`
code premiums use, and the same codes hand-maintained in `INSURER_NAMES`
in [insurers.ts](../../../scripts/ingest/insurers.ts)). Mirrors that file's existing
shape/test pattern.

- `buildInsurersJson` (`insurers.ts`) gains an optional members-map parameter and emits
  `memberCount?: number` per entry — present only when that insurer code is found in the
  enrollment file.
- An insurer code from the enrollment file that isn't in `INSURER_NAMES` (or vice versa —
  a premium insurer with no enrollment row) is **not** a hard failure: skip with a
  warning, matching the "add the missing code here" tolerance already documented in
  `insurers.ts`'s header comment. That insurer's badge is simply omitted downstream —
  same defensive-omission pattern as the already-approved discount badge's "no Standard
  premium to compare against" case.
- `metadata.json` gains one new field: `memberCountAsOf: number` — the publication year of
  the enrollment data. This is a single dataset-wide fact (one BAG publication covering
  all insurers for one year), not per-insurer, so it doesn't belong on individual
  `insurers.json` entries. It will very likely differ from (lag behind) `publicationDate`
  / `availableYears`, since enrollment statistics are published on a slower cycle than
  premiums — that's expected, not a bug.
- Reuses the existing `validateIngest.ts` round-trip verification approach for the new
  file rather than inventing separate failure handling.

### Types

`types.ts` gains a shared exported type, replacing the ad hoc local one currently
duplicated in `CurrentPlanSection.tsx`:

```ts
export type Insurer = {
  insurerCode: string;
  insurerName: string;
  memberCount?: number; // OKP enrollment, BAG Versichertenbestand — absent if unmatched
};
```

`CurrentPlanSection.tsx`'s local `type Insurer = { insurerCode: string; insurerName: string }`
is replaced with an import of this type (targeted cleanup — we're already touching this
exact shape for the new consumer, so de-duplicating it here is in scope; no behavior
change for that component, which doesn't render member counts).

### Data flow into the UI

`memberCount` is insurer-level and time-invariant with respect to region/franchise/model —
unlike `insurerName`, it is **not** denormalized onto every `PremiumRow` (that would mean
carrying the same value across hundreds of rows per insurer for no benefit). Instead:

- `InsuranceComparator.tsx` builds a `Record<string, number>` (insurerCode → memberCount)
  once from `INSURERS` (memoized — same lifecycle as the existing `INSURERS` cast at
  line 23), filtering out insurers with no `memberCount`.
- Threaded down `PlanList` → `PlanRow` as a new `memberCounts: Record<string, number>`
  prop, the same way `currentInsurerCode` already flows today.
- `PlanRow` looks up `memberCounts[plan.insurerCode]`; renders the badge only when a value
  is present.

### UI — new column between insurer info and price (validated via visual companion)

A new flex column in `PlanRow`, positioned between the insurer-info block (name + model
badge) and the yoy%/price cluster — this was compared against two alternatives (inline
next to the insurer name, and trailing after the price) via mockups and this placement was
selected.

- Content: 👥 icon + abbreviated count — "1.6 Mio.", "820 Tsd." — via a new
  `formatMemberCount` helper in [format.ts](../../../src/lib/format.ts), alongside the
  existing `formatChf`. Exact rounding/boundary rules (e.g. how 999'999 rounds, the
  Mio./Tsd. cutover point) are pinned down in the implementation plan, not this doc.
- Tooltip (native `title` attribute — no extra JS/UI dependency): exact grouped count
  using `formatChf`'s apostrophe thousands-separator convention, plus the data's
  publication year — e.g. `1'623'481 Versicherte · Stand 2024`.
- The column is `flex-direction: column`, so a second badge (e.g. a future satisfaction
  badge) can stack underneath without a layout rework. Only the member-count badge is
  implemented now.
- No badge (not a placeholder/zero) is rendered for a row whose insurer has no
  `memberCount` — consistent with the discount badge's existing defensive-omission
  pattern for missing comparison data.

## Testing strategy

- `scripts/ingest/members.ts`: code→count mapping; an enrollment-file code with no match
  in `INSURER_NAMES` (and vice versa) is skipped with a warning, not a thrown error.
- `formatMemberCount` (`format.test.ts`): boundary values — sub-1,000 exact digits,
  1,000 → "1 Tsd.", the 999,999→1,000,000 Mio./Tsd. cutover and its rounding — exact
  boundary table to be finalized in the implementation plan.
- `PlanRow` component tests: badge renders with the correct abbreviated text and tooltip
  when `memberCounts[insurerCode]` is present; column renders with no badge (not blank
  space with a placeholder) when absent.
- `InsuranceComparator`/`PlanList`: prop-threading coverage — the memoized
  insurerCode→memberCount map is built correctly and passed down unchanged.

## Self-Review

- **Placeholders:** none — every section states a concrete decision; the one genuinely
  unresolved item (exact BAG download URL/columns) is explicitly called out as an
  implementation-start task, not left ambiguous about *what* to do when it's tackled.
- **Internal consistency:** matches the already-approved discount-badge design's
  defensive-omission pattern for missing comparison data, and follows `insurerName`'s
  existing precedent for how insurer-level facts reach `PremiumRow`-adjacent UI, while
  explicitly diverging from denormalizing onto every row (with the reasoning stated) since
  `memberCount` doesn't vary per row the way `insurerName` conceptually does per plan.
- **Scope:** this doc covers only the member-count badge, end-to-end (data → ingest →
  types → UI). Customer-satisfaction badging is explicitly deferred — no data source
  identified — and is called out as a non-goal here rather than left implicit.
- **Ambiguity check:** "insurer missing from the enrollment file" is explicitly specified
  as defensively handled (badge omitted, ingest doesn't fail) rather than left for
  implementation to guess; the OKP-vs-VVG scope question that motivated this design round
  is answered with supporting evidence, not asserted from memory alone.
