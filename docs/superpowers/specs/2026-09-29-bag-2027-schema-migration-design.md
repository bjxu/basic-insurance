# BAG 2027 Schema Migration — Design

**Date:** 2026-09-29
**Status:** Approved

## Problem

BAG published the 2027 premium data (confirmed live on `opendata.bagnet.ch`: ~220k rows,
all `Geschäftsjahr=2027`, all 32 insurers present). Running `npm run ingest` against it
fails immediately: `scripts/ingest/parsePremiums.ts` throws on the first row —
`unrecognized Altersklasse "AKA_03_ERW"`.

Investigation shows BAG changed the *value encoding* of every coded column in
`Praemien_CH.csv` for 2027 (column names are unchanged), and — separately — restructured
the `Tariftyp` classification itself:

- Hyphenated codes became underscore-delimited with new prefixes (`AKL-KIN` →
  `AKA_01_KIN`, `MIT-UNF` → `MIT_UNF`, `PR-REG CH0` → `PR_REG_0`, `FRA-300` →
  `FRA_01_E_0300`). Cosmetic — same categories, same meaning.
- `Tariftyp` is not cosmetic. Cross-referencing every product present in both years' files
  by (insurer, tariff code) gives this crosswalk:

  | 2026 category | → | 2027 category | count |
  |---|---|---|---|
  | TAR-HAM (Hausarzt) | → | PRAXIS | 33 |
  | TAR-DIV (telmed/other) | → | TEL_DIG | 32 |
  | TAR-BASE (standard) | → | BASE | 32 |
  | TAR-HMO (HMO) | → | PRAXIS | 17 |
  | TAR-DIV | → | FLEX | 9 |
  | TAR-HAM | → | FLEX | 8 |
  | TAR-HAM | → | TEL_DIG | 1 |
  | TAR-DIV | → | PRAXIS | 1 |

  BAG's own page on restricted-choice models
  (bag.admin.ch/de/krankenversicherung-versicherungsmodelle-mit-eingeschraenkter-wahl-der-leistungserbringer)
  confirms this is deliberate, not noise: for 2027 **PRAXIS merges Hausarzt and HMO**
  ("Erstanlaufstelle ist immer eine vorgegebene Arztpraxis"), and the old TAR-DIV bucket
  splits into **TEL_DIG** (phone/digital first contact — the telmed concept, unchanged in
  substance) and a genuinely new **FLEX** category ("mehrere Erstanlaufstellen zur
  Auswahl" — a choice of several first-contact options, e.g. practice, telmed, or
  pharmacy). A fifth category, PHARM (pharmacy-first), is defined by BAG but not present
  in any insurer's current 2027 filing.

Separately, `versichertenbestand.csv` also changed format (semicolon → comma delimiter),
which `scripts/ingest/members.ts` would fail on independently once `parsePremiumRows`
stopped being the first thing to error.

This is bigger than a parser bug fix: `Tarifart` is a domain type consumed across the
app's filters, badges, URL state, and 6-locale UI copy, and `premiums-2026.json` is
already published containing real `"hausarzt"`/`"hmo"` values that must keep rendering
correctly — 2026 and 2027 are shown side by side, not one replacing the other.

## Goal

Get `npm run ingest` working against the 2027 files, producing `premiums-2027.json` and an
updated `metadata.json` (`availableYears: [2026, 2027]`), while:

1. Correctly reflecting BAG's actual 2027 classification (per requirement.md §11.4, item 4:
   "should be driven by BAG's actual Tarifart classification... rather than hardcoded").
2. Not corrupting or reinterpreting the real, already-published 2026 data.
3. Keeping the parser able to re-process either year's raw CSV (both are committed under
   `data/raw/` via git history), since a future bugfix might require re-ingesting 2026.

## Non-goals

- Not adding a `pharm` Tarifart value now — BAG defines the category but no 2027 product
  uses it. The existing "unknown Tariftyp → andere, with a console warning" fallback
  (`scripts/ingest.ts`'s `unknownTariftypes` reporting) already covers it defensively; it
  becomes a real category only if/when it actually appears in the data.
- Not making `ModelList.tsx`'s help-guide list year-aware (i.e. showing only the
  categories relevant to whichever year is currently selected). Both years are live
  right now, so listing all 5 alternative-model concepts is acceptable; revisit if a
  future year's reclassification would make this list keep growing unbounded.
- Not touching `discountVsStandardPct`/`environmentalLevy.ts`/anything price-calculation
  related — this is purely about classification and raw-code parsing.

## Data model: `Tarifart` grows additively

```ts
export type Tarifart =
  | "standard"
  | "hausarzt" // 2026-only: BAG's real, separate Hausarzt classification that year
  | "hmo"      // 2026-only: ditto for HMO
  | "praxis"   // 2027+: BAG's merged Hausarzt+HMO category
  | "flex"     // 2027+: BAG's new "multiple first-contact options" category
  | "telmed"
  | "andere";
```

`hausarzt`/`hmo` are not deprecated or removed — they are 2026's authentic classification
and stay wired exactly as today. `praxis`/`flex` are new. `telmed` is shared by both years
(TAR-DIV and TEL_DIG both mean "phone/digital first contact"). Every `Record<Tarifart, …>`
in the codebase must now cover all 7 keys (TypeScript's exhaustiveness check on
`TARIFART_PRIORITY` will force this).

**Priority order** (`TARIFART_PRIORITY` in `lookup.ts`, also `ALL_TARIFARTS`'s order,
which drives group display order in `ProductList.tsx` and `ModelList.tsx`'s row order):

```
standard=0, hausarzt=1, praxis=2, telmed=3, flex=4, hmo=5, andere=6
```

Groups practice-first concepts together (hausarzt, praxis) and phone/flexible concepts
together (telmed, flex); `hmo` moves last among the alternatives since it's 2026-only
going forward. Within any single year's data only the relevant subset of these ever
actually appears (2026 rows are never tagged `praxis`/`flex`; 2027 rows are never tagged
`hausarzt`/`hmo`), so this ordering is inert for whichever categories aren't present.

**Badge colors** (`MODEL_TAG_CLASSES` in `tarifart-style.ts`):

```ts
export const MODEL_TAG_CLASSES: Record<string, string> = {
  hmo: "bg-warning-container text-on-warning-container",
  telmed: "bg-tertiary-container text-on-tertiary-container",
  hausarzt: "bg-success-container text-on-success-container",
  praxis: "bg-success-container text-on-success-container", // same family as hausarzt
  flex: "bg-secondary-container text-on-secondary-container", // new, previously-unused token
};
```

## Raw-code parsing: recognize both formats

`scripts/ingest/parsePremiums.ts` — maps and parsers extended to accept either year's raw
codes (not a swap):

```ts
export const ALTERSKLASSE_MAP: Record<string, Altersklasse> = {
  "AKL-KIN": "kind", "AKL-JUG": "jung", "AKL-ERW": "erwachsen",
  "AKA_01_KIN": "kind", "AKA_02_JUG": "jung", "AKA_03_ERW": "erwachsen",
};

export const TARIFART_MAP: Record<string, Tarifart> = {
  "TAR-BASE": "standard", "TAR-HAM": "hausarzt", "TAR-HMO": "hmo", "TAR-DIV": "telmed",
  "BASE": "standard", "PRAXIS": "praxis", "FLEX": "flex", "TEL_DIG": "telmed",
};
```

```ts
export function parseFranchise(code: string): number {
  const old = /^FRA-(\d+)$/.exec(code);
  if (old) return Number(old[1]);
  const neu = /^FRA_\d+_[EJK]_(\d+)$/.exec(code); // stufe/altersgruppe-letter/amount
  if (neu) return Number(neu[1]);
  throw new Error(`parseFranchise: unrecognized Franchise code "${code}"`);
}

export function parseRegionNumber(code: string): string {
  const old = /^PR-REG CH(\d+)$/.exec(code);
  if (old) return old[1];
  const neu = /^PR_REG_(\d+)$/.exec(code);
  if (neu) return neu[1];
  throw new Error(`parseRegionNumber: unrecognized Region code "${code}"`);
}

export function parseUnfalldeckung(code: string): boolean {
  if (code === "MIT-UNF" || code === "MIT_UNF") return true;
  if (code === "OHN-UNF" || code === "OHN_UNF") return false;
  throw new Error(`parseUnfalldeckung: unrecognized Unfalleinschluss "${code}"`);
}
```

Verified against the live 2027 file: region numbering is consistent between
`praemien.csv` (`PR_REG_3`) and `praemienregionen.xlsx` (bare `3`) for the same
canton/Gemeinde, so no change needed in `parseRegions.ts` beyond what's already there.
Franchise letter suffix (`E`/`J`/`K`) confirmed present for all three Altersklasse values.

The sibling-discount drop rule (only child rate `K1` kept) becomes a dual-literal check in
both `parsePremiums.ts` and `validateIngest.ts` (which deliberately restates this
predicate rather than importing it, to catch drift — see its own file comment):

```ts
if ((r.Altersklasse === "AKL-KIN" || r.Altersklasse === "AKA_01_KIN") && r.Altersuntergruppe !== "K1") continue;
```

`scripts/ingest/members.ts`: `delimiter: ";"` → `delimiter: ","`. `normalizeInsurerCode`
needs no change — `Number("0008") === Number("8")`, so it already handles both padded and
unpadded codes identically.

## UI copy: 6 locales × 2 new keys

`copy.tarifart.praxis` / `copy.tarifart.flex`, added to `de/fr/it/en/es/pt.json` alongside
the existing 5 entries, same machine-translated tone:

| Locale | praxis label | praxis description | flex label | flex description |
|---|---|---|---|---|
| de | Hausarzt/HMO | Erstanlaufstelle immer bei der gewählten Praxis oder dem HMO-Zentrum | Flex | Mehrere Erstanlaufstellen zur Wahl, z. B. Praxis, Telmedizin oder Apotheke |
| en | Family doctor/HMO | First point of contact is always your chosen practice or HMO centre | Flex | Choice of several first points of contact, e.g. practice, telmed, or pharmacy |
| fr | Médecin de famille/HMO | Premier contact toujours auprès du cabinet ou du centre HMO choisi | Flex | Choix entre plusieurs premiers points de contact, p. ex. cabinet, télémédecine ou pharmacie |
| it | Medico di famiglia/HMO | Primo punto di contatto sempre presso lo studio o il centro HMO scelto | Flex | Scelta tra più punti di primo contatto, ad es. studio medico, telemedicina o farmacia |
| es | Médico de familia/HMO | El primer punto de contacto es siempre la consulta o el centro HMO elegido | Flex | Elección entre varios primeros puntos de contacto, p. ej. consulta, telemedicina o farmacia |
| pt | Médico de família/HMO | O primeiro ponto de contacto é sempre o consultório ou o centro HMO escolhido | Flex | Escolha entre vários primeiros pontos de contacto, por ex. consultório, telemedicina ou farmácia |

`messages.test.ts`'s locale-completeness check extends to cover both new keys across all
6 locales automatically (it walks the message tree, not a hardcoded key list — to be
confirmed while implementing; add explicit assertions if not).

## Every 7-value consumer, updated additively

- `src/lib/url-state.ts` — `VALID_TARIFARTEN` gets all 7. This also means old shared URLs
  containing `models=hausarzt,hmo,...` keep decoding correctly — no graceful-degradation
  edge case introduced.
- `src/app/api/log-inquiry/route.ts` — `TARIFARTEN` array, all 7.
- `src/components/help/ModelList.tsx` — `ALT_MODEL_KEYS` becomes
  `["hausarzt", "praxis", "telmed", "flex", "hmo"]` (5 alt-model rows under the existing
  "alternative models" group; see Non-goals on year-awareness).
- `src/components/admin/Dashboard.tsx` — label map gets `praxis: "Praxis"` and
  `flex: "Flex"` entries alongside the existing 4.
- `scripts/crawl/extractDescription.ts` — the few-shot prompt's example lines get `praxis`
  and `flex` descriptions appended, matching the existing `hausarzt`/`telmed`/`hmo` lines.

## Docs

`requirement.md`:
- §11.4 item 4 (the open question anticipating exactly this) gets struck through as
  resolved, same style as item 2.
- The Tarifart glossary row (§2/terminology) and the help-guide model list description
  (§3) get a short parenthetical noting the 2027 BAG reclassification (Hausarzt+HMO →
  merged "Praxis" category; new "Flex" category), so the spec doesn't read as
  contradicting what's shipped.

## Testing

- `parsePremiums.test.ts`: extend fixtures to cover both old- and new-format raw rows for
  every coded column (Altersklasse, Unfalleinschluss, Region, Franchise, Tariftyp
  including all 4 2027 values). Add cases asserting `TAR-HAM`→`hausarzt` and
  `PRAXIS`→`praxis` are distinct outputs (i.e. the parser doesn't collapse them itself —
  that only happens if a 2027 file actually uses `PRAXIS`).
- `validateIngest.test.ts`: extend the sibling-discount-drop fixture to cover both
  `AKL-KIN` and `AKA_01_KIN`.
- `members.test.ts`: switch fixture to comma-delimited, keep a regression case for
  zero-padded codes via `normalizeInsurerCode`'s own unit tests (unchanged function).
- `metadata.test.ts`: no change (already covers `mergeAvailableYears`/`carryForwardEnvironmentalLevy`
  generically).
- New: `tarifart-style`/`lookup` tests asserting all 7 `Tarifart` values have a
  `TARIFART_PRIORITY` entry and a `MODEL_TAG_CLASSES` entry (a compile-time
  `Record<Tarifart, …>` already enforces the former; the latter is a plain object and
  worth a runtime assertion so a forgotten color doesn't silently fall back to
  `DEFAULT_MODEL_TAG_CLASSES`).
- `messages.test.ts`: extend to assert `copy.tarifart.praxis`/`copy.tarifart.flex` exist
  with `label`+`description` in all 6 locales.
- Full ingest run against the real downloaded 2027 files (`npm run ingest
  --publication-date 2026-09-29`) as an end-to-end check once unit tests pass, verifying
  `premiums-2027.json` is produced and `metadata.json` shows `availableYears: [2026, 2027]`.

## Yearly maintenance note

Add a comment next to `TARIFART_MAP`/`ALTERSKLASSE_MAP` noting that BAG has changed raw
code formats between at least two consecutive years (2026→2027), so a future year's
ingest failure on an "unrecognized code" error should first check whether BAG changed
value encodings again, not assume a bug in this parser.
