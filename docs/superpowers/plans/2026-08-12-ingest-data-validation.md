# Ingest Data Validation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `npm run ingest` automatically verify that every premium row it writes is traceable, value-for-value, back to the real BAG source CSV it was ingested from, aborting before any file is written if it isn't.

**Architecture:** A new pure module, `scripts/ingest/validateIngest.ts`, independently re-derives the natural key and expected drop-counts for every row in the raw CSV (reusing `parsePremiums.ts`'s mapping tables/helpers, exported for this purpose) and cross-checks them against the parser's actual output — conservation, uniqueness, and exact value match. `scripts/ingest.ts` calls it right after parsing and aborts via the existing `fail()` helper before writing anything if validation fails. A second, tiny check (`verifyWrittenFile`) re-reads the premiums JSON immediately after it's written and confirms it's byte-identical to what was meant to be written.

**Tech Stack:** Node/TypeScript via `tsx`, `csv-parse/sync` (already a dependency), Vitest.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-12-ingest-data-validation-design.md`.
- The natural key for a premium row is `(insurerCode, praemienregionId, altersklasse, franchise, unfalldeckung, tarifart, tarifCode, year)` — this is not unique without `tarifCode` (BAG publishes multiple distinct named products under the same model/region/age/franchise/accident combination; see `c036af7`), so every key built in this plan includes it.
- `PremiumRow` (`src/lib/types.ts`) is unchanged — this plan only adds validation, no new fields.
- Reuse `parsePremiums.ts`'s existing mapping tables/helpers (`VALID_CANTONS`, `ALTERSKLASSE_MAP`, `TARIFART_MAP`, `parseFranchise`, `parseRegionNumber`) rather than re-declaring them, so there is one source of truth for *how* a value maps. The two drop predicates (sibling-discount subgroup, invalid canton) are deliberately restated in the validator rather than imported, so a future drift between parser and validator surfaces as a conservation-check failure instead of passing silently.
- The real committed raw file is `data/raw/praemien.csv` (217 473 lines: 1 header + 217 472 data rows) and the real BAG publication date already used for the committed data is `2025-09-23` (`src/data/metadata.json`).
- Validation must run and abort (via the existing `fail()` helper, non-zero exit) **before** any `writeFile` call in `scripts/ingest.ts` — a failed validation must never let a partial or bad ingest reach disk.

---

### Task 1: Export shared parsing helpers from `parsePremiums.ts`

**Files:**
- Modify: `scripts/ingest/parsePremiums.ts`
- Test: `scripts/ingest/parsePremiums.test.ts`

**Interfaces:**
- Produces: `VALID_CANTONS: Set<string>`, `ALTERSKLASSE_MAP: Record<string, Altersklasse>`, `TARIFART_MAP: Record<string, Tarifart>`, `parseFranchise(code: string): number`, `parseRegionNumber(code: string): string`, `parseUnfalldeckung(code: string): boolean` — all exported for Task 2 to import.

This is a pure refactor: existing constants/functions become `export`ed, and the inline `Unfalleinschluss` if/else is extracted into a named, exported function with identical behavior. No change to `parsePremiumRows`'s own behavior.

- [ ] **Step 1: Write the failing test**

Add to the bottom of `scripts/ingest/parsePremiums.test.ts` (new `describe` block, same file):

```typescript
import {
  parsePremiumRows,
  VALID_CANTONS,
  ALTERSKLASSE_MAP,
  TARIFART_MAP,
  parseFranchise,
  parseRegionNumber,
  parseUnfalldeckung,
} from "./parsePremiums";

describe("exported parsing helpers (reused by validateIngest.ts)", () => {
  it("VALID_CANTONS contains real cantons and excludes cross-border codes", () => {
    expect(VALID_CANTONS.has("ZH")).toBe(true);
    expect(VALID_CANTONS.has("ZE")).toBe(false);
  });

  it("ALTERSKLASSE_MAP maps all three real BAG codes", () => {
    expect(ALTERSKLASSE_MAP["AKL-KIN"]).toBe("kind");
    expect(ALTERSKLASSE_MAP["AKL-JUG"]).toBe("jung");
    expect(ALTERSKLASSE_MAP["AKL-ERW"]).toBe("erwachsen");
  });

  it("TARIFART_MAP maps all four real BAG Tariftyp codes", () => {
    expect(TARIFART_MAP["TAR-BASE"]).toBe("standard");
    expect(TARIFART_MAP["TAR-HAM"]).toBe("hausarzt");
    expect(TARIFART_MAP["TAR-HMO"]).toBe("hmo");
    expect(TARIFART_MAP["TAR-DIV"]).toBe("telmed");
  });

  it("parseFranchise extracts the numeric value from a FRA-<n> code", () => {
    expect(parseFranchise("FRA-300")).toBe(300);
    expect(() => parseFranchise("XYZ")).toThrow(/Franchise/);
  });

  it("parseRegionNumber extracts the numeric value from a PR-REG CH<n> code", () => {
    expect(parseRegionNumber("PR-REG CH1")).toBe("1");
    expect(() => parseRegionNumber("XYZ")).toThrow(/Region/);
  });

  it("parseUnfalldeckung maps MIT-UNF/OHN-UNF to true/false", () => {
    expect(parseUnfalldeckung("MIT-UNF")).toBe(true);
    expect(parseUnfalldeckung("OHN-UNF")).toBe(false);
    expect(() => parseUnfalldeckung("XYZ")).toThrow(/Unfalleinschluss/);
  });
});
```

Update the existing `import { describe, it, expect } from "vitest";` line's neighboring import (the current `import { parsePremiumRows } from "./parsePremiums";` at the top of the file) — merge it into the new import shown above rather than having two import lines for the same module.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run scripts/ingest/parsePremiums.test.ts`
Expected: FAIL — `VALID_CANTONS`, `ALTERSKLASSE_MAP`, `TARIFART_MAP`, `parseFranchise`, `parseRegionNumber`, `parseUnfalldeckung` are not exported (`undefined` / TS error).

- [ ] **Step 3: Export the helpers and extract `parseUnfalldeckung`**

In `scripts/ingest/parsePremiums.ts`:

1. Add `export` to the three existing top-level consts:

```typescript
export const VALID_CANTONS = new Set([
  "AG", "AI", "AR", "BE", "BL", "BS", "FR", "GE", "GL", "GR", "JU", "LU", "NE",
  "NW", "OW", "SG", "SH", "SO", "SZ", "TG", "TI", "UR", "VD", "VS", "ZG", "ZH",
]);

export const ALTERSKLASSE_MAP: Record<string, Altersklasse> = {
  "AKL-KIN": "kind",
  "AKL-JUG": "jung",
  "AKL-ERW": "erwachsen",
};

export const TARIFART_MAP: Record<string, Tarifart> = {
  "TAR-BASE": "standard",
  "TAR-HAM": "hausarzt",
  "TAR-HMO": "hmo",
  "TAR-DIV": "telmed",
};
```

2. Add `export` to the two existing bottom-of-file functions (`parseFranchise`, `parseRegionNumber`) — just add the `export` keyword, bodies unchanged.

3. Replace the inline `Unfalleinschluss` if/else inside the `for (const r of records)` loop:

```typescript
    let unfalldeckung: boolean;
    if (r.Unfalleinschluss === "MIT-UNF") unfalldeckung = true;
    else if (r.Unfalleinschluss === "OHN-UNF") unfalldeckung = false;
    else throw new Error(`parsePremiumRows: unrecognized Unfalleinschluss "${r.Unfalleinschluss}"`);
```

with a call to a new exported function:

```typescript
    const unfalldeckung = parseUnfalldeckung(r.Unfalleinschluss);
```

4. Add the new function next to `parseFranchise`/`parseRegionNumber` at the bottom of the file:

```typescript
export function parseUnfalldeckung(code: string): boolean {
  if (code === "MIT-UNF") return true;
  if (code === "OHN-UNF") return false;
  throw new Error(`parsePremiumRows: unrecognized Unfalleinschluss "${code}"`);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run scripts/ingest/parsePremiums.test.ts`
Expected: PASS — all pre-existing tests plus the new `describe` block.

- [ ] **Step 5: Commit**

```bash
git add scripts/ingest/parsePremiums.ts scripts/ingest/parsePremiums.test.ts
git commit -m "refactor(ingest): export shared parsing helpers for reuse by validateIngest"
```

---

### Task 2: `validateIngestOutput` and `verifyWrittenFile`

**Files:**
- Create: `scripts/ingest/validateIngest.ts`
- Test: `scripts/ingest/validateIngest.test.ts`

**Interfaces:**
- Consumes: `VALID_CANTONS`, `ALTERSKLASSE_MAP`, `TARIFART_MAP`, `parseFranchise`, `parseRegionNumber`, `parseUnfalldeckung` from Task 1 (`./parsePremiums`); `PremiumRow` from `../../src/lib/types`.
- Produces: `type ValidationResult = { ok: boolean; errors: string[] }`; `validateIngestOutput(csvText: string, rows: PremiumRow[]): ValidationResult`; `verifyWrittenFile(expectedJson: string, writtenJson: string): ValidationResult` — both consumed by Task 3's `scripts/ingest.ts` wiring.

- [ ] **Step 1: Write the failing tests**

```typescript
// scripts/ingest/validateIngest.test.ts
import { describe, it, expect } from "vitest";
import { validateIngestOutput, verifyWrittenFile } from "./validateIngest";
import type { PremiumRow } from "../../src/lib/types";

const HEADER =
  "Versicherer,Kanton,Hoheitsgebiet,Geschäftsjahr,Erhebungsjahr,Region,Altersklasse,Unfalleinschluss,Tarif,Tariftyp,Altersuntergruppe,Franchisestufe,Franchise,Prämie,isBaseP,isBaseF,Tarifbezeichnung";

function csv(...rows: string[]): string {
  return [HEADER, ...rows].join("\n");
}

function row(overrides: Partial<PremiumRow> = {}): PremiumRow {
  return {
    year: 2026,
    insurerCode: "8",
    insurerName: "CSS",
    praemienregionId: "ZH-1",
    altersklasse: "erwachsen",
    franchise: 300,
    unfalldeckung: true,
    tarifart: "standard",
    tarifCode: "BASE",
    productName: "Grundversicherung",
    monthlyPremium: 301.1,
    ...overrides,
  };
}

describe("validateIngestOutput", () => {
  it("passes when every output row matches its source CSV row exactly", () => {
    const csvText = csv(
      "8,ZH,CH,2026,2025,PR-REG CH1,AKL-ERW,MIT-UNF,BASE,TAR-BASE,,FRAST1,FRA-300,301.1,1,1,Grundversicherung",
    );
    expect(validateIngestOutput(csvText, [row()])).toEqual({ ok: true, errors: [] });
  });

  it("accounts for dropped sibling-discount and invalid-canton rows in the conservation check", () => {
    const csvText = csv(
      "8,ZH,CH,2026,2025,PR-REG CH1,AKL-ERW,MIT-UNF,BASE,TAR-BASE,,FRAST1,FRA-300,301.1,1,1,Grundversicherung",
      "8,ZH,CH,2026,2025,PR-REG CH1,AKL-KIN,MIT-UNF,BASE,TAR-BASE,K1,FRAST1,FRA-0,120,0,1,Grundversicherung",
      "8,ZH,CH,2026,2025,PR-REG CH1,AKL-KIN,MIT-UNF,BASE,TAR-BASE,K3,FRAST1,FRA-0,60,0,1,Grundversicherung",
      "312,ZE,CH,2026,2025,PR-REG CH0,AKL-KIN,MIT-UNF,BASE,TAR-BASE,K1,FRAST1,FRA-0,175,1,1,Grundversicherung",
    );
    const rows = [
      row(),
      row({ altersklasse: "kind", franchise: 0, monthlyPremium: 120 }),
    ];
    expect(validateIngestOutput(csvText, rows)).toEqual({ ok: true, errors: [] });
  });

  it("fails when a source row is missing from the output", () => {
    const csvText = csv(
      "8,ZH,CH,2026,2025,PR-REG CH1,AKL-ERW,MIT-UNF,BASE,TAR-BASE,,FRAST1,FRA-300,301.1,1,1,Grundversicherung",
      "1542,BE,CH,2026,2025,PR-REG CH1,AKL-ERW,MIT-UNF,BASE,TAR-BASE,,FRAST1,FRA-300,250,1,1,Grundversicherung",
    );
    const result = validateIngestOutput(csvText, [row()]);
    expect(result.ok).toBe(false);
    expect(result.errors).toEqual([expect.stringContaining("conservation:")]);
  });

  it("fails when two output rows share the same natural key", () => {
    const csvText = csv(
      "8,ZH,CH,2026,2025,PR-REG CH1,AKL-ERW,MIT-UNF,BASE,TAR-BASE,,FRAST1,FRA-300,301.1,1,1,Grundversicherung",
      "8,ZH,CH,2026,2025,PR-REG CH1,AKL-ERW,MIT-UNF,BASE,TAR-BASE,,FRAST1,FRA-300,301.1,1,1,Grundversicherung",
    );
    const result = validateIngestOutput(csvText, [row(), row()]);
    expect(result.ok).toBe(false);
    expect(result.errors).toEqual([expect.stringContaining("uniqueness:")]);
  });

  it("fails when an output row's premium doesn't match the source", () => {
    const csvText = csv(
      "8,ZH,CH,2026,2025,PR-REG CH1,AKL-ERW,MIT-UNF,BASE,TAR-BASE,,FRAST1,FRA-300,301.1,1,1,Grundversicherung",
    );
    const result = validateIngestOutput(csvText, [row({ monthlyPremium: 999 })]);
    expect(result.ok).toBe(false);
    expect(result.errors).toEqual([expect.stringContaining("value:")]);
  });

  it("fails when an output row has no matching source row at all", () => {
    const csvText = csv(
      "8,ZH,CH,2026,2025,PR-REG CH1,AKL-ERW,MIT-UNF,BASE,TAR-BASE,,FRAST1,FRA-300,301.1,1,1,Grundversicherung",
    );
    const result = validateIngestOutput(
      csvText,
      [row({ insurerCode: "1542", insurerName: "Assura" })],
    );
    expect(result.ok).toBe(false);
    expect(result.errors).toEqual([expect.stringContaining("value:")]);
  });
});

describe("verifyWrittenFile", () => {
  it("passes when the written text matches what was meant to be written", () => {
    expect(verifyWrittenFile('{"a":1}', '{"a":1}')).toEqual({ ok: true, errors: [] });
  });

  it("fails when the written text differs from what was meant to be written", () => {
    const result = verifyWrittenFile('{"a":1}', '{"a":2}');
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toMatch(/read-after-write/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run scripts/ingest/validateIngest.test.ts`
Expected: FAIL — `Cannot find module './validateIngest'`

- [ ] **Step 3: Write the implementation**

```typescript
// scripts/ingest/validateIngest.ts
//
// Validates that scripts/ingest.ts's output is a faithful, complete transform of the
// real BAG source CSV it was ingested from
// (docs/superpowers/specs/2026-08-12-ingest-data-validation-design.md). Runs on every
// `npm run ingest`, before any file is written, so a transform bug can never reach
// committed data.
//
// Reuses parsePremiums.ts's mapping tables/helpers (one source of truth for *how* a
// value maps) but deliberately restates the two drop predicates (sibling-discount
// subgroup, invalid canton) rather than importing them — if that business rule ever
// drifts between the parser and this validator, the conservation check below fails
// loudly instead of silently passing.

import { parse } from "csv-parse/sync";
import type { PremiumRow } from "../../src/lib/types";
import {
  VALID_CANTONS,
  ALTERSKLASSE_MAP,
  TARIFART_MAP,
  parseFranchise,
  parseRegionNumber,
  parseUnfalldeckung,
} from "./parsePremiums";

export type ValidationResult = { ok: boolean; errors: string[] };

const MAX_EXAMPLES = 10;

function naturalKey(fields: {
  insurerCode: string;
  praemienregionId: string;
  altersklasse: string;
  franchise: number;
  unfalldeckung: boolean;
  tarifart: string;
  tarifCode: string;
  year: number;
}): string {
  return [
    fields.insurerCode,
    fields.praemienregionId,
    fields.altersklasse,
    fields.franchise,
    fields.unfalldeckung,
    fields.tarifart,
    fields.tarifCode,
    fields.year,
  ].join("|");
}

export function validateIngestOutput(csvText: string, rows: PremiumRow[]): ValidationResult {
  const errors: string[] = [];
  const records: Record<string, string>[] = parse(csvText, {
    columns: true,
    bom: true,
    trim: true,
  });

  const sourceByKey = new Map<string, string>();
  let droppedSiblingRows = 0;
  let droppedCantonRows = 0;

  for (const r of records) {
    if (r.Altersklasse === "AKL-KIN" && r.Altersuntergruppe !== "K1") {
      droppedSiblingRows++;
      continue;
    }
    if (!VALID_CANTONS.has(r.Kanton)) {
      droppedCantonRows++;
      continue;
    }

    const key = naturalKey({
      insurerCode: r.Versicherer,
      praemienregionId: `${r.Kanton}-${parseRegionNumber(r.Region)}`,
      altersklasse: ALTERSKLASSE_MAP[r.Altersklasse],
      franchise: parseFranchise(r.Franchise),
      unfalldeckung: parseUnfalldeckung(r.Unfalleinschluss),
      tarifart: TARIFART_MAP[r.Tariftyp] ?? "andere",
      tarifCode: r.Tarif,
      year: Number(r["Geschäftsjahr"]),
    });
    sourceByKey.set(key, r["Prämie"]);
  }

  const expectedKeptCount = records.length - droppedSiblingRows - droppedCantonRows;
  if (rows.length !== expectedKeptCount) {
    errors.push(
      `conservation: expected ${expectedKeptCount} kept rows ` +
        `(${records.length} source rows - ${droppedSiblingRows} sibling-discount - ` +
        `${droppedCantonRows} invalid-canton), got ${rows.length} output rows`,
    );
  }

  const seenKeys = new Set<string>();
  let duplicateCount = 0;
  let missingSourceCount = 0;
  let valueMismatchCount = 0;

  for (const row of rows) {
    const key = naturalKey({
      insurerCode: row.insurerCode,
      praemienregionId: row.praemienregionId,
      altersklasse: row.altersklasse,
      franchise: row.franchise,
      unfalldeckung: row.unfalldeckung,
      tarifart: row.tarifart,
      tarifCode: row.tarifCode,
      year: row.year,
    });

    if (seenKeys.has(key)) {
      duplicateCount++;
      if (duplicateCount <= MAX_EXAMPLES) errors.push(`uniqueness: duplicate output row for key "${key}"`);
      continue;
    }
    seenKeys.add(key);

    const sourcePremium = sourceByKey.get(key);
    if (sourcePremium === undefined) {
      missingSourceCount++;
      if (missingSourceCount <= MAX_EXAMPLES) {
        errors.push(`value: no source row found for output key "${key}"`);
      }
      continue;
    }

    if (Number(sourcePremium) !== row.monthlyPremium) {
      valueMismatchCount++;
      if (valueMismatchCount <= MAX_EXAMPLES) {
        errors.push(
          `value: key "${key}" expected monthlyPremium ${sourcePremium}, got ${row.monthlyPremium}`,
        );
      }
    }
  }

  return { ok: errors.length === 0, errors };
}

export function verifyWrittenFile(expectedJson: string, writtenJson: string): ValidationResult {
  if (expectedJson === writtenJson) return { ok: true, errors: [] };
  return {
    ok: false,
    errors: [
      `read-after-write: file on disk (${writtenJson.length} bytes) does not match the ` +
        `JSON that was written (${expectedJson.length} bytes)`,
    ],
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run scripts/ingest/validateIngest.test.ts`
Expected: PASS — all 8 tests.

- [ ] **Step 5: Commit**

```bash
git add scripts/ingest/validateIngest.ts scripts/ingest/validateIngest.test.ts
git commit -m "feat(ingest): add validateIngestOutput and verifyWrittenFile"
```

---

### Task 3: Wire validation into `scripts/ingest.ts`

**Files:**
- Modify: `scripts/ingest.ts`

**Interfaces:**
- Consumes: `validateIngestOutput`, `verifyWrittenFile` from Task 2 (`./ingest/validateIngest`).

- [ ] **Step 1: Import the new module**

At the top of `scripts/ingest.ts`, add to the existing block of `./ingest/*` imports:

```typescript
import { validateIngestOutput, verifyWrittenFile } from "./ingest/validateIngest";
```

- [ ] **Step 2: Abort before any write if validation fails**

In `main()`, immediately after the existing line:

```typescript
  if (rows.length === 0) fail("parsed 0 premium rows — check the CSV format/columns.");
```

add:

```typescript
  const validation = validateIngestOutput(csvText, rows);
  if (!validation.ok) {
    fail(`ingest output failed validation against source data:\n  ${validation.errors.join("\n  ")}`);
  }
```

This runs before `mkdir`/`writeFile` are reached, so a failing ingest writes nothing.

- [ ] **Step 3: Verify the premiums file round-trips after writing it**

Replace the current line:

```typescript
  await writeFile(join(PUBLIC_DATA_DIR, `premiums-${year}.json`), JSON.stringify(rows));
```

with:

```typescript
  const premiumsJson = JSON.stringify(rows);
  await writeFile(join(PUBLIC_DATA_DIR, `premiums-${year}.json`), premiumsJson);
  const premiumsWrittenBack = await readFile(join(PUBLIC_DATA_DIR, `premiums-${year}.json`), "utf-8");
  const roundTrip = verifyWrittenFile(premiumsJson, premiumsWrittenBack);
  if (!roundTrip.ok) {
    fail(`premiums file failed round-trip verification:\n  ${roundTrip.errors.join("\n  ")}`);
  }
```

(`readFile` is already imported at the top of the file from `node:fs/promises`, alongside `writeFile` and `mkdir` — no new import needed.)

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Run the full unit test suite**

Run: `npm test`
Expected: PASS — all existing suites plus Task 1 and Task 2's new tests.

- [ ] **Step 6: Run the real ingest against the committed raw data**

```bash
npm run ingest -- --local data/raw --publication-date 2025-09-23
```

Expected console output ends with `✔ wrote <N> premium rows for 2026, …` (no `ingest failed: ingest output failed validation` and no `ingest failed: premiums file failed round-trip verification` — if either appears, stop and treat it as a real bug per systematic-debugging, don't proceed to Step 7).

- [ ] **Step 7: Confirm the ingest is a no-op against already-correct committed data**

```bash
git status --porcelain src/data public/data
```

Expected: no output — regenerating from the same committed raw files with the same publication date reproduces byte-identical `src/data/*.json` and `public/data/premiums-2026.json`, confirming this change is purely additive (validation only) with no side effect on the data itself.

- [ ] **Step 8: Build the app against the validated data**

```bash
npm run build
```

Expected: PASS — confirms nothing downstream broke.

- [ ] **Step 9: Commit**

```bash
git add scripts/ingest.ts
git commit -m "feat(ingest): validate output against source data before writing, verify round-trip"
```

---

## Self-Review

**Spec coverage:** All four checks from the design doc are implemented — conservation and uniqueness and value cross-check in `validateIngestOutput` (Task 2), read-after-write in `verifyWrittenFile` (Task 2) wired at the point of writing (Task 3). The "runs on every `npm run ingest`" requirement is satisfied by calling both before/around the existing write calls in `main()` (Task 3), not as a separate command. The "abort before any write, print concrete examples" failure behavior is satisfied by placing the `validateIngestOutput` call before the first `writeFile` and joining up to `MAX_EXAMPLES` (10) concrete errors per category into the `fail()` message.

**Placeholder scan:** No TBD/TODO — every step has complete, runnable code or an exact command with its expected output.

**Type consistency:** `validateIngestOutput(csvText: string, rows: PremiumRow[]): ValidationResult` and `verifyWrittenFile(expectedJson: string, writtenJson: string): ValidationResult` (Task 2) are the exact names/signatures Task 3 imports and calls. `ValidationResult = { ok: boolean; errors: string[] }` matches how Task 3 reads `.ok`/`.errors`. The six helper names imported from `parsePremiums.ts` in Task 2 (`VALID_CANTONS`, `ALTERSKLASSE_MAP`, `TARIFART_MAP`, `parseFranchise`, `parseRegionNumber`, `parseUnfalldeckung`) are exactly the six Task 1 exports.
