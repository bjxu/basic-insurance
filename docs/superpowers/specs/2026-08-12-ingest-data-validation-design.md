# Ingest Data Validation — Design

**Date:** 2026-08-12
**Status:** Approved

## Problem

The premium prices shown on the site come from a build-time ETL (`scripts/ingest.ts`)
that parses the official BAG premium CSV (`data/raw/praemien.csv`, ~217k rows) into
`PremiumRow[]`, which is then shipped as static JSON
(`public/data/premiums-{year}.json`) and read directly by the app's lookup logic.

Today, correctness of that transform relies entirely on unit tests against small
hand-written CSV fixtures (`scripts/ingest/parsePremiums.test.ts`). Those tests verify
the *mapping rules* are right for the cases someone thought to write, but nothing
checks that the transform was applied correctly and completely to the *real, full*
source file — a bug that only manifests on real data (an unexpected value, an
off-by-one row drop, a value attached to the wrong row) would ship silently.

**Goal:** Guarantee that every price the site serves is traceable, value-for-value,
back to the official BAG source file it was ingested from — automatically, as part of
every ingest run, with no separate step to remember.

**Explicitly out of scope** (per discussion): keeping the ingested data in sync with
future BAG republications (staleness), and cross-checking against an independent
external oracle (e.g. a live calculator). This design addresses ETL/transform
correctness against the source file already committed to the repo.

## Design

### What gets validated

A new function, `validateIngestOutput(csvText, rows)`, runs after `parsePremiumRows`
produces its output and before anything is written to disk. It performs four checks
against the exact raw CSV bytes that produced `rows`:

1. **Conservation** — every source row is accounted for as either kept (present in
   `rows`) or deliberately dropped (sibling-discount `K3`/`K4`/`K5` rows, or
   invalid-canton rows like `ZE`/`ZR`). `rows.length + droppedSiblingRows +
   droppedCantonRows` must equal the total source row count. Nothing vanishes or
   duplicates silently.
2. **Uniqueness** — no two output rows share the same full natural key
   (`insurerCode`, `praemienregionId`, `altersklasse`, `franchise`, `unfalldeckung`,
   `tarifart`, `tarifCode`, `year`). A collision means two distinct BAG products got
   merged or one silently overwrote the other.
3. **Value cross-check** — for every output row, look up its source CSV record by
   natural key and assert `monthlyPremium` matches the raw `Prämie` field exactly.
   Catches mapping bugs (e.g. a value attached to the wrong row) that row-count
   checks alone can't see.
4. **Read-after-write** — after `public/data/premiums-{year}.json` is written, read
   it back and deep-compare it against the in-memory `rows`. Closes the loop to what
   actually ships; catches serialization or write-path bugs.

### Where it lives

`scripts/ingest/validateIngest.ts` — a new, pure, independently unit-testable module
(fixture-driven tests, same style as `parsePremiums.test.ts`). It reuses the existing
mapping tables/helpers (`ALTERSKLASSE_MAP`, `TARIFART_MAP`, franchise/region parsing)
from `parsePremiums.ts` so there is one source of truth for *how* a value maps, but
independently restates the drop conditions (sibling subgroup, invalid canton) as a
deliberate cross-check: if that business rule ever drifts between the parser and the
validator, the conservation check fails loudly instead of silently passing.

`scripts/ingest.ts` calls it right after parsing
(`const validation = validateIngestOutput(csvText, rows)`) and again for the
read-after-write check, post-`writeFile`.

### Failure behavior

Any failed check aborts the ingest via the existing `fail()` helper (non-zero exit)
**before** any file is written — a bad ingest can never land in the repo. The error
message names the failed check and lists up to ~10 concrete examples (natural key +
expected vs. actual), so a real problem is diagnosable from console output alone.

### Testing strategy

`scripts/ingest/validateIngest.test.ts` covers each check independently with small
fixture CSVs (mirroring `parsePremiums.test.ts`'s style): a clean pass, a missing row,
a duplicate-key collision, a mismatched premium value. The orchestration change in
`ingest.ts` (abort-before-write on failure) is exercised by running the real ingest
against the committed `data/raw/` files as part of implementation verification — the
same way the existing pipeline is manually verified today.

## Self-Review

- **Placeholder scan:** No TBD/TODO — every check, its location, and its failure
  behavior is fully specified.
- **Internal consistency:** The four checks match the natural key already established
  in the codebase (`c036af7`'s dedupe key, extended with `tarifCode` per the later
  product-disambiguation change) — no contradiction with existing `PremiumRow` shape
  or `parsePremiumRows` behavior.
- **Scope check:** Single, focused change — one new module, one new test file, small
  wiring change to `ingest.ts`. No decomposition needed.
- **Ambiguity check:** "100% correct" was narrowed via discussion to ETL/transform
  correctness against the committed source file, validated automatically on every
  `npm run ingest` run — not staleness detection, not external-oracle
  reconciliation. Both explicitly excluded above.
