# Service-Quality Badge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a disclosed, cross-source customer-satisfaction average (⭐) stacked
under the member-count badge (👥) on each results row, sourced from moneyland.ch,
comparis.ch, and bonus.ch, each normalized to its own scale and shown individually in
the tooltip.

**Architecture:** A new hand-maintained data file (`src/data/serviceQuality.ts`) holds
each insurer's raw scores from whichever of the three sources cover it — deliberately
kept out of the BAG ingest pipeline, since this is commercial survey data with no open
feed. A new pure function (`averageServiceQualityPct`, `lookup.ts`) normalizes each
source's `rawScore/scaleMax` and means them. The UI reads this the same way it reads
`memberCount` — a lookup map built once in `InsuranceComparator`, threaded through
`PlanList` to `PlanRow`, which renders the badge only when data exists (defensive
omission, no placeholder).

**Tech Stack:** TypeScript, Vitest, React 19 / Next.js, Tailwind (Material Design 3
token classes already in use in `PlanRow.tsx`).

## Prerequisite

**This plan assumes [2026-08-14-member-count-badge.md](2026-08-14-member-count-badge.md)
has already been fully executed** — every file diff below is written against that
plan's end state (`Insurer`/`Metadata` types, `MEMBER_COUNTS` map, the 👥 badge in
`PlanRow`). If that plan hasn't landed yet, execute it first; this plan does not
duplicate its tasks. If the real code differs from that plan's documented end state
(e.g. adjusted during its own review), reconcile against the actual files before
starting Task 5.

## Global Constraints

- **Disclosed average, not a single figure.** The badge text itself includes "Ø" (German
  for "average") and the tooltip always lists every contributing source's raw score,
  scale, and year — never just the blended percentage. This is the mitigation for
  averaging across incompatible methodologies (requirement.md Core Principle #3's "real
  data only" is preserved by making every input traceable, not by claiming rigor the
  average doesn't have).
- **Hand-maintained, not automated.** No ingest script, no scraping. `src/data/serviceQuality.ts`
  is manually re-verified against each source's own annual publish cadence.
- **Defensive omission.** An insurer with no rating from any of the three sources
  renders no badge at all — not "–" or "0%". Same pattern as the member-count and
  discount badges.
- **Refinement over the design doc's speculative Groupe Mutuel handling**: the design
  doc guessed that a Groupe Mutuel rating might need duplicating across its 4 BAG codes
  (`343`, `1479`, `1507`, `1535`) if the brand were rated as one unit. Real data
  collection (below) found the opposite: bonus.ch rates Groupe Mutuel's sub-brands
  **independently** (Avenir Assurance and Philos Assurance each have their own score;
  AMB Assurances and Mutuel Assurance have none), so each code gets its own
  `ServiceQualityRating` entry directly — no duplication logic needed anywhere in this
  plan.
- **No new test infrastructure** (matches the member-count plan's own constraint) — no
  React component tests; UI wiring in `PlanRow`/`PlanList`/`InsuranceComparator` stays
  thin/untested, verified by running the app.
- **Verified source data (2026-08-14)**, used directly in Task 3 — not re-derived or
  guessed at during implementation:
  - **moneyland.ch** (Ipsos, n=1,500, scale 1–10, "Gesamtzufriedenheit"):
    Helsana 8.0, ÖKK 8.0, Sanitas 8.0, Swica 8.0, Atupri 7.9, Concordia 7.9, Visana 7.9.
    (Groupe Mutuel's listed 6.5 is excluded — different metric, see the design doc.)
  - **comparis.ch** (Innofact, n=4,500, scale 1–6, per
    [presseportal.ch/.../100941089](https://www.presseportal.ch/de/pm/100003671/100941089)):
    Helsana 5.1, Swica 5.1, ÖKK 5.1, Aquilana 5.0, Concordia 5.0, EGK-Gesundheitskasse 5.0,
    KPT 5.0, Sana24 5.0, Sanitas 5.0, Visana 5.0, Atupri 4.9, CSS 4.9, Sympany 4.9, Assura 4.7.
  - **bonus.ch** (undisclosed n, scale 1–6 — Swiss school-grade convention, confirmed
    "1 (not acceptable) to 6 (very good)"): Assura 4.9, CSS 5.2, KPT 5.1, Sanitas 5.2,
    Agrisano 5.2, Aquilana 5.4, Atupri 5.2, Avenir Assurance (GM) 5.2, Concordia 5.2,
    EGK-Gesundheitskasse 5.3, Galenos 5.2, Helsana 5.2, ÖKK 5.3, Philos Assurance (GM) 5.2,
    sana24 5.2, sodalis 5.2, Swica 5.4, Visana 5.2, Vivao Sympany 5.2.

---

### Task 1: `ServiceQualitySourceScore` / `ServiceQualityRating` types

**Files:**
- Modify: `src/lib/types.ts`

**Interfaces:**
- Produces: `ServiceQualitySourceScore`, `ServiceQualityRating` — used by Task 3
  (`serviceQuality.ts`), Task 4 (`lookup.ts`), and Task 5 (`InsuranceComparator.tsx`,
  `PlanList.tsx`, `PlanRow.tsx`).

Types-only task, no test file — verify with the TypeScript compiler directly.

- [ ] **Step 1: Add the types to `src/lib/types.ts`**

Add after the `Insurer` type:

```ts
export type ServiceQualitySourceScore = {
  sourceName: string; // "moneyland.ch" | "comparis.ch" | "bonus.ch"
  rawScore: number; // as published, e.g. 8.0 or 5.1
  scaleMax: number; // the source's own ceiling — 10 for moneyland, 6 for comparis/bonus.ch
  sourceYear: number;
  sourceUrl: string;
};

// Customer-satisfaction rating for one insurer, disclosed as an average across
// whichever of moneyland.ch/comparis.ch/bonus.ch cover it — see
// docs/superpowers/specs/2026-08-14-service-quality-badge-design.md.
export type ServiceQualityRating = {
  insurerCode: string; // BAG insurer code — see INSURER_NAMES
  sources: ServiceQualitySourceScore[]; // 1–3 entries, whichever sources cover this insurer
};
```

- [ ] **Step 2: Verify with the TypeScript compiler**

Run: `npx tsc --noEmit`
Expected: no new errors (nothing references these types yet).

- [ ] **Step 3: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat(types): add ServiceQualitySourceScore and ServiceQualityRating"
```

---

### Task 2: `formatServiceQualityPct` / `formatServiceQualityDetail`

**Files:**
- Modify: `src/lib/format.ts`
- Modify: `src/lib/format.test.ts`

**Interfaces:**
- Consumes: `ServiceQualityRating` (Task 1).
- Produces: `formatServiceQualityPct(pct: number): string`,
  `formatServiceQualityDetail(rating: ServiceQualityRating, averagePct: number): string`
  — used by Task 5 (`PlanRow.tsx`).

- [ ] **Step 1: Write the failing tests**

Add to `src/lib/format.test.ts` (widen the existing import line and add two new
`describe` blocks):

```ts
import { formatChf, formatMemberCount, formatMemberCountDetail, formatServiceQualityPct, formatServiceQualityDetail } from "@/lib/format";
import type { ServiceQualityRating } from "@/lib/types";

describe("formatServiceQualityPct", () => {
  it("rounds to the nearest whole percent, prefixed with the average marker", () => {
    expect(formatServiceQualityPct(83.888888889)).toBe("Ø 84%");
    expect(formatServiceQualityPct(84.166666667)).toBe("Ø 84%");
  });
  it("rounds .5 up", () => {
    expect(formatServiceQualityPct(82.5)).toBe("Ø 83%");
  });
});

describe("formatServiceQualityDetail", () => {
  it("lists every source's raw score, scale, and a shared year, singular 'Quelle' for one source", () => {
    const rating: ServiceQualityRating = {
      insurerCode: "1560",
      sources: [
        { sourceName: "bonus.ch", rawScore: 5.2, scaleMax: 6, sourceYear: 2026, sourceUrl: "https://www.bonus.ch" },
      ],
    };
    expect(formatServiceQualityDetail(rating, 86.666666667)).toBe(
      "Ø 87% aus 1 Quelle (2026)\nbonus.ch: 5.2/6",
    );
  });

  it("lists all three sources, plural 'Quellen', using the real Helsana 2026 figures", () => {
    const rating: ServiceQualityRating = {
      insurerCode: "1562",
      sources: [
        { sourceName: "moneyland.ch", rawScore: 8.0, scaleMax: 10, sourceYear: 2026, sourceUrl: "https://www.moneyland.ch/de/krankenkassen-zufriedenheit-2026" },
        { sourceName: "comparis.ch", rawScore: 5.1, scaleMax: 6, sourceYear: 2026, sourceUrl: "https://www.presseportal.ch/de/pm/100003671/100941089" },
        { sourceName: "bonus.ch", rawScore: 5.2, scaleMax: 6, sourceYear: 2026, sourceUrl: "https://www.bonus.ch" },
      ],
    };
    expect(formatServiceQualityDetail(rating, 83.888888889)).toBe(
      "Ø 84% aus 3 Quellen (2026)\nmoneyland.ch: 8.0/10\ncomparis.ch: 5.1/6\nbonus.ch: 5.2/6",
    );
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/format.test.ts`
Expected: FAIL — `formatServiceQualityPct is not a function` /
`formatServiceQualityDetail is not a function`.

- [ ] **Step 3: Implement in `src/lib/format.ts`**

Add at the end of the file (after `formatMemberCountDetail`):

```ts
import type { ServiceQualityRating } from "./types";

// Disclosed cross-source average for the service-quality badge (PlanRow). "Ø" (German
// for "average") is part of the label deliberately — the badge shouldn't read as more
// authoritative than an average across differing methodologies actually is. See
// docs/superpowers/specs/2026-08-14-service-quality-badge-design.md.
export function formatServiceQualityPct(pct: number): string {
  return `Ø ${Math.round(pct)}%`;
}

// Full disclosure for the badge's tooltip: every contributing source's own raw score
// and scale, not just the blended output, so a skeptical user can see exactly what was
// averaged.
export function formatServiceQualityDetail(rating: ServiceQualityRating, averagePct: number): string {
  const year = rating.sources[0].sourceYear;
  const count = rating.sources.length;
  const header = `Ø ${Math.round(averagePct)}% aus ${count} Quelle${count === 1 ? "" : "n"} (${year})`;
  const lines = rating.sources.map((s) => `${s.sourceName}: ${s.rawScore.toFixed(1)}/${s.scaleMax}`);
  return [header, ...lines].join("\n");
}
```

(Move the `import type { ServiceQualityRating } from "./types";` line up to the top of
the file alongside any other imports, rather than mid-file — shown here inline only to
mark what's new.)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/format.test.ts`
Expected: PASS (all `formatChf`, `formatMemberCount`, `formatMemberCountDetail`,
`formatServiceQualityPct`, `formatServiceQualityDetail` tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/format.ts src/lib/format.test.ts
git commit -m "feat(format): add formatServiceQualityPct and formatServiceQualityDetail"
```

---

### Task 3: `serviceQuality.ts` data file

**Files:**
- Create: `src/data/serviceQuality.ts`
- Create: `src/data/serviceQuality.test.ts`

**Interfaces:**
- Consumes: `ServiceQualityRating` (Task 1), `INSURER_NAMES`
  (`scripts/ingest/insurers.ts`, existing).
- Produces: `SERVICE_QUALITY_RATINGS: ServiceQualityRating[]` — used by Task 5
  (`InsuranceComparator.tsx`).

This is hand-typed data, not derived from a parser — the sanity tests exist specifically
to catch typos (wrong insurer code, a score entered outside its scale) that a CSV
parser's own structure would normally rule out.

- [ ] **Step 1: Write the failing tests**

Create `src/data/serviceQuality.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { SERVICE_QUALITY_RATINGS } from "./serviceQuality";
import { INSURER_NAMES } from "../../scripts/ingest/insurers";

describe("SERVICE_QUALITY_RATINGS", () => {
  it("every insurerCode exists in INSURER_NAMES", () => {
    for (const rating of SERVICE_QUALITY_RATINGS) {
      expect(INSURER_NAMES[rating.insurerCode], `unknown insurer code "${rating.insurerCode}"`).toBeDefined();
    }
  });

  it("every source's rawScore is within (0, scaleMax]", () => {
    for (const rating of SERVICE_QUALITY_RATINGS) {
      for (const source of rating.sources) {
        expect(source.rawScore).toBeGreaterThan(0);
        expect(source.rawScore).toBeLessThanOrEqual(source.scaleMax);
      }
    }
  });

  it("has no duplicate insurerCode entries", () => {
    const codes = SERVICE_QUALITY_RATINGS.map((r) => r.insurerCode);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("every rating has at least one source", () => {
    for (const rating of SERVICE_QUALITY_RATINGS) {
      expect(rating.sources.length).toBeGreaterThan(0);
    }
  });

  it("Helsana (1562) carries all 3 sources with the verified 2026 figures", () => {
    const helsana = SERVICE_QUALITY_RATINGS.find((r) => r.insurerCode === "1562");
    expect(helsana?.sources).toEqual([
      { sourceName: "moneyland.ch", rawScore: 8.0, scaleMax: 10, sourceYear: 2026, sourceUrl: "https://www.moneyland.ch/de/krankenkassen-zufriedenheit-2026" },
      { sourceName: "comparis.ch", rawScore: 5.1, scaleMax: 6, sourceYear: 2026, sourceUrl: "https://www.presseportal.ch/de/pm/100003671/100941089" },
      { sourceName: "bonus.ch", rawScore: 5.2, scaleMax: 6, sourceYear: 2026, sourceUrl: "https://www.bonus.ch/Krankenkasse/Vergleich/Krankenkassenpraemie.aspx" },
    ]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/data/serviceQuality.test.ts`
Expected: FAIL — `Cannot find module './serviceQuality'`.

- [ ] **Step 3: Implement `src/data/serviceQuality.ts`**

```ts
// Hand-maintained, NOT part of the automated BAG ingest pipeline (scripts/ingest.ts).
// Sources: three Swiss consumer-satisfaction surveys, none of them open/licensed data
// — see docs/superpowers/specs/2026-08-14-service-quality-badge-design.md for the full
// provenance/legal reasoning. Re-verify and update by hand whenever a source publishes
// a new edition; there is no automated feed.
//
// Deliberately excluded: moneyland.ch's 2026 Groupe Mutuel figure (6.5) measures
// price/value, not "Gesamtzufriedenheit" like its other 7 scores — not the same metric,
// so not included here as if comparable.
//
// Groupe Mutuel's sub-brands (Avenir Assurance, Philos Assurance, AMB Assurances,
// Mutuel Assurance — BAG codes 343/1535/1507/1479) are rated independently by bonus.ch,
// not as one combined "Groupe Mutuel" figure — each gets its own entry below, no
// duplication needed.

import type { ServiceQualityRating } from "@/lib/types";

const MONEYLAND_2026 = {
  sourceName: "moneyland.ch",
  scaleMax: 10,
  sourceYear: 2026,
  sourceUrl: "https://www.moneyland.ch/de/krankenkassen-zufriedenheit-2026",
} as const;

const COMPARIS_2026 = {
  sourceName: "comparis.ch",
  scaleMax: 6,
  sourceYear: 2026,
  sourceUrl: "https://www.presseportal.ch/de/pm/100003671/100941089",
} as const;

const BONUS_CH_2026 = {
  sourceName: "bonus.ch",
  scaleMax: 6,
  sourceYear: 2026,
  sourceUrl: "https://www.bonus.ch/Krankenkasse/Vergleich/Krankenkassenpraemie.aspx",
} as const;

export const SERVICE_QUALITY_RATINGS: ServiceQualityRating[] = [
  { insurerCode: "8", sources: [{ ...COMPARIS_2026, rawScore: 4.9 }, { ...BONUS_CH_2026, rawScore: 5.2 }] }, // CSS
  { insurerCode: "32", sources: [{ ...COMPARIS_2026, rawScore: 5.0 }, { ...BONUS_CH_2026, rawScore: 5.4 }] }, // Aquilana
  { insurerCode: "290", sources: [{ ...MONEYLAND_2026, rawScore: 7.9 }, { ...COMPARIS_2026, rawScore: 5.0 }, { ...BONUS_CH_2026, rawScore: 5.2 }] }, // Concordia
  { insurerCode: "312", sources: [{ ...MONEYLAND_2026, rawScore: 7.9 }, { ...COMPARIS_2026, rawScore: 4.9 }, { ...BONUS_CH_2026, rawScore: 5.2 }] }, // Atupri
  { insurerCode: "343", sources: [{ ...BONUS_CH_2026, rawScore: 5.2 }] }, // Avenir Assurance (Groupe Mutuel)
  { insurerCode: "376", sources: [{ ...COMPARIS_2026, rawScore: 5.0 }, { ...BONUS_CH_2026, rawScore: 5.1 }] }, // KPT
  { insurerCode: "455", sources: [{ ...MONEYLAND_2026, rawScore: 8.0 }, { ...COMPARIS_2026, rawScore: 5.1 }, { ...BONUS_CH_2026, rawScore: 5.3 }] }, // ÖKK
  { insurerCode: "509", sources: [{ ...COMPARIS_2026, rawScore: 4.9 }, { ...BONUS_CH_2026, rawScore: 5.2 }] }, // Sympany
  { insurerCode: "881", sources: [{ ...COMPARIS_2026, rawScore: 5.0 }, { ...BONUS_CH_2026, rawScore: 5.3 }] }, // EGK
  { insurerCode: "941", sources: [{ ...BONUS_CH_2026, rawScore: 5.2 }] }, // sodalis
  { insurerCode: "1384", sources: [{ ...MONEYLAND_2026, rawScore: 8.0 }, { ...COMPARIS_2026, rawScore: 5.1 }, { ...BONUS_CH_2026, rawScore: 5.4 }] }, // Swica
  { insurerCode: "1386", sources: [{ ...BONUS_CH_2026, rawScore: 5.2 }] }, // Galenos
  { insurerCode: "1509", sources: [{ ...MONEYLAND_2026, rawScore: 8.0 }, { ...COMPARIS_2026, rawScore: 5.0 }, { ...BONUS_CH_2026, rawScore: 5.2 }] }, // Sanitas
  { insurerCode: "1535", sources: [{ ...BONUS_CH_2026, rawScore: 5.2 }] }, // Philos Assurance (Groupe Mutuel)
  { insurerCode: "1542", sources: [{ ...COMPARIS_2026, rawScore: 4.7 }, { ...BONUS_CH_2026, rawScore: 4.9 }] }, // Assura
  { insurerCode: "1555", sources: [{ ...MONEYLAND_2026, rawScore: 7.9 }, { ...COMPARIS_2026, rawScore: 5.0 }, { ...BONUS_CH_2026, rawScore: 5.2 }] }, // Visana
  { insurerCode: "1560", sources: [{ ...BONUS_CH_2026, rawScore: 5.2 }] }, // Agrisano
  { insurerCode: "1562", sources: [{ ...MONEYLAND_2026, rawScore: 8.0 }, { ...COMPARIS_2026, rawScore: 5.1 }, { ...BONUS_CH_2026, rawScore: 5.2 }] }, // Helsana
  { insurerCode: "1568", sources: [{ ...COMPARIS_2026, rawScore: 5.0 }, { ...BONUS_CH_2026, rawScore: 5.2 }] }, // sana24
];
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/data/serviceQuality.test.ts`
Expected: PASS (all 5 tests).

- [ ] **Step 5: Run the TypeScript compiler**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add src/data/serviceQuality.ts src/data/serviceQuality.test.ts
git commit -m "feat(data): add hand-maintained service-quality ratings (19 insurers)"
```

---

### Task 4: `averageServiceQualityPct` (lookup.ts)

**Files:**
- Modify: `src/lib/lookup.ts`
- Modify: `src/lib/lookup.test.ts`

**Interfaces:**
- Consumes: `ServiceQualitySourceScore` (Task 1).
- Produces: `averageServiceQualityPct(sources: ServiceQualitySourceScore[]): number` —
  used by Task 5 (`PlanRow.tsx`). Returns an unrounded 0–100 percentage — rounding
  happens at display time in `formatServiceQualityPct` (Task 2), the same split that
  `discountVsStandardPct`/`.toFixed(1)` already use in this codebase.

- [ ] **Step 1: Write the failing tests**

Add to `src/lib/lookup.test.ts` (widen the existing type-only import to include
`ServiceQualitySourceScore`, and the function import to include
`averageServiceQualityPct`):

```ts
import { averageServiceQualityPct, /* ...existing imports... */ } from "@/lib/lookup";
import type { ServiceQualitySourceScore } from "@/lib/types";

describe("averageServiceQualityPct", () => {
  it("returns the source's own fraction when there's only one", () => {
    const sources: ServiceQualitySourceScore[] = [
      { sourceName: "bonus.ch", rawScore: 5.2, scaleMax: 6, sourceYear: 2026, sourceUrl: "https://www.bonus.ch" },
    ];
    expect(averageServiceQualityPct(sources)).toBeCloseTo(86.666666667, 6);
  });

  it("normalizes each source to its own scale before averaging (real CSS 2026 figures)", () => {
    const sources: ServiceQualitySourceScore[] = [
      { sourceName: "comparis.ch", rawScore: 4.9, scaleMax: 6, sourceYear: 2026, sourceUrl: "https://www.presseportal.ch/de/pm/100003671/100941089" },
      { sourceName: "bonus.ch", rawScore: 5.2, scaleMax: 6, sourceYear: 2026, sourceUrl: "https://www.bonus.ch" },
    ];
    // (4.9/6 + 5.2/6) / 2 = 0.841666... -> 84.1666...%, NOT a naive raw average of 4.9/5.2.
    expect(averageServiceQualityPct(sources)).toBeCloseTo(84.166666667, 6);
  });

  it("normalizes a 1-10 scale alongside 1-6 scales (real Helsana 2026 figures)", () => {
    const sources: ServiceQualitySourceScore[] = [
      { sourceName: "moneyland.ch", rawScore: 8.0, scaleMax: 10, sourceYear: 2026, sourceUrl: "https://www.moneyland.ch/de/krankenkassen-zufriedenheit-2026" },
      { sourceName: "comparis.ch", rawScore: 5.1, scaleMax: 6, sourceYear: 2026, sourceUrl: "https://www.presseportal.ch/de/pm/100003671/100941089" },
      { sourceName: "bonus.ch", rawScore: 5.2, scaleMax: 6, sourceYear: 2026, sourceUrl: "https://www.bonus.ch" },
    ];
    // (0.8 + 0.85 + 0.866666...) / 3 = 0.838888... -> 83.8888...%
    expect(averageServiceQualityPct(sources)).toBeCloseTo(83.888888889, 6);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/lookup.test.ts`
Expected: FAIL — `averageServiceQualityPct is not a function`.

- [ ] **Step 3: Implement in `src/lib/lookup.ts`**

Add the import and function:

```ts
import type { HeadlineState, PremiumRow, SelfReportedPlan, ServiceQualitySourceScore, Tarifart } from "./types";
```

(widen the existing type-only import line at the top of the file to add
`ServiceQualitySourceScore`)

```ts
/** Mean of each source's (rawScore / scaleMax), as an unrounded 0–100 percentage.
 *  Normalizes before averaging so a 1–10 scale and a 1–6 scale aren't blended as raw
 *  numbers. Works the same whether `sources` has 1, 2, or 3 entries — no special-casing
 *  for partial coverage (docs/superpowers/specs/2026-08-14-service-quality-badge-design.md). */
export function averageServiceQualityPct(sources: ServiceQualitySourceScore[]): number {
  const fractions = sources.map((s) => s.rawScore / s.scaleMax);
  const mean = fractions.reduce((sum, f) => sum + f, 0) / fractions.length;
  return mean * 100;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/lookup.test.ts`
Expected: PASS (all pre-existing lookup tests plus the 3 new `averageServiceQualityPct` tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/lookup.ts src/lib/lookup.test.ts
git commit -m "feat(lookup): add averageServiceQualityPct"
```

---

### Task 5: UI wiring — `PlanRow` / `PlanList` / `InsuranceComparator`

**Files:**
- Modify: `src/components/InsuranceComparator.tsx`
- Modify: `src/components/results/PlanList.tsx`
- Modify: `src/components/results/PlanRow.tsx`

**Interfaces:**
- Consumes: `ServiceQualityRating` (Task 1), `SERVICE_QUALITY_RATINGS` (Task 3),
  `averageServiceQualityPct` (Task 4), `formatServiceQualityPct`/`formatServiceQualityDetail`
  (Task 2).
- Produces: the rendered badge — final task, no downstream consumers.

No test file (see Global Constraints). Verified by running the app. This task assumes
`InsuranceComparator.tsx`/`PlanList.tsx`/`PlanRow.tsx` are already in the
member-count-badge plan's post-Task-8 state (see Prerequisite above) — diffs below are
against that exact code.

- [ ] **Step 1: Build the service-quality lookup map in `InsuranceComparator.tsx`**

Change:

```ts
import type { CurrentPlan, Insurer, SelfReportedPlan, Tarifart } from "@/lib/types";

import insurersData from "@/data/insurers.json";
import metadata from "@/data/metadata.json";
import type { PremiumRow } from "@/lib/types";

const INSURERS = insurersData as Insurer[];
// Static — INSURERS is a module-level import, not component state, so this is derived
// once at module load, same lifecycle as INSURERS itself (no useMemo needed).
const MEMBER_COUNTS: Record<string, number> = Object.fromEntries(
  INSURERS.filter((i) => i.memberCount != null).map((i) => [i.insurerCode, i.memberCount!]),
);
```

to:

```ts
import type { CurrentPlan, Insurer, SelfReportedPlan, ServiceQualityRating, Tarifart } from "@/lib/types";

import insurersData from "@/data/insurers.json";
import metadata from "@/data/metadata.json";
import { SERVICE_QUALITY_RATINGS } from "@/data/serviceQuality";
import type { PremiumRow } from "@/lib/types";

const INSURERS = insurersData as Insurer[];
// Static — INSURERS is a module-level import, not component state, so this is derived
// once at module load, same lifecycle as INSURERS itself (no useMemo needed).
const MEMBER_COUNTS: Record<string, number> = Object.fromEntries(
  INSURERS.filter((i) => i.memberCount != null).map((i) => [i.insurerCode, i.memberCount!]),
);
// Same lifecycle as MEMBER_COUNTS — SERVICE_QUALITY_RATINGS is a module-level import.
const SERVICE_QUALITY: Record<string, ServiceQualityRating> = Object.fromEntries(
  SERVICE_QUALITY_RATINGS.map((r) => [r.insurerCode, r]),
);
```

- [ ] **Step 2: Pass the new prop to `PlanList`**

Find the `<PlanList ... />` call (post-member-count-badge state):

```tsx
<PlanList
  plans={results.plans}
  currentInsurerCode={currentPlan.insurerCode ?? null}
  standardBaseline={results.standardBaseline}
  memberCounts={MEMBER_COUNTS}
  memberCountAsOf={metadata.memberCountAsOf}
/>
```

Change it to:

```tsx
<PlanList
  plans={results.plans}
  currentInsurerCode={currentPlan.insurerCode ?? null}
  standardBaseline={results.standardBaseline}
  memberCounts={MEMBER_COUNTS}
  memberCountAsOf={metadata.memberCountAsOf}
  serviceQuality={SERVICE_QUALITY}
/>
```

- [ ] **Step 3: Thread the prop through `PlanList`**

Replace `src/components/results/PlanList.tsx` with:

```tsx
import type { PremiumRow, ServiceQualityRating } from "@/lib/types";
import { discountVsStandardPct } from "@/lib/lookup";
import { PlanRow } from "./PlanRow";

type Props = {
  plans: PremiumRow[];
  currentInsurerCode: string | null;
  standardBaseline: Map<string, number>;
  memberCounts: Record<string, number>;
  memberCountAsOf: number;
  serviceQuality: Record<string, ServiceQualityRating>;
};

export function PlanList({ plans, currentInsurerCode, standardBaseline, memberCounts, memberCountAsOf, serviceQuality }: Props) {
  return (
    <div role="list" className="flex flex-col gap-1.5">
      {plans.map((plan, i) => (
        <PlanRow
          key={plan.insurerCode}
          plan={plan}
          rank={i + 1}
          isCheapest={i === 0}
          isCurrentPlan={plan.insurerCode === currentInsurerCode}
          discountPct={plan.tarifart === "standard" ? null : discountVsStandardPct(standardBaseline.get(plan.insurerCode), plan.monthlyPremium)}
          memberCount={memberCounts[plan.insurerCode]}
          memberCountAsOf={memberCountAsOf}
          serviceQuality={serviceQuality[plan.insurerCode]}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Render the badge in `PlanRow`**

Change the imports at the top of `src/components/results/PlanRow.tsx` from:

```tsx
import type { PremiumRow } from "@/lib/types";
import { TARIFART_LABELS, TARIFART_DESCRIPTIONS } from "@/lib/copy";
import { formatChf, formatMemberCount, formatMemberCountDetail } from "@/lib/format";
```

to:

```tsx
import type { PremiumRow, ServiceQualityRating } from "@/lib/types";
import { TARIFART_LABELS, TARIFART_DESCRIPTIONS } from "@/lib/copy";
import { formatChf, formatMemberCount, formatMemberCountDetail, formatServiceQualityPct, formatServiceQualityDetail } from "@/lib/format";
import { averageServiceQualityPct } from "@/lib/lookup";
```

Change the `Props` type from:

```tsx
type Props = {
  plan: PremiumRow;
  rank: number;
  isCheapest: boolean;
  isCurrentPlan: boolean;
  discountPct: number | null;
  memberCount?: number;
  memberCountAsOf: number;
  previousYearPremium?: number;
};
```

to:

```tsx
type Props = {
  plan: PremiumRow;
  rank: number;
  isCheapest: boolean;
  isCurrentPlan: boolean;
  discountPct: number | null;
  memberCount?: number;
  memberCountAsOf: number;
  serviceQuality?: ServiceQualityRating;
  previousYearPremium?: number;
};
```

Change the function signature from:

```tsx
export function PlanRow({
  plan,
  rank,
  isCheapest,
  isCurrentPlan,
  discountPct,
  memberCount,
  memberCountAsOf,
  previousYearPremium,
}: Props) {
```

to:

```tsx
export function PlanRow({
  plan,
  rank,
  isCheapest,
  isCurrentPlan,
  discountPct,
  memberCount,
  memberCountAsOf,
  serviceQuality,
  previousYearPremium,
}: Props) {
```

Replace the member-count badge block:

```tsx
      {memberCount != null && (
        <div
          className="flex flex-col items-end gap-0.5 flex-shrink-0"
          title={formatMemberCountDetail(memberCount, memberCountAsOf)}
        >
          <span className="text-[11px] font-semibold px-1.5 py-px rounded bg-surface-variant text-on-surface-variant whitespace-nowrap">
            👥 {formatMemberCount(memberCount)}
          </span>
        </div>
      )}
```

with (the `title` moves from the wrapping `div` onto each badge's own `span`, since the
two badges now need two different tooltips rather than sharing one):

```tsx
      {(memberCount != null || serviceQuality != null) && (
        <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
          {memberCount != null && (
            <span
              className="text-[11px] font-semibold px-1.5 py-px rounded bg-surface-variant text-on-surface-variant whitespace-nowrap"
              title={formatMemberCountDetail(memberCount, memberCountAsOf)}
            >
              👥 {formatMemberCount(memberCount)}
            </span>
          )}
          {serviceQuality != null && (
            <span
              className="text-[11px] font-semibold px-1.5 py-px rounded bg-surface-variant text-on-surface-variant whitespace-nowrap"
              title={formatServiceQualityDetail(serviceQuality, averageServiceQualityPct(serviceQuality.sources))}
            >
              ⭐ {formatServiceQualityPct(averageServiceQualityPct(serviceQuality.sources))}
            </span>
          )}
        </div>
      )}
```

- [ ] **Step 5: Type-check and run the full test suite**

Run: `npx tsc --noEmit && npm test`
Expected: no type errors, all tests PASS.

- [ ] **Step 6: Visually verify against the mockup**

Use the `superpowers:run` skill to start the dev server and load the app with a PLZ/
birth-year/franchise combination that returns results (e.g. a Zürich PLZ). Confirm:
- Rows for insurers with real data (e.g. Helsana, Swica, CSS, Sanitas — see Global
  Constraints for the full list) show a ⭐ badge stacked directly under the 👥 badge,
  matching the updated `.superpowers/brainstorm/46455-1786700093/content/badge-layout.html`
  mockup (Option B).
- Hovering/tapping the ⭐ badge shows a tooltip listing each contributing source by
  name with its own raw score and scale (e.g. "moneyland.ch: 8.0/10").
- A row for an insurer with no rating (e.g. a small regional Kasse like Krankenkasse
  Birchmeier, if it appears for the chosen PLZ) shows no ⭐ badge at all — not blank
  space with a placeholder.
- A row for an insurer covered by only 1–2 sources (e.g. Agrisano — bonus.ch only)
  still shows a badge, tooltip correctly listing just that one source.

- [ ] **Step 7: Commit**

```bash
git add src/components/InsuranceComparator.tsx src/components/results/PlanList.tsx src/components/results/PlanRow.tsx
git commit -m "feat(ui): render the disclosed service-quality badge on each results row"
```

---

## Self-Review

**1. Spec coverage:** every section of
`docs/superpowers/specs/2026-08-14-service-quality-badge-design.md` maps to a task —
data provenance/storage (Task 3), computation (Task 4), types (Task 1), formatting
(Task 2), UI/disclosure (Task 5). The three Open Items the spec flagged (remaining
comparis figures, remaining bonus.ch figures, bonus.ch's scale ceiling) were resolved
during planning with real verified data (Global Constraints), not left as TBDs in the
tasks themselves — matching how the member-count plan resolved its own open BAG-URL
item before writing tasks.

**2. Placeholder scan:** no TBD/TODO; every task has concrete code, concrete test
expectations (including hand-computed averages for real insurers), and a concrete
verified data source.

**3. Type consistency:** `ServiceQualitySourceScore`/`ServiceQualityRating` (Task 1) are
used identically in `serviceQuality.ts` (Task 3), `lookup.ts` (Task 4), and
`InsuranceComparator.tsx`/`PlanList.tsx`/`PlanRow.tsx` (Task 5).
`averageServiceQualityPct`'s signature (Task 4) matches its call site in `PlanRow.tsx`
(Task 5) exactly. `formatServiceQualityPct`/`formatServiceQualityDetail`'s signatures
(Task 2) match their call sites in `PlanRow.tsx` (Task 5) exactly.

**One correction over the design doc, called out explicitly rather than silently
applied**: the design doc speculated Groupe Mutuel might need its rating duplicated
across all 4 of its BAG codes if rated as one brand. Real data collection found bonus.ch
rates its sub-brands independently, so Task 3's data has no duplication logic — each of
Avenir Assurance (`343`) and Philos Assurance (`1535`) carries its own real bonus.ch
score, while AMB Assurances (`1507`) and Mutuel Assurance (`1479`) simply have no entry
(defensive omission, same as any other unrated insurer).
