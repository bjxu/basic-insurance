# BAG 2027 Schema Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `npm run ingest` succeed against BAG's 2027 premium files (already downloaded, live in `data/raw/`), producing `public/data/premiums-2027.json` and an updated `src/data/metadata.json` with `availableYears: [2026, 2027]`, while correctly reflecting BAG's 2027 Tarifart reclassification and without breaking the already-published 2026 data.

**Architecture:** Extend the `Tarifart` domain type additively (2026's real `hausarzt`/`hmo` classification stays; add new `praxis`/`flex` for 2027) and make every raw-code parser in the ingest pipeline recognize both years' code formats side by side, rather than replacing one with the other. Every downstream consumer of the 5-value `Tarifart` list (filters, badges, URL state, 6-locale UI copy) becomes a 7-value consumer.

**Tech Stack:** TypeScript, Next.js/React, Vitest, csv-parse, next-intl (6 locales: de/fr/it/en/es/pt).

## Global Constraints

- `Tarifart` union: `"standard" | "hmo" | "hausarzt" | "praxis" | "flex" | "telmed" | "andere"` — 2026 values (`hausarzt`, `hmo`) are never removed or renamed.
- Priority order (ties, display grouping): `standard=0, hausarzt=1, praxis=2, telmed=3, flex=4, hmo=5, andere=6`.
- Raw-code parsers must accept **both** old (2026, hyphenated) and new (2027, underscored) BAG code formats — never replace one format with the other, since 2026's raw CSV may need re-parsing later (it's committed under `data/raw/` via git history).
- New UI copy keys (`copy.tarifart.praxis`, `copy.tarifart.flex`) must be added to all 6 locale files (`de/fr/it/en/es/pt.json`) in the same commit — `messages.test.ts` fails otherwise.
- Badge colors: `praxis` reuses `bg-success-container text-on-success-container` (hausarzt's color); `flex` uses `bg-secondary-container text-on-secondary-container` (a previously-unused token in this app).
- Exact translated copy (from the approved spec, `docs/superpowers/specs/2026-09-29-bag-2027-schema-migration-design.md`):

  | Locale | praxis label | praxis description | flex label | flex description |
  |---|---|---|---|---|
  | de | Hausarzt/HMO | Erstanlaufstelle immer bei der gewählten Praxis oder dem HMO-Zentrum | Flex | Mehrere Erstanlaufstellen zur Wahl, z. B. Praxis, Telmedizin oder Apotheke |
  | en | Family doctor/HMO | First point of contact is always your chosen practice or HMO centre | Flex | Choice of several first points of contact, e.g. practice, telmed, or pharmacy |
  | fr | Médecin de famille/HMO | Premier contact toujours auprès du cabinet ou du centre HMO choisi | Flex | Choix entre plusieurs premiers points de contact, p. ex. cabinet, télémédecine ou pharmacie |
  | it | Medico di famiglia/HMO | Primo punto di contatto sempre presso lo studio o il centro HMO scelto | Flex | Scelta tra più punti di primo contatto, ad es. studio medico, telemedicina o farmacia |
  | es | Médico de familia/HMO | El primer punto de contacto es siempre la consulta o el centro HMO elegido | Flex | Elección entre varios primeros puntos de contacto, p. ej. consulta, telemedicina o farmacia |
  | pt | Médico de família/HMO | O primeiro ponto de contacto é sempre o consultório ou o centro HMO escolhido | Flex | Escolha entre vários primeiros pontos de contacto, por ex. consultório, telemedicina ou farmácia |

- Run `npx vitest run` and `npx tsc --noEmit` after every task; both must be clean before moving on.
- Current branch is `ingest-2027-premium-data`, already containing: the 2027 BAFU levy figure in `src/data/metadata.json`, and fresh (uncommitted) 2027 raw files under `data/raw/`. Do not revert either.

---

### Task 1: Extend the `Tarifart` type and its core consumers (lookup, URL state, log-inquiry)

**Files:**
- Modify: `src/lib/types.ts` (the `Tarifart` union)
- Modify: `src/lib/lookup.ts:28-40` (`TARIFART_PRIORITY`, `ALL_TARIFARTS`)
- Modify: `src/lib/url-state.ts:20` (`VALID_TARIFARTEN`)
- Modify: `src/app/api/log-inquiry/route.ts:11` (`TARIFARTEN`)
- Test: `src/lib/url-state.test.ts`

**Interfaces:**
- Produces: `Tarifart` now has 7 members: `"standard" | "hmo" | "hausarzt" | "praxis" | "flex" | "telmed" | "andere"`. `ALL_TARIFARTS: Tarifart[]` exported from `src/lib/lookup.ts` now has 7 entries. Later tasks (2, 3) read `ALL_TARIFARTS` from here.

- [ ] **Step 1: Write the failing tests in `url-state.test.ts`**

Add this new `describe` block at the end of the file:

```ts
describe("decodeState — models backward/forward compatibility across BAG's 2027 reclassification", () => {
  it("still decodes a legacy shared link using 2026's hausarzt/hmo codes", () => {
    expect(decodeState(new URLSearchParams("models=standard,hausarzt,hmo")).models).toEqual([
      "standard",
      "hausarzt",
      "hmo",
    ]);
  });

  it("decodes a 2027 shared link using the new praxis/flex codes", () => {
    expect(decodeState(new URLSearchParams("models=standard,praxis,flex")).models).toEqual([
      "standard",
      "praxis",
      "flex",
    ]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/url-state.test.ts`
Expected: FAIL — the `praxis`/`flex` case gets filtered out to `["standard"]` because `VALID_TARIFARTEN` doesn't recognize them yet (`Tarifart` also doesn't have them yet, so this won't even compile — that's fine, it's still "RED", just a compile error instead of an assertion failure).

- [ ] **Step 3: Extend the `Tarifart` type**

In `src/lib/types.ts`, replace:

```ts
export type Tarifart =
  | "standard"
  | "hmo"
  | "hausarzt"
  | "telmed"
  | "andere"; // driven by BAG classification, not hardcoded labels
```

with:

```ts
export type Tarifart =
  | "standard"
  | "hmo" // 2026-only: BAG's real, separate HMO classification that year
  | "hausarzt" // 2026-only: ditto for Hausarzt
  | "praxis" // 2027+: BAG's merged Hausarzt+HMO category
  | "telmed"
  | "flex" // 2027+: BAG's new "multiple first-contact options" category
  | "andere"; // driven by BAG classification, not hardcoded labels
```

- [ ] **Step 4: Update `TARIFART_PRIORITY` and `ALL_TARIFARTS` in `lookup.ts`**

Replace:

```ts
const TARIFART_PRIORITY: Record<Tarifart, number> = {
  standard: 0,
  hausarzt: 1,
  telmed: 2,
  hmo: 3,
  andere: 4,
};
```

with:

```ts
const TARIFART_PRIORITY: Record<Tarifart, number> = {
  standard: 0,
  hausarzt: 1,
  praxis: 2,
  telmed: 3,
  flex: 4,
  hmo: 5,
  andere: 6,
};
```

Replace:

```ts
// All five Tarifart values, in the same priority order as TARIFART_PRIORITY above — the
// filter used when the provider-product-detail accordion needs every model type for an
// insurer, independent of whichever models are currently toggled into the main list
// (docs/superpowers/specs/2026-08-16-provider-product-detail-design.md).
export const ALL_TARIFARTS: Tarifart[] = ["standard", "hausarzt", "telmed", "hmo", "andere"];
```

with:

```ts
// All seven Tarifart values, in the same priority order as TARIFART_PRIORITY above — the
// filter used when the provider-product-detail accordion needs every model type for an
// insurer, independent of whichever models are currently toggled into the main list
// (docs/superpowers/specs/2026-08-16-provider-product-detail-design.md).
export const ALL_TARIFARTS: Tarifart[] = ["standard", "hausarzt", "praxis", "telmed", "flex", "hmo", "andere"];
```

- [ ] **Step 5: Update `VALID_TARIFARTEN` in `url-state.ts`**

Replace:

```ts
const VALID_TARIFARTEN: Tarifart[] = ["standard", "hmo", "hausarzt", "telmed", "andere"];
```

with:

```ts
const VALID_TARIFARTEN: Tarifart[] = ["standard", "hmo", "hausarzt", "praxis", "flex", "telmed", "andere"];
```

- [ ] **Step 6: Update `TARIFARTEN` in `src/app/api/log-inquiry/route.ts`**

Replace:

```ts
const TARIFARTEN = ["standard", "hmo", "hausarzt", "telmed", "andere"];
```

with:

```ts
const TARIFARTEN = ["standard", "hmo", "hausarzt", "praxis", "flex", "telmed", "andere"];
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `npx vitest run src/lib/url-state.test.ts`
Expected: PASS

- [ ] **Step 8: Typecheck and run the full suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: `tsc` clean (TypeScript now forces `TARIFART_PRIORITY` to have all 7 keys — if you missed one, this is where it's caught). Some existing tests will still be RED at this point because `tarifart-style.ts` (Task 2) doesn't yet style `praxis`/`flex` — that's expected; only `url-state.test.ts` and anything not touching those two values needs to be green right now. Confirm no *unexpected* failures beyond what Task 2 will fix.

- [ ] **Step 9: Commit**

```bash
git add src/lib/types.ts src/lib/lookup.ts src/lib/url-state.ts src/lib/url-state.test.ts src/app/api/log-inquiry/route.ts
git commit -m "feat: extend Tarifart with 2027's praxis/flex categories"
```

---

### Task 2: Badge colors for the new categories

**Files:**
- Modify: `src/lib/tarifart-style.ts`
- Test: `src/lib/tarifart-style.test.ts` (new file)

**Interfaces:**
- Consumes: `ALL_TARIFARTS` from `src/lib/lookup.ts` (Task 1).
- Produces: `MODEL_TAG_CLASSES: Record<string, string>` now has entries for `hausarzt`, `hmo`, `telmed`, `praxis`, `flex` (unchanged: no entry for `standard`/`andere`, which intentionally fall back to `DEFAULT_MODEL_TAG_CLASSES`).

- [ ] **Step 1: Write the failing test**

Create `src/lib/tarifart-style.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { MODEL_TAG_CLASSES } from "./tarifart-style";
import { ALL_TARIFARTS } from "./lookup";

describe("MODEL_TAG_CLASSES", () => {
  it("has an explicit badge color for every alternative-model Tarifart", () => {
    // standard and andere intentionally have no entry — they fall back to
    // DEFAULT_MODEL_TAG_CLASSES — every other Tarifart needs its own color.
    const styledModels = ALL_TARIFARTS.filter((t) => t !== "standard" && t !== "andere");
    for (const tarifart of styledModels) {
      expect(MODEL_TAG_CLASSES[tarifart], `missing badge color for "${tarifart}"`).toBeDefined();
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/tarifart-style.test.ts`
Expected: FAIL — `MODEL_TAG_CLASSES["praxis"]` and `MODEL_TAG_CLASSES["flex"]` are `undefined`.

- [ ] **Step 3: Add the new colors**

In `src/lib/tarifart-style.ts`, replace:

```ts
export const MODEL_TAG_CLASSES: Record<string, string> = {
  hmo: "bg-warning-container text-on-warning-container",
  telmed: "bg-tertiary-container text-on-tertiary-container",
  hausarzt: "bg-success-container text-on-success-container",
};
```

with:

```ts
export const MODEL_TAG_CLASSES: Record<string, string> = {
  hmo: "bg-warning-container text-on-warning-container",
  telmed: "bg-tertiary-container text-on-tertiary-container",
  hausarzt: "bg-success-container text-on-success-container",
  praxis: "bg-success-container text-on-success-container", // same family as hausarzt, its 2027 successor
  flex: "bg-secondary-container text-on-secondary-container",
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/tarifart-style.test.ts`
Expected: PASS

- [ ] **Step 5: Run the full suite**

Run: `npx vitest run && npx tsc --noEmit`
Expected: all green (Task 1's temporary gap is now closed).

- [ ] **Step 6: Commit**

```bash
git add src/lib/tarifart-style.ts src/lib/tarifart-style.test.ts
git commit -m "feat: badge colors for the praxis/flex Tarifart categories"
```

---

### Task 3: Update the help-guide model list and admin dashboard labels

**Files:**
- Modify: `src/components/help/ModelList.tsx:8`
- Modify: `src/components/admin/Dashboard.tsx:48-54`

**Interfaces:**
- Consumes: `copy.tarifart.praxis`/`copy.tarifart.flex` message keys (added in Task 4 — this task's UI change is inert until then, since next-intl falls back to the key path string for a missing key; run Task 4 before doing a visual check, but the code change itself is independent and safe to land now).

No dedicated unit test exists for either component (both are static display lists with no existing render-test scaffolding in this codebase) — verify via typecheck and the full suite, consistent with how these two files are already tested (not at all, beyond compilation).

- [ ] **Step 1: Update `ModelList.tsx`'s alternative-model list**

In `src/components/help/ModelList.tsx`, replace:

```ts
const ALT_MODEL_KEYS = ["hausarzt", "telmed", "hmo"] as const;
```

with:

```ts
const ALT_MODEL_KEYS = ["hausarzt", "praxis", "telmed", "flex", "hmo"] as const;
```

- [ ] **Step 2: Update `Dashboard.tsx`'s model label map**

In `src/components/admin/Dashboard.tsx`, replace:

```ts
const MODEL_LABEL: Record<string, string> = {
  standard: "Standard",
  hausarzt: "Hausarzt",
  hmo: "HMO",
  telmed: "Telmed",
  andere: "Andere",
};
```

with:

```ts
const MODEL_LABEL: Record<string, string> = {
  standard: "Standard",
  hausarzt: "Hausarzt",
  hmo: "HMO",
  praxis: "Praxis",
  flex: "Flex",
  telmed: "Telmed",
  andere: "Andere",
};
```

- [ ] **Step 3: Typecheck and run the full suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: clean (no new failures; `copy.tarifart.praxis`/`.flex` don't exist yet, so if you start the dev server now `ModelList` will show the raw key path instead of real text for those two rows — expected until Task 4).

- [ ] **Step 4: Commit**

```bash
git add src/components/help/ModelList.tsx src/components/admin/Dashboard.tsx
git commit -m "feat: list praxis/flex in the help guide and admin dashboard"
```

---

### Task 4: Add `copy.tarifart.praxis`/`copy.tarifart.flex` to all 6 locales

**Files:**
- Modify: `src/messages/de.json`, `en.json`, `fr.json`, `it.json`, `es.json`, `pt.json`

**Interfaces:**
- Produces: `copy.tarifart.praxis.{label,description}` and `copy.tarifart.flex.{label,description}` in every locale file, consumed by `ProductList.tsx` and `ModelList.tsx` (already wired, Task 3) via `t(\`copy.tarifart.${tarifart}.label\`)`.

`messages.test.ts` already generically diffs every locale's key tree and placeholder set against `de.json` — no test code changes needed, just data. Add to `de.json` first to prove the test catches an incomplete rollout, then finish all locales.

- [ ] **Step 1: Add the new keys to `de.json` only, and run the test to verify it fails**

In `src/messages/de.json`, inside `copy.tarifart`, insert `praxis` and `flex` entries (position doesn't matter, JSON object). The object becomes:

```json
"tarifart": {
  "standard": {
    "label": "Standard",
    "description": "Freie Arztwahl"
  },
  "hausarzt": {
    "label": "Hausarzt",
    "description": "Erstbehandlung immer beim gewählten Hausarzt"
  },
  "telmed": {
    "label": "Telmed",
    "description": "Anruf bei Hotline erforderlich vor jedem Arztbesuch"
  },
  "hmo": {
    "label": "HMO",
    "description": "Erstanlaufstelle immer beim HMO-Zentrum"
  },
  "praxis": {
    "label": "Hausarzt/HMO",
    "description": "Erstanlaufstelle immer bei der gewählten Praxis oder dem HMO-Zentrum"
  },
  "flex": {
    "label": "Flex",
    "description": "Mehrere Erstanlaufstellen zur Wahl, z. B. Praxis, Telmedizin oder Apotheke"
  },
  "andere": {
    "label": "Alternativmodell",
    "description": "Eingeschränkte Wahl des Erstanlaufpunkts"
  }
}
```

Run: `npx vitest run src/messages/messages.test.ts`
Expected: FAIL — `en.json` (etc.) now has fewer keys than `de.json` (`%s.json has exactly the same keys and placeholders as de.json"` fails for all 5 other locales).

- [ ] **Step 2: Add the matching keys to the other 5 locales**

`en.json`:

```json
"praxis": {
  "label": "Family doctor/HMO",
  "description": "First point of contact is always your chosen practice or HMO centre"
},
"flex": {
  "label": "Flex",
  "description": "Choice of several first points of contact, e.g. practice, telmed, or pharmacy"
}
```

`fr.json`:

```json
"praxis": {
  "label": "Médecin de famille/HMO",
  "description": "Premier contact toujours auprès du cabinet ou du centre HMO choisi"
},
"flex": {
  "label": "Flex",
  "description": "Choix entre plusieurs premiers points de contact, p. ex. cabinet, télémédecine ou pharmacie"
}
```

`it.json`:

```json
"praxis": {
  "label": "Medico di famiglia/HMO",
  "description": "Primo punto di contatto sempre presso lo studio o il centro HMO scelto"
},
"flex": {
  "label": "Flex",
  "description": "Scelta tra più punti di primo contatto, ad es. studio medico, telemedicina o farmacia"
}
```

`es.json`:

```json
"praxis": {
  "label": "Médico de familia/HMO",
  "description": "El primer punto de contacto es siempre la consulta o el centro HMO elegido"
},
"flex": {
  "label": "Flex",
  "description": "Elección entre varios primeros puntos de contacto, p. ej. consulta, telemedicina o farmacia"
}
```

`pt.json`:

```json
"praxis": {
  "label": "Médico de família/HMO",
  "description": "O primeiro ponto de contacto é sempre o consultório ou o centro HMO escolhido"
},
"flex": {
  "label": "Flex",
  "description": "Escolha entre vários primeiros pontos de contacto, por ex. consultório, telemedicina ou farmácia"
}
```

Insert each locale's `praxis`/`flex` pair into that file's `copy.tarifart` object, in the same position as `de.json` (after `hmo`, before `andere`) so a visual diff across locale files stays easy to follow.

- [ ] **Step 3: Run the test to verify it passes**

Run: `npx vitest run src/messages/messages.test.ts`
Expected: PASS for all 5 locale comparisons.

- [ ] **Step 4: Run the full suite and typecheck**

Run: `npx vitest run && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/messages/de.json src/messages/en.json src/messages/fr.json src/messages/it.json src/messages/es.json src/messages/pt.json
git commit -m "feat: translate copy.tarifart.praxis/flex into all 6 locales"
```

---

### Task 5: Dual-format raw-code parsing in `parsePremiums.ts`

**Files:**
- Modify: `scripts/ingest/parsePremiums.ts`
- Test: `scripts/ingest/parsePremiums.test.ts`

**Interfaces:**
- Produces: `ALTERSKLASSE_MAP`, `TARIFART_MAP` (both `Record<string, …>`, now covering both years' raw codes), `parseFranchise(code: string): number`, `parseRegionNumber(code: string): string`, `parseUnfalldeckung(code: string): boolean` — all unchanged signatures, now accepting either format. Consumed by `validateIngest.ts` (Task 6, already imports these) and `scripts/ingest.ts` (unchanged call site).

- [ ] **Step 1: Write the failing tests**

Add these cases to `scripts/ingest/parsePremiums.test.ts`. First, inside `describe("parsePremiumRows", ...)`, add a 2027-format equivalent of the existing "maps a standard adult row" and "maps all four real Tariftyp codes" tests:

```ts
  it("maps a standard adult row using 2027's raw code format", () => {
    const { rows } = parsePremiumRows(
      csv(
        "8,ZH,P_OKPCH,2027,2026,PR_REG_1,AKA_03_ERW,MIT_UNF,BASE,BASE,E1,FRASTU_01,FRA_01_E_0300,301.1,1,1,Grundversicherung",
      ),
      NAMES,
    );
    expect(rows).toEqual([
      {
        year: 2027,
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
      },
    ]);
  });

  it("maps all four 2027 Tariftyp codes to the right Tarifart, distinct from their 2026 counterparts", () => {
    const { rows } = parsePremiumRows(
      csv(
        "8,ZH,P_OKPCH,2027,2026,PR_REG_1,AKA_03_ERW,OHN_UNF,X,PRAXIS,E1,FRASTU_01,FRA_01_E_0300,200,0,0,Praxis",
        "8,ZH,P_OKPCH,2027,2026,PR_REG_1,AKA_03_ERW,OHN_UNF,X,FLEX,E1,FRASTU_01,FRA_01_E_0300,190,0,0,Flex",
        "8,ZH,P_OKPCH,2027,2026,PR_REG_1,AKA_03_ERW,OHN_UNF,X,TEL_DIG,E1,FRASTU_01,FRA_01_E_0300,180,0,0,Telmed",
      ),
      NAMES,
    );
    expect(rows.map((r) => r.tarifart)).toEqual(["praxis", "flex", "telmed"]);
  });

  it("keeps only the K1 (base) child rate using 2027's sibling-discount code", () => {
    const { rows } = parsePremiumRows(
      csv(
        "8,ZH,P_OKPCH,2027,2026,PR_REG_1,AKA_01_KIN,MIT_UNF,BASE,BASE,K1,FRASTU_01,FRA_01_K_0000,120,0,1,Grundversicherung",
        "8,ZH,P_OKPCH,2027,2026,PR_REG_1,AKA_01_KIN,MIT_UNF,BASE,BASE,K3,FRASTU_01,FRA_01_K_0000,60,0,1,Grundversicherung",
      ),
      NAMES,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].monthlyPremium).toBe(120);
  });
```

Then, inside `describe("exported parsing helpers (reused by validateIngest.ts)", ...)`, extend the existing helper tests to cover both formats:

```ts
  it("ALTERSKLASSE_MAP maps both 2026 and 2027 BAG codes", () => {
    expect(ALTERSKLASSE_MAP["AKL-KIN"]).toBe("kind");
    expect(ALTERSKLASSE_MAP["AKL-JUG"]).toBe("jung");
    expect(ALTERSKLASSE_MAP["AKL-ERW"]).toBe("erwachsen");
    expect(ALTERSKLASSE_MAP["AKA_01_KIN"]).toBe("kind");
    expect(ALTERSKLASSE_MAP["AKA_02_JUG"]).toBe("jung");
    expect(ALTERSKLASSE_MAP["AKA_03_ERW"]).toBe("erwachsen");
  });

  it("TARIFART_MAP maps both 2026 and 2027 BAG Tariftyp codes", () => {
    expect(TARIFART_MAP["TAR-BASE"]).toBe("standard");
    expect(TARIFART_MAP["TAR-HAM"]).toBe("hausarzt");
    expect(TARIFART_MAP["TAR-HMO"]).toBe("hmo");
    expect(TARIFART_MAP["TAR-DIV"]).toBe("telmed");
    expect(TARIFART_MAP["BASE"]).toBe("standard");
    expect(TARIFART_MAP["PRAXIS"]).toBe("praxis");
    expect(TARIFART_MAP["FLEX"]).toBe("flex");
    expect(TARIFART_MAP["TEL_DIG"]).toBe("telmed");
  });

  it("parseFranchise extracts the numeric value from either year's Franchise code", () => {
    expect(parseFranchise("FRA-300")).toBe(300);
    expect(parseFranchise("FRA_01_E_0300")).toBe(300);
    expect(parseFranchise("FRA_04_K_0300")).toBe(300);
    expect(parseFranchise("FRA_01_J_0300")).toBe(300);
    expect(() => parseFranchise("XYZ")).toThrow(/Franchise/);
  });

  it("parseRegionNumber extracts the numeric value from either year's Region code", () => {
    expect(parseRegionNumber("PR-REG CH1")).toBe("1");
    expect(parseRegionNumber("PR_REG_1")).toBe("1");
    expect(() => parseRegionNumber("XYZ")).toThrow(/Region/);
  });

  it("parseUnfalldeckung maps either year's Unfalleinschluss codes to true/false", () => {
    expect(parseUnfalldeckung("MIT-UNF")).toBe(true);
    expect(parseUnfalldeckung("OHN-UNF")).toBe(false);
    expect(parseUnfalldeckung("MIT_UNF")).toBe(true);
    expect(parseUnfalldeckung("OHN_UNF")).toBe(false);
    expect(() => parseUnfalldeckung("XYZ")).toThrow(/Unfalleinschluss/);
  });
```

(Leave the pre-existing 2026-format-only assertions in the earlier tests in this same `it` blocks as-is — you're extending each `it`, not replacing it, so both formats are asserted in one place per helper.)

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run scripts/ingest/parsePremiums.test.ts`
Expected: FAIL — new 2027-format rows throw "unrecognized Altersklasse/Tariftyp/etc.", and the new `TARIFART_MAP`/`ALTERSKLASSE_MAP`/`parseFranchise`/`parseRegionNumber`/`parseUnfalldeckung` assertions for new-format codes return `undefined` or throw.

- [ ] **Step 3: Implement dual-format support**

In `scripts/ingest/parsePremiums.ts`, replace:

```ts
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

with:

```ts
// BAG changed its raw code encoding between the 2026 and 2027 premium files (hyphenated
// prefixes -> underscore-delimited codes) — both are recognized here rather than one
// replacing the other, since a future fix might require re-parsing 2026's raw CSV (still
// committed under data/raw/ via git history). If a future year's ingest throws
// "unrecognized code", check whether BAG changed the encoding again before assuming a bug.
export const ALTERSKLASSE_MAP: Record<string, Altersklasse> = {
  "AKL-KIN": "kind",
  "AKL-JUG": "jung",
  "AKL-ERW": "erwachsen",
  "AKA_01_KIN": "kind",
  "AKA_02_JUG": "jung",
  "AKA_03_ERW": "erwachsen",
};

// 2027 merged Hausarzt+HMO into one "PRAXIS" category and split the old "TAR-DIV" bucket
// into "TEL_DIG" (unchanged in substance: phone/digital first contact) and a genuinely new
// "FLEX" category (choice of several first-contact options) — see
// docs/superpowers/specs/2026-09-29-bag-2027-schema-migration-design.md.
export const TARIFART_MAP: Record<string, Tarifart> = {
  "TAR-BASE": "standard",
  "TAR-HAM": "hausarzt",
  "TAR-HMO": "hmo",
  "TAR-DIV": "telmed",
  "BASE": "standard",
  "PRAXIS": "praxis",
  "FLEX": "flex",
  "TEL_DIG": "telmed",
};
```

Replace:

```ts
    if (r.Altersklasse === "AKL-KIN" && r.Altersuntergruppe !== "K1") continue;
```

with:

```ts
    if ((r.Altersklasse === "AKL-KIN" || r.Altersklasse === "AKA_01_KIN") && r.Altersuntergruppe !== "K1") continue;
```

Replace:

```ts
export function parseFranchise(code: string): number {
  const match = /^FRA-(\d+)$/.exec(code);
  if (!match) throw new Error(`parseFranchise: unrecognized Franchise code "${code}"`);
  return Number(match[1]);
}

export function parseRegionNumber(code: string): string {
  const match = /^PR-REG CH(\d+)$/.exec(code);
  if (!match) throw new Error(`parseRegionNumber: unrecognized Region code "${code}"`);
  return match[1];
}

export function parseUnfalldeckung(code: string): boolean {
  if (code === "MIT-UNF") return true;
  if (code === "OHN-UNF") return false;
  throw new Error(`parseUnfalldeckung: unrecognized Unfalleinschluss "${code}"`);
}
```

with:

```ts
export function parseFranchise(code: string): number {
  const old = /^FRA-(\d+)$/.exec(code);
  if (old) return Number(old[1]);
  // 2027 format: FRA_<stufe>_<E|J|K altersgruppe-letter>_<amount, zero-padded>
  const neu = /^FRA_\d+_[EJK]_(\d+)$/.exec(code);
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

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run scripts/ingest/parsePremiums.test.ts`
Expected: PASS

- [ ] **Step 5: Run the full suite and typecheck**

Run: `npx vitest run && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add scripts/ingest/parsePremiums.ts scripts/ingest/parsePremiums.test.ts
git commit -m "feat: parse both 2026 and 2027 BAG raw code formats"
```

---

### Task 6: Dual-format sibling-discount check in `validateIngest.ts`

**Files:**
- Modify: `scripts/ingest/validateIngest.ts:71`
- Test: `scripts/ingest/validateIngest.test.ts`

**Interfaces:**
- Consumes: nothing new (already imports `ALTERSKLASSE_MAP`/`TARIFART_MAP`/etc. from `parsePremiums.ts`, Task 5, unchanged import list).

- [ ] **Step 1: Write the failing test**

Add this test to `scripts/ingest/validateIngest.test.ts`, inside `describe("validateIngestOutput", ...)`:

```ts
  it("accounts for a dropped sibling-discount row using 2027's raw code format", () => {
    const csvText = csv(
      "8,ZH,P_OKPCH,2027,2026,PR_REG_1,AKA_03_ERW,MIT_UNF,BASE,BASE,E1,FRASTU_01,FRA_01_E_0300,301.1,1,1,Grundversicherung",
      "8,ZH,P_OKPCH,2027,2026,PR_REG_1,AKA_01_KIN,MIT_UNF,BASE,BASE,K1,FRASTU_01,FRA_01_K_0000,120,0,1,Grundversicherung",
      "8,ZH,P_OKPCH,2027,2026,PR_REG_1,AKA_01_KIN,MIT_UNF,BASE,BASE,K3,FRASTU_01,FRA_01_K_0000,60,0,1,Grundversicherung",
    );
    const rows = [
      row({ year: 2027, tarifart: "standard" }),
      row({ year: 2027, altersklasse: "kind", franchise: 0, monthlyPremium: 120, tarifart: "standard" }),
    ];
    expect(validateIngestOutput(csvText, rows)).toEqual({ ok: true, errors: [] });
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run scripts/ingest/validateIngest.test.ts`
Expected: FAIL — the conservation check expects 2 kept rows (3 source rows - 1 dropped sibling), but `validateIngestOutput` doesn't recognize `AKA_01_KIN` as the child code yet, so it doesn't drop the sibling row, producing a mismatched count/errors.

- [ ] **Step 3: Fix the sibling-discount check**

In `scripts/ingest/validateIngest.ts`, replace:

```ts
    if (r.Altersklasse === "AKL-KIN" && r.Altersuntergruppe !== "K1") {
```

with:

```ts
    if ((r.Altersklasse === "AKL-KIN" || r.Altersklasse === "AKA_01_KIN") && r.Altersuntergruppe !== "K1") {
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run scripts/ingest/validateIngest.test.ts`
Expected: PASS

- [ ] **Step 5: Run the full suite and typecheck**

Run: `npx vitest run && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add scripts/ingest/validateIngest.ts scripts/ingest/validateIngest.test.ts
git commit -m "fix: recognize 2027's sibling-discount code in ingest validation"
```

---

### Task 7: Multi-delimiter support in `members.ts`

**Files:**
- Modify: `scripts/ingest/members.ts`
- Test: `scripts/ingest/members.test.ts`

**Interfaces:**
- Produces: `parseMemberCounts(csvText: string, insurerNames: Record<string,string>): ParseMemberCountsResult` — unchanged signature, now accepts both semicolon- (2026) and comma-delimited (2027) input. `normalizeInsurerCode` is unchanged (already handles both zero-padded and unpadded codes via `Number()`).

- [ ] **Step 1: Write the failing test**

Add this test to `scripts/ingest/members.test.ts`, inside `describe("parseMemberCounts", ...)`:

```ts
  it("parses a comma-delimited file (2027 format) with unpadded insurer codes", () => {
    const text = "﻿Versicherer,Kanton,Geschäftsjahr,Durchschnittsbestand\n8,AG,2025,147305.265483858\n8,ZH,2025,100.5";
    const result = parseMemberCounts(text, insurerNames);
    expect(result.counts).toEqual({ "8": 147406 }); // 147305.265... + 100.5 = 147405.765... -> round
    expect(result.year).toBe(2025);
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run scripts/ingest/members.test.ts`
Expected: FAIL — `csv-parse` configured with `delimiter: ";"` treats the entire comma-delimited line as one column, so `r.Versicherer` is `undefined` and `normalizeInsurerCode(undefined)` throws.

- [ ] **Step 3: Support both delimiters**

In `scripts/ingest/members.ts`, replace:

```ts
  const records: Record<string, string>[] = parse(csvText, {
    columns: true,
    bom: true,
    trim: true,
    delimiter: ";",
  });
```

with:

```ts
  // 2026's file is semicolon-delimited; 2027's is comma-delimited. csv-parse auto-detects
  // which of these two is actually used per call, so both are listed rather than picking one.
  const records: Record<string, string>[] = parse(csvText, {
    columns: true,
    bom: true,
    trim: true,
    delimiter: [";", ","],
  });
```

Also update the file-level comment, which currently states the delimiter/padding
difference between files as an unconditional fact. Replace:

```ts
// Parses BAG's "Versichertenbestand_CH.csv" (per-insurer, per-canton OKP enrollment)
// into per-insurer national totals. This is a separate BAG file from Praemien_CH.csv:
// semicolon-delimited (the premium file is comma-delimited) and the Versicherer code is
// zero-padded (the premium file's is not) — both handled here. Column mapping verified
// against the live file during planning (2026-08-14) — see
// docs/superpowers/plans/2026-08-14-member-count-badge.md Global Constraints.
```

with:

```ts
// Parses BAG's "Versichertenbestand_CH.csv" (per-insurer, per-canton OKP enrollment)
// into per-insurer national totals. This is a separate BAG file from Praemien_CH.csv, with
// its own quirks handled here. Both have varied by year rather than being fixed facts:
// delimiter was semicolon in 2026, comma in 2027 (both recognized below); the Versicherer
// code was zero-padded in 2026's file ("0008") and unpadded in 2027's ("8") —
// normalizeInsurerCode handles either via Number() round-tripping. Column mapping
// verified against the live file during planning (2026-08-14) — see
// docs/superpowers/plans/2026-08-14-member-count-badge.md Global Constraints.
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run scripts/ingest/members.test.ts`
Expected: PASS

- [ ] **Step 5: Run the full suite and typecheck**

Run: `npx vitest run && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add scripts/ingest/members.ts scripts/ingest/members.test.ts
git commit -m "fix: parse both semicolon- and comma-delimited Versichertenbestand files"
```

---

### Task 8: Update the product-description crawler's prompt examples

**Files:**
- Modify: `scripts/crawl/extractDescription.ts:27-29`
- Test: `scripts/crawl/extractDescription.test.ts`

**Interfaces:**
- Consumes: `Tarifart` type (Task 1) — `buildPrompt`'s `tarifart` argument already accepts any of the 7 values with no signature change.

- [ ] **Step 1: Write the failing test**

Add this test to `scripts/crawl/extractDescription.test.ts`, inside `describe("buildPrompt", ...)`:

```ts
  it("includes example descriptions for the 2027 praxis/flex categories", () => {
    const prompt = buildPrompt({ pageText: "Some page content here.", productName: "AGRIeco", tarifart: "praxis" });
    expect(prompt).toContain("praxis");
    expect(prompt).toContain("flex");
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run scripts/crawl/extractDescription.test.ts`
Expected: FAIL — the prompt currently only mentions `hausarzt`/`telmed`/`hmo` as examples, not `praxis`/`flex`.

- [ ] **Step 3: Add the new example lines**

In `scripts/crawl/extractDescription.ts`, replace:

```ts
    `- hausarzt: "Erstbehandlung immer beim gewählten Hausarzt"`,
    `- telmed: "Anruf bei Hotline erforderlich vor jedem Arztbesuch"`,
    `- hmo: "Erstanlaufstelle immer beim HMO-Zentrum"`,
```

with:

```ts
    `- hausarzt: "Erstbehandlung immer beim gewählten Hausarzt"`,
    `- telmed: "Anruf bei Hotline erforderlich vor jedem Arztbesuch"`,
    `- hmo: "Erstanlaufstelle immer beim HMO-Zentrum"`,
    `- praxis: "Erstanlaufstelle immer bei der gewählten Praxis oder dem HMO-Zentrum"`,
    `- flex: "Mehrere Erstanlaufstellen zur Wahl, z. B. Praxis, Telmedizin oder Apotheke"`,
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run scripts/crawl/extractDescription.test.ts`
Expected: PASS

- [ ] **Step 5: Run the full suite and typecheck**

Run: `npx vitest run && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add scripts/crawl/extractDescription.ts scripts/crawl/extractDescription.test.ts
git commit -m "feat: add praxis/flex examples to the product-description crawler prompt"
```

---

### Task 9: Update `requirement.md`

**Files:**
- Modify: `requirement.md` (glossary row ~line 47, help-guide description ~lines 202-203, resolved-questions item 4 ~lines 385-387)

No tests — this is documentation. Verify by reading the diff for accuracy against the shipped behavior from Tasks 1-8.

- [ ] **Step 1: Update the Tarifart glossary row**

Replace:

```
| Tarifart (insurance model) | Standard (free choice of doctor) vs. alternative models (HMO, family-doctor/*Hausarztmodell*, Telmed, and other BAG-classified alternative variants) that restrict first point of contact in exchange for a lower premium. |
```

with:

```
| Tarifart (insurance model) | Standard (free choice of doctor) vs. alternative models (HMO, family-doctor/*Hausarztmodell*, Telmed, and other BAG-classified alternative variants) that restrict first point of contact in exchange for a lower premium. Since 2027, BAG classifies alternative models more coarsely: Hausarzt and HMO merged into one "Praxis" category, plus a new "Flex" category (choice of several first-contact points). 2026 data keeps its original, separate Hausarzt/HMO classification — the app shows both years' authentic categories side by side rather than collapsing one into the other (§11.4). |
```

- [ ] **Step 2: Update the help-guide model list description**

Replace:

```
lists each BAG Tarifart with its one-line restriction — Standard on top, then Hausarzt /
Telmed / HMO grouped under an "alternative models" label — reusing the same
```

with:

```
lists each BAG Tarifart with its one-line restriction — Standard on top, then Hausarzt /
Praxis / Telmed / Flex / HMO grouped under an "alternative models" label — reusing the same
```

- [ ] **Step 3: Mark the anticipated open question as resolved**

Replace:

```
4. The alternative-model list in §3 (HMO, Hausarztmodell, Telmed, "other variants") should
   be driven by BAG's actual Tarifart classification during implementation rather than
   hardcoded to these three named models, in case the official classification is broader.
```

with:

```
4. ~~The alternative-model list in §3 (HMO, Hausarztmodell, Telmed, "other variants")
   should be driven by BAG's actual Tarifart classification during implementation rather
   than hardcoded to these three named models, in case the official classification is
   broader.~~ — resolved by the 2026-09-29 BAG 2027 schema migration: BAG's own
   reclassification (Hausarzt+HMO merged into "Praxis", a new "Flex" category added) is
   exactly the broader-than-anticipated case this note flagged, and the app follows it
   additively (see `docs/superpowers/specs/2026-09-29-bag-2027-schema-migration-design.md`).
```

- [ ] **Step 4: Commit**

```bash
git add requirement.md
git commit -m "docs: reconcile requirement.md with the 2027 Tarifart reclassification"
```

---

### Task 10: Run the real 2027 ingest end-to-end and commit the data

**Files:**
- Run (not edit by hand): `npm run ingest`
- Commit: `data/raw/praemien.csv`, `data/raw/praemienregionen.xlsx`, `data/raw/versichertenbestand.csv` (already refreshed in the working tree from the earlier live download), `public/data/premiums-2027.json` (new), `src/data/metadata.json`, `src/data/insurers.json`, `src/data/plz-map.json`, `src/data/gemeinde-region-map.json`

**Interfaces:** none — this is the integration checkpoint that proves Tasks 1-9 actually add up to a working ingest.

- [ ] **Step 1: Confirm the working tree still has the live 2027 raw files and the BAFU levy figure**

Run: `git status --short`
Expected: `data/raw/praemien.csv`, `data/raw/praemienregionen.xlsx`, `data/raw/versichertenbestand.csv`, and `src/data/metadata.json` show as modified (uncommitted from earlier in this session). If `metadata.json`'s diff doesn't include `"2027": 4.75` under `environmentalLevyPerMonth`, stop and re-add it before continuing — Task 5's `carryForwardEnvironmentalLevy` check will otherwise fail the ingest run.

- [ ] **Step 2: Run the full test suite and typecheck one more time**

Run: `npx vitest run && npx tsc --noEmit`
Expected: clean — this is the last chance to catch a wiring mistake before touching real data files.

- [ ] **Step 3: Run the ingest**

Run: `npm run ingest -- --publication-date 2026-09-29`
Expected: `✔ wrote <N> premium rows for 2027, <M> Gemeinden, <K> PLZ.` with no `unrecognized Altersklasse/Tariftyp/Franchise/Region/Unfalleinschluss` errors and no `unknownTariftypes` warning (all 4 real 2027 Tariftyp codes — BASE/PRAXIS/FLEX/TEL_DIG — are now mapped; if a `PHARM` warning appears, that's expected and fine per the spec's Non-goals — it falls back to `andere`).

- [ ] **Step 4: Verify the output**

Run:
```bash
node -e "const m = require('./src/data/metadata.json'); console.log(m.availableYears, m.environmentalLevyPerMonth);"
ls -la public/data/premiums-2027.json
node -e "const rows = require('./public/data/premiums-2027.json'); console.log(rows.length, rows[0]);"
```
Expected: `availableYears` is `[2026, 2027]` (not `[2027]` — this is what `mergeAvailableYears`, from the earlier `fix-ingest-available-years` PR, was for); `environmentalLevyPerMonth` has both `"2026": 5.15` and `"2027": 4.75`; `premiums-2027.json` exists and its first row has `year: 2027` and a `tarifart` of one of `standard`/`praxis`/`flex`/`telmed`/`andere` (never `hausarzt`/`hmo` — those are 2026-only).

- [ ] **Step 5: Run the full suite one final time against the real generated data**

Run: `npx vitest run`
Expected: PASS, including `src/lib/praemienGuide.test.ts`'s fixture-reading test (it reads whichever year's `premiums-*.json` it's pointed at — confirm it still passes against the new file if it references 2027, otherwise it's unaffected since it targets 2026's fixture by name).

- [ ] **Step 6: Manually verify the app in the browser**

Run: `npm run dev`, open the app, and:
- Confirm the year toggle shows both **2026** and **2027** and switching between them changes prices.
- With 2027 selected and alternative models on, confirm you see **"Hausarzt/HMO"** and **"Flex"** badges (not "Hausarzt"/"HMO" separately) on the appropriate product rows.
- With 2026 selected, confirm **"Hausarzt"** and **"HMO"** still show as separate badges, unchanged.
- Open the help guide's model explainer and confirm it now lists 5 alternative-model rows (Hausarzt, Hausarzt/HMO, Telmed, Flex, HMO) with real (non-key-path) label and description text.
- Visit `/de/praemien` (or any locale) and confirm the guide's year and canton table now show **2027** (it follows `Math.max(availableYears)`).

- [ ] **Step 7: Commit the data files**

```bash
git add data/raw/praemien.csv data/raw/praemienregionen.xlsx data/raw/versichertenbestand.csv \
        public/data/premiums-2027.json src/data/metadata.json src/data/insurers.json \
        src/data/plz-map.json src/data/gemeinde-region-map.json
git commit -m "feat: ingest 2027 BAG premium data alongside 2026"
```

- [ ] **Step 8: Push the branch and open a PR**

```bash
git push -u origin ingest-2027-premium-data
gh pr create --base main --title "feat: ingest 2027 BAG premium data (Tarifart reclassification)" --body "$(cat <<'EOF'
## Summary
- BAG published 2027 premium data with a changed raw code encoding *and* a reclassified Tariftyp taxonomy (Hausarzt+HMO merged into "Praxis", a new "Flex" category split off the old telmed/Diverse bucket).
- `Tarifart` grows additively (7 values) — 2026's real hausarzt/hmo classification is untouched; premiums-2026.json is not rewritten.
- Raw-code parsers (`parsePremiums.ts`, `validateIngest.ts`, `members.ts`) now recognize both years' formats.
- New `copy.tarifart.praxis`/`.flex` UI copy across all 6 locales.
- `premiums-2027.json` ingested; `metadata.json` now has `availableYears: [2026, 2027]` and both years' environmental levy figures.
- Design doc: `docs/superpowers/specs/2026-09-29-bag-2027-schema-migration-design.md`

## Test plan
- [x] `npx vitest run` — full suite passing
- [x] `npx tsc --noEmit` — clean
- [x] `npm run ingest -- --publication-date 2026-09-29` — real 2027 files ingest cleanly, no unrecognized-code errors
- [x] Manual check: year toggle shows 2026 and 2027; 2027 shows merged "Hausarzt/HMO" and new "Flex" badges; 2026 still shows separate "Hausarzt"/"HMO"; `/praemien` guide follows the latest year
EOF
)"
```

---

## Self-review notes

- **Spec coverage:** every section of the design doc maps to a task — raw-code parsing (5, 6, 7), Tarifart data model + priority/colors (1, 2), UI copy (3, 4), docs (9), the crawler prompt (8), and the end-to-end ingest + manual verification (10).
- **No placeholders:** every step has literal code, exact file paths, and expected command output.
- **Type consistency:** `Tarifart`'s 7 members, `ALL_TARIFARTS`'s order, and `TARIFART_PRIORITY`'s keys match across Tasks 1, 2, and 3. `parseFranchise`/`parseRegionNumber`/`parseUnfalldeckung`/`ALTERSKLASSE_MAP`/`TARIFART_MAP` signatures in Task 5 match what Task 6 (`validateIngest.ts`) already imports unchanged.
