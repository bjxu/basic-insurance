# Environmental Levy Price Adjustment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Subtract the flat federal environmental levy credit (CHF 5.15/month for 2026) from every displayed absolute premium price, and declare this in the footer, matching what Swica and Helsana already do on their own sites.

**Architecture:** A new pure function `applyEnvironmentalLevy(monthlyPremium, year, levyByYear)` in `src/lib/environmentalLevy.ts`, backed by a new year-keyed field in `src/data/metadata.json`. Applied only at the two places an absolute plan price is rendered (`PlanRow`'s price, and the levy-adjusted copy fed into `computeHeadline`'s `cheapest` argument) — `lookup.ts`'s pure functions and the ratio-based discount/YoY badges are untouched.

**Tech Stack:** TypeScript, React 19, Next.js 15, next-intl, Vitest.

## Global Constraints

- The levy is **never** applied to `discountVsStandardPct` inputs or the year-over-year badge — those stay on raw BAG tariffs (spec Non-goals).
- The levy is **never** applied to the self-reported current-plan premium — that's the user's real bill, not a dataset value.
- `premiums-2026.json` and `scripts/ingest.ts` are never touched — the levy constant lives only in `metadata.json`.
- A year with no `environmentalLevyPerMonth` entry must degrade safely: `applyEnvironmentalLevy` returns the input unchanged, and the footer clause is omitted.
- Swiss monetary formatting conventions (`formatChf`) are unchanged — this feature only changes the number fed into it, never the formatter itself.

---

### Task 1: `applyEnvironmentalLevy` pure function + metadata field

**Files:**
- Create: `src/lib/environmentalLevy.ts`
- Create: `src/lib/environmentalLevy.test.ts`
- Modify: `src/data/metadata.json`

**Interfaces:**
- Produces: `applyEnvironmentalLevy(monthlyPremium: number, year: number, levyPerMonthByYear: Record<string, number>): number` — subtracts `levyPerMonthByYear[String(year)]` from `monthlyPremium` if that key exists, otherwise returns `monthlyPremium` unchanged.

- [ ] **Step 1: Write the failing test**

Create `src/lib/environmentalLevy.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { applyEnvironmentalLevy } from "@/lib/environmentalLevy";

describe("applyEnvironmentalLevy", () => {
  const levyByYear = { "2026": 5.15 };

  it("subtracts the levy for a year with a published amount", () => {
    expect(applyEnvironmentalLevy(311.6, 2026, levyByYear)).toBeCloseTo(306.45);
  });

  it("matches the verified Swica FAVORIT SANTE reference value (ZH-3, 2026)", () => {
    expect(applyEnvironmentalLevy(315.4, 2026, levyByYear)).toBeCloseTo(310.25);
  });

  it("matches the verified Helsana BENEFIT PLUS TELMED reference value (ZH-3, 2026)", () => {
    expect(applyEnvironmentalLevy(323.4, 2026, levyByYear)).toBeCloseTo(318.25);
  });

  it("returns the premium unchanged for a year with no published levy", () => {
    expect(applyEnvironmentalLevy(311.6, 2027, levyByYear)).toBe(311.6);
  });

  it("returns the premium unchanged when the levy map is empty", () => {
    expect(applyEnvironmentalLevy(311.6, 2026, {})).toBe(311.6);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/environmentalLevy.test.ts`
Expected: FAIL — `Cannot find module '@/lib/environmentalLevy'` (or similar resolution error), since the module doesn't exist yet.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/environmentalLevy.ts`:

```ts
// Federal CO2-/VOC-Lenkungsabgabe redistribution (docs/superpowers/specs/
// 2026-08-19-environmental-levy-price-adjustment-design.md): every person insured under
// Swiss basic insurance is credited a flat, insurer-uniform amount each year, funded by
// two federal steering taxes (CO2 levy + VOC levy) and administered via a credit against
// the health-insurance premium bill. Verified against Swica's and Helsana's own premium
// calculators — both already net this out of the price they display, unlike the raw BAG
// tariff data this app is built on (public/data/premiums-*.json).
//
// This constant comes from BAFU (Federal Office for the Environment), not BAG — a
// different federal office and publication schedule than the premium tariff data — so it
// intentionally lives in src/data/metadata.json rather than the BAG ingest pipeline.

/** Subtracts the published levy credit for `year` from `monthlyPremium`. Returns
 *  `monthlyPremium` unchanged if no levy amount is published for that year yet — a safe
 *  default (no adjustment) rather than a crash or a wrong number. */
export function applyEnvironmentalLevy(
  monthlyPremium: number,
  year: number,
  levyPerMonthByYear: Record<string, number>,
): number {
  const levy = levyPerMonthByYear[String(year)];
  return levy != null ? monthlyPremium - levy : monthlyPremium;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/environmentalLevy.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Add the real 2026 constant to metadata.json**

Modify `src/data/metadata.json` — add `environmentalLevyPerMonth` alongside the existing
year-scoped fields:

```json
{
  "publicationDate": "2025-09-23",
  "availableYears": [
    2026
  ],
  "memberCountAsOf": 2024,
  "environmentalLevyPerMonth": {
    "2026": 5.15
  }
}
```

(This field is sourced manually from BAFU's annual "Merkblatt Rückverteilung CO2- und
VOC-Abgaben" — CHF 61.80/year ÷ 12 for 2026. Whoever adds a new year to `availableYears`
must add that year's figure here too — it's a separate manual step from the BAG ingest.)

- [ ] **Step 6: Run the full test suite to confirm nothing broke**

Run: `npx vitest run --exclude '**/.claude/**' --exclude '**/node_modules/**'`
Expected: all passing, +5 tests vs. baseline (90 → 95)

- [ ] **Step 7: Commit**

```bash
git add src/lib/environmentalLevy.ts src/lib/environmentalLevy.test.ts src/data/metadata.json
git commit -m "feat: add applyEnvironmentalLevy pure function + 2026 constant"
```

---

### Task 2: Apply the levy to the plan-list price display

**Files:**
- Modify: `src/components/results/PlanRow.tsx:1-3,96-99`

**Interfaces:**
- Consumes: `applyEnvironmentalLevy(monthlyPremium: number, year: number, levyPerMonthByYear: Record<string, number>): number` from Task 1.
- Consumes: `PremiumRow.year: number` (existing field, `src/lib/types.ts`).

- [ ] **Step 1: Add the imports**

In `src/components/results/PlanRow.tsx`, add alongside the existing imports (after line 3,
`import { formatChf, ... } from "@/lib/format";`):

```ts
import { applyEnvironmentalLevy } from "@/lib/environmentalLevy";
import metadata from "@/data/metadata.json";

const ENVIRONMENTAL_LEVY_PER_MONTH = metadata.environmentalLevyPerMonth as Record<string, number>;
```

- [ ] **Step 2: Apply the adjustment at the price render site**

Find this block (around line 96-101):

```tsx
      <div className="text-right">
        <div className={`text-headline-small ${isCheapest ? "text-primary" : "text-on-surface"}`}>
          {formatChf(plan.monthlyPremium)}
        </div>
        <div className="text-body-small text-outline">{t("results.perMonth")}</div>
      </div>
```

Replace the `formatChf(plan.monthlyPremium)` line with:

```tsx
          {formatChf(applyEnvironmentalLevy(plan.monthlyPremium, plan.year, ENVIRONMENTAL_LEVY_PER_MONTH))}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Run the full test suite**

Run: `npx vitest run --exclude '**/.claude/**' --exclude '**/node_modules/**'`
Expected: all still passing (no test covers `PlanRow` directly — this repo has no component
tests; Task 5 covers manual/visual verification of this wiring).

- [ ] **Step 5: Commit**

```bash
git add src/components/results/PlanRow.tsx
git commit -m "feat: apply environmental levy to plan-list price display"
```

---

### Task 3: Apply the levy to the headline's cheapest-price and savings math

**Files:**
- Modify: `src/components/InsuranceComparator.tsx:1-34,143-186`

**Interfaces:**
- Consumes: `applyEnvironmentalLevy(monthlyPremium: number, year: number, levyPerMonthByYear: Record<string, number>): number` from Task 1.
- Consumes: `computeHeadline(current: SelfReportedPlan | null, cheapest: PremiumRow | null): HeadlineState` (existing, unchanged, `src/lib/lookup.ts`).

- [ ] **Step 1: Add the import and the cast constant**

In `src/components/InsuranceComparator.tsx`, add near the top with the other imports (after
line 25, `import type { PremiumRow } from "@/lib/types";`):

```ts
import { applyEnvironmentalLevy } from "@/lib/environmentalLevy";
```

Add alongside the existing module-level constants (near line 32-33, after `MEMBER_COUNTS`):

```ts
const ENVIRONMENTAL_LEVY_PER_MONTH = metadata.environmentalLevyPerMonth as Record<string, number>;
```

- [ ] **Step 2: Build a levy-adjusted copy of the cheapest row before computing the headline**

Find this block inside the `results` `useMemo` (around line 154-172):

```ts
    const cheapestRows = sortPlans(cheapestPerInsurer(filtered));

    const standardBaseline = standardPremiumsByInsurer(ALL_PREMIUMS, {
      praemienregionId,
      altersklasse,
      franchise,
      unfalldeckung,
      year,
    });

    const current: SelfReportedPlan | null = currentPlanProvided
      ? {
          insurerCode: currentPlan.insurerCode!,
          insurerName: INSURERS.find((i) => i.insurerCode === currentPlan.insurerCode)?.insurerName ?? currentPlan.insurerCode!,
          monthlyPremium: currentPlan.monthlyPremium!,
        }
      : null;

    const headline = computeHeadline(current, cheapestRows[0] ?? null);

    return { plans: cheapestRows, headline, standardBaseline };
```

Replace the `computeHeadline(...)` line with a levy-adjusted copy built just for the
headline — `cheapestRows` itself (fed to `PlanList`) stays raw, since `PlanRow` does its
own adjustment per Task 2:

```ts
    // Headline compares the user's self-reported current premium (their real bill —
    // already net of the levy) against the dataset's cheapest — so the cheapest side needs
    // the same adjustment to be an apples-to-apples comparison (design doc: "Savings math
    // fix"). lookup.ts's computeHeadline itself stays levy-agnostic; only this copy's
    // monthlyPremium is adjusted before being passed in.
    const cheapestForHeadline = cheapestRows[0]
      ? { ...cheapestRows[0], monthlyPremium: applyEnvironmentalLevy(cheapestRows[0].monthlyPremium, year, ENVIRONMENTAL_LEVY_PER_MONTH) }
      : null;

    const headline = computeHeadline(current, cheapestForHeadline);

    return { plans: cheapestRows, headline, standardBaseline };
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Run the full test suite**

Run: `npx vitest run --exclude '**/.claude/**' --exclude '**/node_modules/**'`
Expected: all still passing — `lookup.test.ts`'s `computeHeadline` tests call the function
directly with their own fixtures and are unaffected by this caller-side change.

- [ ] **Step 5: Commit**

```bash
git add src/components/InsuranceComparator.tsx
git commit -m "feat: use levy-adjusted cheapest premium in headline savings math"
```

---

### Task 4: Footer declaration, all four locales

**Files:**
- Modify: `src/messages/de.json`
- Modify: `src/messages/fr.json`
- Modify: `src/messages/it.json`
- Modify: `src/messages/en.json`
- Modify: `src/components/InsuranceComparator.tsx:296-304`

**Interfaces:**
- Consumes: `t("footer.levyNotice", { amount, year })` via `next-intl`'s `useTranslations()` (existing pattern, same as `t("footer.dataNotice", { date })` two lines above it).
- Consumes: `metadata.environmentalLevyPerMonth` (Task 1).

- [ ] **Step 1: Add the key to `de.json` only, and watch the existing locale-completeness test catch the gap**

In `src/messages/de.json`, inside `"footer"` (currently just `"dataNotice"`), add:

```json
  "footer": {
    "dataNotice": "Daten: BAG Opendata · Publikation {date} · Nur Pflichtleistungen (OKP) · Kein Sponsoring, keine Vermittlungslinks",
    "levyNotice": "Preise enthalten die Rückerstattung der CO₂-/VOC-Lenkungsabgabe (CHF {amount}/Monat, {year}) — für alle Kassen gleich hoch, ohne Einfluss auf die Rangfolge"
  },
```

Run: `npx vitest run src/messages/messages.test.ts`
Expected: FAIL — `en.json has exactly the same keys as de.json` (and `fr`/`it`) now fail,
since `footer.levyNotice` exists only in `de.json`. This is `messages.test.ts` (existing,
unmodified) doing its job.

- [ ] **Step 2: Add the matching key to the other three locales**

In `src/messages/fr.json`, inside `"footer"`:

```json
  "footer": {
    "dataNotice": "Données : Open Data OFSP · Publication {date} · Prestations obligatoires uniquement (AOS) · Aucun sponsoring, aucun lien d'intermédiation",
    "levyNotice": "Les prix incluent la restitution de la taxe d'incitation CO₂/COV (CHF {amount}/mois, {year}) — identique pour toutes les caisses, sans effet sur le classement"
  },
```

In `src/messages/it.json`, inside `"footer"`:

```json
  "footer": {
    "dataNotice": "Dati: Open Data UFSP · Pubblicazione {date} · Solo prestazioni obbligatorie (AOMS) · Nessuno sponsor, nessun link di intermediazione",
    "levyNotice": "I prezzi includono la restituzione della tassa d'incentivazione CO₂/COV (CHF {amount}/mese, {year}) — uguale per tutte le casse, senza effetto sulla classifica"
  },
```

In `src/messages/en.json`, inside `"footer"`:

```json
  "footer": {
    "dataNotice": "Data: FOPH open data · Published {date} · Mandatory benefits only · No sponsoring, no referral links",
    "levyNotice": "Prices include the CO₂/VOC levy redistribution (CHF {amount}/month, {year}) — the same for every insurer, with no effect on ranking"
  },
```

- [ ] **Step 3: Run the message test again to confirm it passes**

Run: `npx vitest run src/messages/messages.test.ts`
Expected: PASS (all 3 locale-completeness checks)

- [ ] **Step 4: Render the note in the footer, conditionally on the selected year having a published levy**

In `src/components/InsuranceComparator.tsx`, find the footer paragraph (around line 296-304):

```tsx
      <p className="text-body-small text-outline text-center mt-6 pb-10">
        {t("footer.dataNotice", {
          date: new Date(metadata.publicationDate).toLocaleDateString(DATE_LOCALE[locale as Locale] ?? "de-CH", {
            day: "numeric",
            month: "long",
            year: "numeric",
          }),
        })}
      </p>
```

Replace it with (adding the conditional levy line right after, same styling):

```tsx
      <p className="text-body-small text-outline text-center mt-6">
        {t("footer.dataNotice", {
          date: new Date(metadata.publicationDate).toLocaleDateString(DATE_LOCALE[locale as Locale] ?? "de-CH", {
            day: "numeric",
            month: "long",
            year: "numeric",
          }),
        })}
      </p>
      {ENVIRONMENTAL_LEVY_PER_MONTH[String(year)] != null && (
        <p className="text-body-small text-outline text-center pb-10">
          {t("footer.levyNotice", { amount: ENVIRONMENTAL_LEVY_PER_MONTH[String(year)].toFixed(2), year })}
        </p>
      )}
```

(Note `pb-10` moves to whichever paragraph renders last, so bottom spacing is preserved
whether or not the levy note is shown — when the condition is false, `dataNotice`'s `<p>`
no longer carries `pb-10` either, so add it back there unconditionally instead. Simplest:
keep `pb-10` on `dataNotice`'s own `<p>` as it already is above, and drop `pb-10` from the
new conditional paragraph, using `pt-1` instead for spacing between the two lines. Use this
version instead of the one above:)

```tsx
      <p className="text-body-small text-outline text-center mt-6 pb-10">
        {t("footer.dataNotice", {
          date: new Date(metadata.publicationDate).toLocaleDateString(DATE_LOCALE[locale as Locale] ?? "de-CH", {
            day: "numeric",
            month: "long",
            year: "numeric",
          }),
        })}
        {ENVIRONMENTAL_LEVY_PER_MONTH[String(year)] != null && (
          <>
            {" · "}
            {t("footer.levyNotice", { amount: ENVIRONMENTAL_LEVY_PER_MONTH[String(year)].toFixed(2), year })}
          </>
        )}
      </p>
```

This keeps it as one paragraph (matching the mockup, which appended the levy clause to the
same `data-notice` line with a `·` separator) and avoids any spacing edge cases.

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Run the full test suite**

Run: `npx vitest run --exclude '**/.claude/**' --exclude '**/node_modules/**'`
Expected: all passing.

- [ ] **Step 7: Commit**

```bash
git add src/messages/de.json src/messages/fr.json src/messages/it.json src/messages/en.json src/components/InsuranceComparator.tsx
git commit -m "feat: declare environmental levy inclusion in the footer, all locales"
```

---

### Task 5: End-to-end verification

**Files:** none (verification only)

- [ ] **Step 1: Full test suite**

Run: `npx vitest run --exclude '**/.claude/**' --exclude '**/node_modules/**'`
Expected: all passing (baseline 90 + 5 new = 95 tests, 0 failures)

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 3: Production build**

Run: `npm run build`
Expected: build succeeds with no type errors.

- [ ] **Step 4: Manual visual check**

Use the `run` skill to launch the dev server and confirm, for a real PLZ/birth-year/franchise
combination: (a) every plan-row price is CHF 5.15 lower than the corresponding row in
`public/data/premiums-2026.json`, (b) the headline's "cheapest offer" and savings amount
reflect the adjusted figure, (c) the self-reported current-plan amount in the headline is
untouched, (d) the footer shows the new levy clause. Cross-check at least one row against
`mockups/main.html`'s numbers for the same product/region to confirm they match.

- [ ] **Step 5: Commit (if the manual check surfaced fixes)**

```bash
git add -A
git commit -m "fix: address issues found during manual verification"
```

(Skip this step if no fixes were needed.)
