# Prämien Guide Content Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a new, evergreen, German-only content page at `/de/praemien` that ranks for "prämien {year}"-style searches, with a real canton-by-canton average premium table computed from the app's own ingest data.

**Architecture:** A new pure aggregation module (`src/lib/praemienGuide.ts`) computes levy-adjusted average premiums per canton from the existing `PremiumRow[]` data, read server-side from `public/data/premiums-{year}.json`. A new page (`src/app/[locale]/praemien/page.tsx`) and content component (`src/components/help/PraemienGuideContent.tsx`) follow the exact structural pattern the existing `how-it-works` page already established, `notFound()`-ing for every locale but `de`.

**Tech Stack:** TypeScript, Next.js App Router (Server + Client Components), next-intl, Vitest, Tailwind.

## Global Constraints

- German-only for now: the route exists for all locales but only renders real content for `de`; every other locale `notFound()`s.
- Stable URL: `/de/praemien`, never year-specific (`/de/praemien-2027`).
- The canton table uses this exact fixed reference profile: `{ altersklasse: "erwachsen", franchise: 300, tarifart: "standard", unfalldeckung: true }`.
- Table premiums must have `applyEnvironmentalLevy` applied before averaging (matches what `InsuranceComparator.tsx` displays) — never raw BAG tariff numbers.
- The "current premium data year" is always `Math.max(...metadata.availableYears)` from `src/data/metadata.json` — never hard-coded, computed in exactly one place per file that needs it.
- `src/messages/messages.test.ts` requires every locale file to have identical key paths and placeholder names — the new `praemienGuide` namespace and the two new `meta` keys must exist (with the German text duplicated verbatim, not real translations) in all 6 locale files, even though only `de.json`'s copy is ever shown.
- No new npm dependency.

---

### Task 1: `src/lib/praemienGuide.ts` — canton premium aggregation

**Files:**
- Create: `src/lib/praemienGuide.ts`
- Test: `src/lib/praemienGuide.test.ts`

**Interfaces:**
- Consumes: `PremiumRow` (`src/lib/types.ts`), `cheapestPerInsurer` (`src/lib/lookup.ts`), `applyEnvironmentalLevy` (`src/lib/environmentalLevy.ts`) — all already exist, unmodified.
- Produces: `CANTON_NAMES_DE: Record<string, string>` (all 26 canton codes), `REFERENCE_PROFILE: { altersklasse: "erwachsen"; franchise: 300; tarifart: "standard"; unfalldeckung: true }`, `CantonAverage = { kanton: string; averagePremium: number }`, `averagePremiumByCanton(rows: PremiumRow[], year: number, levyPerMonthByYear: Record<string, number>): CantonAverage[]`, `readPremiumRows(year: number): Promise<PremiumRow[]>`.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/praemienGuide.test.ts`:

```ts
// src/lib/praemienGuide.test.ts
import { describe, it, expect } from "vitest";
import { averagePremiumByCanton, readPremiumRows, CANTON_NAMES_DE } from "./praemienGuide";
import type { PremiumRow } from "./types";

function row(overrides: Partial<PremiumRow>): PremiumRow {
  return {
    year: 2026,
    insurerCode: "1",
    insurerName: "Test",
    praemienregionId: "ZH-1",
    altersklasse: "erwachsen",
    franchise: 300,
    unfalldeckung: true,
    tarifart: "standard",
    monthlyPremium: 300,
    tarifCode: "BASE",
    productName: "Grundversicherung",
    ...overrides,
  };
}

describe("averagePremiumByCanton", () => {
  it("averages matching rows per canton, derived from the praemienregionId prefix", () => {
    const rows = [
      row({ praemienregionId: "ZH-1", insurerCode: "1", monthlyPremium: 300 }),
      row({ praemienregionId: "ZH-2", insurerCode: "2", monthlyPremium: 320 }),
      row({ praemienregionId: "BE-1", insurerCode: "1", monthlyPremium: 280 }),
    ];
    const result = averagePremiumByCanton(rows, 2026, {});
    expect(result).toEqual([
      { kanton: "BE", averagePremium: 280 },
      { kanton: "ZH", averagePremium: 310 },
    ]);
  });

  it("excludes rows outside the fixed reference profile", () => {
    const rows = [
      row({ monthlyPremium: 300 }), // matches REFERENCE_PROFILE
      row({ franchise: 2500, monthlyPremium: 100 }), // wrong franchise, excluded
      row({ altersklasse: "kind", monthlyPremium: 100 }), // wrong age band, excluded
      row({ tarifart: "hmo", monthlyPremium: 100 }), // wrong model, excluded
      row({ unfalldeckung: false, monthlyPremium: 100 }), // wrong accident coverage, excluded
    ];
    const result = averagePremiumByCanton(rows, 2026, {});
    expect(result).toEqual([{ kanton: "ZH", averagePremium: 300 }]);
  });

  it("keeps only each insurer's cheapest row per canton before averaging", () => {
    const rows = [
      row({ insurerCode: "1", monthlyPremium: 300 }),
      row({ insurerCode: "1", monthlyPremium: 250, tarifCode: "OTHER", productName: "Other" }),
      row({ insurerCode: "2", monthlyPremium: 350 }),
    ];
    const result = averagePremiumByCanton(rows, 2026, {});
    // insurer 1 contributes its cheaper row (250), insurer 2 contributes 350 -> (250+350)/2 = 300
    expect(result).toEqual([{ kanton: "ZH", averagePremium: 300 }]);
  });

  it("subtracts the environmental levy before averaging, not after", () => {
    const rows = [
      row({ insurerCode: "1", monthlyPremium: 300 }),
      row({ insurerCode: "2", monthlyPremium: 320 }),
    ];
    const result = averagePremiumByCanton(rows, 2026, { "2026": 5.15 });
    // (300 - 5.15 + 320 - 5.15) / 2 = 304.85
    expect(result).toEqual([{ kanton: "ZH", averagePremium: 304.85 }]);
  });

  it("returns no entry for a canton with no rows in the reference profile", () => {
    const rows = [row({ praemienregionId: "ZH-1", altersklasse: "kind" })];
    expect(averagePremiumByCanton(rows, 2026, {})).toEqual([]);
  });
});

describe("CANTON_NAMES_DE", () => {
  it("has all 26 cantons", () => {
    expect(Object.keys(CANTON_NAMES_DE)).toHaveLength(26);
  });

  it("maps each code to its German name (spot check)", () => {
    expect(CANTON_NAMES_DE.ZH).toBe("Zürich");
    expect(CANTON_NAMES_DE.GE).toBe("Genf");
    expect(CANTON_NAMES_DE.TI).toBe("Tessin");
  });
});

describe("readPremiumRows", () => {
  it("reads and parses the real premiums-2026.json fixture", async () => {
    const rows = await readPremiumRows(2026);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0]).toHaveProperty("praemienregionId");
    expect(rows[0].year).toBe(2026);
  });

  it("rejects for a year with no data file", async () => {
    await expect(readPremiumRows(1999)).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/praemienGuide.test.ts`
Expected: FAIL — `Cannot find module './praemienGuide'`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/praemienGuide.ts`:

```ts
// src/lib/praemienGuide.ts
// Canton-level average premium aggregation for the /de/praemien SEO guide
// (docs/superpowers/specs/2026-08-31-praemien-guide-content-page-design.md).

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { PremiumRow } from "./types";
import { cheapestPerInsurer } from "./lookup";
import { applyEnvironmentalLevy } from "./environmentalLevy";

export type CantonAverage = { kanton: string; averagePremium: number };

// German canton display names, keyed by the 2-letter code already used
// throughout the app's data (praemienregionId's "<KANTON>-<region>" prefix;
// scripts/ingest/parsePremiums.ts's VALID_CANTONS). All 26 cantons.
export const CANTON_NAMES_DE: Record<string, string> = {
  AG: "Aargau",
  AI: "Appenzell Innerrhoden",
  AR: "Appenzell Ausserrhoden",
  BE: "Bern",
  BL: "Basel-Landschaft",
  BS: "Basel-Stadt",
  FR: "Freiburg",
  GE: "Genf",
  GL: "Glarus",
  GR: "Graubünden",
  JU: "Jura",
  LU: "Luzern",
  NE: "Neuenburg",
  NW: "Nidwalden",
  OW: "Obwalden",
  SG: "St. Gallen",
  SH: "Schaffhausen",
  SO: "Solothurn",
  SZ: "Schwyz",
  TG: "Thurgau",
  TI: "Tessin",
  UR: "Uri",
  VD: "Waadt",
  VS: "Wallis",
  ZG: "Zug",
  ZH: "Zürich",
};

// Fixed reference profile for the guide's canton table — stated here (not
// buried inline) and echoed in the page's own copy (praemienGuide.table.note)
// so the numbers are self-explanatory.
export const REFERENCE_PROFILE = {
  altersklasse: "erwachsen",
  franchise: 300,
  tarifart: "standard",
  unfalldeckung: true,
} as const;

/** Average monthly premium per canton, for REFERENCE_PROFILE, levy-adjusted
 *  (matching what InsuranceComparator.tsx actually displays — see
 *  applyEnvironmentalLevy). Pure, no I/O. One row per canton present in
 *  `rows`, sorted by canton code. */
export function averagePremiumByCanton(
  rows: PremiumRow[],
  year: number,
  levyPerMonthByYear: Record<string, number>,
): CantonAverage[] {
  const matching = rows.filter(
    (row) =>
      row.altersklasse === REFERENCE_PROFILE.altersklasse &&
      row.franchise === REFERENCE_PROFILE.franchise &&
      row.tarifart === REFERENCE_PROFILE.tarifart &&
      row.unfalldeckung === REFERENCE_PROFILE.unfalldeckung,
  );

  const byCanton = new Map<string, PremiumRow[]>();
  for (const row of matching) {
    const kanton = row.praemienregionId.split("-")[0];
    const existing = byCanton.get(kanton);
    if (existing) existing.push(row);
    else byCanton.set(kanton, [row]);
  }

  const result: CantonAverage[] = [];
  for (const [kanton, cantonRows] of byCanton) {
    const cheapest = cheapestPerInsurer(cantonRows);
    const adjusted = cheapest.map((row) =>
      applyEnvironmentalLevy(row.monthlyPremium, year, levyPerMonthByYear),
    );
    const average = adjusted.reduce((sum, p) => sum + p, 0) / adjusted.length;
    result.push({ kanton, averagePremium: Math.round(average * 100) / 100 });
  }

  return result.sort((a, b) => a.kanton.localeCompare(b.kanton));
}

/** Reads public/data/premiums-{year}.json off disk. I/O — server-side only
 *  (mirrors how scripts/ingest.ts writes to the same path via
 *  PUBLIC_DATA_DIR = join(process.cwd(), "public", "data")). Never call this
 *  from a "use client" component. */
export async function readPremiumRows(year: number): Promise<PremiumRow[]> {
  const filePath = join(process.cwd(), "public", "data", `premiums-${year}.json`);
  const json = await readFile(filePath, "utf-8");
  return JSON.parse(json) as PremiumRow[];
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/praemienGuide.test.ts`
Expected: PASS (10 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/praemienGuide.ts src/lib/praemienGuide.test.ts
git commit -m "feat: add canton-level premium aggregation for the Prämien guide page

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Message catalog + `PraemienGuideContent.tsx`

**Files:**
- Modify: `src/messages/de.json`, `src/messages/en.json`, `src/messages/fr.json`, `src/messages/it.json`, `src/messages/pt.json`, `src/messages/es.json`
- Create: `src/components/help/PraemienGuideContent.tsx`

**Interfaces:**
- Consumes: `CANTON_NAMES_DE`, `CantonAverage` (Task 1, `src/lib/praemienGuide.ts`).
- Produces: `PraemienGuideContent({ year, cantonAverages }: { year: number; cantonAverages: CantonAverage[] })` — a `"use client"` component, no other exports.

- [ ] **Step 1: Add the `meta` keys and `praemienGuide` namespace to `de.json`**

In `src/messages/de.json`, add two keys to the existing `"meta"` object (after `"howItWorksDescription"`):

```json
    "howItWorksTitle": "So funktioniert die Schweizer Grundversicherung – Krankenkassenvergleich",
    "howItWorksDescription": "Neu in der Schweiz? Wie die obligatorische Grundversicherung funktioniert: Anmeldefristen, Kassenwechsel, Franchise und Versicherungsmodelle — einfach erklärt.",
    "praemienGuideTitle": "Krankenkassenprämien {year}: Vergleich & Kantonsübersicht",
    "praemienGuideDescription": "Was die Krankenkassenprämien {year} kosten, wie sie berechnet werden und was sich ändert — mit Durchschnittsprämien nach Kanton und den wichtigsten Fristen."
```

(Only the last two lines are new; the two `howItWorks*` lines above are shown for anchor context — add a comma after `"howItWorksDescription"`'s closing quote.)

Then add a new top-level `"praemienGuide"` key, after the existing top-level `"languageSwitcher"` object (i.e. add a comma after `"languageSwitcher"`'s closing `}` and insert this before the file's final `}`):

```json
  "praemienGuide": {
    "h1": "Krankenkassenprämien {year}: Was Sie wissen müssen",
    "intro": "Das Bundesamt für Gesundheit (BAG) veröffentlicht die neuen Prämien jeweils Ende September. Wie stark sie steigen oder sinken, hängt von den Gesundheitskosten des Vorjahres, dem Kanton und der gewählten Kasse ab — es gibt keine einheitliche Schweizer Prämie.",
    "howSet": {
      "heading": "Wie sich die Prämie zusammensetzt",
      "intro": "Jede Krankenkasse berechnet ihre Prämien nach denselben gesetzlich vorgegebenen Faktoren:",
      "region": "Wohnkanton und Prämienregion — je nach Gesundheitskosten in der Region.",
      "age": "Altersklasse — Kinder (0–18), junge Erwachsene (19–25) und Erwachsene (ab 26) zahlen unterschiedliche Prämien.",
      "franchise": "Franchise — eine höhere Franchise (bis CHF 2500) senkt die monatliche Prämie, du trägst dafür mehr Kosten selbst.",
      "model": "Versicherungsmodell — Standard, Hausarzt, Telmed oder HMO; eine eingeschränkte Wahl der Leistungserbringer senkt die Prämie.",
      "accident": "Unfalldeckung — wer über den Arbeitgeber bereits gegen Unfall versichert ist, kann sie aus der Krankenkasse ausschliessen."
    },
    "table": {
      "heading": "Durchschnittsprämie {year} nach Kanton",
      "note": "Monatliche Durchschnittsprämie für Erwachsene, Franchise CHF 300, Standardmodell, mit Unfalldeckung — Basis: offizielle BAG-Daten {year}, abzüglich der Prämienverbilligung durch die CO₂-/VOC-Lenkungsabgabe.",
      "cantonHeader": "Kanton",
      "premiumHeader": "Ø Prämie/Monat"
    },
    "deadlines": {
      "heading": "Wichtige Fristen",
      "text": "Du kannst die Krankenkasse einmal pro Jahr wechseln. Die Kündigung muss bis zum 30. November bei der bisherigen Kasse eintreffen, der Wechsel gilt ab dem 1. Januar."
    },
    "faq": {
      "heading": "Häufige Fragen",
      "q1": "Wann muss ich die Krankenkasse wechseln?",
      "a1": "Die Kündigung muss bis spätestens 30. November bei deiner aktuellen Kasse eintreffen. Der Wechsel zur neuen Kasse gilt dann ab dem 1. Januar des Folgejahres.",
      "q2": "Steigen die Prämien jedes Jahr?",
      "a2": "Nicht zwingend, aber meistens. Die Prämien folgen den tatsächlichen Gesundheitskosten — in den meisten Jahren steigen sie, die Höhe unterscheidet sich aber stark nach Kanton und Kasse.",
      "q3": "Was ist die Franchise?",
      "a3": "Die Franchise ist der jährliche Betrag, den du selbst für Behandlungskosten bezahlst, bevor die Krankenkasse übernimmt. Sie liegt zwischen CHF 300 und CHF 2500 — eine höhere Franchise senkt die monatliche Prämie.",
      "q4": "Was bedeutet Standardmodell?",
      "a4": "Im Standardmodell kannst du frei jeden zugelassenen Arzt oder jede zugelassene Ärztin wählen. Alternative Modelle (Hausarzt, Telmed, HMO) schränken die Wahl ein und sind dafür günstiger.",
      "q5": "Kann jede Krankenkasse meine Aufnahme ablehnen?",
      "a5": "Nein. In der Grundversicherung muss dich jede Krankenkasse aufnehmen — es gibt keine Gesundheitsfragen und keine Ablehnung."
    }
  },
```

(This is a new top-level sibling of `"languageSwitcher"` — keep `"languageSwitcher"` itself unchanged, just add a comma after its closing `}` and insert the block above before the file's final `}`.)

- [ ] **Step 2: Run the message-catalog test to verify it fails**

Run: `npx vitest run src/messages/messages.test.ts`
Expected: FAIL — `en.json`/`fr.json`/`it.json`/`pt.json`/`es.json` are each missing the new `meta.praemienGuideTitle`, `meta.praemienGuideDescription`, and `praemienGuide.*` keys de.json now has.

- [ ] **Step 3: Copy the identical additions into the other 5 locale files**

For each of `src/messages/en.json`, `src/messages/fr.json`, `src/messages/it.json`, `src/messages/pt.json`, `src/messages/es.json`: add the exact same two `meta` keys (`praemienGuideTitle`, `praemienGuideDescription`, same German text and `{year}` placeholder) and the exact same top-level `praemienGuide` object (same German text throughout) shown in Step 1 — verbatim, not translated. This is deliberate (see the plan's Global Constraints and the spec's "Found during planning" note): the page never renders for these locales, so the content is unreachable, but `messages.test.ts` requires the key/placeholder shape to match `de.json` exactly.

- [ ] **Step 4: Run the message-catalog test to verify it passes**

Run: `npx vitest run src/messages/messages.test.ts`
Expected: PASS (5 tests, one per non-German locale).

- [ ] **Step 5: Write `PraemienGuideContent.tsx`**

Create `src/components/help/PraemienGuideContent.tsx`:

```tsx
"use client";

import { useTranslations } from "next-intl";
import { CANTON_NAMES_DE, type CantonAverage } from "@/lib/praemienGuide";

// Mirrors HowItWorksContent's role (src/components/help/HowItWorksContent.tsx)
// for the /de/praemien page. "use client" for useTranslations — Next still
// server-renders a client component's first paint, so this doesn't cost
// crawlability. Unlike HowItWorksContent, this only ever appears on its own
// page (no full/summary variant) and takes the pre-computed canton table as
// a prop — the fs read + aggregation (src/lib/praemienGuide.ts) run
// server-side in the page component, never here.

const FAQ_ITEMS = [
  { q: "q1", a: "a1" },
  { q: "q2", a: "a2" },
  { q: "q3", a: "a3" },
  { q: "q4", a: "a4" },
  { q: "q5", a: "a5" },
] as const;

export function PraemienGuideContent({
  year,
  cantonAverages,
}: {
  year: number;
  cantonAverages: CantonAverage[];
}) {
  const t = useTranslations("praemienGuide");

  return (
    <div className="text-on-surface">
      <h1 className="text-title-large">{t("h1", { year })}</h1>
      <p className="mt-2 text-body-medium text-on-surface-variant">{t("intro")}</p>

      <section id="wie-berechnet" className="mt-5 border-t border-outline-variant pt-4">
        <h2 className="text-label-large text-on-surface">{t("howSet.heading")}</h2>
        <p className="mt-1 text-body-small text-on-surface-variant">{t("howSet.intro")}</p>
        <ul className="mt-2 list-disc pl-5 text-body-small text-on-surface-variant space-y-1.5">
          <li>{t("howSet.region")}</li>
          <li>{t("howSet.age")}</li>
          <li>{t("howSet.franchise")}</li>
          <li>{t("howSet.model")}</li>
          <li>{t("howSet.accident")}</li>
        </ul>
      </section>

      <section id="kantonstabelle" className="mt-4 border-t border-outline-variant pt-4">
        <h2 className="text-label-large text-on-surface">{t("table.heading", { year })}</h2>
        <p className="mt-1 text-body-small text-on-surface-variant">{t("table.note", { year })}</p>
        <table className="mt-3 w-full text-body-small">
          <thead>
            <tr className="text-left text-on-surface-variant">
              <th className="py-1 pr-2 font-semibold">{t("table.cantonHeader")}</th>
              <th className="py-1 text-right font-semibold">{t("table.premiumHeader")}</th>
            </tr>
          </thead>
          <tbody>
            {cantonAverages.map(({ kanton, averagePremium }) => (
              <tr key={kanton} className="border-t border-outline-variant">
                <td className="py-1 pr-2">{CANTON_NAMES_DE[kanton] ?? kanton}</td>
                <td className="py-1 text-right">CHF {averagePremium.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section id="fristen" className="mt-4 border-t border-outline-variant pt-4">
        <h2 className="text-label-large text-on-surface">{t("deadlines.heading")}</h2>
        <p className="mt-1 text-body-small text-on-surface-variant">{t("deadlines.text")}</p>
      </section>

      <section id="faq" className="mt-4 border-t border-outline-variant pt-4">
        <h2 className="text-label-large text-on-surface">{t("faq.heading")}</h2>
        <dl className="mt-3 space-y-3">
          {FAQ_ITEMS.map(({ q, a }) => (
            <div key={q}>
              <dt className="text-body-small font-bold text-on-surface">{t(`faq.${q}`)}</dt>
              <dd className="text-body-small text-on-surface-variant">{t(`faq.${a}`)}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
```

- [ ] **Step 6: Typecheck and lint**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npx eslint src/components/help/PraemienGuideContent.tsx src/messages/messages.test.ts`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/messages/de.json src/messages/en.json src/messages/fr.json src/messages/it.json src/messages/pt.json src/messages/es.json src/components/help/PraemienGuideContent.tsx
git commit -m "feat: add Prämien guide copy and content component

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: `src/app/[locale]/praemien/page.tsx` — route

**Files:**
- Create: `src/app/[locale]/praemien/page.tsx`

**Interfaces:**
- Consumes: `averagePremiumByCanton`, `readPremiumRows` (Task 1, `src/lib/praemienGuide.ts`); `PraemienGuideContent` (Task 2, `src/components/help/PraemienGuideContent.tsx`); `BackToComparisonLink` (existing, `src/components/help/BackToComparisonLink.tsx`); `getSiteUrl` (existing, `src/lib/site-url.ts`); `metadata` (existing, `src/data/metadata.json`, providing `availableYears: number[]` and `environmentalLevyPerMonth: Record<string, number>`).
- Produces: default export (the page component) and `generateMetadata` — standard Next.js page conventions, no other module imports this directly.

- [ ] **Step 1: Write the page**

Create `src/app/[locale]/praemien/page.tsx`:

```tsx
// src/app/[locale]/praemien/page.tsx
// German-only SEO content page (docs/superpowers/specs/2026-08-31-praemien-
// guide-content-page-design.md). Follows how-it-works/page.tsx's structure;
// notFound()s for every other locale rather than rendering empty content.

import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getSiteUrl } from "@/lib/site-url";
import { Link } from "@/i18n/navigation";
import { PraemienGuideContent } from "@/components/help/PraemienGuideContent";
import { BackToComparisonLink } from "@/components/help/BackToComparisonLink";
import { averagePremiumByCanton, readPremiumRows } from "@/lib/praemienGuide";
import metadata from "@/data/metadata.json";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (locale !== "de") return {};

  const t = await getTranslations({ locale, namespace: "meta" });
  const baseUrl = getSiteUrl();
  const year = Math.max(...metadata.availableYears);

  return {
    title: t("praemienGuideTitle", { year }),
    description: t("praemienGuideDescription", { year }),
    alternates: { canonical: `${baseUrl}/de/praemien` },
    openGraph: {
      title: t("praemienGuideTitle", { year }),
      description: t("praemienGuideDescription", { year }),
      type: "article",
    },
    twitter: {
      card: "summary",
      title: t("praemienGuideTitle", { year }),
      description: t("praemienGuideDescription", { year }),
    },
  };
}

export default async function PraemienGuidePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (locale !== "de") notFound();
  setRequestLocale(locale);

  const year = Math.max(...metadata.availableYears);
  const rows = await readPremiumRows(year);
  const cantonAverages = averagePremiumByCanton(rows, year, metadata.environmentalLevyPerMonth);

  // Static fallback so the back-link is in the prerendered HTML (crawl graph, no
  // layout shift); BackToComparisonLink upgrades it to the query-preserving
  // version on hydration. Same pattern as how-it-works/page.tsx.
  const th = await getTranslations({ locale, namespace: "help" });
  const backFallback = (
    <Link href="/" className="text-[12.5px] font-semibold text-primary">
      {th("guide.back")}
    </Link>
  );

  return (
    <main className="mx-auto my-8 max-w-[720px] px-4">
      <Suspense fallback={backFallback}>
        <BackToComparisonLink />
      </Suspense>
      <div className="mt-4">
        <PraemienGuideContent year={year} cantonAverages={cantonAverages} />
      </div>
      <div className="mt-6">
        <Suspense fallback={backFallback}>
          <BackToComparisonLink />
        </Suspense>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Typecheck and lint**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npx eslint src/app/[locale]/praemien/page.tsx`
Expected: no errors.

- [ ] **Step 3: Build and smoke-check the route**

Run: `npm run build`
Expected: succeeds, and the build output's route list includes `/[locale]/praemien` (or the equivalent static/dynamic listing) alongside the existing `/[locale]/how-it-works`.

Run: `npm run dev` in the background (or use the project's `run` skill if available), then:
- `curl -s http://localhost:3000/de/praemien | grep -o 'Krankenkassenprämien 20[0-9][0-9]'` — expect a match (confirms the H1's interpolated year renders).
- `curl -s http://localhost:3000/de/praemien | grep -c 'CHF '` — expect a number ≥ 26 (one per canton row, plus the table note also contains "CHF").
- `curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/fr/praemien` — expect `404`.

Stop the dev server afterward.

- [ ] **Step 4: Commit**

```bash
git add "src/app/[locale]/praemien/page.tsx"
git commit -m "feat: add the /de/praemien route

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: `sitemap.ts` — add the `/de/praemien` entry

**Files:**
- Modify: `src/app/sitemap.ts`
- Modify: `src/app/sitemap.test.ts`

**Interfaces:**
- Consumes: nothing new — `routing`, `getSiteUrl` already imported.
- Produces: `sitemap()`'s return array gains one more entry; no signature change.

- [ ] **Step 1: Write the failing test**

Replace `src/app/sitemap.test.ts` in full:

```ts
import { describe, it, expect } from "vitest";
import sitemap from "@/app/sitemap";

describe("sitemap", () => {
  const entries = sitemap();
  const urls = entries.map((e) => e.url);
  const LOCALES = ["de", "en", "es", "fr", "it", "pt"];

  it("lists /{locale} and /{locale}/how-it-works for all six locales, plus the German-only /de/praemien guide (13 entries)", () => {
    expect([...urls].sort()).toEqual(
      [
        ...LOCALES.flatMap((l) => [
          `https://example.com/${l}`,
          `https://example.com/${l}/how-it-works`,
        ]),
        "https://example.com/de/praemien",
      ].sort(),
    );
  });

  it("contains no parameterized URLs", () => {
    expect(urls.every((u) => !u.includes("?"))).toBe(true);
  });

  it("every localized entry carries hreflang alternates for all six locales with correct per-path targeting", () => {
    const localizedEntries = entries.filter((e) => e.url !== "https://example.com/de/praemien");
    for (const entry of localizedEntries) {
      const languages = entry.alternates?.languages ?? {};
      expect(Object.keys(languages).sort()).toEqual([...LOCALES].sort());

      const entryPath = entry.url.replace("https://example.com", "");
      const isHowItWorksPath = entryPath.endsWith("/how-it-works");

      for (const locale of LOCALES) {
        const expectedAlternate = isHowItWorksPath
          ? `https://example.com/${locale}/how-it-works`
          : `https://example.com/${locale}`;
        expect(languages[locale as keyof typeof languages]).toBe(expectedAlternate);
      }
    }
  });

  it("the /de/praemien entry has no hreflang alternates (no other-locale version exists)", () => {
    const praemienEntry = entries.find((e) => e.url === "https://example.com/de/praemien");
    expect(praemienEntry).toBeDefined();
    expect(praemienEntry?.alternates?.languages ?? {}).toEqual({});
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/app/sitemap.test.ts`
Expected: FAIL — the current `sitemap()` returns 12 entries, not 13, and has no `/de/praemien` URL.

- [ ] **Step 3: Update the implementation**

Replace `src/app/sitemap.ts` in full:

```ts
import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { getSiteUrl } from "@/lib/site-url";

// One entry per (locale × indexable path). Only base URLs and the evergreen
// how-it-works guide are listed — never parameterised comparison URLs (REQ-20).
// Each entry carries hreflang alternates so search engines link the language
// versions of the same page together.
const INDEXABLE_PATHS = ["", "/how-it-works"] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = getSiteUrl();

  const localizedEntries = routing.locales.flatMap((locale) =>
    INDEXABLE_PATHS.map((path) => ({
      url: `${baseUrl}/${locale}${path}`,
      lastModified: new Date(),
      changeFrequency: "yearly" as const,
      priority: path === "" ? (locale === routing.defaultLocale ? 1 : 0.9) : 0.6,
      alternates: {
        languages: Object.fromEntries(
          routing.locales.map((l) => [l, `${baseUrl}/${l}${path}`]),
        ),
      },
    })),
  );

  // German-only content (docs/superpowers/specs/2026-08-31-praemien-guide-
  // content-page-design.md) — no other-locale version exists yet, so no
  // hreflang alternates map (there's nothing to alternate to).
  const praemienEntry: MetadataRoute.Sitemap[number] = {
    url: `${baseUrl}/de/praemien`,
    lastModified: new Date(),
    changeFrequency: "yearly",
    priority: 0.6,
  };

  return [...localizedEntries, praemienEntry];
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/app/sitemap.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/sitemap.ts src/app/sitemap.test.ts
git commit -m "feat: add /de/praemien to the sitemap

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: Full verification

**Files:** none (verification only).

- [ ] **Step 1: Run the full test suite**

Run: `npx vitest run`
Expected: all tests pass, including the new/updated ones in Tasks 1, 2, and 4 (no regressions in the pre-existing 291).

- [ ] **Step 2: Typecheck and lint the whole project**

Run: `npx tsc --noEmit && npx eslint .`
Expected: no errors. (A pre-existing, unrelated warning in `src/components/InsuranceComparator.tsx` — `react-hooks/exhaustive-deps` on `ALL_PREMIUMS` — is fine and not something to fix here.)

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 4: Verify `robots.ts` doesn't need a change**

Run: `grep -n "disallow" src/app/robots.ts`
Expected: only `/admin` is disallowed — `/de/praemien` is not blocked (it shouldn't be; this step just confirms no accidental blocking rule exists that would need updating).

- [ ] **Step 5: No commit needed** (verification-only task).
