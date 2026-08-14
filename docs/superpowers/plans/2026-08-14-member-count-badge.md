# Member-Count Badge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show each insurer's total OKP enrollment ("Versichertenbestand") as a badge on
its results row, sourced from real BAG open data, joined into the existing ingest
pipeline and threaded through to `PlanRow`.

**Architecture:** A new ingest step (`scripts/ingest/members.ts`) parses BAG's
`Versichertenbestand_CH.csv` (per-insurer, per-canton OKP enrollment) into per-insurer
national totals, joined by BAG insurer code into `insurers.json`. A new `metadata.json`
field records the data's own publication year (it lags the premium year). The UI reads
`memberCount` off the existing `insurers.json`-derived list (not denormalized onto every
`PremiumRow`, since it's insurer-level and doesn't vary by region/franchise/model) and
renders it as a new column in `PlanRow`, positioned between the insurer-info block and
the yoy%/price cluster (layout validated via the brainstorming visual companion).

**Tech Stack:** TypeScript, `csv-parse/sync` (already a dependency), Vitest, React 19 /
Next.js, Tailwind (Material Design 3 token classes already in use in `PlanRow.tsx`).

## Global Constraints

- **Real data only** (requirement.md Core Principle #3) — the member count must trace to
  BAG's `Versichertenbestand_CH.csv`, joined by the same BAG insurer code the premium
  data uses. No estimated/placeholder numbers.
- **OKP-only, confirmed** — this file is part of BAG's *Statistik der obligatorischen
  Krankenversicherung*, scoped to KVG-regulated OKP business only; VVG/supplementary
  figures are reported separately in the same publication and are not part of this file.
  No filtering needed.
- **Defensive omission, not a placeholder** — a row for an insurer with no matching
  member-count data renders no badge at all (not "–" or "0"). Verified as unreachable
  with the real 2026-08-14 snapshot of the data (all 34 known insurer codes have a
  match) but implemented defensively anyway, matching the project's existing pattern for
  the discount badge's "no Standard premium" case.
- **No new test infrastructure.** This repo has zero React component tests today — no
  `@testing-library/react`, no jsdom (`vitest.config.ts` uses `environment: "node"`).
  Don't add that tooling for this feature. Keep all new logic in pure, `node`-testable
  functions (`format.ts`, `members.ts`, `insurers.ts`); UI wiring in `PlanRow`/`PlanList`/
  `InsuranceComparator` stays thin/untested, exactly like the existing `yoy`/`discountPct`
  conditionals in `PlanRow.tsx` are today. Verify UI wiring by running the app
  (`superpowers:run` skill), not by writing component tests.
- **Swiss number formatting conventions already established:** apostrophe thousands
  separator (`formatChf` in `src/lib/format.ts`), German UI copy throughout.
- **Real source URL/columns (verified 2026-08-14 during planning):**
  `https://opendata.bagnet.ch/?r=/download&path=L1ByYWVtaWVuL1ZlcnNpY2hlcnRlbmJlc3RhbmRfQ0guY3N2`
  (decodes to `/Praemien/Versichertenbestand_CH.csv`) — semicolon-delimited CSV, UTF-8
  with BOM, columns `Versicherer;Kanton;Geschäftsjahr;Durchschnittsbestand`. `Versicherer`
  is **zero-padded** (`"0008"`), unlike the premium file's unpadded `"8"` — must be
  normalized. Confirmed single `Geschäftsjahr` value in the current file: `2024` (lags the
  2026 premium year, as expected). Real per-insurer national totals observed at planning
  time (canton rows summed, rounded): CSS (`8`) → 1'537'730; Helsana (`1562`) → 1'290'207;
  Swica (`1384`) → 813'080; Krankenkasse Birchmeier (`1322`) → 2'792 (smallest). The file
  also contains code `0829`, which is **not** in `INSURER_NAMES` — a real example of the
  "unmatched code" case.

---

### Task 1: Shared `Insurer` type + `memberCountAsOf` metadata field

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/components/current-plan/CurrentPlanSection.tsx`

**Interfaces:**
- Produces: `export type Insurer = { insurerCode: string; insurerName: string; memberCount?: number }` — used by Task 4 (`insurers.ts`), Task 6 (`ingest.ts`), and Task 8 (`InsuranceComparator.tsx`).
- Produces: `Metadata.memberCountAsOf: number` — used by Task 6 and Task 8.

This is a types-only task with no test file — verify with the TypeScript compiler directly.

- [ ] **Step 1: Add the `Insurer` type and extend `Metadata` in `src/lib/types.ts`**

Add after the `Gemeinde` type (before `export type Metadata`):

```ts
export type Insurer = {
  insurerCode: string;
  insurerName: string;
  memberCount?: number; // OKP enrollment (BAG Versichertenbestand), absent if unmatched
};
```

Change the existing `Metadata` type to:

```ts
export type Metadata = {
  publicationDate: string; // ISO date, e.g. "2025-10-15"
  availableYears: number[];
  memberCountAsOf: number; // publication year of the Versichertenbestand data (lags publicationDate)
};
```

- [ ] **Step 2: Replace the local `Insurer` type in `CurrentPlanSection.tsx` with the shared one**

In `src/components/current-plan/CurrentPlanSection.tsx`, change:

```ts
import { validateCurrentPremium } from "@/lib/validate";
import type { CurrentPlan } from "@/lib/types";

type Insurer = { insurerCode: string; insurerName: string };
```

to:

```ts
import { validateCurrentPremium } from "@/lib/validate";
import type { CurrentPlan, Insurer } from "@/lib/types";
```

(No other changes in this file — `Props.insurers: Insurer[]` already matches structurally.)

- [ ] **Step 3: Verify with the TypeScript compiler**

Run: `npx tsc --noEmit`
Expected: no new errors. (`metadata.json` doesn't have `memberCountAsOf` yet, but nothing
currently type-asserts the imported JSON against `Metadata`, so this is safe until
Task 6/7 regenerate the real file.)

- [ ] **Step 4: Commit**

```bash
git add src/lib/types.ts src/components/current-plan/CurrentPlanSection.tsx
git commit -m "feat(types): add shared Insurer type and Metadata.memberCountAsOf"
```

---

### Task 2: `formatMemberCount` / `formatMemberCountDetail` (format.ts)

**Files:**
- Modify: `src/lib/format.ts`
- Modify: `src/lib/format.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `formatMemberCount(count: number): string`, `formatMemberCountDetail(count: number, asOfYear: number): string` — used by Task 8 (`PlanRow.tsx`).

Rounding rules (pinned down from the real data range — 2'792 to 1'537'730):
- `>= 1_000_000` → one decimal + `" Mio."`, e.g. `1_537_730` → `"1.5 Mio."`.
- `>= 1_000` → rounded to the nearest whole thousand + `" Tsd."`, e.g. `813_080` →
  `"813 Tsd."`, `2_792` → `"3 Tsd."`.
- `< 1_000` → the exact integer, no suffix (not reached by real 2024 data — smallest
  real insurer is `2_792` — but defined defensively).
- Cutover boundary: `999_999` → `"1.0 Mio."` (rounds up at the `.toFixed(1)` step) —
  intentional, matches common abbreviation UX; pinned by a test below.

- [ ] **Step 1: Write the failing tests**

Add to `src/lib/format.test.ts`:

```ts
import { formatChf, formatMemberCount, formatMemberCountDetail } from "@/lib/format";

describe("formatMemberCount", () => {
  it("formats sub-1000 counts as an exact integer", () => {
    expect(formatMemberCount(999)).toBe("999");
  });
  it("formats thousands rounded to the nearest whole Tsd.", () => {
    expect(formatMemberCount(1000)).toBe("1 Tsd.");
    expect(formatMemberCount(2792)).toBe("3 Tsd."); // real: Krankenkasse Birchmeier
    expect(formatMemberCount(813080)).toBe("813 Tsd."); // real: Swica
  });
  it("formats millions with one decimal", () => {
    expect(formatMemberCount(1537730)).toBe("1.5 Mio."); // real: CSS
    expect(formatMemberCount(1290207)).toBe("1.3 Mio."); // real: Helsana
  });
  it("rounds the Tsd./Mio. cutover boundary up", () => {
    expect(formatMemberCount(999999)).toBe("1.0 Mio.");
  });
});

describe("formatMemberCountDetail", () => {
  it("formats the exact grouped count with the data-as-of year", () => {
    expect(formatMemberCountDetail(1537730, 2024)).toBe("1'537'730 Versicherte · Stand 2024");
  });
  it("rounds a fractional count before grouping", () => {
    expect(formatMemberCountDetail(2791.6, 2024)).toBe("2'792 Versicherte · Stand 2024");
  });
});
```

(Leave the existing `formatChf` describe block as-is; just widen the import line.)

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/format.test.ts`
Expected: FAIL — `formatMemberCount is not a function` / `formatMemberCountDetail is not a function`.

- [ ] **Step 3: Implement in `src/lib/format.ts`**

Replace the whole file with:

```ts
// Swiss-convention monetary formatting (requirement.md §9): apostrophe thousands
// separator, two decimal places, "CHF" prefix.

function groupThousands(intPart: string): string {
  return intPart.replace(/\B(?=(\d{3})+(?!\d))/g, "'");
}

export function formatChf(amount: number): string {
  const parts = amount.toFixed(2).split(".");
  return `CHF ${groupThousands(parts[0])}.${parts[1]}`;
}

// Abbreviated OKP enrollment count for the member-count badge (PlanRow). Real BAG 2024
// range: ~2'800 (smallest regional Kasse) to ~1.5 Mio. (largest).
export function formatMemberCount(count: number): string {
  const rounded = Math.round(count);
  if (rounded >= 1_000_000) return `${(rounded / 1_000_000).toFixed(1)} Mio.`;
  if (rounded >= 1_000) return `${Math.round(rounded / 1_000)} Tsd.`;
  return String(rounded);
}

// Exact count + the enrollment data's own publication year, for the badge's tooltip
// (the enrollment data lags the premium year — see Metadata.memberCountAsOf).
export function formatMemberCountDetail(count: number, asOfYear: number): string {
  return `${groupThousands(String(Math.round(count)))} Versicherte · Stand ${asOfYear}`;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/format.test.ts`
Expected: PASS (all `formatChf`, `formatMemberCount`, `formatMemberCountDetail` tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/format.ts src/lib/format.test.ts
git commit -m "feat(format): add formatMemberCount and formatMemberCountDetail"
```

---

### Task 3: `parseMemberCounts` (new ingest parser)

**Files:**
- Create: `scripts/ingest/members.ts`
- Create: `scripts/ingest/members.test.ts`

**Interfaces:**
- Consumes: nothing new (raw CSV text + the existing `INSURER_NAMES`-shaped `Record<string,string>`).
- Produces: `parseMemberCounts(csvText: string, insurerNames: Record<string,string>): { counts: Record<string,number>; year: number; unmatchedCodes: Set<string> }` and `normalizeInsurerCode(raw: string): string` — used by Task 6 (`ingest.ts`).

- [ ] **Step 1: Write the failing tests**

Create `scripts/ingest/members.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { normalizeInsurerCode, parseMemberCounts } from "./members";

const HEADER = "Versicherer;Kanton;Geschäftsjahr;Durchschnittsbestand";

function csv(...rows: string[]): string {
  return "﻿" + [HEADER, ...rows].join("\r\n");
}

describe("normalizeInsurerCode", () => {
  it("strips leading zeros", () => {
    expect(normalizeInsurerCode("0008")).toBe("8");
    expect(normalizeInsurerCode("1542")).toBe("1542");
  });
  it("throws on a non-numeric code", () => {
    expect(() => normalizeInsurerCode("abcd")).toThrow(/unrecognized code/);
  });
});

describe("parseMemberCounts", () => {
  const insurerNames = { "8": "CSS" };

  it("sums Durchschnittsbestand across cantons per insurer, rounded", () => {
    const text = csv("0008;AG;2024;153225.267", "0008;ZH;2024;100.5");
    const result = parseMemberCounts(text, insurerNames);
    expect(result.counts).toEqual({ "8": 153326 }); // 153225.267 + 100.5 = 153325.767 -> round
    expect(result.year).toBe(2024);
  });

  it("collects unmatched insurer codes separately, excluded from counts", () => {
    const text = csv("0008;AG;2024;153225.267", "0829;BE;2024;12661.4");
    const result = parseMemberCounts(text, insurerNames);
    expect(result.counts).toEqual({ "8": 153225 });
    expect(result.unmatchedCodes).toEqual(new Set(["829"]));
  });

  it("sums every canton row regardless of canton validity (unlike premium parsing)", () => {
    // "ZE"/"ZR" are cross-border/special-region codes parsePremiums.ts skips for pricing —
    // but those are still real insured people for a total membership count.
    const text = csv("0008;ZE;2024;50.2", "0008;ZR;2024;10.1");
    const result = parseMemberCounts(text, insurerNames);
    expect(result.counts).toEqual({ "8": 60 });
  });

  it("throws if the file mixes more than one Geschäftsjahr", () => {
    const text = csv("0008;AG;2024;153225.267", "0008;AG;2023;140000");
    expect(() => parseMemberCounts(text, insurerNames)).toThrow(/Geschäftsjahr/);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run scripts/ingest/members.test.ts`
Expected: FAIL — `Cannot find module './members'`.

- [ ] **Step 3: Implement `scripts/ingest/members.ts`**

```ts
//
// Parses BAG's "Versichertenbestand_CH.csv" (per-insurer, per-canton OKP enrollment)
// into per-insurer national totals. This is a separate BAG file from Praemien_CH.csv:
// semicolon-delimited (the premium file is comma-delimited) and the Versicherer code is
// zero-padded (the premium file's is not) — both handled here. Column mapping verified
// against the live file during planning (2026-08-14) — see
// docs/superpowers/plans/2026-08-14-member-count-badge.md Global Constraints.
//
// Unlike parsePremiums.ts, every Kanton row is summed regardless of canton validity
// (including BAG's cross-border/special-region codes like ZE/ZR) — those still represent
// real insured people for a total membership count, even though they're not mappable to
// a Swiss Prämienregion for pricing.

import { parse } from "csv-parse/sync";

export type ParseMemberCountsResult = {
  counts: Record<string, number>; // insurerCode (unpadded, matches INSURER_NAMES) -> total OKP Versichertenbestand, rounded
  year: number; // Geschäftsjahr — the file is expected to carry exactly one
  unmatchedCodes: Set<string>; // codes present in the file but not in insurerNames — excluded from counts
};

export function normalizeInsurerCode(raw: string): string {
  const n = Number(raw);
  if (!Number.isFinite(n)) throw new Error(`normalizeInsurerCode: unrecognized code "${raw}"`);
  return String(n);
}

export function parseMemberCounts(
  csvText: string,
  insurerNames: Record<string, string>,
): ParseMemberCountsResult {
  const records: Record<string, string>[] = parse(csvText, {
    columns: true,
    bom: true,
    trim: true,
    delimiter: ";",
  });

  const sums = new Map<string, number>();
  const years = new Set<string>();
  const unmatchedCodes = new Set<string>();

  for (const r of records) {
    const code = normalizeInsurerCode(r.Versicherer);
    years.add(r["Geschäftsjahr"]);

    if (!insurerNames[code]) {
      unmatchedCodes.add(code);
      continue;
    }

    sums.set(code, (sums.get(code) ?? 0) + Number(r.Durchschnittsbestand));
  }

  if (years.size !== 1) {
    throw new Error(
      `parseMemberCounts: expected exactly one Geschäftsjahr in the file, found ${[...years].join(", ")}`,
    );
  }

  const counts: Record<string, number> = {};
  for (const [code, total] of sums) counts[code] = Math.round(total);

  return { counts, year: Number([...years][0]), unmatchedCodes };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run scripts/ingest/members.test.ts`
Expected: PASS (all 6 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/ingest/members.ts scripts/ingest/members.test.ts
git commit -m "feat(ingest): add Versichertenbestand_CH parser"
```

---

### Task 4: `buildInsurersJson` gains member counts

**Files:**
- Modify: `scripts/ingest/insurers.ts`
- Modify: `scripts/ingest/insurers.test.ts`

**Interfaces:**
- Consumes: `Insurer` type from Task 1 (`../../src/lib/types`).
- Produces: `buildInsurersJson(names?: Record<string,string>, memberCounts?: Record<string,number>): Insurer[]` — used by Task 6 (`ingest.ts`).

- [ ] **Step 1: Write the failing test**

Add to `scripts/ingest/insurers.test.ts` (inside the existing `describe("buildInsurersJson", ...)` block, after the existing test):

```ts
  it("adds memberCount when the map has a match, omits the key when it doesn't", () => {
    const result = buildInsurersJson({ "32": "Aquilana", "8": "CSS" }, { "8": 1537730 });
    expect(result).toEqual([
      { insurerCode: "32", insurerName: "Aquilana" },
      { insurerCode: "8", insurerName: "CSS", memberCount: 1537730 },
    ]);
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run scripts/ingest/insurers.test.ts`
Expected: FAIL — `buildInsurersJson` doesn't accept a second argument, or the CSS row has no `memberCount` key.

- [ ] **Step 3: Implement the change in `scripts/ingest/insurers.ts`**

Replace the existing `buildInsurersJson` function with:

```ts
import type { Insurer } from "../../src/lib/types";

export function buildInsurersJson(
  names: Record<string, string> = INSURER_NAMES,
  memberCounts: Record<string, number> = {},
): Insurer[] {
  return Object.entries(names)
    .map(([insurerCode, insurerName]): Insurer => {
      const memberCount = memberCounts[insurerCode];
      return memberCount != null ? { insurerCode, insurerName, memberCount } : { insurerCode, insurerName };
    })
    .sort((a, b) => a.insurerName.localeCompare(b.insurerName, "de-CH"));
}
```

(Add the `import type { Insurer } ...` line at the top of the file, alongside/above the
existing `INSURER_NAMES` constant.)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run scripts/ingest/insurers.test.ts`
Expected: PASS (both the pre-existing test and the new one).

- [ ] **Step 5: Commit**

```bash
git add scripts/ingest/insurers.ts scripts/ingest/insurers.test.ts
git commit -m "feat(ingest): thread member counts into buildInsurersJson"
```

---

### Task 5: Download source + commit the raw file

**Files:**
- Modify: `scripts/ingest/downloadRaw.ts`
- Modify: `data/raw/README.md`
- Create: `data/raw/versichertenbestand.csv` (committed raw BAG data, same convention as
  the existing `data/raw/praemien.csv` / `praemienregionen.xlsx`)

No test file — this is I/O plumbing, matching `downloadRaw.ts`'s existing untested status.

- [ ] **Step 1: Add the URL and download call to `downloadRaw.ts`**

In `scripts/ingest/downloadRaw.ts`, change:

```ts
const PREMIUM_CSV_URL =
  "https://opendata.bagnet.ch/?r=/download&path=L1ByYWVtaWVuL1Byw6RtaWVuX0NILmNzdg%3D%3D"; // BAG: /Praemien/Praemien_CH.csv
const REGION_XLSX_URL = "https://www.priminfo.admin.ch/downloads/praemienregionen.xlsx";

export async function downloadRawFiles(destDir: string): Promise<void> {
  await mkdir(destDir, { recursive: true });
  await Promise.all([
    downloadTo(PREMIUM_CSV_URL, join(destDir, "praemien.csv")),
    downloadTo(REGION_XLSX_URL, join(destDir, "praemienregionen.xlsx")),
  ]);
}
```

to:

```ts
const PREMIUM_CSV_URL =
  "https://opendata.bagnet.ch/?r=/download&path=L1ByYWVtaWVuL1Byw6RtaWVuX0NILmNzdg%3D%3D"; // BAG: /Praemien/Praemien_CH.csv
const REGION_XLSX_URL = "https://www.priminfo.admin.ch/downloads/praemienregionen.xlsx";
const VERSICHERTENBESTAND_CSV_URL =
  "https://opendata.bagnet.ch/?r=/download&path=L1ByYWVtaWVuL1ZlcnNpY2hlcnRlbmJlc3RhbmRfQ0guY3N2"; // BAG: /Praemien/Versichertenbestand_CH.csv

export async function downloadRawFiles(destDir: string): Promise<void> {
  await mkdir(destDir, { recursive: true });
  await Promise.all([
    downloadTo(PREMIUM_CSV_URL, join(destDir, "praemien.csv")),
    downloadTo(REGION_XLSX_URL, join(destDir, "praemienregionen.xlsx")),
    downloadTo(VERSICHERTENBESTAND_CSV_URL, join(destDir, "versichertenbestand.csv")),
  ]);
}
```

- [ ] **Step 2: Download the real file into `data/raw/`**

Run:

```bash
curl -s -A "Mozilla/5.0" \
  "https://opendata.bagnet.ch/?r=/download&path=L1ByYWVtaWVuL1ZlcnNpY2hlcnRlbmJlc3RhbmRfQ0guY3N2" \
  -o data/raw/versichertenbestand.csv
```

Expected: a semicolon-delimited CSV starting with
`﻿Versicherer;Kanton;Geschäftsjahr;Durchschnittsbestand` (UTF-8 BOM), ~650-700 data rows,
all `Geschäftsjahr` values `2024`. Verify with:

```bash
head -3 data/raw/versichertenbestand.csv
awk -F';' 'NR>1{print $3}' data/raw/versichertenbestand.csv | sort -u
```

Expected: header line as above, and the second command prints exactly `2024`.

- [ ] **Step 3: Add a row for the new file to `data/raw/README.md`**

Add a row to the existing table:

```markdown
| `versichertenbestand.csv` | `https://opendata.bagnet.ch/?r=/download&path=L1ByYWVtaWVuL1ZlcnNpY2hlcnRlbmJlc3RhbmRfQ0guY3N2` (decodes to `/Praemien/Versichertenbestand_CH.csv`) | Same publisher/portal as `praemien.csv`, but its own refresh cadence — BAG's enrollment ("Versichertenbestand") figures lag the premium year by roughly 2 years and aren't re-published on the same schedule. Re-check before assuming a re-run will pick up a newer year. |
```

- [ ] **Step 4: Commit**

```bash
git add scripts/ingest/downloadRaw.ts data/raw/README.md data/raw/versichertenbestand.csv
git commit -m "feat(ingest): download and commit raw Versichertenbestand_CH data"
```

---

### Task 6: Wire it into `scripts/ingest.ts`

**Files:**
- Modify: `scripts/ingest.ts`

**Interfaces:**
- Consumes: `parseMemberCounts` (Task 3), `buildInsurersJson` (Task 4), `Metadata` (Task 1).
- Produces: regenerated `src/data/insurers.json` (with `memberCount`) and
  `src/data/metadata.json` (with `memberCountAsOf`) once run — done in Task 7.

No new test file — `scripts/ingest.ts`'s `main()` has no existing unit tests either
(verified by actually running it, same as today).

- [ ] **Step 1: Add the import and read the new raw file**

In `scripts/ingest.ts`, add to the imports:

```ts
import { parseMemberCounts } from "./ingest/members";
```

Change the existence check:

```ts
  const premiumsPath = join(rawDir, "praemien.csv");
  const regionsPath = join(rawDir, "praemienregionen.xlsx");
  if (!existsSync(premiumsPath) || !existsSync(regionsPath)) {
    fail(`expected ${premiumsPath} and ${regionsPath} to exist.`);
  }
```

to:

```ts
  const premiumsPath = join(rawDir, "praemien.csv");
  const regionsPath = join(rawDir, "praemienregionen.xlsx");
  const membersPath = join(rawDir, "versichertenbestand.csv");
  if (!existsSync(premiumsPath) || !existsSync(regionsPath) || !existsSync(membersPath)) {
    fail(`expected ${premiumsPath}, ${regionsPath}, and ${membersPath} to exist.`);
  }
```

- [ ] **Step 2: Parse the member counts and fail fast on an empty result**

Right after the existing `parsePremiumRows` call and its `rows.length === 0` check, add:

```ts
  const membersCsvText = await readFile(membersPath, "utf-8");
  const { counts: memberCounts, year: memberCountAsOf, unmatchedCodes } = parseMemberCounts(
    membersCsvText,
    INSURER_NAMES,
  );
  if (Object.keys(memberCounts).length === 0) {
    fail("parsed 0 member counts — check the Versichertenbestand CSV format/columns.");
  }
```

- [ ] **Step 3: Add `memberCountAsOf` to the written metadata**

Change:

```ts
  const year = rows[0].year;
  const metadata: Metadata = { publicationDate: args.publicationDate, availableYears: [year] };
```

to:

```ts
  const year = rows[0].year;
  const metadata: Metadata = { publicationDate: args.publicationDate, availableYears: [year], memberCountAsOf };
```

- [ ] **Step 4: Pass member counts into `buildInsurersJson`**

Change:

```ts
  await writeFile(join(DATA_DIR, "insurers.json"), JSON.stringify(buildInsurersJson(), null, 2));
```

to:

```ts
  await writeFile(
    join(DATA_DIR, "insurers.json"),
    JSON.stringify(buildInsurersJson(INSURER_NAMES, memberCounts), null, 2),
  );
```

- [ ] **Step 5: Log unmatched codes**

After the existing `unknownTariftypes` logging block at the end of `main()`, add:

```ts
  if (unmatchedCodes.size > 0) {
    console.log(
      `  ⚠ Versichertenbestand code(s) with no matching insurer, skipped: ${[...unmatchedCodes].join(", ")}`,
    );
  }
```

- [ ] **Step 6: Run the existing ingest test suite to make sure nothing else broke**

Run: `npx vitest run scripts/ingest`
Expected: PASS (all pre-existing ingest tests, plus Tasks 3/4's new tests).

- [ ] **Step 7: Commit**

```bash
git add scripts/ingest.ts
git commit -m "feat(ingest): wire member counts into the main ingest pipeline"
```

---

### Task 7: Regenerate real data

**Files:**
- Modify (regenerated, not hand-edited): `src/data/insurers.json`, `src/data/metadata.json`
- Modify (regenerated, not hand-edited): `public/data/premiums-2026.json` (only if its
  content changes — the premium parsing itself is untouched by this plan, so this file
  should come out byte-identical; if `git diff` shows no change, that's expected, not a bug)

**Interfaces:**
- Consumes: everything from Tasks 1–6.
- Produces: the real `memberCount`/`memberCountAsOf` data the UI (Task 8) reads.

- [ ] **Step 1: Run the real ingest, offline, against the committed raw files**

Run:

```bash
npm run ingest -- --local data/raw --publication-date 2025-09-23
```

(`2025-09-23` is the existing `publicationDate` already in `src/data/metadata.json` —
reuse it verbatim so this run only changes what this plan actually changes, not an
unrelated redated re-publish.)

Expected: a `✔ wrote ... premium rows for 2026, ...` success line, **no** `⚠
Versichertenbestand code(s) with no matching insurer` line missing entirely would be
wrong — expect to actually see `⚠ Versichertenbestand code(s) with no matching insurer,
skipped: 829` (the real unmatched code identified during planning).

- [ ] **Step 2: Inspect the regenerated `insurers.json`**

Run: `grep -A1 '"insurerCode": "8"' src/data/insurers.json`
Expected: shows `"insurerName": "CSS"` followed by `"memberCount": 1537730` (or very close
— exact value depends on the live file at run time, but should be in the ~1.5M range).

Run: `grep memberCountAsOf src/data/metadata.json`
Expected: `"memberCountAsOf": 2024` (or whatever year the live file carries — must be a
single real 4-digit year, not `undefined`/missing).

- [ ] **Step 3: Confirm every insurer in `insurers.json` has a `memberCount` (expected today, not assumed)**

Run:

```bash
node -e '
const insurers = require("./src/data/insurers.json");
const missing = insurers.filter(i => i.memberCount == null).map(i => i.insurerName);
console.log(missing.length === 0 ? "all insurers have memberCount" : "missing: " + missing.join(", "));
'
```

Expected: `all insurers have memberCount`. If this ever prints a `missing:` list on a
future re-run (e.g. BAG added a new insurer to the premium data without a matching
Versichertenbestand row yet), that's the defensive-omission path working as designed —
not a bug to fix here.

- [ ] **Step 4: Run the full test suite**

Run: `npm test`
Expected: PASS, all suites.

- [ ] **Step 5: Commit**

```bash
git add src/data/insurers.json src/data/metadata.json public/data/premiums-*.json
git commit -m "chore(data): regenerate insurers.json/metadata.json with member counts"
```

---

### Task 8: UI wiring — `PlanRow` / `PlanList` / `InsuranceComparator`

**Files:**
- Modify: `src/components/InsuranceComparator.tsx`
- Modify: `src/components/results/PlanList.tsx`
- Modify: `src/components/results/PlanRow.tsx`

**Interfaces:**
- Consumes: `Insurer` (Task 1), `formatMemberCount`/`formatMemberCountDetail` (Task 2),
  real `insurers.json`/`metadata.json` (Task 7).
- Produces: the rendered badge — this is the final task, no downstream consumers.

No test file for this task (see Global Constraints — no component-test infra in this
repo). Verified by running the app.

- [ ] **Step 1: Type the `INSURERS` constant and derive a member-count lookup map**

In `src/components/InsuranceComparator.tsx`, change:

```ts
import type { CurrentPlan, SelfReportedPlan, Tarifart } from "@/lib/types";

import insurersData from "@/data/insurers.json";
import metadata from "@/data/metadata.json";
import type { PremiumRow } from "@/lib/types";

const INSURERS = insurersData as { insurerCode: string; insurerName: string }[];
```

to:

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

- [ ] **Step 2: Pass the new props to `PlanList`**

Find the existing `<PlanList ... />` call:

```tsx
<PlanList plans={results.plans} currentInsurerCode={currentPlan.insurerCode ?? null} standardBaseline={results.standardBaseline} />
```

Change it to:

```tsx
<PlanList
  plans={results.plans}
  currentInsurerCode={currentPlan.insurerCode ?? null}
  standardBaseline={results.standardBaseline}
  memberCounts={MEMBER_COUNTS}
  memberCountAsOf={metadata.memberCountAsOf}
/>
```

- [ ] **Step 3: Thread the props through `PlanList`**

Replace `src/components/results/PlanList.tsx` with:

```tsx
import type { PremiumRow } from "@/lib/types";
import { discountVsStandardPct } from "@/lib/lookup";
import { PlanRow } from "./PlanRow";

type Props = {
  plans: PremiumRow[];
  currentInsurerCode: string | null;
  standardBaseline: Map<string, number>;
  memberCounts: Record<string, number>;
  memberCountAsOf: number;
};

export function PlanList({ plans, currentInsurerCode, standardBaseline, memberCounts, memberCountAsOf }: Props) {
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
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Render the badge in `PlanRow`**

Replace `src/components/results/PlanRow.tsx` with:

```tsx
import type { PremiumRow } from "@/lib/types";
import { TARIFART_LABELS, TARIFART_DESCRIPTIONS } from "@/lib/copy";
import { formatChf, formatMemberCount, formatMemberCountDetail } from "@/lib/format";

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

// Model tag color per Tarifart, matching mockups/main.html's .model-tag.hmo/.telmed/.haus
// (hausarzt maps to the mockup's "haus" class — same success-container treatment).
const MODEL_TAG_CLASSES: Record<string, string> = {
  hmo: "bg-warning-container text-on-warning-container",
  telmed: "bg-tertiary-container text-on-tertiary-container",
  hausarzt: "bg-success-container text-on-success-container",
};
const DEFAULT_MODEL_TAG_CLASSES = "bg-surface-variant text-on-surface-variant";

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
  const yoy =
    previousYearPremium != null && previousYearPremium !== plan.monthlyPremium
      ? ((plan.monthlyPremium - previousYearPremium) / previousYearPremium) * 100
      : null;

  return (
    <div
      role="listitem"
      className={`flex items-center gap-3 rounded-lg border p-3.5 shadow-sm ${
        isCurrentPlan ? "border-error bg-error-container" : "border-outline-variant bg-surface"
      }`}
    >
      <div className={`w-5 text-center text-sm font-bold ${rank === 1 ? "text-primary" : "text-outline"}`}>
        {rank}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-[15px] truncate">{plan.insurerName}</div>
        <div className="text-xs text-on-surface-variant mt-0.5 flex flex-wrap items-center gap-1">
          <span
            className={`inline-block px-1.5 py-px rounded text-[11px] font-semibold ${
              MODEL_TAG_CLASSES[plan.tarifart] ?? DEFAULT_MODEL_TAG_CLASSES
            }`}
          >
            {TARIFART_LABELS[plan.tarifart]}
          </span>
          {discountPct != null && (
            <span className="inline-block px-1.5 py-px rounded text-[11px] font-bold bg-primary-container text-on-primary-container whitespace-nowrap">
              bis zu −{discountPct.toFixed(1)}% ggü. Standard
            </span>
          )}
          <span>· {TARIFART_DESCRIPTIONS[plan.tarifart]}</span>
        </div>
      </div>
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
      {isCurrentPlan && (
        <span className="text-[11px] font-semibold px-1.5 py-px rounded bg-error-container text-error">
          Deine Kasse
        </span>
      )}
      {yoy != null && (
        <div
          className={`text-xs font-semibold px-1.5 py-px rounded ${
            yoy > 0 ? "bg-error-container text-error" : yoy < 0 ? "bg-success-container text-success" : "text-outline font-normal"
          }`}
        >
          {yoy > 0 ? "+" : ""}
          {yoy.toFixed(1)}%
        </div>
      )}
      <div className="text-right">
        <div className={`text-headline-small ${isCheapest ? "text-primary" : "text-on-surface"}`}>
          {formatChf(plan.monthlyPremium)}
        </div>
        <div className="text-body-small text-outline">/Monat</div>
      </div>
    </div>
  );
}
```

(Only the `Props` type, the `formatMemberCount`/`formatMemberCountDetail` import, the
function signature, and the new `{memberCount != null && (...)}` block are new — the rest
is unchanged from the current file, reproduced here in full since this task replaces the
whole file.)

- [ ] **Step 5: Type-check and run the full test suite**

Run: `npx tsc --noEmit && npm test`
Expected: no type errors, all tests PASS.

- [ ] **Step 6: Visually verify against the validated mockup layout**

Use the `superpowers:run` skill to start the dev server and load the app with a PLZ/
birth-year/franchise combination that returns results (e.g. a Zürich PLZ). Confirm:
- Each row shows a 👥 badge with an abbreviated count between the model-badge line and
  the price — matching the "Option B" layout validated earlier in brainstorming
  (`.superpowers/brainstorm/*/content/badge-layout.html` if it's still on disk).
- Hovering/tapping the badge shows the tooltip with the exact grouped count and
  "Stand `<year>`".
- CSS's badge reads "1.5 Mio." (or close, matching Task 7's regenerated data) and
  Krankenkasse Birchmeier's (if it appears in results for the chosen PLZ) reads
  something in the "X Tsd." range.

- [ ] **Step 7: Commit**

```bash
git add src/components/InsuranceComparator.tsx src/components/results/PlanList.tsx src/components/results/PlanRow.tsx
git commit -m "feat(ui): render the member-count badge on each results row"
```

---

## Self-Review

**1. Spec coverage:** every section of `docs/superpowers/specs/2026-08-14-member-count-badge-design.md`
maps to a task — data source/ingest (Tasks 3, 5, 6, 7), types (Task 1), data flow into the
UI via a lookup map rather than denormalization (Task 8 Step 1), UI/layout (Task 8 Steps
2-4), and the OKP-only confirmation (Global Constraints, and Task 3's "sum every canton
row" test which documents *why* no VVG-vs-OKP filtering is needed at the row level).

**2. Placeholder scan:** no TBD/TODO; the one item the design doc left open (exact BAG
URL/columns) was resolved during planning and is now a concrete Global Constraint with a
verified URL, verified column names, and real sample values used directly in tests.

**3. Type consistency:** `Insurer` (Task 1) is used identically in `insurers.ts` (Task 4),
`ingest.ts` (Task 6), and `InsuranceComparator.tsx` (Task 8). `parseMemberCounts`'s return
shape (`counts`/`year`/`unmatchedCodes`, Task 3) matches its destructuring in `ingest.ts`
(Task 6) exactly. `PlanRow`'s new `memberCount`/`memberCountAsOf` props (Task 8) match
what `PlanList` passes (Task 8) and what `InsuranceComparator` computes (Task 8).

**One deliberate divergence from the design doc**, called out explicitly rather than
silently dropped: the design doc suggested reusing `validateIngest.ts`'s round-trip
verification for the new file. `insurers.json`/`metadata.json` aren't actually
round-tripped in the existing pipeline today (only `premiums-{year}.json` is) — adding
new verification machinery only for this feature, asymmetric with how the rest of
`insurers.json` is already handled, would be scope creep. Task 6 instead adds a
same-shape `Object.keys(memberCounts).length === 0` guard, mirroring the existing
`rows.length === 0` check for premiums.
