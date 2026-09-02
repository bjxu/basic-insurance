# Prämien guide i18n Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the German-only Prämien guide (`/de/praemien`) into real translated content in all six locales, at full SEO parity with `how-it-works`.

**Architecture:** Follows the existing `src/app/[locale]/how-it-works/page.tsx` pattern. The page and teaser stop forcing German; the `praemienGuide` message namespace and two `meta` keys get translated into fr/it/en/es/pt; canton display names move to a new per-locale map module; the hand-maintained projection figures move to language-neutral numbers that each locale formats and phrases itself; the sitemap lists `/praemien` per locale.

**Tech Stack:** Next.js App Router, next-intl (message catalogs under `src/messages/`, `useTranslations`/`useLocale`/`getTranslations`), Vitest (`environment: "node"` — no DOM render tests), `Intl.NumberFormat`/`Intl.DateTimeFormat` for locale formatting.

## Global Constraints

- **Six locales, exact codes:** `de` (default), `fr`, `it`, `en`, `pt`, `es` — from `src/i18n/routing.ts`.
- **URL path stays `/praemien` on every locale.** No localized slugs.
- **`src/lib/praemienGuide.ts` and `src/lib/cantonNames.ts` must stay browser-safe** — no Node built-ins. `PraemienGuideContent.tsx` (`"use client"`) imports from both.
- **Message-catalog parity is enforced** by `src/messages/messages.test.ts`: every locale file must have exactly the same key paths AND the same `{placeholder}` set per leaf as `de.json`.
- **Office acronym per locale** (existing convention elsewhere in each catalog): de `BAG` (spelled "Bundesamt für Gesundheit (BAG)"), fr `OFSP`, it `UFSP`, en `FOPH`, es `OFSP`, pt `OFSP`.
- **Currency in prose:** write `CHF 300` / `CHF 2500` (no thousands separator), matching the current German source strings.
- **Translations are machine-authored** — requirement.md §12 already lists a native-speaker review as a follow-up.
- Test: `npm test` (vitest). Build: `npm run build`. Lint: `npm run lint`.

---

### Task 1: Per-locale canton name map

**Files:**
- Create: `src/lib/cantonNames.ts`
- Modify: `src/lib/praemienGuide.ts` (remove the inline `CANTON_NAMES_DE` map and its export; keep everything else)
- Modify: `src/components/help/PraemienGuideContent.tsx` (canton column only)
- Test: `src/lib/praemienGuide.test.ts` (replace the `CANTON_NAMES_DE` describe block)

**Interfaces:**
- Produces:
  - `CANTON_CODES: readonly ["AG","AI","AR","BE","BL","BS","FR","GE","GL","GR","JU","LU","NE","NW","OW","SG","SH","SO","SZ","TG","TI","UR","VD","VS","ZG","ZH"]`
  - `type CantonCode = (typeof CANTON_CODES)[number]`
  - `CANTON_NAMES: Record<"de"|"fr"|"it"|"en"|"es"|"pt", Record<CantonCode, string>>`
- Consumes: nothing from other tasks.
- Note: `src/lib/praemienGuide.ts` keeps exporting `CantonAverage`, `averagePremiumByCanton`, `buildFaqJsonLd`, `FAQ_KEYS`, `REFERENCE_PROFILE`. Only `CANTON_NAMES_DE` goes away.

- [ ] **Step 1: Write the new module**

Create `src/lib/cantonNames.ts`:

```ts
// src/lib/cantonNames.ts
// Canton display names per locale for the Prämien guide's canton table
// (src/components/help/PraemienGuideContent.tsx). Stable reference data, kept
// out of the message catalogs — canton names are labels, not UI prose.
// Browser-safe (the "use client" content component imports this): no Node
// built-ins.
//
// Spellings are machine-authored; requirement.md §12's native-speaker review
// covers this table. Where a language has no established exonym, the local
// (de/fr/it) name is kept.

export const CANTON_CODES = [
  "AG", "AI", "AR", "BE", "BL", "BS", "FR", "GE", "GL", "GR", "JU", "LU", "NE",
  "NW", "OW", "SG", "SH", "SO", "SZ", "TG", "TI", "UR", "VD", "VS", "ZG", "ZH",
] as const;

export type CantonCode = (typeof CANTON_CODES)[number];

export const CANTON_NAMES: Record<
  "de" | "fr" | "it" | "en" | "es" | "pt",
  Record<CantonCode, string>
> = {
  de: {
    AG: "Aargau", AI: "Appenzell Innerrhoden", AR: "Appenzell Ausserrhoden",
    BE: "Bern", BL: "Basel-Landschaft", BS: "Basel-Stadt", FR: "Freiburg",
    GE: "Genf", GL: "Glarus", GR: "Graubünden", JU: "Jura", LU: "Luzern",
    NE: "Neuenburg", NW: "Nidwalden", OW: "Obwalden", SG: "St. Gallen",
    SH: "Schaffhausen", SO: "Solothurn", SZ: "Schwyz", TG: "Thurgau",
    TI: "Tessin", UR: "Uri", VD: "Waadt", VS: "Wallis", ZG: "Zug", ZH: "Zürich",
  },
  fr: {
    AG: "Argovie", AI: "Appenzell Rhodes-Intérieures",
    AR: "Appenzell Rhodes-Extérieures", BE: "Berne", BL: "Bâle-Campagne",
    BS: "Bâle-Ville", FR: "Fribourg", GE: "Genève", GL: "Glaris",
    GR: "Grisons", JU: "Jura", LU: "Lucerne", NE: "Neuchâtel", NW: "Nidwald",
    OW: "Obwald", SG: "Saint-Gall", SH: "Schaffhouse", SO: "Soleure",
    SZ: "Schwytz", TG: "Thurgovie", TI: "Tessin", UR: "Uri", VD: "Vaud",
    VS: "Valais", ZG: "Zoug", ZH: "Zurich",
  },
  it: {
    AG: "Argovia", AI: "Appenzello Interno", AR: "Appenzello Esterno",
    BE: "Berna", BL: "Basilea Campagna", BS: "Basilea Città", FR: "Friburgo",
    GE: "Ginevra", GL: "Glarona", GR: "Grigioni", JU: "Giura", LU: "Lucerna",
    NE: "Neuchâtel", NW: "Nidvaldo", OW: "Obvaldo", SG: "San Gallo",
    SH: "Sciaffusa", SO: "Soletta", SZ: "Svitto", TG: "Turgovia",
    TI: "Ticino", UR: "Uri", VD: "Vaud", VS: "Vallese", ZG: "Zugo",
    ZH: "Zurigo",
  },
  en: {
    AG: "Aargau", AI: "Appenzell Innerrhoden", AR: "Appenzell Ausserrhoden",
    BE: "Bern", BL: "Basel-Landschaft", BS: "Basel-Stadt", FR: "Fribourg",
    GE: "Geneva", GL: "Glarus", GR: "Graubünden", JU: "Jura", LU: "Lucerne",
    NE: "Neuchâtel", NW: "Nidwalden", OW: "Obwalden", SG: "St. Gallen",
    SH: "Schaffhausen", SO: "Solothurn", SZ: "Schwyz", TG: "Thurgau",
    TI: "Ticino", UR: "Uri", VD: "Vaud", VS: "Valais", ZG: "Zug",
    ZH: "Zurich",
  },
  es: {
    AG: "Argovia", AI: "Appenzell Rodas Interiores",
    AR: "Appenzell Rodas Exteriores", BE: "Berna", BL: "Basilea-Campiña",
    BS: "Basilea-Ciudad", FR: "Friburgo", GE: "Ginebra", GL: "Glaris",
    GR: "Grisones", JU: "Jura", LU: "Lucerna", NE: "Neuchâtel",
    NW: "Nidwalden", OW: "Obwalden", SG: "San Galo", SH: "Schaffhausen",
    SO: "Soleura", SZ: "Schwyz", TG: "Turgovia", TI: "Tesino", UR: "Uri",
    VD: "Vaud", VS: "Valais", ZG: "Zug", ZH: "Zúrich",
  },
  pt: {
    AG: "Argóvia", AI: "Appenzell Rodes Interiores",
    AR: "Appenzell Rodes Exteriores", BE: "Berna", BL: "Basileia-Campo",
    BS: "Basileia-Cidade", FR: "Friburgo", GE: "Genebra", GL: "Glaris",
    GR: "Grisões", JU: "Jura", LU: "Lucerna", NE: "Neuchâtel",
    NW: "Nidvaldo", OW: "Obvaldo", SG: "São Galo", SH: "Schaffhausen",
    SO: "Solothurn", SZ: "Schwyz", TG: "Turgóvia", TI: "Tessino", UR: "Uri",
    VD: "Vaud", VS: "Valais", ZG: "Zug", ZH: "Zurique",
  },
};
```

- [ ] **Step 2: Replace the test block**

In `src/lib/praemienGuide.test.ts`:

- Change the import line to drop `CANTON_NAMES_DE`:
  ```ts
  import { averagePremiumByCanton, buildFaqJsonLd, FAQ_KEYS } from "./praemienGuide";
  import { CANTON_NAMES, CANTON_CODES } from "./cantonNames";
  import { routing } from "@/i18n/routing";
  ```
- Replace the entire `describe("CANTON_NAMES_DE", ...)` block (lines ~78-88) with:
  ```ts
  describe("CANTON_NAMES", () => {
    it("has an entry for every app locale", () => {
      expect(Object.keys(CANTON_NAMES).sort()).toEqual([...routing.locales].sort());
    });

    it("names all 26 cantons in every locale", () => {
      for (const locale of routing.locales) {
        expect(Object.keys(CANTON_NAMES[locale]).sort()).toEqual(
          [...CANTON_CODES].sort(),
        );
      }
    });

    it("uses localized canton names (spot check)", () => {
      expect(CANTON_NAMES.de.ZH).toBe("Zürich");
      expect(CANTON_NAMES.de.GE).toBe("Genf");
      expect(CANTON_NAMES.fr.GE).toBe("Genève");
      expect(CANTON_NAMES.it.GE).toBe("Ginevra");
      expect(CANTON_NAMES.en.GE).toBe("Geneva");
    });
  });
  ```

- [ ] **Step 3: Run the test — expect FAIL**

Run: `npm test -- src/lib/praemienGuide.test.ts`
Expected: FAIL — `./cantonNames` not found / `CANTON_NAMES_DE` still imported elsewhere.

Wait — the module is created in Step 1, so the failure is that `praemienGuide.ts` still exports `CANTON_NAMES_DE` and `PraemienGuideContent.tsx` still imports it (TypeScript/build), but the *test file itself* should now pass. If it passes already, that is fine — proceed to Step 4 for the source cleanup.

- [ ] **Step 4: Remove `CANTON_NAMES_DE` from `praemienGuide.ts`**

Delete the `CANTON_NAMES_DE` const (lines ~14-45, the comment + the `export const CANTON_NAMES_DE: Record<string, string> = { ... };`). Leave the file-header comment's mention of it updated:

```ts
// Pure, browser-safe: PraemienGuideContent.tsx ("use client") imports the
// CantonAverage type from here, so this module must stay free of Node
// built-ins. The disk read lives in ./praemienGuideData; canton display
// names live in ./cantonNames.
```

- [ ] **Step 5: Point `PraemienGuideContent.tsx` at the new map**

- Change the import:
  ```ts
  import { useTranslations, useLocale } from "next-intl";
  import type { CantonAverage } from "@/lib/praemienGuide";
  import { CANTON_NAMES, type CantonCode } from "@/lib/cantonNames";
  ```
- Inside the component, after `const t = useTranslations("praemienGuide");`:
  ```ts
  const locale = useLocale();
  const cantonNames =
    CANTON_NAMES[locale as keyof typeof CANTON_NAMES] ?? CANTON_NAMES.de;
  ```
- Change the canton cell (was `{CANTON_NAMES_DE[kanton] ?? kanton}`):
  ```tsx
  <td className="py-1 pr-2">
    {cantonNames[kanton as CantonCode] ??
      CANTON_NAMES.de[kanton as CantonCode] ??
      kanton}
  </td>
  ```

Leave the projection line (`t("projected", { ... })`) exactly as it is — Task 2 changes it.

- [ ] **Step 6: Run the full suite + typecheck**

Run: `npm test && npm run build`
Expected: PASS. The build confirms no dangling `CANTON_NAMES_DE` import.

- [ ] **Step 7: Commit**

```bash
git add src/lib/cantonNames.ts src/lib/praemienGuide.ts src/lib/praemienGuide.test.ts src/components/help/PraemienGuideContent.tsx
git commit -m "feat: per-locale canton name map for the Prämien guide"
```

---

### Task 2: Language-neutral projection figures

**Files:**
- Modify: `src/data/praemienProjection.json`
- Test: `src/data/praemienProjection.test.ts` (rewrite the assertions)
- Modify: `src/lib/praemienGuide.ts` (add `RawProjection` type + `formatProjection`)
- Test: `src/lib/praemienGuide.test.ts` (add a `formatProjection` describe block)
- Modify: `src/components/help/PraemienGuideContent.tsx` (projection prop + line)
- Modify: `src/components/help/PraemienGuideTeaser.tsx` (projection line)
- Modify: `src/app/[locale]/praemien/page.tsx` (pass the raw json through)
- Modify: `src/messages/{de,fr,it,en,es,pt}.json` — `praemienGuide.projected` only

**Interfaces:**
- Consumes: nothing from Task 1 (independent file set apart from `PraemienGuideContent.tsx`, which Task 1 already edited — apply on top).
- Produces:
  - `type RawProjection = { year: number; asOf: string; comparis: { increase: number }; bag: { low: number; high: number } }`
  - `formatProjection(projection: RawProjection, locale: string): { projYear: string; comparis: string; bagLow: string; bagHigh: string; asOf: string }`
  - New `praemienGuide.projected` placeholder set in every catalog: `{projYear} {comparis} {bagLow} {bagHigh} {asOf}` (drops the old `{bag}` and the hardcoded year).

- [ ] **Step 1: Reshape the data file**

Replace `src/data/praemienProjection.json` with:

```json
{
  "_comment": "Hand-maintained editorial figures for the Prämien guide (docs/superpowers/specs/2026-08-31-praemien-guide-content-page-design.md). Two published forecasts for the next premium year's average increase, stored as plain numbers (percent) and an ISO year-month so each locale formats and phrases them itself. Not from the BAG ingest pipeline — the ingest script never touches this file. Update when the definitive BAG premiums are published (end of September) or when a newer forecast supersedes these.",
  "year": 2027,
  "asOf": "2026-05",
  "comparis": {
    "increase": 3.7,
    "source": "https://www.comparis.ch/publikationen/mitteilungen/2026/05/krankenkassenpraemien-steigen-2027-um-3-7prozent"
  },
  "bag": {
    "low": 4.5,
    "high": 5,
    "source": "https://www.20min.ch/story/bag-krankenkassenpraemien-steigen-wieder-um-vier-prozent-oder-mehr-103570875"
  }
}
```

- [ ] **Step 2: Rewrite the data test**

Replace the body of `src/data/praemienProjection.test.ts` (keep the top comment) with:

```ts
import { describe, it, expect } from "vitest";
import projection from "./praemienProjection.json";

describe("praemienProjection.json", () => {
  it("has the Comparis forecast as a positive numeric percentage with a source URL", () => {
    expect(typeof projection.comparis.increase).toBe("number");
    expect(projection.comparis.increase).toBeGreaterThan(0);
    expect(projection.comparis.source).toMatch(/^https:\/\//);
  });

  it("has the BAG forecast as a low<=high numeric range with a source URL", () => {
    expect(typeof projection.bag.low).toBe("number");
    expect(typeof projection.bag.high).toBe("number");
    expect(projection.bag.high).toBeGreaterThanOrEqual(projection.bag.low);
    expect(projection.bag.source).toMatch(/^https:\/\//);
  });

  it("states the projected year and an ISO year-month it is current as of", () => {
    expect(projection.year).toBe(2027);
    expect(projection.asOf).toMatch(/^\d{4}-\d{2}$/);
  });
});
```

- [ ] **Step 3: Run the data test — expect PASS**

Run: `npm test -- src/data/praemienProjection.test.ts`
Expected: PASS.

- [ ] **Step 4: Write the failing `formatProjection` test**

Add to `src/lib/praemienGuide.test.ts` (import `formatProjection` from `./praemienGuide` in the existing import line):

```ts
describe("formatProjection", () => {
  const raw = {
    year: 2027,
    asOf: "2026-05",
    comparis: { increase: 3.7 },
    bag: { low: 4.5, high: 5 },
  };

  it("formats figures for German (decimal comma, German month)", () => {
    expect(formatProjection(raw, "de")).toEqual({
      projYear: "2027",
      comparis: "3,7",
      bagLow: "4,5",
      bagHigh: "5",
      asOf: "Mai 2026",
    });
  });

  it("formats figures for English (decimal point, English month)", () => {
    expect(formatProjection(raw, "en")).toEqual({
      projYear: "2027",
      comparis: "3.7",
      bagLow: "4.5",
      bagHigh: "5",
      asOf: "May 2026",
    });
  });
});
```

- [ ] **Step 5: Run it — expect FAIL**

Run: `npm test -- src/lib/praemienGuide.test.ts`
Expected: FAIL — `formatProjection` is not exported.

- [ ] **Step 6: Implement `formatProjection`**

Append to `src/lib/praemienGuide.ts`:

```ts
export type RawProjection = {
  year: number;
  asOf: string; // ISO year-month, e.g. "2026-05"
  comparis: { increase: number };
  bag: { low: number; high: number };
};

/** Locale-formatted projection figures for the `praemienGuide.projected`
 *  message. Pure — safe to call from a client component. `locale` is an app
 *  locale code ("de", "fr", …), deliberately not "de-CH": German/French/
 *  Italian/Spanish/Portuguese then render a decimal comma (matching how the
 *  forecasts are published), English a decimal point. */
export function formatProjection(projection: RawProjection, locale: string) {
  const nf = new Intl.NumberFormat(locale);
  const asOf = new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${projection.asOf}-01T00:00:00Z`));
  return {
    projYear: String(projection.year),
    comparis: nf.format(projection.comparis.increase),
    bagLow: nf.format(projection.bag.low),
    bagHigh: nf.format(projection.bag.high),
    asOf,
  };
}
```

- [ ] **Step 7: Run it — expect PASS**

Run: `npm test -- src/lib/praemienGuide.test.ts`
Expected: PASS. (If the month casing differs from `"Mai 2026"`/`"May 2026"` on this Node's ICU, adjust the expected strings to the actual output — the formatting is what matters, not the exact literal.)

- [ ] **Step 8: Update `praemienGuide.projected` in all six catalogs**

Set `praemienGuide.projected` to these exact strings. **de** gets its final wording; the other five get the **same German string as de** for now (Task 3 translates them) — this keeps `messages.test.ts` placeholder-parity green.

- `de.json`:
  ```
  "projected": "Für {projYear} rechnet Comparis mit einem durchschnittlichen Prämienanstieg von {comparis} %, das Bundesamt für Gesundheit (BAG) mit {bagLow} bis {bagHigh} % (Stand: {asOf})."
  ```
- `fr.json`, `it.json`, `en.json`, `es.json`, `pt.json`: set `praemienGuide.projected` to the **identical** German string above.

- [ ] **Step 9: Wire the components + page to the raw projection**

`src/app/[locale]/praemien/page.tsx` — the `<PraemienGuideContent>` call currently maps the json into `{ comparis, bag, asOf }`. Replace with passing the import straight through:

```tsx
<PraemienGuideContent
  year={year}
  cantonAverages={cantonAverages}
  projection={projection}
/>
```

`src/components/help/PraemienGuideContent.tsx`:
- Remove the local `export type PraemienProjection = { ... }`.
- Import the type + helper: add to the `@/lib/praemienGuide` import:
  ```ts
  import { formatProjection, type RawProjection } from "@/lib/praemienGuide";
  import type { CantonAverage } from "@/lib/praemienGuide";
  ```
  (Combine into one import statement if the file style prefers it.)
- Change the prop type `projection: PraemienProjection` → `projection: RawProjection`.
- In the body, replace the `t("projected", { comparis: projection.comparis, bag: projection.bag, asOf: projection.asOf })` call (there is one, right after `{t("intro")}`) with:
  ```tsx
  {t("intro")}{" "}
  {t("projected", formatProjection(projection, locale))}
  ```
  (`locale` is already in scope from Task 1.)

`src/components/help/PraemienGuideTeaser.tsx`:
- Add `useLocale` to the next-intl import; add `import { formatProjection } from "@/lib/praemienGuide";`
- After `const t = useTranslations("praemienGuide");` add `const locale = useLocale();`
- Replace the `t("projected", { comparis: projection.comparis.increase, bag: projection.bag.increase, asOf: projection.asOf })` call with:
  ```tsx
  {t("intro")}{" "}
  {t("projected", formatProjection(projection, locale))}
  ```

- [ ] **Step 10: Full suite + build**

Run: `npm test && npm run build && npm run lint`
Expected: PASS. `messages.test.ts` confirms the new placeholder set is consistent across all six catalogs.

- [ ] **Step 11: Commit**

```bash
git add src/data/praemienProjection.json src/data/praemienProjection.test.ts src/lib/praemienGuide.ts src/lib/praemienGuide.test.ts src/components/help/PraemienGuideContent.tsx src/components/help/PraemienGuideTeaser.tsx src/app/[locale]/praemien/page.tsx src/messages
git commit -m "feat: language-neutral projection figures for the Prämien guide"
```

---

### Task 3: Translate the guide copy into fr, it, en, es, pt

**Files:**
- Modify: `src/messages/fr.json`, `src/messages/it.json`, `src/messages/en.json`, `src/messages/es.json`, `src/messages/pt.json`
- Test: `src/messages/messages.test.ts` (no change — it verifies the work)

**Interfaces:**
- Consumes: the `praemienGuide.projected` placeholder set from Task 2 (`{projYear} {comparis} {bagLow} {bagHigh} {asOf}`).
- Produces: nothing consumed by later tasks (Task 4 just relies on the keys existing).

For each of the five files, replace **`meta.praemienGuideTitle`**, **`meta.praemienGuideDescription`**, and the **entire `praemienGuide` object** with the block below. Keep `{year}` / `{nextYear}` in the meta keys exactly as `de.json` has them. Do not touch any other namespace.

- [ ] **Step 1: French — `src/messages/fr.json`**

`meta`:
```json
"praemienGuideTitle": "Primes d'assurance-maladie {year} : comparaison par canton",
"praemienGuideDescription": "Les primes d'assurance-maladie {year} comparées – prime moyenne par canton, comment elles sont calculées et les perspectives pour {nextYear}."
```
`praemienGuide`:
```json
{
  "h1": "Primes d'assurance-maladie {year} : ce qu'il faut savoir",
  "intro": "L'Office fédéral de la santé publique (OFSP) publie les nouvelles primes chaque année fin septembre. L'ampleur de leur hausse ou de leur baisse dépend des coûts de la santé de l'année précédente, du canton et de la caisse choisie — il n'existe pas de prime suisse unique.",
  "projected": "Pour {projYear}, Comparis prévoit une hausse moyenne des primes de {comparis} %, l'OFSP de {bagLow} à {bagHigh} % (état : {asOf}).",
  "teaserCta": "Plus de détails →",
  "howSet": {
    "heading": "Comment la prime est composée",
    "intro": "Chaque caisse-maladie calcule ses primes selon les mêmes facteurs fixés par la loi :",
    "region": "Canton de domicile et région de primes — selon les coûts de la santé dans la région.",
    "age": "Classe d'âge — les enfants (0–18 ans), les jeunes adultes (19–25 ans) et les adultes (dès 26 ans) paient des primes différentes.",
    "franchise": "Franchise — une franchise plus élevée (jusqu'à CHF 2500) réduit la prime mensuelle, mais vous prenez en charge une plus grande part des coûts.",
    "model": "Modèle d'assurance — standard, médecin de famille, Telmed ou HMO ; un choix restreint des fournisseurs de prestations réduit la prime.",
    "accident": "Couverture accidents — si vous êtes déjà assuré contre les accidents par votre employeur, vous pouvez l'exclure de l'assurance-maladie."
  },
  "table": {
    "heading": "Prime moyenne {year} par canton",
    "note": "Prime mensuelle moyenne pour les adultes, franchise CHF 300, modèle standard, avec couverture accidents — base : données officielles de l'OFSP {year}, déduction faite de la réduction de prime liée à la taxe d'incitation CO₂/COV.",
    "cantonHeader": "Canton",
    "premiumHeader": "Prime moy./mois"
  },
  "deadlines": {
    "heading": "Délais importants",
    "text": "Vous pouvez changer de caisse-maladie une fois par an. La résiliation doit parvenir à votre caisse actuelle jusqu'au 30 novembre ; le changement prend effet au 1er janvier."
  },
  "faq": {
    "heading": "Questions fréquentes",
    "q1": "Quand dois-je changer de caisse-maladie ?",
    "a1": "La résiliation doit parvenir à votre caisse actuelle au plus tard le 30 novembre. Le changement vers la nouvelle caisse prend alors effet au 1er janvier de l'année suivante.",
    "q2": "Les primes augmentent-elles chaque année ?",
    "a2": "Pas nécessairement, mais le plus souvent. Les primes suivent les coûts réels de la santé — la plupart des années, elles augmentent, mais l'ampleur varie fortement selon le canton et la caisse.",
    "q3": "Qu'est-ce que la franchise ?",
    "a3": "La franchise est le montant annuel que vous payez vous-même pour les frais de traitement avant que la caisse-maladie ne prenne le relais. Elle se situe entre CHF 300 et CHF 2500 — une franchise plus élevée réduit la prime mensuelle.",
    "q4": "Que signifie le modèle standard ?",
    "a4": "Dans le modèle standard, vous choisissez librement tout médecin agréé. Les modèles alternatifs (médecin de famille, Telmed, HMO) restreignent ce choix et sont donc meilleur marché.",
    "q5": "Une caisse-maladie peut-elle refuser mon adhésion ?",
    "a5": "Non. Dans l'assurance de base, chaque caisse-maladie doit vous accepter — il n'y a pas de questions de santé ni de refus."
  }
}
```

- [ ] **Step 2: Italian — `src/messages/it.json`**

`meta`:
```json
"praemienGuideTitle": "Premi dell'assicurazione malattie {year}: confronto per cantone",
"praemienGuideDescription": "I premi dell'assicurazione malattie {year} a confronto – premio medio per cantone, come vengono calcolati e le prospettive per il {nextYear}."
```
`praemienGuide`:
```json
{
  "h1": "Premi dell'assicurazione malattie {year}: cosa c'è da sapere",
  "intro": "L'Ufficio federale della sanità pubblica (UFSP) pubblica i nuovi premi ogni anno a fine settembre. L'entità del loro aumento o della loro diminuzione dipende dai costi della salute dell'anno precedente, dal cantone e dalla cassa scelta — non esiste un premio svizzero unico.",
  "projected": "Per il {projYear} Comparis prevede un aumento medio dei premi del {comparis} %, l'UFSP del {bagLow}–{bagHigh} % (stato: {asOf}).",
  "teaserCta": "Maggiori dettagli →",
  "howSet": {
    "heading": "Come si compone il premio",
    "intro": "Ogni cassa malati calcola i suoi premi secondo gli stessi fattori stabiliti dalla legge:",
    "region": "Cantone di domicilio e regione di premio — a seconda dei costi della salute nella regione.",
    "age": "Classe d'età — bambini (0–18 anni), giovani adulti (19–25 anni) e adulti (dai 26 anni) pagano premi diversi.",
    "franchise": "Franchigia — una franchigia più alta (fino a CHF 2500) riduce il premio mensile, ma Lei si assume una quota maggiore dei costi.",
    "model": "Modello assicurativo — standard, medico di famiglia, Telmed o HMO; una scelta limitata dei fornitori di prestazioni riduce il premio.",
    "accident": "Copertura infortuni — chi è già assicurato contro gli infortuni tramite il datore di lavoro può escluderla dall'assicurazione malattie."
  },
  "table": {
    "heading": "Premio medio {year} per cantone",
    "note": "Premio mensile medio per adulti, franchigia CHF 300, modello standard, con copertura infortuni — base: dati ufficiali UFSP {year}, dedotta la riduzione di premio dovuta alla tassa d'incentivazione CO₂/COV.",
    "cantonHeader": "Cantone",
    "premiumHeader": "Premio medio/mese"
  },
  "deadlines": {
    "heading": "Termini importanti",
    "text": "Può cambiare cassa malati una volta all'anno. La disdetta deve pervenire alla cassa attuale entro il 30 novembre; il cambiamento ha effetto dal 1° gennaio."
  },
  "faq": {
    "heading": "Domande frequenti",
    "q1": "Quando devo cambiare cassa malati?",
    "a1": "La disdetta deve pervenire alla Sua cassa attuale entro il 30 novembre. Il passaggio alla nuova cassa ha quindi effetto dal 1° gennaio dell'anno successivo.",
    "q2": "I premi aumentano ogni anno?",
    "a2": "Non necessariamente, ma nella maggior parte dei casi sì. I premi seguono i costi effettivi della salute — nella maggior parte degli anni aumentano, ma l'entità varia molto a seconda del cantone e della cassa.",
    "q3": "Che cos'è la franchigia?",
    "a3": "La franchigia è l'importo annuo che Lei paga di tasca propria per le spese di cura prima che intervenga la cassa malati. Va da CHF 300 a CHF 2500 — una franchigia più alta riduce il premio mensile.",
    "q4": "Cosa significa modello standard?",
    "a4": "Nel modello standard può scegliere liberamente qualsiasi medico autorizzato. I modelli alternativi (medico di famiglia, Telmed, HMO) limitano questa scelta e sono quindi più convenienti.",
    "q5": "Ogni cassa malati può rifiutare la mia ammissione?",
    "a5": "No. Nell'assicurazione di base ogni cassa malati deve accettarLa — non ci sono domande sulla salute né rifiuti."
  }
}
```

- [ ] **Step 3: English — `src/messages/en.json`**

`meta`:
```json
"praemienGuideTitle": "Swiss health insurance premiums {year}: comparison by canton",
"praemienGuideDescription": "Swiss health insurance premiums {year} compared – average premium by canton, how they are calculated and the outlook for {nextYear}."
```
`praemienGuide`:
```json
{
  "h1": "Swiss health insurance premiums {year}: what you need to know",
  "intro": "The Federal Office of Public Health (FOPH) publishes the new premiums at the end of September each year. How much they rise or fall depends on the previous year's healthcare costs, the canton and the insurer you choose — there is no single Swiss premium.",
  "projected": "For {projYear}, Comparis expects an average premium increase of {comparis}%, and the FOPH {bagLow}–{bagHigh}% (as of {asOf}).",
  "teaserCta": "More details →",
  "howSet": {
    "heading": "How the premium is made up",
    "intro": "Every insurer calculates its premiums using the same factors set by law:",
    "region": "Canton of residence and premium region — depending on healthcare costs in the region.",
    "age": "Age group — children (0–18), young adults (19–25) and adults (26+) pay different premiums.",
    "franchise": "Deductible — a higher deductible (up to CHF 2500) lowers the monthly premium, but you cover more of the costs yourself.",
    "model": "Insurance model — standard, family doctor, Telmed or HMO; a restricted choice of providers lowers the premium.",
    "accident": "Accident coverage — if you are already covered against accidents through your employer, you can exclude it from your health insurance."
  },
  "table": {
    "heading": "Average premium {year} by canton",
    "note": "Average monthly premium for adults, CHF 300 deductible, standard model, with accident coverage — based on official FOPH data {year}, less the premium reduction from the CO₂/VOC incentive tax.",
    "cantonHeader": "Canton",
    "premiumHeader": "Avg. premium/month"
  },
  "deadlines": {
    "heading": "Key deadlines",
    "text": "You can switch insurers once a year. Your cancellation must reach your current insurer by 30 November; the switch takes effect on 1 January."
  },
  "faq": {
    "heading": "Frequently asked questions",
    "q1": "When do I have to switch insurers?",
    "a1": "Your cancellation must reach your current insurer by 30 November at the latest. The switch to the new insurer then takes effect on 1 January of the following year.",
    "q2": "Do premiums go up every year?",
    "a2": "Not necessarily, but usually. Premiums follow actual healthcare costs — in most years they rise, but the amount varies widely by canton and insurer.",
    "q3": "What is the deductible?",
    "a3": "The deductible is the annual amount you pay yourself for treatment costs before your insurer starts to pay. It ranges from CHF 300 to CHF 2500 — a higher deductible lowers the monthly premium.",
    "q4": "What does the standard model mean?",
    "a4": "In the standard model you can freely choose any licensed doctor. Alternative models (family doctor, Telmed, HMO) restrict that choice and are cheaper in return.",
    "q5": "Can an insurer turn down my application?",
    "a5": "No. In basic insurance every insurer must accept you — there are no health questions and no rejection."
  }
}
```

- [ ] **Step 4: Spanish — `src/messages/es.json`**

`meta`:
```json
"praemienGuideTitle": "Primas del seguro de salud {year}: comparación por cantón",
"praemienGuideDescription": "Las primas del seguro de salud suizo {year} comparadas: prima media por cantón, cómo se calculan y las perspectivas para {nextYear}."
```
`praemienGuide`:
```json
{
  "h1": "Primas del seguro de salud {year}: lo que debes saber",
  "intro": "La Oficina Federal de Salud Pública (OFSP) publica las nuevas primas a finales de septiembre de cada año. Cuánto suben o bajan depende de los costes sanitarios del año anterior, del cantón y de la aseguradora elegida: no existe una prima suiza única.",
  "projected": "Para {projYear}, Comparis prevé un aumento medio de las primas del {comparis} %, y la OFSP del {bagLow}–{bagHigh} % (a fecha de {asOf}).",
  "teaserCta": "Más detalles →",
  "howSet": {
    "heading": "Cómo se compone la prima",
    "intro": "Todas las aseguradoras calculan sus primas según los mismos factores fijados por ley:",
    "region": "Cantón de residencia y región de primas, según los costes sanitarios de la región.",
    "age": "Grupo de edad: los niños (0–18 años), los adultos jóvenes (19–25 años) y los adultos (a partir de 26 años) pagan primas distintas.",
    "franchise": "Franquicia: una franquicia más alta (hasta CHF 2500) reduce la prima mensual, pero asumes una mayor parte de los costes.",
    "model": "Modelo de seguro: estándar, médico de cabecera, Telmed o HMO; una elección restringida de proveedores reduce la prima.",
    "accident": "Cobertura de accidentes: si ya estás cubierto frente a accidentes a través de tu empleador, puedes excluirla del seguro de salud."
  },
  "table": {
    "heading": "Prima media {year} por cantón",
    "note": "Prima mensual media para adultos, franquicia de CHF 300, modelo estándar, con cobertura de accidentes. Base: datos oficiales de la OFSP {year}, descontada la reducción de prima por la tasa de incentivo sobre el CO₂ y los COV.",
    "cantonHeader": "Cantón",
    "premiumHeader": "Prima media/mes"
  },
  "deadlines": {
    "heading": "Plazos importantes",
    "text": "Puedes cambiar de aseguradora una vez al año. La cancelación debe llegar a tu aseguradora actual antes del 30 de noviembre; el cambio surte efecto el 1 de enero."
  },
  "faq": {
    "heading": "Preguntas frecuentes",
    "q1": "¿Cuándo tengo que cambiar de aseguradora?",
    "a1": "La cancelación debe llegar a tu aseguradora actual a más tardar el 30 de noviembre. El cambio a la nueva aseguradora surte efecto el 1 de enero del año siguiente.",
    "q2": "¿Suben las primas todos los años?",
    "a2": "No necesariamente, pero casi siempre. Las primas siguen los costes sanitarios reales: en la mayoría de los años suben, aunque la cuantía varía mucho según el cantón y la aseguradora.",
    "q3": "¿Qué es la franquicia?",
    "a3": "La franquicia es el importe anual que pagas tú mismo por los costes de tratamiento antes de que intervenga la aseguradora. Va de CHF 300 a CHF 2500: una franquicia más alta reduce la prima mensual.",
    "q4": "¿Qué significa el modelo estándar?",
    "a4": "En el modelo estándar puedes elegir libremente cualquier médico autorizado. Los modelos alternativos (médico de cabecera, Telmed, HMO) restringen esa elección y, a cambio, son más baratos.",
    "q5": "¿Puede una aseguradora rechazar mi solicitud?",
    "a5": "No. En el seguro básico, todas las aseguradoras deben aceptarte: no hay preguntas de salud ni rechazos."
  }
}
```

- [ ] **Step 5: Portuguese — `src/messages/pt.json`**

`meta`:
```json
"praemienGuideTitle": "Prémios do seguro de saúde {year}: comparação por cantão",
"praemienGuideDescription": "Os prémios do seguro de saúde suíço {year} comparados: prémio médio por cantão, como são calculados e as perspetivas para {nextYear}."
```
`praemienGuide`:
```json
{
  "h1": "Prémios do seguro de saúde {year}: o que precisa de saber",
  "intro": "O Serviço Federal da Saúde Pública (OFSP) publica os novos prémios no final de setembro de cada ano. O quanto sobem ou descem depende dos custos de saúde do ano anterior, do cantão e da seguradora escolhida — não existe um prémio suíço único.",
  "projected": "Para {projYear}, a Comparis prevê um aumento médio dos prémios de {comparis} %, e o OFSP de {bagLow}–{bagHigh} % (dados de {asOf}).",
  "teaserCta": "Mais detalhes →",
  "howSet": {
    "heading": "Como se compõe o prémio",
    "intro": "Todas as seguradoras calculam os seus prémios segundo os mesmos fatores definidos por lei:",
    "region": "Cantão de residência e região de prémios — consoante os custos de saúde na região.",
    "age": "Escalão etário — as crianças (0–18 anos), os jovens adultos (19–25 anos) e os adultos (a partir dos 26 anos) pagam prémios diferentes.",
    "franchise": "Franquia — uma franquia mais elevada (até CHF 2500) reduz o prémio mensal, mas assume uma parte maior dos custos.",
    "model": "Modelo de seguro — padrão, médico de família, Telmed ou HMO; uma escolha limitada de prestadores reduz o prémio.",
    "accident": "Cobertura de acidentes — quem já está coberto contra acidentes através do empregador pode excluí-la do seguro de saúde."
  },
  "table": {
    "heading": "Prémio médio {year} por cantão",
    "note": "Prémio mensal médio para adultos, franquia de CHF 300, modelo padrão, com cobertura de acidentes — base: dados oficiais do OFSP {year}, deduzida a redução do prémio pela taxa de incentivo sobre o CO₂/COV.",
    "cantonHeader": "Cantão",
    "premiumHeader": "Prémio médio/mês"
  },
  "deadlines": {
    "heading": "Prazos importantes",
    "text": "Pode mudar de seguradora uma vez por ano. A rescisão tem de chegar à seguradora atual até 30 de novembro; a mudança produz efeitos a 1 de janeiro."
  },
  "faq": {
    "heading": "Perguntas frequentes",
    "q1": "Quando tenho de mudar de seguradora?",
    "a1": "A rescisão tem de chegar à sua seguradora atual até 30 de novembro, o mais tardar. A mudança para a nova seguradora produz então efeitos a 1 de janeiro do ano seguinte.",
    "q2": "Os prémios sobem todos os anos?",
    "a2": "Não necessariamente, mas na maioria das vezes sim. Os prémios acompanham os custos reais de saúde — na maioria dos anos sobem, mas o valor varia muito consoante o cantão e a seguradora.",
    "q3": "O que é a franquia?",
    "a3": "A franquia é o montante anual que paga do seu bolso pelos custos de tratamento antes de a seguradora comparticipar. Situa-se entre CHF 300 e CHF 2500 — uma franquia mais elevada reduz o prémio mensal.",
    "q4": "O que significa o modelo padrão?",
    "a4": "No modelo padrão pode escolher livremente qualquer médico autorizado. Os modelos alternativos (médico de família, Telmed, HMO) limitam essa escolha e, em troca, são mais baratos.",
    "q5": "Uma seguradora pode recusar a minha adesão?",
    "a5": "Não. No seguro básico, todas as seguradoras têm de o aceitar — não há perguntas de saúde nem recusas."
  }
}
```

- [ ] **Step 6: Run parity + build**

Run: `npm test -- src/messages/messages.test.ts && npm run build`
Expected: PASS. If parity fails, the diff names the offending key path / placeholder — fix that leaf.

- [ ] **Step 7: Commit**

```bash
git add src/messages/fr.json src/messages/it.json src/messages/en.json src/messages/es.json src/messages/pt.json
git commit -m "feat: translate the Prämien guide copy into fr, it, en, es, pt"
```

---

### Task 4: Serve the guide in every locale

**Files:**
- Modify: `src/app/[locale]/praemien/page.tsx`
- Modify: `src/components/help/PraemienGuideTeaser.tsx`

**Interfaces:**
- Consumes: translated `praemienGuide.*` and `meta.praemienGuide*` keys (Task 3); `routing` from `@/i18n/routing`.
- Produces: `/{locale}/praemien` renders for all six locales, with hreflang alternates — relied on by Task 5's sitemap test only indirectly.

- [ ] **Step 1: Drop the German-only guards in the page**

`src/app/[locale]/praemien/page.tsx`:

- Rewrite the file-header comment:
  ```tsx
  // src/app/[locale]/praemien/page.tsx
  // SEO content page on every locale (docs/superpowers/specs/2026-09-02-
  // praemien-guide-i18n-design.md). Mirrors how-it-works/page.tsx.
  ```
- Remove `import { notFound } from "next/navigation";` (now unused).
- Add `import { routing } from "@/i18n/routing";`
- In `generateMetadata`, delete `if (locale !== "de") return {};` and the `const url = ...` line. Replace the whole `alternates` object with:
  ```tsx
  alternates: {
    languages: {
      ...Object.fromEntries(
        routing.locales.map((l) => [l, `${baseUrl}/${l}/praemien`]),
      ),
      "x-default": `${baseUrl}/${routing.defaultLocale}/praemien`,
    },
  },
  ```
  (Leave the `title` / `description` / `openGraph` / `twitter` blocks and the `year` / `vars` derivation untouched.)
- In `PraemienGuidePage`, delete `if (locale !== "de") notFound();`

- [ ] **Step 2: De-Germanize the teaser**

`src/components/help/PraemienGuideTeaser.tsx`:
- Rewrite the header comment to say it renders the active locale's copy and links to `/praemien` in that locale.
- On the outer `<div>`, remove the `lang="de"` attribute.
- On the `<Link>`, remove `locale="de"` (keep `href="/praemien"`).

- [ ] **Step 3: Build and eyeball the route list**

Run: `npm run build`
Expected: PASS, and the build's route table lists `/[locale]/praemien` as prerendered for all six locales (`○` / `●`). No `notFound` at build.

- [ ] **Step 4: Spot-check rendered output**

Run: `npm run build && npm start &` then `curl -s localhost:3000/fr/praemien | grep -o '<h1[^>]*>[^<]*</h1>'` and `curl -s localhost:3000/it/praemien | grep -o 'hreflang="[a-z-]*"' | sort -u`
Expected: the `<h1>` shows the French title ("Primes d'assurance-maladie …"); hreflang tags list all six locales plus `x-default`. Stop the server afterward (`kill %1`).

- [ ] **Step 5: Commit**

```bash
git add src/app/[locale]/praemien/page.tsx src/components/help/PraemienGuideTeaser.tsx
git commit -m "feat: serve the Prämien guide in every locale"
```

---

### Task 5: Sitemap — one `/praemien` entry per locale

**Files:**
- Modify: `src/app/sitemap.ts`
- Test: `src/app/sitemap.test.ts`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: 18 sitemap entries (6 locales × `["", "/how-it-works", "/praemien"]`), each with hreflang alternates for all six locales.

- [ ] **Step 1: Update the test expectations**

`src/app/sitemap.test.ts`:

- First test — rename and update to 18 entries, all with alternates:
  ```ts
  it("lists /{locale}, /{locale}/how-it-works and /{locale}/praemien for all six locales (18 entries)", () => {
    expect([...urls].sort()).toEqual(
      LOCALES.flatMap((l) => [
        `https://example.com/${l}`,
        `https://example.com/${l}/how-it-works`,
        `https://example.com/${l}/praemien`,
      ]).sort(),
    );
  });
  ```
- Third test — drop the `/de/praemien` exclusion filter and generalize the per-path targeting:
  ```ts
  it("every entry carries hreflang alternates for all six locales with correct per-path targeting", () => {
    for (const entry of entries) {
      const languages = entry.alternates?.languages ?? {};
      expect(Object.keys(languages).sort()).toEqual([...LOCALES].sort());

      const suffix = entry.url
        .replace("https://example.com", "")
        .replace(/^\/(de|en|es|fr|it|pt)/, "");
      for (const locale of LOCALES) {
        expect(languages[locale as keyof typeof languages]).toBe(
          `https://example.com/${locale}${suffix}`,
        );
      }
    }
  });
  ```
- Delete the fourth test entirely (`"the /de/praemien entry has no hreflang alternates"`).

- [ ] **Step 2: Run the test — expect FAIL**

Run: `npm test -- src/app/sitemap.test.ts`
Expected: FAIL — sitemap still emits 13 entries and a bare `/de/praemien`.

- [ ] **Step 3: Update the sitemap**

`src/app/sitemap.ts`:
- Change the constant and its comment:
  ```ts
  // One entry per (locale × indexable path). Only base URLs and the evergreen
  // guide pages are listed — never parameterised comparison URLs (REQ-20).
  // Each entry carries hreflang alternates so search engines link the
  // language versions of the same page together.
  const INDEXABLE_PATHS = ["", "/how-it-works", "/praemien"] as const;
  ```
- Delete the entire `praemienEntry` block (the comment + the `const praemienEntry: ... = { ... };`).
- Change the return to `return localizedEntries;`

- [ ] **Step 4: Run the test — expect PASS**

Run: `npm test -- src/app/sitemap.test.ts`
Expected: PASS.

- [ ] **Step 5: Full suite + build**

Run: `npm test && npm run build && npm run lint`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/sitemap.ts src/app/sitemap.test.ts
git commit -m "feat: list /praemien per locale in the sitemap"
```

---

## Self-Review

**1. Spec coverage:**

| Spec section | Task |
|---|---|
| §1 page: remove `notFound()` / `return {}` guards | Task 4 Step 1 |
| §1 page: hreflang alternates like how-it-works | Task 4 Step 1 |
| §2 teaser: drop `lang="de"` + `locale="de"` | Task 4 Step 2 |
| §3 `cantonNames.ts` new module, per-locale maps, fallback chain | Task 1 Steps 1, 5 |
| §3 remove `CANTON_NAMES_DE` from `praemienGuide.ts` | Task 1 Step 4 |
| §4 `PraemienGuideContent` canton column via `useLocale()` | Task 1 Step 5 |
| §4 projection formatting (`Intl.NumberFormat` / `DateTimeFormat`) | Task 2 Steps 6, 9 |
| §4 shared `formatProjection` helper in `praemienGuide.ts` | Task 2 Step 6 |
| §5 `praemienProjection.json` reshape to neutral values | Task 2 Step 1 |
| §5 `praemienProjection.test.ts` update | Task 2 Step 2 |
| §6 translate `praemienGuide` namespace ×5 | Task 3 Steps 1-5 |
| §6 keyword-tuned `h1` + `meta.praemienGuide*` ×5 | Task 3 Steps 1-5 |
| §6 `projected` reworded, connective + acronym per locale, new placeholders | Task 2 Step 8 (de + placeholder parity), Task 3 (translations) |
| §6 drop hardcoded "2027" → `{projYear}` | Task 2 Steps 6, 8 |
| §7 sitemap: `/praemien` in `INDEXABLE_PATHS`, delete special case | Task 5 Step 3 |
| §8 `sitemap.test.ts` (13→18, drop exclusion) | Task 5 Step 1 |
| §8 `praemienGuide.test.ts` retarget canton block + coverage check | Task 1 Step 2 |
| §8 `messages.test.ts` unchanged (verifies work) | Task 3 Step 6 |
| §8 `praemienProjection.test.ts` new shape | Task 2 Step 2 |

No gaps.

**2. Placeholder scan:** No "TBD"/"handle edge cases"/"similar to Task N". Canton spellings are given in full. All test code is spelled out. Month-string literals in Task 2 Step 7 carry an explicit "adjust to actual ICU output" instruction — that is a real environmental variance, not a placeholder.

**3. Type consistency:**
- `CANTON_NAMES` / `CANTON_CODES` / `CantonCode` — defined Task 1 Step 1, consumed Task 1 Steps 2 & 5 with matching names.
- `RawProjection` / `formatProjection` — defined Task 2 Step 6, consumed Task 2 Step 9 (`PraemienGuideContent`, `PraemienGuideTeaser`) and Task 2 Step 4 test. Return keys `{projYear, comparis, bagLow, bagHigh, asOf}` match the `projected` placeholder set in Task 2 Step 8 / Task 3.
- `praemienProjection.json` shape (`comparis.increase`, `bag.low`, `bag.high`, `asOf`, `year`) — written Task 2 Step 1, matched by `RawProjection` Task 2 Step 6 and the test Task 2 Step 2.
- Old `PraemienProjection` type removed (Task 2 Step 9) — only consumer was `page.tsx`, updated in the same step.
- `INDEXABLE_PATHS` — Task 5 Step 3; test's `suffix` regex (Task 5 Step 1) matches the three path values.
