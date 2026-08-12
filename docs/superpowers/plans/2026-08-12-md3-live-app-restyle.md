# MD3 Live-App Restyle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-skin the live Next.js app (main comparator + admin dashboard) to match the already-approved MD3 mockups (`mockups/main.html`, `mockups/admin.html`), with zero behavior/logic changes.

**Architecture:** Add the MD3 color + type-scale tokens (already finalized in `docs/design/material-design-guideline.md`) as CSS custom properties in `src/app/globals.css`, alias them into Tailwind v4's `@theme inline` block so components consume them as ordinary Tailwind utility classes, swap the app font to Roboto, then update each component's `className` strings from the old ad-hoc Tailwind palette to the new tokens, one component (or small group of trivially-similar components) per task.

**Tech Stack:** Next.js 15 (App Router) · React 19 · Tailwind CSS v4 (`@theme inline`, no `tailwind.config.js`) · `next/font/google` · Vitest.

## Global Constraints

- No changes to component props, React structure, state, or any file under `src/lib/*` — this is a visual re-skin only (spec §5.3).
- App stays light-only: `color-scheme: light` remains set; no `dark:` Tailwind variants are introduced anywhere (spec §3).
- Color and type-scale values are copied verbatim from `docs/design/material-design-guideline.md` — never re-derived or approximated (spec §3).
- Font: Roboto (weights 400/500/700) via `next/font/google`, replacing Geist/Geist Mono (spec §4).
- Existing Tailwind ad-hoc colors (`gray-*`, `blue-*`, `red-*`, `green-*`, `amber-*`, `violet-*`, `emerald-*`) must not remain in any file this plan touches once its task is done — verified by grep in each task.
- `npm test` (Vitest) must keep passing unmodified throughout — it covers `src/lib/*` and `scripts/ingest/*` logic, none of which changes.
- Monetary formatting (`formatChf`, Swiss apostrophe thousands separator) is untouched.
- Admin scope is bounded to what exists today in `src/app/admin` — the login form, range-picker buttons, and single stat panel (there is no `<nav>` element in the current code, unlike `mockups/admin.html`; adding one would be new structure/behavior, not a re-skin, so it's not part of this pass) — no new chart panels are built (spec §5.2).

---

## Task 1: Wire MD3 tokens into `globals.css` + Tailwind theme

**Files:**
- Modify: `src/app/globals.css`

**Interfaces:**
- Produces: CSS custom properties `--md-sys-color-*` and `--md-sys-typescale-*-*` on `:root` (exact names/values below), plus Tailwind theme entries so utilities `bg-primary`, `text-on-surface-variant`, `border-outline-variant`, `text-title-large`, etc. become available to every later task.

- [ ] **Step 1: Replace `globals.css` with the token-wired version**

```css
@import "tailwindcss";

/* App UI is light-only: every component uses hardcoded light Tailwind
   classes (bg-white, text-gray-500, ...) with no dark: variants. Without
   this, an OS/browser dark theme flips just these two body-level vars
   (leftover Next.js boilerplate) while nested elements stay explicitly
   light, e.g. an unstyled <h1> inherits the now-light --foreground and
   renders unreadable on an explicit bg-white card. */
:root {
  color-scheme: light;
  --background: #ffffff;
  --foreground: #171717;

  /* MD3 tokens — copied verbatim from docs/design/material-design-guideline.md
     (§1.2 color, §2 typography). Do not hand-edit values here; regenerate
     both this file and the guideline together if the seed color changes. */
  --md-sys-color-primary: #0053db;
  --md-sys-color-on-primary: #ffffff;
  --md-sys-color-primary-container: #dbe1ff;
  --md-sys-color-on-primary-container: #00174b;
  --md-sys-color-primary-hover: #003ea8;
  --md-sys-color-secondary: #595e72;
  --md-sys-color-on-secondary: #ffffff;
  --md-sys-color-secondary-container: #dde1f9;
  --md-sys-color-on-secondary-container: #161b2c;
  --md-sys-color-tertiary: #745470;
  --md-sys-color-tertiary-container: #ffd6f8;
  --md-sys-color-on-tertiary-container: #2b122b;
  --md-sys-color-error: #ba1a1a;
  --md-sys-color-error-container: #ffdad6;
  --md-sys-color-on-error-container: #410002;
  --md-sys-color-success: #006e2d;
  --md-sys-color-on-success: #ffffff;
  --md-sys-color-success-container: #7ffc97;
  --md-sys-color-on-success-container: #002109;
  --md-sys-color-warning: #855300;
  --md-sys-color-on-warning: #ffffff;
  --md-sys-color-warning-container: #ffddb8;
  --md-sys-color-on-warning-container: #2a1700;
  --md-sys-color-surface: #fefbff;
  --md-sys-color-on-surface: #1b1b1f;
  --md-sys-color-on-surface-variant: #45464f;
  --md-sys-color-surface-variant: #e2e2ec;
  --md-sys-color-outline: #757680;
  --md-sys-color-outline-variant: #c5c6d0;
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-sans: var(--font-geist-sans); /* becomes var(--font-roboto) in Task 2 */
  --font-mono: var(--font-geist-mono);

  /* MD3 color tokens as Tailwind utilities: bg-primary, text-on-surface-variant, border-outline-variant, ... */
  --color-primary: var(--md-sys-color-primary);
  --color-on-primary: var(--md-sys-color-on-primary);
  --color-primary-container: var(--md-sys-color-primary-container);
  --color-on-primary-container: var(--md-sys-color-on-primary-container);
  --color-primary-hover: var(--md-sys-color-primary-hover);
  --color-secondary: var(--md-sys-color-secondary);
  --color-on-secondary: var(--md-sys-color-on-secondary);
  --color-secondary-container: var(--md-sys-color-secondary-container);
  --color-on-secondary-container: var(--md-sys-color-on-secondary-container);
  --color-tertiary: var(--md-sys-color-tertiary);
  --color-tertiary-container: var(--md-sys-color-tertiary-container);
  --color-on-tertiary-container: var(--md-sys-color-on-tertiary-container);
  --color-error: var(--md-sys-color-error);
  --color-error-container: var(--md-sys-color-error-container);
  --color-on-error-container: var(--md-sys-color-on-error-container);
  --color-success: var(--md-sys-color-success);
  --color-on-success: var(--md-sys-color-on-success);
  --color-success-container: var(--md-sys-color-success-container);
  --color-on-success-container: var(--md-sys-color-on-success-container);
  --color-warning: var(--md-sys-color-warning);
  --color-on-warning: var(--md-sys-color-on-warning);
  --color-warning-container: var(--md-sys-color-warning-container);
  --color-on-warning-container: var(--md-sys-color-on-warning-container);
  --color-surface: var(--md-sys-color-surface);
  --color-on-surface: var(--md-sys-color-on-surface);
  --color-on-surface-variant: var(--md-sys-color-on-surface-variant);
  --color-surface-variant: var(--md-sys-color-surface-variant);
  --color-outline: var(--md-sys-color-outline);
  --color-outline-variant: var(--md-sys-color-outline-variant);

  /* MD3 type scale (only the roles actually used in the mockups, per the
     guideline §2 "Roles used" list) as Tailwind text-size utilities:
     text-title-large, text-title-medium, text-label-large, text-body-medium,
     text-body-small, text-headline-small. Each pairs font-size with the
     matching line-height/weight/tracking automatically. */
  --text-title-large: 22px;
  --text-title-large--line-height: 28px;
  --text-title-large--font-weight: 400;

  --text-title-medium: 16px;
  --text-title-medium--line-height: 24px;
  --text-title-medium--font-weight: 500;
  --text-title-medium--letter-spacing: 0.15px;

  --text-label-large: 14px;
  --text-label-large--line-height: 20px;
  --text-label-large--font-weight: 500;
  --text-label-large--letter-spacing: 0.1px;

  --text-body-medium: 14px;
  --text-body-medium--line-height: 20px;
  --text-body-medium--font-weight: 400;
  --text-body-medium--letter-spacing: 0.25px;

  --text-body-small: 12px;
  --text-body-small--line-height: 16px;
  --text-body-small--font-weight: 400;
  --text-body-small--letter-spacing: 0.4px;

  --text-headline-small: 24px;
  --text-headline-small--line-height: 32px;
  --text-headline-small--font-weight: 400;
}

body {
  background: var(--color-background);
  color: var(--color-foreground);
  font-family: var(--font-sans), -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
}
```

- [ ] **Step 2: Verify the build compiles with the new theme**

Run: `npm run build`
Expected: PASS. The app still looks and renders exactly as before (Geist font, same layout) — this task only adds new, unused-so-far color/type-scale tokens; nothing consumes them yet.

- [ ] **Step 3: Run the existing test suite (regression guard)**

Run: `npm test`
Expected: PASS, unchanged (no `src/lib` or `scripts/ingest` files touched).

- [ ] **Step 4: Commit**

```bash
git add src/app/globals.css
git commit -m "feat(design): wire MD3 color and type-scale tokens into Tailwind theme"
```

---

## Task 2: Swap app font to Roboto

**Files:**
- Modify: `src/app/layout.tsx`
- Modify: `src/app/globals.css:38` (the `--font-sans` line in `@theme inline`, added in Task 1)

**Interfaces:**
- Consumes: the `@theme inline` block from Task 1.
- Produces: `--font-roboto` CSS variable on `<body>`, consumed by `--font-sans` in `globals.css`.

- [ ] **Step 1: Replace the font import and usage**

```tsx
import type { Metadata, Viewport } from "next";
import { Roboto, Geist_Mono } from "next/font/google";
import "./globals.css";

const roboto = Roboto({
  variable: "--font-roboto",
  weight: ["400", "500", "700"],
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// UI is light-only (no dark: Tailwind variants anywhere) — declare it so an
// OS/browser dark theme doesn't auto-invert colors and break contrast.
export const viewport: Viewport = {
  colorScheme: "light",
};

// Generic default; overridden per-request in app/page metadata once URL state is read (REQ-18).
export const metadata: Metadata = {
  title: "Krankenkassenvergleich – Grundversicherung Schweiz",
  description:
    "Vergleiche Krankenkassenprämien für die Grundversicherung – alle Kassen, alle Modelle, offizielle BAG-Daten.",
  openGraph: {
    title: "Krankenkassenvergleich – Grundversicherung Schweiz",
    description:
      "Vergleiche Krankenkassenprämien für die Grundversicherung – alle Kassen, alle Modelle, offizielle BAG-Daten.",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Krankenkassenvergleich – Grundversicherung Schweiz",
    description: "Vergleiche Krankenkassenprämien für die Grundversicherung – offizielle BAG-Daten.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de">
      <body
        className={`${roboto.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Flip `--font-sans` in `globals.css` to the new variable**

In `src/app/globals.css`, in the `@theme inline` block added by Task 1, change:

```css
  --font-sans: var(--font-geist-sans); /* becomes var(--font-roboto) in Task 2 */
```

to:

```css
  --font-sans: var(--font-roboto);
```

- [ ] **Step 3: Verify the build compiles and the font applies**

Run: `npm run build`
Expected: PASS. Start `npm run dev` and confirm in the browser (devtools → computed `font-family` on `<body>`) that Roboto is now active.

- [ ] **Step 4: Run the existing test suite (regression guard)**

Run: `npm test`
Expected: PASS, unchanged.

- [ ] **Step 5: Commit**

```bash
git add src/app/layout.tsx src/app/globals.css
git commit -m "feat(design): switch app font from Geist to Roboto"
```

---

## Task 3: Restyle the three input fields (PlzInput, BirthYearInput, DeductibleSelect)

**Files:**
- Modify: `src/components/inputs/PlzInput.tsx`
- Modify: `src/components/inputs/BirthYearInput.tsx`
- Modify: `src/components/inputs/DeductibleSelect.tsx`

**Interfaces:**
- Consumes: Tailwind utilities from Task 1 (`text-label-large`, `text-body-small`, `bg-primary`... wait, no `bg-primary` here — consumes `border-outline-variant`, `border-error`, `text-on-surface-variant`, `text-error`, `focus:border-primary`, `focus-visible:ring-primary-container`, `bg-surface-variant`, `text-outline`).
- Produces: no new exports; same component signatures as before (`PlzInput({value, onChange, notFound})`, `BirthYearInput({value, onChange, calendarYear})`, `DeductibleSelect({altersklasse, value, onChange})`).

- [ ] **Step 1: Replace `PlzInput.tsx`**

```tsx
"use client";

import { validatePlz } from "@/lib/validate";

type Props = {
  value: string;
  onChange: (value: string) => void;
  /** True when the PLZ has valid format but doesn't resolve to any known Gemeinde (REQ-13). */
  notFound?: boolean;
};

export function PlzInput({ value, onChange, notFound }: Props) {
  const formatResult = value ? validatePlz(value) : { valid: true as const };
  const result =
    formatResult.valid && notFound
      ? { valid: false as const, message: "PLZ nicht gefunden — bitte überprüfen." }
      : formatResult;

  return (
    <div>
      <label htmlFor="plz" className="block text-label-large text-on-surface-variant mb-1.5">
        Postleitzahl (PLZ)
      </label>
      <input
        id="plz"
        type="text"
        inputMode="numeric"
        maxLength={4}
        placeholder="z.B. 3001"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-describedby="plz-hint"
        aria-invalid={!result.valid}
        className={`w-full h-10 px-3 rounded-md border text-[15px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary-container ${
          result.valid ? "border-outline-variant focus:border-primary" : "border-error focus:border-error"
        }`}
      />
      {!result.valid && (
        <p id="plz-hint" className="text-body-small text-error mt-1">
          {result.message}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Replace `BirthYearInput.tsx`**

```tsx
"use client";

import { validateBirthYear } from "@/lib/validate";
import { getAltersklasse, getFranchiseTiers } from "@/lib/ageband";
import { ALTERSKLASSE_LABELS } from "@/lib/copy";

type Props = {
  value: string;
  onChange: (value: string) => void;
  calendarYear: number;
};

export function BirthYearInput({ value, onChange, calendarYear }: Props) {
  const parsed = value ? Number(value) : null;
  const result = parsed != null ? validateBirthYear(parsed) : { valid: true as const };
  const altersklasse = parsed != null && result.valid ? getAltersklasse(parsed, calendarYear) : null;
  const tiers = altersklasse ? getFranchiseTiers(altersklasse) : null;

  return (
    <div>
      <label htmlFor="by" className="block text-label-large text-on-surface-variant mb-1.5">
        Jahrgang
      </label>
      <input
        id="by"
        type="number"
        placeholder="z.B. 1985"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-describedby="by-hint"
        aria-invalid={!result.valid}
        className={`w-full h-10 px-3 rounded-md border text-[15px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary-container ${
          result.valid ? "border-outline-variant focus:border-primary" : "border-error focus:border-error"
        }`}
      />
      <p id="by-hint" className={`text-body-small mt-1 ${result.valid ? "text-outline" : "text-error"}`}>
        {!result.valid
          ? result.message
          : altersklasse && tiers
            ? `→ ${ALTERSKLASSE_LABELS[altersklasse]}, Franchise CHF ${tiers[0]}–${tiers[tiers.length - 1]}`
            : "Bestimmt Altersklasse und verfügbare Franchise-Stufen"}
      </p>
    </div>
  );
}
```

- [ ] **Step 3: Replace `DeductibleSelect.tsx`**

```tsx
"use client";

import type { Altersklasse } from "@/lib/types";
import { getFranchiseTiers } from "@/lib/ageband";

type Props = {
  altersklasse: Altersklasse | null;
  value: number | null;
  onChange: (value: number) => void;
};

export function DeductibleSelect({ altersklasse, value, onChange }: Props) {
  const tiers = altersklasse ? getFranchiseTiers(altersklasse) : [];

  return (
    <div>
      <label htmlFor="fran" className="block text-label-large text-on-surface-variant mb-1.5">
        Franchise
      </label>
      <select
        id="fran"
        value={value ?? ""}
        disabled={!altersklasse}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-10 px-3 rounded-md border border-outline-variant text-[15px] bg-surface outline-none focus:border-primary focus-visible:ring-2 focus-visible:ring-primary-container disabled:bg-surface-variant disabled:text-outline"
      >
        <option value="" disabled>
          {altersklasse ? "Wählen…" : "Erst Jahrgang eingeben"}
        </option>
        {tiers.map((tier) => (
          <option key={tier} value={tier}>
            CHF {tier}
          </option>
        ))}
      </select>
    </div>
  );
}
```

- [ ] **Step 4: Confirm no old palette classes remain**

Run: `grep -nE "gray-|blue-|red-" src/components/inputs/PlzInput.tsx src/components/inputs/BirthYearInput.tsx src/components/inputs/DeductibleSelect.tsx`
Expected: no output.

- [ ] **Step 5: Run the existing test suite (regression guard)**

Run: `npm test`
Expected: PASS, unchanged.

- [ ] **Step 6: Commit**

```bash
git add src/components/inputs/PlzInput.tsx src/components/inputs/BirthYearInput.tsx src/components/inputs/DeductibleSelect.tsx
git commit -m "feat(design): restyle input fields with MD3 tokens"
```

---

## Task 4: Restyle the `InsuranceComparator` shell (card, heading, gemeinde picker, loading/error notices, footer)

**Files:**
- Modify: `src/components/InsuranceComparator.tsx:214-260` (input card JSX) and `:262-321` (loading/error/footer JSX)

**Interfaces:**
- Consumes: Tailwind utilities from Task 1; `PlzInput`/`BirthYearInput`/`DeductibleSelect` from Task 3 (props unchanged).
- Produces: no signature changes — `InsuranceComparator()` still takes no props.

- [ ] **Step 1: Replace the returned JSX (lines 214–323) with the MD3-styled version**

```tsx
  return (
    <main className="max-w-[860px] mx-auto my-8 px-4">
      <div className="bg-surface border border-outline-variant rounded-lg shadow-sm p-6">
        <h1 className="text-title-large text-on-surface mb-1">Prämienvergleich</h1>
        <p className="text-body-medium text-on-surface-variant mb-5">
          Gib deine Angaben ein — die günstigsten Kassen erscheinen sofort.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <PlzInput value={plz} onChange={handlePlzChange} notFound={plzNotFound} />
          <BirthYearInput value={birthYear} onChange={setBirthYear} calendarYear={year} />
          <DeductibleSelect altersklasse={altersklasse} value={franchise} onChange={setFranchise} />
        </div>

        {ambiguous && (
          <div className="mt-3 bg-primary-container border border-primary-container rounded-md p-3.5">
            <p className="text-sm text-on-surface-variant mb-2">
              PLZ {plz} liegt in mehreren Prämienregionen. Bitte wähle deine Gemeinde:
            </p>
            <div className="flex gap-2 flex-wrap">
              {gemeinden.map((g) => (
                <button
                  key={g.bfsNr}
                  type="button"
                  onClick={() => handleGemeindeSelect(g.bfsNr)}
                  className={`px-3 py-1 rounded-full border text-sm ${
                    bfsNr === g.bfsNr
                      ? "bg-primary border-primary text-on-primary font-semibold"
                      : "border-primary-container text-on-surface-variant bg-surface"
                  }`}
                >
                  {g.name} ({g.praemienregionId})
                </button>
              ))}
            </div>
          </div>
        )}
        {!ambiguous && resolvedGemeinde && (
          <p className="text-xs text-primary mt-2">&#10003; Gemeinde: {resolvedGemeinde.name}</p>
        )}

        <CurrentPlanSection
          insurers={INSURERS}
          franchiseTiers={franchiseTiers.length ? franchiseTiers : [300, 500, 1000, 1500, 2000, 2500]}
          value={currentPlan}
          onChange={setCurrentPlan}
          productOptions={currentPlanProductOptions}
        />
      </div>

      {premiumsLoading && !results && (
        <p className="text-sm text-on-surface-variant mt-4" role="status">
          Prämiendaten werden geladen…
        </p>
      )}

      {premiumsError && !premiumsLoading && !results && (
        <div className="mt-4 bg-error-container border border-error-container rounded-md p-3.5" role="alert">
          <p className="text-sm text-on-error-container mb-2">
            Prämiendaten konnten nicht geladen werden. Bitte versuche es erneut.
          </p>
          <button
            type="button"
            onClick={() => {
              setPremiumsError(false);
              setPremiumsByYear((prev) => {
                const next = { ...prev };
                delete next[year];
                return next;
              });
            }}
            className="px-3 py-1.5 rounded-md border border-error text-sm text-error bg-surface hover:bg-error-container"
          >
            Erneut versuchen
          </button>
        </div>
      )}

      {results && (
        <div aria-live="polite">
          <Headline headline={results.headline} year={year} />

          <FilterBar
            year={year}
            availableYears={metadata.availableYears}
            onYearChange={setYear}
            altModelsActive={altModelsActive}
            onToggleAltModels={() => setAltModelsActive((v) => !v)}
            unfalldeckung={unfalldeckung}
            onToggleUnfalldeckung={() => setUnfalldeckung((v) => !v)}
          />

          <p className="text-sm text-on-surface-variant mt-4 mb-2">
            {results.plans.length} Kassen · {altModelsActive ? "günstiges Modell je Kasse" : "günstigstes Standard-Angebot je Kasse"} ·{" "}
            Unfalldeckung {unfalldeckung ? "eingeschlossen" : "ausgeschlossen"} · {year}
          </p>

          {results.plans.length > 0 ? (
            <PlanList plans={results.plans} currentInsurerCode={currentPlan.insurerCode ?? null} />
          ) : (
            <EmptyState message="Für die aktuelle Kombination sind keine Prämien in den BAG-Daten vorhanden. Bitte überprüfe deine Eingaben oder passe die Filter an." />
          )}
        </div>
      )}

      <p className="text-body-small text-outline text-center mt-6 pb-10">
        Daten: BAG Opendata · Publikation{" "}
        {new Date(metadata.publicationDate).toLocaleDateString("de-CH", { day: "numeric", month: "long", year: "numeric" })} ·
        Nur Pflichtleistungen (OKP) · Kein Sponsoring, keine Vermittlungslinks
      </p>
    </main>
  );
}
```

- [ ] **Step 2: Confirm no old palette classes remain**

Run: `grep -nE "gray-|blue-|red-" src/components/InsuranceComparator.tsx`
Expected: no output.

- [ ] **Step 3: Run the existing test suite (regression guard)**

Run: `npm test`
Expected: PASS, unchanged.

- [ ] **Step 4: Commit**

```bash
git add src/components/InsuranceComparator.tsx
git commit -m "feat(design): restyle InsuranceComparator shell with MD3 tokens"
```

---

## Task 5: Restyle `CurrentPlanSection`

**Files:**
- Modify: `src/components/current-plan/CurrentPlanSection.tsx`

**Interfaces:**
- Consumes: Tailwind utilities from Task 1.
- Produces: no signature change — same `CurrentPlanSection` props as before.

- [ ] **Step 1: Replace `CurrentPlanSection.tsx`**

```tsx
"use client";

import type { CurrentPlan } from "@/lib/types";
import type { Tarifart } from "@/lib/types";

type Insurer = { insurerCode: string; insurerName: string };

type ProductOption = { tarifCode: string; productName: string };

type Props = {
  insurers: Insurer[];
  franchiseTiers: number[];
  value: Partial<CurrentPlan>;
  onChange: (value: Partial<CurrentPlan>) => void;
  productOptions: ProductOption[] | null;
};

const MODELS: Tarifart[] = ["standard", "hausarzt", "telmed", "hmo", "andere"];

export function CurrentPlanSection({ insurers, franchiseTiers, value, onChange, productOptions }: Props) {
  return (
    <details className="mt-5 pt-4 border-t border-surface-variant">
      <summary className="flex items-center gap-2 cursor-pointer select-none text-title-medium text-primary list-none [&::-webkit-details-marker]:hidden before:content-['▸'] before:text-xs [details[open]_&]:before:content-['▾']">
        Was zahlst du heute?{" "}
        <span className="font-normal text-on-surface-variant">&nbsp;(optional — zeigt deine Ersparnis)</span>
      </summary>
      <div className="mt-3.5 grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <label htmlFor="current-insurer" className="block text-label-large text-on-surface-variant mb-1.5">
            Aktuelle Kasse
          </label>
          <select
            id="current-insurer"
            value={value.insurerCode ?? ""}
            onChange={(e) => onChange({ ...value, insurerCode: e.target.value, tarifCode: undefined })}
            className="w-full h-10 px-3 rounded-md border border-outline-variant text-[15px] bg-surface outline-none focus:border-primary"
          >
            <option value="">–</option>
            {insurers.map((i) => (
              <option key={i.insurerCode} value={i.insurerCode}>
                {i.insurerName}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="current-franchise" className="block text-label-large text-on-surface-variant mb-1.5">
            Aktuelle Franchise
          </label>
          <select
            id="current-franchise"
            value={value.franchise ?? ""}
            onChange={(e) => onChange({ ...value, franchise: Number(e.target.value), tarifCode: undefined })}
            className="w-full h-10 px-3 rounded-md border border-outline-variant text-[15px] bg-surface outline-none focus:border-primary"
          >
            <option value="">–</option>
            {franchiseTiers.map((t) => (
              <option key={t} value={t}>
                CHF {t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="current-model" className="block text-label-large text-on-surface-variant mb-1.5">
            Aktuelles Modell
          </label>
          <select
            id="current-model"
            value={value.tarifart ?? ""}
            onChange={(e) => onChange({ ...value, tarifart: e.target.value as Tarifart, tarifCode: undefined })}
            className="w-full h-10 px-3 rounded-md border border-outline-variant text-[15px] bg-surface outline-none focus:border-primary"
          >
            <option value="">–</option>
            {MODELS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="current-accident" className="block text-label-large text-on-surface-variant mb-1.5">
            Unfalldeckung
          </label>
          <select
            id="current-accident"
            value={value.unfalldeckung == null ? "" : value.unfalldeckung ? "1" : "0"}
            onChange={(e) => onChange({ ...value, unfalldeckung: e.target.value === "1", tarifCode: undefined })}
            className="w-full h-10 px-3 rounded-md border border-outline-variant text-[15px] bg-surface outline-none focus:border-primary"
          >
            <option value="">–</option>
            <option value="1">Eingeschlossen</option>
            <option value="0">Ausgeschlossen</option>
          </select>
        </div>
      </div>
      {productOptions && productOptions.length > 1 && (
        <div className="mt-3">
          <label htmlFor="current-product" className="block text-label-large text-on-surface-variant mb-1.5">
            Genaues Produkt
          </label>
          <select
            id="current-product"
            value={value.tarifCode ?? ""}
            onChange={(e) => onChange({ ...value, tarifCode: e.target.value || undefined })}
            className="w-full h-10 px-3 rounded-md border border-outline-variant text-[15px] bg-surface outline-none focus:border-primary"
          >
            <option value="">– bitte wählen –</option>
            {productOptions.map((p) => (
              <option key={p.tarifCode} value={p.tarifCode}>
                {p.productName}
              </option>
            ))}
          </select>
          <p className="text-body-small text-on-surface-variant mt-1">
            Deine Kasse bietet mehrere Produkte zu diesem Modell/dieser Franchise an — wähle dein genaues Produkt für eine korrekte Ersparnis-Berechnung.
          </p>
        </div>
      )}
    </details>
  );
}
```

- [ ] **Step 2: Confirm no old palette classes remain**

Run: `grep -nE "gray-|blue-|red-" src/components/current-plan/CurrentPlanSection.tsx`
Expected: no output.

- [ ] **Step 3: Run the existing test suite (regression guard)**

Run: `npm test`
Expected: PASS, unchanged.

- [ ] **Step 4: Commit**

```bash
git add src/components/current-plan/CurrentPlanSection.tsx
git commit -m "feat(design): restyle CurrentPlanSection with MD3 tokens"
```

---

## Task 6: Restyle `Headline` (all four states)

**Files:**
- Modify: `src/components/results/Headline.tsx`

**Interfaces:**
- Consumes: Tailwind utilities from Task 1; `HeadlineState`/`PremiumRow` types and `formatChf` unchanged.
- Produces: no signature change — same `Headline({headline, year})` and internal `CheapestOnly` helper.

- [ ] **Step 1: Replace `Headline.tsx`**

```tsx
import type { HeadlineState, PremiumRow } from "@/lib/types";
import { formatChf } from "@/lib/format";

type Props = {
  headline: HeadlineState;
  year: number;
};

export function Headline({ headline, year }: Props) {
  if (headline.kind === "savings") {
    return (
      <div role="status" className="mt-6 rounded-lg p-5 flex gap-3.5 bg-success-container border border-success-container">
        <span className="text-xl" aria-hidden>💡</span>
        <p className="text-sm text-on-success-container">
          <strong className="block text-base font-bold text-on-surface mb-0.5">
            Wenn du nichts tust: {formatChf(headline.current.monthlyPremium)}/Monat {year} bei{" "}
            {headline.current.insurerName}.
          </strong>
          Günstigstes Angebot für dein Profil: {formatChf(headline.cheapest.monthlyPremium)}/Monat bei{" "}
          {headline.cheapest.insurerName} —{" "}
          <span className="text-success font-bold">
            spare {formatChf(headline.savingsPerYear)}/Jahr durch einen Wechsel.
          </span>
        </p>
      </div>
    );
  }

  if (headline.kind === "already-cheapest") {
    return (
      <div role="status" className="mt-6 rounded-lg p-5 flex gap-3.5 bg-success-container border border-success-container">
        <span className="text-xl" aria-hidden>✅</span>
        <p className="text-sm text-on-success-container">
          <strong className="block text-base font-bold text-on-surface mb-0.5">
            Du hast bereits das günstigste Angebot für dein Profil.
          </strong>
          {headline.current.insurerName} · {formatChf(headline.current.monthlyPremium)}/Monat {year}.
        </p>
      </div>
    );
  }

  if (headline.kind === "current-plan-not-found") {
    return (
      <>
        <div className="rounded-lg p-3 text-sm text-on-warning-container bg-warning-container border border-warning-container mb-2">
          <strong>Aktuelle Kasse nicht gefunden.</strong> Der angegebene Plan wurde in den BAG-Daten für
          deine Region nicht gefunden. Das günstigste verfügbare Angebot wird angezeigt.
        </div>
        {headline.cheapest && <CheapestOnly cheapest={headline.cheapest} />}
      </>
    );
  }

  return headline.cheapest ? <CheapestOnly cheapest={headline.cheapest} /> : null;
}

function CheapestOnly({ cheapest }: { cheapest: PremiumRow }) {
  return (
    <div role="status" className="mt-6 rounded-lg p-5 flex gap-3.5 bg-primary-container border border-primary-container">
      <span className="text-xl" aria-hidden>🔍</span>
      <p className="text-sm text-on-primary-container">
        <strong className="block text-base font-bold text-on-surface mb-0.5">
          Günstigstes Angebot: {formatChf(cheapest.monthlyPremium)}/Monat bei {cheapest.insurerName}.
        </strong>
        Gib deine aktuelle Kasse an, um zu sehen, wie viel du sparen könntest. ↓
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Confirm no old palette classes remain**

Run: `grep -nE "green-|blue-|amber-|gray-" src/components/results/Headline.tsx`
Expected: no output.

- [ ] **Step 3: Run the existing test suite (regression guard)**

Run: `npm test`
Expected: PASS, unchanged.

- [ ] **Step 4: Commit**

```bash
git add src/components/results/Headline.tsx
git commit -m "feat(design): restyle Headline states with MD3 tokens"
```

---

## Task 7: Restyle `FilterBar`

**Files:**
- Modify: `src/components/results/FilterBar.tsx`

**Interfaces:**
- Consumes: Tailwind utilities from Task 1.
- Produces: no signature change — same `FilterBar` props as before.

- [ ] **Step 1: Replace `FilterBar.tsx`**

```tsx
"use client";

type Props = {
  year: number;
  availableYears: number[];
  onYearChange: (year: number) => void;
  altModelsActive: boolean;
  onToggleAltModels: () => void;
  unfalldeckung: boolean;
  onToggleUnfalldeckung: () => void;
};

export function FilterBar({
  year,
  availableYears,
  onYearChange,
  altModelsActive,
  onToggleAltModels,
  unfalldeckung,
  onToggleUnfalldeckung,
}: Props) {
  return (
    <div className="mt-4 flex items-center gap-2 flex-wrap">
      <span className="text-sm text-on-surface-variant mr-1">Jahr:</span>
      <div className="flex rounded-md border border-outline-variant overflow-hidden">
        {availableYears.map((y, i) => (
          <button
            key={y}
            type="button"
            onClick={() => onYearChange(y)}
            aria-pressed={year === y}
            className={`px-3.5 py-1.5 text-sm ${i > 0 ? "border-l border-outline-variant" : ""} ${
              year === y ? "bg-primary text-on-primary font-semibold" : "bg-surface text-on-surface-variant"
            }`}
          >
            {y}
          </button>
        ))}
      </div>
      <div className="w-px h-6 bg-outline-variant mx-1" />
      <button
        type="button"
        role="button"
        aria-pressed={altModelsActive}
        onClick={onToggleAltModels}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm ${
          altModelsActive ? "bg-primary-container border-primary-container text-primary font-semibold" : "border-outline-variant text-on-surface-variant"
        }`}
      >
        <span className={`w-2 h-2 rounded-full ${altModelsActive ? "bg-primary" : "bg-outline"}`} />
        Alternative Modelle: {altModelsActive ? "ein" : "aus"}
      </button>
      <button
        type="button"
        role="button"
        aria-pressed={unfalldeckung}
        onClick={onToggleUnfalldeckung}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm ${
          unfalldeckung ? "bg-primary-container border-primary-container text-primary font-semibold" : "border-outline-variant text-on-surface-variant"
        }`}
      >
        <span className={`w-2 h-2 rounded-full ${unfalldeckung ? "bg-primary" : "bg-outline"}`} />
        Unfall: {unfalldeckung ? "eingeschlossen" : "ausgeschlossen"}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Confirm no old palette classes remain**

Run: `grep -nE "gray-|blue-" src/components/results/FilterBar.tsx`
Expected: no output.

- [ ] **Step 3: Run the existing test suite (regression guard)**

Run: `npm test`
Expected: PASS, unchanged.

- [ ] **Step 4: Commit**

```bash
git add src/components/results/FilterBar.tsx
git commit -m "feat(design): restyle FilterBar with MD3 tokens"
```

---

## Task 8: Restyle `PlanRow` (per-model tag colors, current-plan highlight, price) and `PlanList`

**Files:**
- Modify: `src/components/results/PlanRow.tsx`
- Modify: `src/components/results/PlanList.tsx`

**Interfaces:**
- Consumes: Tailwind utilities from Task 1; `TARIFART_LABELS`/`TARIFART_DESCRIPTIONS` from `@/lib/copy` (keys: `standard`, `hausarzt`, `telmed`, `hmo`, `andere` — confirmed in `src/lib/copy.ts`), `formatChf` unchanged.
- Produces: no signature change — same `PlanRow`/`PlanList` props as before.

- [ ] **Step 1: Replace `PlanRow.tsx`**

```tsx
import type { PremiumRow } from "@/lib/types";
import { TARIFART_LABELS, TARIFART_DESCRIPTIONS } from "@/lib/copy";
import { formatChf } from "@/lib/format";

type Props = {
  plan: PremiumRow;
  rank: number;
  isCheapest: boolean;
  isCurrentPlan: boolean;
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

export function PlanRow({ plan, rank, isCheapest, isCurrentPlan, previousYearPremium }: Props) {
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
        <div className="text-xs text-on-surface-variant mt-0.5">
          <span
            className={`inline-block px-1.5 py-px rounded text-[11px] font-semibold mr-1 ${
              MODEL_TAG_CLASSES[plan.tarifart] ?? DEFAULT_MODEL_TAG_CLASSES
            }`}
          >
            {TARIFART_LABELS[plan.tarifart]}
          </span>
          · {TARIFART_DESCRIPTIONS[plan.tarifart]}
        </div>
      </div>
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

- [ ] **Step 2: Leave `PlanList.tsx` as-is (no palette classes present)**

`src/components/results/PlanList.tsx` only uses `flex flex-col gap-1.5` — no old-palette classes to replace. Confirm:

Run: `grep -nE "gray-|blue-|red-|green-" src/components/results/PlanList.tsx`
Expected: no output (no change needed).

- [ ] **Step 3: Confirm no old palette classes remain in PlanRow**

Run: `grep -nE "gray-|blue-|red-|green-|amber-|violet-|emerald-" src/components/results/PlanRow.tsx`
Expected: no output.

- [ ] **Step 4: Run the existing test suite (regression guard)**

Run: `npm test`
Expected: PASS, unchanged.

- [ ] **Step 5: Commit**

```bash
git add src/components/results/PlanRow.tsx
git commit -m "feat(design): restyle PlanRow with per-model MD3 tag colors"
```

---

## Task 9: Restyle `EmptyState`

**Files:**
- Modify: `src/components/results/EmptyState.tsx`

**Interfaces:**
- Consumes: Tailwind utilities from Task 1.
- Produces: no signature change — same `EmptyState({message})` props.

- [ ] **Step 1: Replace `EmptyState.tsx`**

```tsx
type Props = {
  message: string;
};

export function EmptyState({ message }: Props) {
  return (
    <div className="rounded-lg border border-outline-variant bg-surface p-10 text-center text-on-surface-variant">
      <p className="text-[15px] mb-1.5">Keine Angebote gefunden</p>
      <p className="text-body-small text-outline">{message}</p>
    </div>
  );
}
```

- [ ] **Step 2: Confirm no old palette classes remain**

Run: `grep -nE "gray-" src/components/results/EmptyState.tsx`
Expected: no output.

- [ ] **Step 3: Run the existing test suite (regression guard)**

Run: `npm test`
Expected: PASS, unchanged.

- [ ] **Step 4: Commit**

```bash
git add src/components/results/EmptyState.tsx
git commit -m "feat(design): restyle EmptyState with MD3 tokens"
```

---

## Task 10: Restyle admin login form, range-picker, and stat panel

**Files:**
- Modify: `src/app/admin/page.tsx`
- Modify: `src/app/admin/login/page.tsx`

**Interfaces:**
- Consumes: Tailwind utilities from Task 1.
- Produces: no signature change — same page components/behavior (fetch, presets, form action).

- [ ] **Step 1: Replace `src/app/admin/page.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";

type Stats = {
  total: number;
  granularity: string;
  trend: { bucket: string; n: number }[];
  topRegions: { regionId: string; n: number }[];
  altersklasse: { altersklasse: string; n: number }[];
  franchise: { franchise: number; n: number }[];
  models: { model: string; n: number }[];
  accident: { accident: boolean; n: number }[];
};

const PRESETS = [
  { label: "Heute", days: 1 },
  { label: "7 Tage", days: 7 },
  { label: "30 Tage", days: 30 },
  { label: "3 Monate", days: 90 },
  { label: "Dieses Jahr", days: 365 },
];

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default function AdminDashboard() {
  const [days, setDays] = useState(30);
  const [stats, setStats] = useState<Stats | null>(null);

  const to = new Date();
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);

  useEffect(() => {
    const params = new URLSearchParams({ from: isoDate(from), to: isoDate(to) });
    fetch(`/api/admin/stats?${params}`)
      .then((r) => r.json())
      .then(setStats)
      .catch(() => setStats(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days]);

  return (
    <main className="max-w-[1100px] mx-auto my-7 px-5">
      <h1 className="sr-only">Admin-Dashboard — Anfrage-Aktivität</h1>

      <div className="bg-surface border border-outline-variant rounded-lg shadow-sm p-3 flex items-center gap-2 flex-wrap mb-5">
        <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide mr-1">Zeitraum</span>
        {PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            aria-pressed={days === p.days}
            onClick={() => setDays(p.days)}
            className={`px-3 py-1.5 rounded-full border text-sm ${
              days === p.days ? "bg-primary border-primary text-on-primary font-semibold" : "border-outline-variant text-on-surface-variant"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="bg-surface border border-outline-variant rounded-lg shadow-sm p-5 inline-block mb-5 min-w-[220px]">
        <div className="text-xs font-semibold text-outline uppercase tracking-wide">Anfragen im Zeitraum</div>
        <div className="text-4xl font-bold tracking-tight my-1 text-on-surface">{stats?.total ?? "–"}</div>
        <div className="text-xs text-outline">
          {isoDate(from)} – {isoDate(to)}
        </div>
      </div>

      <p className="text-sm text-outline">
        Weitere Panels (Trend-Chart, Top-Regionen, Altersklasse, Franchise, Modell, Unfalldeckung) folgen, sobald{" "}
        <code className="text-xs bg-surface-variant text-on-surface-variant px-1 py-0.5 rounded">POSTGRES_URL</code> konfiguriert und die
        Aggregations-Queries aus architecture.md §13.2 angebunden sind.
      </p>
    </main>
  );
}
```

- [ ] **Step 2: Replace `src/app/admin/login/page.tsx`**

```tsx
// /admin/login — single password field compared against ADMIN_SECRET (REQ-22).
// No user table, no JWT — one env variable, one HttpOnly cookie.

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { timingSafeEqual } from "node:crypto";

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

async function login(formData: FormData) {
  "use server";
  const password = formData.get("password");
  const secret = process.env.ADMIN_SECRET;

  if (typeof password === "string" && secret && safeEqual(password, secret)) {
    const cookieStore = await cookies();
    cookieStore.set("admin_token", secret, {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      path: "/",
    });
    redirect("/admin");
  }
  redirect("/admin/login?error=1");
}

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="min-h-screen flex items-center justify-center bg-surface-variant">
      <form action={login} className="bg-surface border border-outline-variant rounded-lg shadow-sm p-8 w-full max-w-sm">
        <h1 className="text-title-large text-on-surface mb-4">Admin-Login</h1>
        <label htmlFor="password" className="block text-label-large text-on-surface-variant mb-1.5">
          Passwort
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          className="w-full h-10 px-3 rounded-md border border-outline-variant text-[15px] outline-none focus:border-primary mb-3"
        />
        {error && <p className="text-sm text-error mb-3">Falsches Passwort.</p>}
        <button type="submit" className="w-full h-10 rounded-md bg-primary text-on-primary font-semibold">
          Anmelden
        </button>
      </form>
    </main>
  );
}
```

- [ ] **Step 3: Confirm no old palette classes remain**

Run: `grep -nE "gray-|blue-|red-" src/app/admin/page.tsx src/app/admin/login/page.tsx`
Expected: no output.

- [ ] **Step 4: Run the existing test suite (regression guard)**

Run: `npm test`
Expected: PASS, unchanged.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/page.tsx src/app/admin/login/page.tsx
git commit -m "feat(design): restyle admin dashboard and login page with MD3 tokens"
```

---

## Task 11: Full-app grep sweep, build, and manual visual QA

**Files:** none (verification-only task, no source changes expected)

**Interfaces:** none.

- [ ] **Step 1: Repo-wide sweep for any remaining old-palette class in `src/`**

Run: `grep -rnE "text-gray-|bg-gray-|border-gray-|bg-blue-|text-blue-|border-blue-|bg-red-|text-red-|border-red-|bg-green-|text-green-|border-green-|bg-amber-|text-amber-|bg-violet-|text-violet-|bg-emerald-|text-emerald-" src/`
Expected: no output. If anything remains, fix it in the relevant file and re-run this grep before continuing (each fix is small enough to fold into this step — no separate task needed).

- [ ] **Step 2: Full test suite + production build**

Run: `npm test && npm run build`
Expected: both PASS.

- [ ] **Step 3: Manual visual QA against the mockups**

Run: `npm run dev`, then in a browser visit `http://localhost:3000` and manually walk this checklist, comparing each state against the corresponding block in `mockups/main.html`:

- PLZ 8044 → gemeinde picker renders as pill buttons in `primary-container` styling, matching the mockup's disambiguator.
- Enter a full valid profile (e.g. PLZ 3001, birth year 1988, franchise 500) with no current plan → "cheapest" headline (blue/primary-container, 🔍 icon).
- Add a current plan that's more expensive than the cheapest match → "savings" headline (green/success-container, 💡 icon).
- Add a current plan that already is the cheapest match → "already-cheapest" headline (green/success-container, ✅ icon).
- Enter a current plan combination absent from the data → amber "not found" notice (`warning-container`) above the fallback cheapest headline.
- Toggle "Alternative Modelle" on → HMO/Telmed/Hausarzt tags render in their distinct colors (amber/purple-pink/green containers respectively) instead of one flat gray tag.
- Trigger the empty state (e.g. an unrealistic combination with no matches) → centered empty-state card matches the mockup's styling.
- Confirm page font renders as Roboto (check via browser devtools computed styles on `body`).

Then visit `http://localhost:3000/admin/login` and `http://localhost:3000/admin` (after logging in with `ADMIN_SECRET`, or by inspecting the login form alone if no secret is configured locally) and compare the login form, range-picker, and stat-panel styling against the corresponding elements in `mockups/admin.html` (its `<nav>` bar has no live-app counterpart yet, so skip that part of the comparison).

Expected: every state visually matches its mockup counterpart's colors and typography. Note any mismatch found, fix it in the owning component's file (from the relevant earlier task), and re-run `npm test` before re-checking.

- [ ] **Step 4: Final commit (only if Step 3 required fixes)**

```bash
git add -A
git commit -m "fix(design): address visual QA findings against MD3 mockups"
```

If Step 3 found no issues, skip this step — there's nothing to commit.
