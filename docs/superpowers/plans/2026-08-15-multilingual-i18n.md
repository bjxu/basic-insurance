# Multilingual Support (DE/FR/IT/EN) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Serve the comparator in German (existing default), French, Italian, and English, each on its own crawlable, hreflang-linked URL, with a switcher to move between them.

**Architecture:** `next-intl` handles locale-prefixed routing (`/de`, `/fr`, `/it`, `/en`), middleware-based locale negotiation, and message-file-driven translations. Existing comparator routes move under `src/app/[locale]/...`; `/admin` and `/api/**` stay outside that segment, unprefixed and German-only, using their own root layout (Next.js "multiple root layouts" pattern) since they can no longer share a root layout with the localized routes once `<html lang>` needs to vary per locale.

**Tech Stack:** Next.js 15 App Router, `next-intl@^4.13.6`, existing Vitest suite.

## Global Constraints

- Locales: `de` (default), `fr`, `it`, `en` — all four URL-prefixed (`/de`, `/fr`, `/it`, `/en`), including German (spec: "URL routing").
- `/admin`, `/admin/login`, `/api/**` stay unprefixed and German-only — untouched by this plan except where the shared root-layout refactor mechanically requires it (spec: "Explicitly out of scope").
- `formatChf`'s apostrophe thousands-separator and `CHF` prefix are identical across all four locales — a Swiss currency convention, not a language one (requirement.md §9; spec: "Content & translation").
- `src/lib/validate.ts` returns error **codes**, never display text (spec: "Content & translation").
- Language switcher preserves all query parameters across a locale switch (spec: "Language switcher").
- Translations for FR/IT/EN are authored directly as part of this plan — not blocked on native-speaker review (spec: "Content & translation").

---

## Task 1: next-intl infrastructure, routing, and directory restructuring

**Files:**
- Create: `src/i18n/routing.ts`, `src/i18n/navigation.ts`, `src/i18n/request.ts`
- Create: `src/messages/de.json`
- Create: `src/app/root-shell.tsx`
- Create: `src/app/[locale]/layout.tsx`, `src/app/[locale]/page.tsx`
- Modify: `next.config.ts`, `src/middleware.ts`, `src/app/admin/layout.tsx`
- Delete: `src/app/layout.tsx`, `src/app/page.tsx`
- Test: manual (build + curl) — this task is routing/config plumbing with no business logic to unit-test; Task 2 onward returns to normal TDD.

**Interfaces:**
- Produces: `routing` (`{ locales: readonly ["de"], defaultLocale: "de", localePrefix: "always" }`, from `src/i18n/routing.ts`) — Task 3 extends `locales` to all four.
- Produces: `{ Link, redirect, usePathname, useRouter, getPathname }` from `src/i18n/navigation.ts` — Task 6 (language switcher) consumes `usePathname`/`useRouter`.
- Produces: `RootShell({ lang, children })` from `src/app/root-shell.tsx` — a shared `<html>/<body>` shell used by both root layouts.
- Produces: `src/messages/de.json` with a `meta` namespace (`title`, `description`, `ogTitle`, `ogDescription`, `twitterTitle`, `twitterDescription`) plus the full set of namespaces later tasks consume (`inputs`, `validation`, `currentPlan`, `filterBar`, `results`, `headline`, `footer`, `copy.tarifart.*`, `copy.altersklasse.*`, `languageSwitcher`) — written once, in full, here.

- [ ] **Step 1: Install next-intl**

Run: `npm install next-intl@^4.13.6`

- [ ] **Step 2: Create the routing config**

Create `src/i18n/routing.ts`:

```ts
import { defineRouting } from "next-intl/routing";

// Locale set starts with German only — Task 3 expands this to ["de", "fr", "it", "en"]
// once translated message files exist for the other three.
export const routing = defineRouting({
  locales: ["de"],
  defaultLocale: "de",
  localePrefix: "always",
});
```

- [ ] **Step 3: Create the navigation helpers**

Create `src/i18n/navigation.ts`:

```ts
import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
```

- [ ] **Step 4: Create the request config**

Create `src/i18n/request.ts`:

```ts
import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
```

- [ ] **Step 5: Wire the next-intl Next.js plugin**

Modify `next.config.ts`:

```ts
import type { NextConfig } from "next";
import path from "node:path";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // Pin the Turbopack project root to this checkout. Without this, Next.js
  // infers the root from the nearest ancestor with a lockfile — in a
  // git-worktree layout (this repo keeps worktrees under .claude/worktrees/,
  // each with its own package-lock.json) that ancestor search can walk out
  // to the outer checkout, which caused the dev server to crash. This pin
  // is unrelated to Tailwind's content scanning: that's now bounded by
  // `source(none)` + `@source "../"` in src/app/globals.css, which is what
  // actually stops Tailwind from scanning outside src/.
  turbopack: {
    root: path.join(__dirname),
  },
};

export default withNextIntl(nextConfig);
```

- [ ] **Step 6: Write the full German message catalog**

Create `src/messages/de.json` (verbatim extraction of every hardcoded German string currently in the components — later tasks wire components to consume it, but the content is authored complete here):

```json
{
  "meta": {
    "title": "Krankenkassenvergleich – Grundversicherung Schweiz",
    "description": "Vergleiche Krankenkassenprämien für die Grundversicherung – alle Kassen, alle Modelle, offizielle BAG-Daten.",
    "ogTitle": "Krankenkassenvergleich – Grundversicherung Schweiz",
    "ogDescription": "Vergleiche Krankenkassenprämien für die Grundversicherung – alle Kassen, alle Modelle, offizielle BAG-Daten.",
    "twitterTitle": "Krankenkassenvergleich – Grundversicherung Schweiz",
    "twitterDescription": "Vergleiche Krankenkassenprämien für die Grundversicherung – offizielle BAG-Daten."
  },
  "inputs": {
    "title": "Prämienvergleich",
    "tagline": "Gib deine Angaben ein — die günstigsten Kassen erscheinen sofort.",
    "plzLabel": "Postleitzahl (PLZ)",
    "plzPlaceholder": "z.B. 3001",
    "plzNotFound": "PLZ nicht gefunden — bitte überprüfen.",
    "birthYearLabel": "Jahrgang",
    "birthYearPlaceholder": "z.B. 1985",
    "birthYearHintDefault": "Bestimmt Altersklasse und verfügbare Franchise-Stufen",
    "birthYearHintResolved": "→ {altersklasse}, Franchise CHF {min}–{max}",
    "deductibleLabel": "Franchise",
    "deductibleChoose": "Wählen…",
    "deductibleNeedsBirthYear": "Erst Jahrgang eingeben",
    "gemeindeAmbiguous": "PLZ {plz} liegt in mehreren Prämienregionen. Bitte wähle deine Gemeinde:",
    "gemeindeConfirmed": "✓ Gemeinde: {name}",
    "premiumsLoading": "Prämiendaten werden geladen…",
    "premiumsError": "Prämiendaten konnten nicht geladen werden. Bitte versuche es erneut.",
    "retry": "Erneut versuchen"
  },
  "validation": {
    "invalidPlzFormat": "Ungültige PLZ — bitte eine vierstellige Schweizer PLZ eingeben.",
    "invalidPremium": "Bitte eine gültige monatliche Prämie eingeben.",
    "nonPositivePremium": "Die monatliche Prämie muss grösser als CHF 0 sein.",
    "invalidBirthYear": "Bitte einen gültigen Jahrgang eingeben.",
    "futureBirthYear": "Jahrgang liegt in der Zukunft.",
    "unrealisticBirthYear": "Bitte einen realistischen Jahrgang eingeben (max. ~120 Jahre)."
  },
  "currentPlan": {
    "summaryTitle": "Was zahlst du heute?",
    "summaryHint": "(optional — zeigt deine Ersparnis)",
    "insurerLabel": "Aktuelle Kasse",
    "premiumLabel": "Monatliche Prämie",
    "premiumPlaceholder": "z.B. 350"
  },
  "filterBar": {
    "yearLabel": "Jahr:",
    "altModelsLabel": "Alternative Modelle: {state}",
    "accidentLabel": "Unfall: {state}",
    "stateOn": "ein",
    "stateOff": "aus",
    "included": "eingeschlossen",
    "excluded": "ausgeschlossen"
  },
  "results": {
    "summary": "{count} Kassen · {model} · Unfalldeckung {coverage} · {year}",
    "modelAlt": "günstiges Modell je Kasse",
    "modelStandard": "günstigstes Standard-Angebot je Kasse",
    "emptyTitle": "Keine Angebote gefunden",
    "emptyMessage": "Für die aktuelle Kombination sind keine Prämien in den BAG-Daten vorhanden. Bitte überprüfe deine Eingaben oder passe die Filter an.",
    "discountBadge": "bis zu −{pct}% ggü. Standard",
    "yourInsurerBadge": "Deine Kasse",
    "perMonth": "/Monat"
  },
  "headline": {
    "savingsCurrent": "Wenn du nichts tust: {amount}/Monat bei {insurer}.",
    "savingsCheapest": "Günstigstes Angebot für dein Profil {year}: {amount}/Monat bei {insurer} —",
    "savingsAmount": "spare {amount}/Jahr durch einen Wechsel.",
    "alreadyCheapestExact": "Du hast bereits das günstigste Angebot für dein Profil.",
    "alreadyCheapestBelow": "Dein Beitrag liegt unter allen Angeboten für dieses Profil — prüfe, ob Franchise und Modell vergleichbar sind.",
    "alreadyCheapestDetail": "{insurer} · {amount}/Monat.",
    "cheapestOnlyTitle": "Günstigstes Angebot: {amount}/Monat bei {insurer}.",
    "cheapestOnlyCta": "Gib deine aktuelle Kasse an, um zu sehen, wie viel du sparen könntest. ↓"
  },
  "footer": {
    "dataNotice": "Daten: BAG Opendata · Publikation {date} · Nur Pflichtleistungen (OKP) · Kein Sponsoring, keine Vermittlungslinks"
  },
  "copy": {
    "tarifart": {
      "standard": { "label": "Standard", "description": "Freie Arztwahl" },
      "hausarzt": { "label": "Hausarzt", "description": "Erstbehandlung immer beim gewählten Hausarzt" },
      "telmed": { "label": "Telmed", "description": "Anruf bei Hotline erforderlich vor jedem Arztbesuch" },
      "hmo": { "label": "HMO", "description": "Erstanlaufstelle immer beim HMO-Zentrum" },
      "andere": { "label": "Alternativmodell", "description": "Eingeschränkte Wahl des Erstanlaufpunkts" }
    },
    "altersklasse": {
      "kind": "Kind (0–18)",
      "jung": "Junge Erwachsene (19–25)",
      "erwachsen": "Erwachsen (26+)"
    }
  },
  "languageSwitcher": {
    "menuLabel": "Sprache wählen"
  }
}
```

- [ ] **Step 7: Create the shared root-layout shell**

Create `src/app/root-shell.tsx` — the `<html>/<body>` chrome shared by both root layouts introduced in the next steps (the localized `[locale]` tree and the unlocalized `admin` tree can no longer share a single root layout, since only the former has a locale to put in `lang`):

```tsx
import type { Viewport } from "next";
import { Roboto, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
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

export function RootShell({ lang, children }: { lang: string; children: React.ReactNode }) {
  return (
    <html lang={lang} className={`${roboto.variable} ${geistMono.variable}`}>
      <body className="antialiased">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
```

- [ ] **Step 8: Delete the old shared root layout and home page**

Run: `git rm src/app/layout.tsx src/app/page.tsx`

- [ ] **Step 9: Create the localized root layout**

Create `src/app/[locale]/layout.tsx`:

```tsx
import type { Metadata } from "next";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { RootShell, viewport } from "@/app/root-shell";

export { viewport };

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  return {
    title: t("title"),
    description: t("description"),
    openGraph: { title: t("ogTitle"), description: t("ogDescription"), type: "website" },
    twitter: { card: "summary", title: t("twitterTitle"), description: t("twitterDescription") },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);

  return (
    <RootShell lang={locale}>
      <NextIntlClientProvider>{children}</NextIntlClientProvider>
    </RootShell>
  );
}
```

- [ ] **Step 10: Move the home page under `[locale]`**

Create `src/app/[locale]/page.tsx` (identical content to the deleted `src/app/page.tsx`):

```tsx
import { Suspense } from "react";
import { InsuranceComparator } from "@/components/InsuranceComparator";

export default function Home() {
  return (
    // useSearchParams requires a Suspense boundary in the App Router.
    <Suspense fallback={null}>
      <InsuranceComparator />
    </Suspense>
  );
}
```

- [ ] **Step 11: Give `/admin` its own root layout**

Modify `src/app/admin/layout.tsx` — it can no longer rely on a shared root layout (deleted in Step 8), so it becomes a root layout itself, reusing `RootShell` with a hardcoded `"de"` (admin stays German-only per Global Constraints):

```tsx
import type { Metadata } from "next";
import { RootShell, viewport } from "@/app/root-shell";

export { viewport };

// REQ-22: /admin is not publicly linked or indexed.
export const metadata: Metadata = {
  title: "Admin – Krankenkassenvergleich",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <RootShell lang="de">{children}</RootShell>;
}
```

- [ ] **Step 12: Combine the admin token-gate and intl middleware**

Modify `src/middleware.ts`:

```ts
// Combines two independent concerns on the same request pipeline:
// 1. Stateless token gate for /admin (REQ-22): no user accounts, just a
//    cookie compared against ADMIN_SECRET.
// 2. next-intl locale routing/negotiation for every other path.
// Admin/API routes are intentionally excluded from (2) — they stay
// unprefixed and German-only (see docs/superpowers/specs/2026-08-15-multilingual-i18n-design.md).

import { NextRequest, NextResponse } from "next/server";
import createIntlMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

const intlMiddleware = createIntlMiddleware(routing);

// Constant-time comparison without node:crypto — middleware runs on the Edge
// Runtime, which doesn't support Node built-ins like timingSafeEqual.
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtectedApi = pathname.startsWith("/api/admin");
  const isProtectedPage = pathname.startsWith("/admin") && !pathname.startsWith("/admin/login");
  const isAdminRoute = pathname.startsWith("/admin") || pathname.startsWith("/api/admin");

  if (isProtectedApi || isProtectedPage) {
    const token = request.cookies.get("admin_token")?.value;
    const secret = process.env.ADMIN_SECRET;
    const authorized = Boolean(secret && token && safeEqual(token, secret));

    if (!authorized) {
      if (isProtectedApi) {
        return NextResponse.json({ error: "unauthorized" }, { status: 401 });
      }
      const loginUrl = new URL("/admin/login", request.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  if (isAdminRoute) {
    return NextResponse.next();
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*", "/((?!api|_next|admin|.*\\..*).*)"],
};
```

- [ ] **Step 13: Verify the existing test suite still passes**

Run: `npm test`
Expected: all existing tests PASS unchanged (nothing in `src/lib` was touched this task).

- [ ] **Step 14: Verify the build succeeds**

Run: `npm run build`
Expected: build succeeds with no type errors. If Turbopack/next-intl plugin errors about the request config path, double check `next.config.ts` points at `./src/i18n/request.ts` (relative to repo root, matching where the file was created in Step 4).

- [ ] **Step 15: Manual verification**

Run: `npm run dev`, then in another shell:

```bash
curl -sI http://localhost:3000/ | head -5      # expect 307 redirect to /de
curl -s http://localhost:3000/de | grep -o '<title>[^<]*</title>'  # expect the meta.title text
curl -sI http://localhost:3000/admin | head -5 # expect 307 redirect to /admin/login (unprefixed, no /de)
```

Expected: `/` redirects to `/de`; `/de` renders the (still German-hardcoded) comparator with the new `<title>` from `meta.title`; `/admin` still behaves exactly as before (unprefixed).

- [ ] **Step 16: Commit**

```bash
git add -A
git commit -m "feat(i18n): add next-intl routing/middleware infrastructure

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 2: Wire all components to the message catalog

**Files:**
- Modify: `src/components/InsuranceComparator.tsx`
- Modify: `src/components/inputs/PlzInput.tsx`, `src/components/inputs/BirthYearInput.tsx`, `src/components/inputs/DeductibleSelect.tsx`
- Modify: `src/components/current-plan/CurrentPlanSection.tsx`
- Modify: `src/components/results/FilterBar.tsx`, `src/components/results/Headline.tsx`, `src/components/results/PlanRow.tsx`, `src/components/results/EmptyState.tsx`
- Delete: `src/lib/copy.ts`
- Test: manual (visual) — this is a text-source refactor with no behavior change; Vitest has no coverage of rendered component text, so verification is `npm run build` + `npm test` (regression-free) + a manual page load.

**Interfaces:**
- Consumes: `src/messages/de.json` (Task 1, Step 6) — every key referenced below already exists there.
- Produces: no new exports; every component's rendered output is byte-for-byte identical to before this task (same German text, now sourced from messages instead of literals).

- [ ] **Step 1: Update `InsuranceComparator.tsx`**

Add the import and replace every hardcoded German string. In `src/components/InsuranceComparator.tsx`:

Add near the top:
```tsx
import { useTranslations } from "next-intl";
```

Inside the component function, right after the existing `useRouter()`/`usePathname()`/`useSearchParams()` calls:
```tsx
const t = useTranslations();
```

Replace:
```tsx
<h1 className="text-title-large text-on-surface mb-1">Prämienvergleich</h1>
<p className="text-body-medium text-on-surface-variant mb-5">
  Gib deine Angaben ein — die günstigsten Kassen erscheinen sofort.
</p>
```
with:
```tsx
<h1 className="text-title-large text-on-surface mb-1">{t("inputs.title")}</h1>
<p className="text-body-medium text-on-surface-variant mb-5">{t("inputs.tagline")}</p>
```

Replace:
```tsx
<p className="text-sm text-on-surface-variant mb-2">
  PLZ {plz} liegt in mehreren Prämienregionen. Bitte wähle deine Gemeinde:
</p>
```
with:
```tsx
<p className="text-sm text-on-surface-variant mb-2">{t("inputs.gemeindeAmbiguous", { plz })}</p>
```

Replace:
```tsx
<p className="text-xs text-primary mt-2">&#10003; Gemeinde: {resolvedGemeinde.name}</p>
```
with:
```tsx
<p className="text-xs text-primary mt-2">{t("inputs.gemeindeConfirmed", { name: resolvedGemeinde.name })}</p>
```

Replace:
```tsx
<p className="text-sm text-on-surface-variant mt-4" role="status">
  Prämiendaten werden geladen…
</p>
```
with:
```tsx
<p className="text-sm text-on-surface-variant mt-4" role="status">
  {t("inputs.premiumsLoading")}
</p>
```

Replace:
```tsx
<p className="text-sm text-on-error-container mb-2">
  Prämiendaten konnten nicht geladen werden. Bitte versuche es erneut.
</p>
```
with:
```tsx
<p className="text-sm text-on-error-container mb-2">{t("inputs.premiumsError")}</p>
```

Replace the retry button's text `Erneut versuchen` with `{t("inputs.retry")}`.

Replace:
```tsx
<p className="text-sm text-on-surface-variant mt-4 mb-2">
  {results.plans.length} Kassen · {altModelsActive ? "günstiges Modell je Kasse" : "günstigstes Standard-Angebot je Kasse"} ·{" "}
  Unfalldeckung {unfalldeckung ? "eingeschlossen" : "ausgeschlossen"} · {year}
</p>
```
with:
```tsx
<p className="text-sm text-on-surface-variant mt-4 mb-2">
  {t("results.summary", {
    count: results.plans.length,
    model: altModelsActive ? t("results.modelAlt") : t("results.modelStandard"),
    coverage: unfalldeckung ? t("filterBar.included") : t("filterBar.excluded"),
    year,
  })}
</p>
```

Replace:
```tsx
<EmptyState message="Für die aktuelle Kombination sind keine Prämien in den BAG-Daten vorhanden. Bitte überprüfe deine Eingaben oder passe die Filter an." />
```
with:
```tsx
<EmptyState message={t("results.emptyMessage")} />
```

Replace the footer:
```tsx
<p className="text-body-small text-outline text-center mt-6 pb-10">
  Daten: BAG Opendata · Publikation{" "}
  {new Date(metadata.publicationDate).toLocaleDateString("de-CH", { day: "numeric", month: "long", year: "numeric" })} ·
  Nur Pflichtleistungen (OKP) · Kein Sponsoring, keine Vermittlungslinks
</p>
```
with:
```tsx
<p className="text-body-small text-outline text-center mt-6 pb-10">
  {t("footer.dataNotice", {
    date: new Date(metadata.publicationDate).toLocaleDateString("de-CH", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
  })}
</p>
```
(The `"de-CH"` locale tag here becomes locale-aware in Task 5 — left as-is for now since this task only moves text, not formatting, into the message system.)

- [ ] **Step 2: Update `PlzInput.tsx`**

Replace the full file content of `src/components/inputs/PlzInput.tsx`:

```tsx
"use client";

import { useTranslations } from "next-intl";
import { validatePlz } from "@/lib/validate";

type Props = {
  value: string;
  onChange: (value: string) => void;
  /** True when the PLZ has valid format but doesn't resolve to any known Gemeinde (REQ-13). */
  notFound?: boolean;
};

export function PlzInput({ value, onChange, notFound }: Props) {
  const t = useTranslations();
  const formatResult = value ? validatePlz(value) : { valid: true as const };
  const result =
    formatResult.valid && notFound
      ? { valid: false as const, message: t("inputs.plzNotFound") }
      : formatResult;

  return (
    <div>
      <label htmlFor="plz" className="block text-label-large text-on-surface-variant mb-1.5">
        {t("inputs.plzLabel")}
      </label>
      <input
        id="plz"
        type="text"
        inputMode="numeric"
        maxLength={4}
        placeholder={t("inputs.plzPlaceholder")}
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

(`result.message` for a format error still comes straight from `validatePlz`, which still returns the raw German string at this point — Task 4 changes that to a code and this component's translation of it.)

- [ ] **Step 3: Update `BirthYearInput.tsx`**

Replace the full file content of `src/components/inputs/BirthYearInput.tsx`:

```tsx
"use client";

import { useTranslations } from "next-intl";
import { validateBirthYear } from "@/lib/validate";
import { getAltersklasse, getFranchiseTiers } from "@/lib/ageband";

type Props = {
  value: string;
  onChange: (value: string) => void;
  calendarYear: number;
};

export function BirthYearInput({ value, onChange, calendarYear }: Props) {
  const t = useTranslations();
  const parsed = value ? Number(value) : null;
  const result = parsed != null ? validateBirthYear(parsed) : { valid: true as const };
  const altersklasse = parsed != null && result.valid ? getAltersklasse(parsed, calendarYear) : null;
  const tiers = altersklasse ? getFranchiseTiers(altersklasse) : null;

  return (
    <div>
      <label htmlFor="by" className="block text-label-large text-on-surface-variant mb-1.5">
        {t("inputs.birthYearLabel")}
      </label>
      <input
        id="by"
        type="number"
        placeholder={t("inputs.birthYearPlaceholder")}
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
            ? t("inputs.birthYearHintResolved", {
                altersklasse: t(`copy.altersklasse.${altersklasse}`),
                min: tiers[0],
                max: tiers[tiers.length - 1],
              })
            : t("inputs.birthYearHintDefault")}
      </p>
    </div>
  );
}
```

- [ ] **Step 4: Update `DeductibleSelect.tsx`**

Replace the full file content of `src/components/inputs/DeductibleSelect.tsx`:

```tsx
"use client";

import { useTranslations } from "next-intl";
import type { Altersklasse } from "@/lib/types";
import { getFranchiseTiers } from "@/lib/ageband";

type Props = {
  altersklasse: Altersklasse | null;
  value: number | null;
  onChange: (value: number) => void;
};

export function DeductibleSelect({ altersklasse, value, onChange }: Props) {
  const t = useTranslations("inputs");
  const tiers = altersklasse ? getFranchiseTiers(altersklasse) : [];

  return (
    <div>
      <label htmlFor="fran" className="block text-label-large text-on-surface-variant mb-1.5">
        {t("deductibleLabel")}
      </label>
      <select
        id="fran"
        value={value ?? ""}
        disabled={!altersklasse}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-10 px-3 rounded-md border border-outline-variant text-[15px] bg-surface outline-none focus:border-primary focus-visible:ring-2 focus-visible:ring-primary-container disabled:bg-surface-variant disabled:text-outline"
      >
        <option value="" disabled>
          {altersklasse ? t("deductibleChoose") : t("deductibleNeedsBirthYear")}
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

- [ ] **Step 5: Update `CurrentPlanSection.tsx`**

Replace the full file content of `src/components/current-plan/CurrentPlanSection.tsx`:

```tsx
"use client";

import { useTranslations } from "next-intl";
import { validateCurrentPremium } from "@/lib/validate";
import type { CurrentPlan, Insurer } from "@/lib/types";

type Props = {
  insurers: Insurer[];
  value: Partial<CurrentPlan>;
  onChange: (value: Partial<CurrentPlan>) => void;
};

export function CurrentPlanSection({ insurers, value, onChange }: Props) {
  const t = useTranslations("currentPlan");
  const result = value.monthlyPremium != null ? validateCurrentPremium(value.monthlyPremium) : { valid: true as const };

  return (
    <details className="mt-5 pt-4 border-t border-surface-variant">
      <summary className="flex items-center gap-2 cursor-pointer select-none text-title-medium text-primary list-none [&::-webkit-details-marker]:hidden before:content-['▸'] before:text-xs [details[open]_&]:before:content-['▾']">
        {t("summaryTitle")}{" "}
        <span className="font-normal text-on-surface-variant">&nbsp;{t("summaryHint")}</span>
      </summary>
      <div className="mt-3.5 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label htmlFor="current-insurer" className="block text-label-large text-on-surface-variant mb-1.5">
            {t("insurerLabel")}
          </label>
          <select
            id="current-insurer"
            value={value.insurerCode ?? ""}
            onChange={(e) => onChange({ ...value, insurerCode: e.target.value })}
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
          <label htmlFor="current-premium" className="block text-label-large text-on-surface-variant mb-1.5">
            {t("premiumLabel")}
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[15px] text-on-surface-variant pointer-events-none">
              CHF
            </span>
            <input
              id="current-premium"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.05"
              placeholder={t("premiumPlaceholder")}
              value={value.monthlyPremium ?? ""}
              onChange={(e) => {
                const raw = e.target.value;
                onChange({ ...value, monthlyPremium: raw === "" ? undefined : Number(raw) });
              }}
              aria-describedby="current-premium-hint"
              aria-invalid={!result.valid}
              className={`w-full h-10 pl-11 pr-3 rounded-md border text-[15px] bg-surface outline-none transition-colors ${
                result.valid ? "border-outline-variant focus:border-primary" : "border-error focus:border-error"
              }`}
            />
          </div>
          {!result.valid && (
            <p id="current-premium-hint" className="text-body-small text-error mt-1">
              {result.message}
            </p>
          )}
        </div>
      </div>
    </details>
  );
}
```

- [ ] **Step 6: Update `FilterBar.tsx`**

Replace the full file content of `src/components/results/FilterBar.tsx`:

```tsx
"use client";

import { useTranslations } from "next-intl";

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
  const t = useTranslations("filterBar");
  return (
    <div className="mt-4 flex items-center gap-2 flex-wrap">
      <span className="text-sm text-on-surface-variant mr-1">{t("yearLabel")}</span>
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
        {t("altModelsLabel", { state: altModelsActive ? t("stateOn") : t("stateOff") })}
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
        {t("accidentLabel", { state: unfalldeckung ? t("included") : t("excluded") })}
      </button>
    </div>
  );
}
```

- [ ] **Step 7: Update `Headline.tsx`**

Replace the full file content of `src/components/results/Headline.tsx`:

```tsx
import { useTranslations } from "next-intl";
import type { HeadlineState, PremiumRow } from "@/lib/types";
import { formatChf } from "@/lib/format";

type Props = {
  headline: HeadlineState;
  year: number;
};

export function Headline({ headline, year }: Props) {
  const t = useTranslations("headline");

  if (headline.kind === "savings") {
    return (
      <div role="status" className="mt-6 rounded-lg p-5 flex gap-3.5 bg-success-container border border-success-container">
        <span className="text-xl" aria-hidden>💡</span>
        <p className="text-sm text-on-success-container">
          <strong className="block text-base font-bold text-on-surface mb-0.5">
            {t("savingsCurrent", {
              amount: formatChf(headline.current.monthlyPremium),
              insurer: headline.current.insurerName,
            })}
          </strong>
          {t("savingsCheapest", {
            year,
            amount: formatChf(headline.cheapest.monthlyPremium),
            insurer: headline.cheapest.insurerName,
          })}{" "}
          <span className="text-success font-bold">
            {t("savingsAmount", { amount: formatChf(headline.savingsPerYear) })}
          </span>
        </p>
      </div>
    );
  }

  if (headline.kind === "already-cheapest") {
    const isExactMatch =
      headline.cheapest != null && headline.current.monthlyPremium === headline.cheapest.monthlyPremium;
    return (
      <div role="status" className="mt-6 rounded-lg p-5 flex gap-3.5 bg-success-container border border-success-container">
        <span className="text-xl" aria-hidden>✅</span>
        <p className="text-sm text-on-success-container">
          <strong className="block text-base font-bold text-on-surface mb-0.5">
            {isExactMatch ? t("alreadyCheapestExact") : t("alreadyCheapestBelow")}
          </strong>
          {t("alreadyCheapestDetail", {
            insurer: headline.current.insurerName,
            amount: formatChf(headline.current.monthlyPremium),
          })}
        </p>
      </div>
    );
  }

  return headline.cheapest ? <CheapestOnly cheapest={headline.cheapest} /> : null;
}

function CheapestOnly({ cheapest }: { cheapest: PremiumRow }) {
  const t = useTranslations("headline");
  return (
    <div role="status" className="mt-6 rounded-lg p-5 flex gap-3.5 bg-primary-container border border-primary-container">
      <span className="text-xl" aria-hidden>🔍</span>
      <p className="text-sm text-on-primary-container">
        <strong className="block text-base font-bold text-on-surface mb-0.5">
          {t("cheapestOnlyTitle", { amount: formatChf(cheapest.monthlyPremium), insurer: cheapest.insurerName })}
        </strong>
        {t("cheapestOnlyCta")}
      </p>
    </div>
  );
}
```

- [ ] **Step 8: Update `PlanRow.tsx`**

Replace the full file content of `src/components/results/PlanRow.tsx`:

```tsx
import { useTranslations } from "next-intl";
import type { PremiumRow } from "@/lib/types";
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
  const t = useTranslations();
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
            {t(`copy.tarifart.${plan.tarifart}.label`)}
          </span>
          {discountPct != null && (
            <span className="inline-block px-1.5 py-px rounded text-[11px] font-bold bg-primary-container text-on-primary-container whitespace-nowrap">
              {t("results.discountBadge", { pct: discountPct.toFixed(1) })}
            </span>
          )}
          <span>· {t(`copy.tarifart.${plan.tarifart}.description`)}</span>
        </div>
      </div>
      {memberCount != null && (
        <div
          className="hidden sm:flex flex-col items-end gap-0.5 flex-shrink-0"
          title={formatMemberCountDetail(memberCount, memberCountAsOf)}
          aria-label={formatMemberCountDetail(memberCount, memberCountAsOf)}
        >
          <span className="text-[11px] font-semibold px-1.5 py-px rounded bg-surface-variant text-on-surface-variant whitespace-nowrap">
            <span aria-hidden="true">👥</span> {formatMemberCount(memberCount)}
          </span>
        </div>
      )}
      {isCurrentPlan && (
        <span className="text-[11px] font-semibold px-1.5 py-px rounded bg-error-container text-error">
          {t("results.yourInsurerBadge")}
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
        <div className="text-body-small text-outline">{t("results.perMonth")}</div>
      </div>
    </div>
  );
}
```

(`formatMemberCount`/`formatMemberCountDetail` calls keep their current 1-2 argument signature here — Task 5 adds the `locale` parameter and updates these two call sites again.)

- [ ] **Step 9: Update `EmptyState.tsx`**

Replace the full file content of `src/components/results/EmptyState.tsx`:

```tsx
import { useTranslations } from "next-intl";

type Props = {
  message: string;
};

export function EmptyState({ message }: Props) {
  const t = useTranslations("results");
  return (
    <div className="rounded-lg border border-outline-variant bg-surface p-10 text-center text-on-surface-variant">
      <p className="text-[15px] mb-1.5">{t("emptyTitle")}</p>
      <p className="text-body-small text-outline">{message}</p>
    </div>
  );
}
```

- [ ] **Step 10: Delete `src/lib/copy.ts`**

Run: `git rm src/lib/copy.ts`

Confirm no remaining references: `grep -rn "lib/copy" src` should return nothing.

- [ ] **Step 11: Verify**

Run: `npm test` — expect all existing tests still PASS (none of them import from `src/lib/copy.ts` or the changed components).
Run: `npm run build` — expect success.
Run: `npm run dev`, visit `http://localhost:3000/de` — expect the page to look and read identically to before this task (same German text, sourced from `src/messages/de.json` now).

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "refactor(i18n): wire components to the next-intl message catalog

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 3: Add French, Italian, and English translations

**Files:**
- Create: `src/messages/en.json`, `src/messages/fr.json`, `src/messages/it.json`
- Create: `src/messages/messages.test.ts`
- Modify: `src/i18n/routing.ts`

**Interfaces:**
- Consumes: the key structure established by `src/messages/de.json` (Task 1, Step 6).
- Produces: `src/messages/{en,fr,it}.json`, each with exactly the same key set as `de.json` — enforced by the new test.

- [ ] **Step 1: Write the failing message-consistency test**

Create `src/messages/messages.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import de from "./de.json";
import en from "./en.json";
import fr from "./fr.json";
import it from "./it.json";

function collectKeys(value: unknown, prefix = ""): string[] {
  if (typeof value !== "object" || value === null) return [prefix];
  return Object.entries(value).flatMap(([key, v]) => collectKeys(v, prefix ? `${prefix}.${key}` : key));
}

describe("message catalogs", () => {
  const deKeys = collectKeys(de).sort();

  it.each([
    ["en", en],
    ["fr", fr],
    ["it", it],
  ])("%s.json has exactly the same keys as de.json", (_locale, catalog) => {
    expect(collectKeys(catalog).sort()).toEqual(deKeys);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/messages/messages.test.ts`
Expected: FAIL — `en.json`/`fr.json`/`it.json` don't exist yet (module resolution error).

- [ ] **Step 3: Write the English catalog**

Create `src/messages/en.json`:

```json
{
  "meta": {
    "title": "Health Insurance Comparison – Basic Insurance Switzerland",
    "description": "Compare Swiss basic health insurance premiums – every insurer, every model, official FOPH data.",
    "ogTitle": "Health Insurance Comparison – Basic Insurance Switzerland",
    "ogDescription": "Compare Swiss basic health insurance premiums – every insurer, every model, official FOPH data.",
    "twitterTitle": "Health Insurance Comparison – Basic Insurance Switzerland",
    "twitterDescription": "Compare Swiss basic health insurance premiums – official FOPH data."
  },
  "inputs": {
    "title": "Premium Comparison",
    "tagline": "Enter your details — the cheapest insurers appear instantly.",
    "plzLabel": "Postcode (PLZ)",
    "plzPlaceholder": "e.g. 3001",
    "plzNotFound": "Postcode not found — please check it.",
    "birthYearLabel": "Birth year",
    "birthYearPlaceholder": "e.g. 1985",
    "birthYearHintDefault": "Determines age group and available deductible tiers",
    "birthYearHintResolved": "→ {altersklasse}, deductible CHF {min}–{max}",
    "deductibleLabel": "Deductible",
    "deductibleChoose": "Choose…",
    "deductibleNeedsBirthYear": "Enter birth year first",
    "gemeindeAmbiguous": "Postcode {plz} covers several premium regions. Please choose your municipality:",
    "gemeindeConfirmed": "✓ Municipality: {name}",
    "premiumsLoading": "Loading premium data…",
    "premiumsError": "Couldn't load premium data. Please try again.",
    "retry": "Try again"
  },
  "validation": {
    "invalidPlzFormat": "Invalid postcode — please enter a 4-digit Swiss postcode.",
    "invalidPremium": "Please enter a valid monthly premium.",
    "nonPositivePremium": "The monthly premium must be greater than CHF 0.",
    "invalidBirthYear": "Please enter a valid birth year.",
    "futureBirthYear": "Birth year is in the future.",
    "unrealisticBirthYear": "Please enter a realistic birth year (max. ~120 years)."
  },
  "currentPlan": {
    "summaryTitle": "What are you paying today?",
    "summaryHint": "(optional — shows your savings)",
    "insurerLabel": "Current insurer",
    "premiumLabel": "Monthly premium",
    "premiumPlaceholder": "e.g. 350"
  },
  "filterBar": {
    "yearLabel": "Year:",
    "altModelsLabel": "Alternative models: {state}",
    "accidentLabel": "Accident cover: {state}",
    "stateOn": "on",
    "stateOff": "off",
    "included": "included",
    "excluded": "excluded"
  },
  "results": {
    "summary": "{count} insurers · {model} · Accident cover {coverage} · {year}",
    "modelAlt": "cheapest model per insurer",
    "modelStandard": "cheapest standard offer per insurer",
    "emptyTitle": "No offers found",
    "emptyMessage": "No premiums exist in the FOPH data for this combination. Please check your details or adjust the filters.",
    "discountBadge": "up to −{pct}% vs. standard",
    "yourInsurerBadge": "Your insurer",
    "perMonth": "/month"
  },
  "headline": {
    "savingsCurrent": "If you do nothing: {amount}/month with {insurer}.",
    "savingsCheapest": "Cheapest offer for your profile in {year}: {amount}/month with {insurer} —",
    "savingsAmount": "save {amount}/year by switching.",
    "alreadyCheapestExact": "You already have the cheapest offer for your profile.",
    "alreadyCheapestBelow": "Your premium is below every offer for this profile — check whether the deductible and model are comparable.",
    "alreadyCheapestDetail": "{insurer} · {amount}/month.",
    "cheapestOnlyTitle": "Cheapest offer: {amount}/month with {insurer}.",
    "cheapestOnlyCta": "Enter your current insurer to see how much you could save. ↓"
  },
  "footer": {
    "dataNotice": "Data: FOPH open data · Published {date} · Mandatory benefits only · No sponsoring, no referral links"
  },
  "copy": {
    "tarifart": {
      "standard": { "label": "Standard", "description": "Free choice of doctor" },
      "hausarzt": { "label": "Family doctor", "description": "First point of contact is always your chosen family doctor" },
      "telmed": { "label": "Telmed", "description": "Must call a hotline before every doctor's visit" },
      "hmo": { "label": "HMO", "description": "First point of contact is always the HMO centre" },
      "andere": { "label": "Alternative model", "description": "Restricted choice of first point of contact" }
    },
    "altersklasse": {
      "kind": "Child (0–18)",
      "jung": "Young adult (19–25)",
      "erwachsen": "Adult (26+)"
    }
  },
  "languageSwitcher": {
    "menuLabel": "Choose language"
  }
}
```

- [ ] **Step 4: Write the French catalog**

Create `src/messages/fr.json`:

```json
{
  "meta": {
    "title": "Comparateur d'assurance maladie – Assurance de base Suisse",
    "description": "Comparez les primes de l'assurance de base suisse – toutes les caisses, tous les modèles, données officielles de l'OFSP.",
    "ogTitle": "Comparateur d'assurance maladie – Assurance de base Suisse",
    "ogDescription": "Comparez les primes de l'assurance de base suisse – toutes les caisses, tous les modèles, données officielles de l'OFSP.",
    "twitterTitle": "Comparateur d'assurance maladie – Assurance de base Suisse",
    "twitterDescription": "Comparez les primes de l'assurance de base suisse – données officielles de l'OFSP."
  },
  "inputs": {
    "title": "Comparaison des primes",
    "tagline": "Indiquez vos données — les caisses les plus avantageuses s'affichent aussitôt.",
    "plzLabel": "Code postal (NPA)",
    "plzPlaceholder": "p. ex. 3001",
    "plzNotFound": "Code postal introuvable — veuillez le vérifier.",
    "birthYearLabel": "Année de naissance",
    "birthYearPlaceholder": "p. ex. 1985",
    "birthYearHintDefault": "Détermine la classe d'âge et les franchises disponibles",
    "birthYearHintResolved": "→ {altersklasse}, franchise CHF {min}–{max}",
    "deductibleLabel": "Franchise",
    "deductibleChoose": "Choisir…",
    "deductibleNeedsBirthYear": "Indiquez d'abord l'année de naissance",
    "gemeindeAmbiguous": "Le NPA {plz} couvre plusieurs régions de primes. Veuillez choisir votre commune :",
    "gemeindeConfirmed": "✓ Commune : {name}",
    "premiumsLoading": "Chargement des données de primes…",
    "premiumsError": "Impossible de charger les données de primes. Veuillez réessayer.",
    "retry": "Réessayer"
  },
  "validation": {
    "invalidPlzFormat": "Code postal invalide — veuillez indiquer un NPA suisse à 4 chiffres.",
    "invalidPremium": "Veuillez indiquer une prime mensuelle valide.",
    "nonPositivePremium": "La prime mensuelle doit être supérieure à CHF 0.",
    "invalidBirthYear": "Veuillez indiquer une année de naissance valide.",
    "futureBirthYear": "L'année de naissance se situe dans le futur.",
    "unrealisticBirthYear": "Veuillez indiquer une année de naissance réaliste (max. ~120 ans)."
  },
  "currentPlan": {
    "summaryTitle": "Que payez-vous aujourd'hui ?",
    "summaryHint": "(facultatif — affiche votre économie)",
    "insurerLabel": "Caisse actuelle",
    "premiumLabel": "Prime mensuelle",
    "premiumPlaceholder": "p. ex. 350"
  },
  "filterBar": {
    "yearLabel": "Année :",
    "altModelsLabel": "Modèles alternatifs : {state}",
    "accidentLabel": "Accident : {state}",
    "stateOn": "activé",
    "stateOff": "désactivé",
    "included": "inclus",
    "excluded": "exclu"
  },
  "results": {
    "summary": "{count} caisses · {model} · Couverture accident {coverage} · {year}",
    "modelAlt": "modèle le plus avantageux par caisse",
    "modelStandard": "offre standard la plus avantageuse par caisse",
    "emptyTitle": "Aucune offre trouvée",
    "emptyMessage": "Aucune prime n'existe dans les données de l'OFSP pour cette combinaison. Veuillez vérifier vos données ou ajuster les filtres.",
    "discountBadge": "jusqu'à −{pct}% par rapport au standard",
    "yourInsurerBadge": "Votre caisse",
    "perMonth": "/mois"
  },
  "headline": {
    "savingsCurrent": "Si vous ne faites rien : {amount}/mois chez {insurer}.",
    "savingsCheapest": "Offre la plus avantageuse pour votre profil en {year} : {amount}/mois chez {insurer} —",
    "savingsAmount": "économisez {amount}/an en changeant de caisse.",
    "alreadyCheapestExact": "Vous avez déjà l'offre la plus avantageuse pour votre profil.",
    "alreadyCheapestBelow": "Votre prime est inférieure à toutes les offres pour ce profil — vérifiez que la franchise et le modèle sont comparables.",
    "alreadyCheapestDetail": "{insurer} · {amount}/mois.",
    "cheapestOnlyTitle": "Offre la plus avantageuse : {amount}/mois chez {insurer}.",
    "cheapestOnlyCta": "Indiquez votre caisse actuelle pour voir combien vous pourriez économiser. ↓"
  },
  "footer": {
    "dataNotice": "Données : Open Data OFSP · Publication {date} · Prestations obligatoires uniquement (AOS) · Aucun sponsoring, aucun lien d'intermédiation"
  },
  "copy": {
    "tarifart": {
      "standard": { "label": "Standard", "description": "Libre choix du médecin" },
      "hausarzt": { "label": "Médecin de famille", "description": "Premier contact toujours auprès du médecin de famille choisi" },
      "telmed": { "label": "Telmed", "description": "Appel à une hotline obligatoire avant chaque consultation" },
      "hmo": { "label": "HMO", "description": "Premier contact toujours auprès du centre HMO" },
      "andere": { "label": "Modèle alternatif", "description": "Choix restreint du premier point de contact" }
    },
    "altersklasse": {
      "kind": "Enfant (0–18)",
      "jung": "Jeune adulte (19–25)",
      "erwachsen": "Adulte (26+)"
    }
  },
  "languageSwitcher": {
    "menuLabel": "Choisir la langue"
  }
}
```

- [ ] **Step 5: Write the Italian catalog**

Create `src/messages/it.json`:

```json
{
  "meta": {
    "title": "Confronto assicurazione malattia – Assicurazione di base Svizzera",
    "description": "Confronta i premi dell'assicurazione di base svizzera – tutte le casse, tutti i modelli, dati ufficiali dell'UFSP.",
    "ogTitle": "Confronto assicurazione malattia – Assicurazione di base Svizzera",
    "ogDescription": "Confronta i premi dell'assicurazione di base svizzera – tutte le casse, tutti i modelli, dati ufficiali dell'UFSP.",
    "twitterTitle": "Confronto assicurazione malattia – Assicurazione di base Svizzera",
    "twitterDescription": "Confronta i premi dell'assicurazione di base svizzera – dati ufficiali dell'UFSP."
  },
  "inputs": {
    "title": "Confronto dei premi",
    "tagline": "Inserisci i tuoi dati — le casse più convenienti appaiono subito.",
    "plzLabel": "Numero postale di avviamento (NPA)",
    "plzPlaceholder": "p. es. 3001",
    "plzNotFound": "NPA non trovato — verifica il dato inserito.",
    "birthYearLabel": "Anno di nascita",
    "birthYearPlaceholder": "p. es. 1985",
    "birthYearHintDefault": "Determina la fascia d'età e le franchigie disponibili",
    "birthYearHintResolved": "→ {altersklasse}, franchigia CHF {min}–{max}",
    "deductibleLabel": "Franchigia",
    "deductibleChoose": "Scegli…",
    "deductibleNeedsBirthYear": "Inserisci prima l'anno di nascita",
    "gemeindeAmbiguous": "L'NPA {plz} copre più regioni di premio. Scegli il tuo comune:",
    "gemeindeConfirmed": "✓ Comune: {name}",
    "premiumsLoading": "Caricamento dei dati sui premi…",
    "premiumsError": "Impossibile caricare i dati sui premi. Riprova.",
    "retry": "Riprova"
  },
  "validation": {
    "invalidPlzFormat": "NPA non valido — inserisci un NPA svizzero a 4 cifre.",
    "invalidPremium": "Inserisci un premio mensile valido.",
    "nonPositivePremium": "Il premio mensile deve essere superiore a CHF 0.",
    "invalidBirthYear": "Inserisci un anno di nascita valido.",
    "futureBirthYear": "L'anno di nascita è nel futuro.",
    "unrealisticBirthYear": "Inserisci un anno di nascita realistico (max. ~120 anni)."
  },
  "currentPlan": {
    "summaryTitle": "Quanto paghi oggi?",
    "summaryHint": "(facoltativo — mostra il tuo risparmio)",
    "insurerLabel": "Cassa attuale",
    "premiumLabel": "Premio mensile",
    "premiumPlaceholder": "p. es. 350"
  },
  "filterBar": {
    "yearLabel": "Anno:",
    "altModelsLabel": "Modelli alternativi: {state}",
    "accidentLabel": "Copertura infortuni: {state}",
    "stateOn": "attiva",
    "stateOff": "disattiva",
    "included": "inclusa",
    "excluded": "esclusa"
  },
  "results": {
    "summary": "{count} casse · {model} · Copertura infortuni {coverage} · {year}",
    "modelAlt": "modello più conveniente per cassa",
    "modelStandard": "offerta standard più conveniente per cassa",
    "emptyTitle": "Nessuna offerta trovata",
    "emptyMessage": "Per questa combinazione non esistono premi nei dati dell'UFSP. Verifica i tuoi dati o modifica i filtri.",
    "discountBadge": "fino a −{pct}% rispetto allo standard",
    "yourInsurerBadge": "La tua cassa",
    "perMonth": "/mese"
  },
  "headline": {
    "savingsCurrent": "Se non fai nulla: {amount}/mese con {insurer}.",
    "savingsCheapest": "Offerta più conveniente per il tuo profilo nel {year}: {amount}/mese con {insurer} —",
    "savingsAmount": "risparmia {amount}/anno cambiando cassa.",
    "alreadyCheapestExact": "Hai già l'offerta più conveniente per il tuo profilo.",
    "alreadyCheapestBelow": "Il tuo premio è inferiore a tutte le offerte per questo profilo — verifica che franchigia e modello siano comparabili.",
    "alreadyCheapestDetail": "{insurer} · {amount}/mese.",
    "cheapestOnlyTitle": "Offerta più conveniente: {amount}/mese con {insurer}.",
    "cheapestOnlyCta": "Indica la tua cassa attuale per vedere quanto potresti risparmiare. ↓"
  },
  "footer": {
    "dataNotice": "Dati: Open Data UFSP · Pubblicazione {date} · Solo prestazioni obbligatorie (AOMS) · Nessuno sponsor, nessun link di intermediazione"
  },
  "copy": {
    "tarifart": {
      "standard": { "label": "Standard", "description": "Libera scelta del medico" },
      "hausarzt": { "label": "Medico di famiglia", "description": "Primo punto di contatto sempre presso il medico di famiglia scelto" },
      "telmed": { "label": "Telmed", "description": "Chiamata a una hotline obbligatoria prima di ogni visita medica" },
      "hmo": { "label": "HMO", "description": "Primo punto di contatto sempre presso il centro HMO" },
      "andere": { "label": "Modello alternativo", "description": "Scelta limitata del primo punto di contatto" }
    },
    "altersklasse": {
      "kind": "Bambino (0–18)",
      "jung": "Giovane adulto (19–25)",
      "erwachsen": "Adulto (26+)"
    }
  },
  "languageSwitcher": {
    "menuLabel": "Scegli la lingua"
  }
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx vitest run src/messages/messages.test.ts`
Expected: PASS — all three catalogs have exactly `de.json`'s key set.

- [ ] **Step 7: Expand routing to all four locales**

Modify `src/i18n/routing.ts`:

```ts
import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["de", "fr", "it", "en"],
  defaultLocale: "de",
  localePrefix: "always",
});
```

- [ ] **Step 8: Verify the full test suite and build**

Run: `npm test`
Expected: all tests PASS, including the new message-consistency test.

Run: `npm run build`
Expected: succeeds; build output now lists `/de`, `/fr`, `/it`, `/en` as static-generated routes (from `generateStaticParams` in `src/app/[locale]/layout.tsx`).

- [ ] **Step 9: Manual verification**

Run: `npm run dev`, then:

```bash
curl -s http://localhost:3000/fr | grep -o '<title>[^<]*</title>'
curl -s http://localhost:3000/it | grep -o '<title>[^<]*</title>'
curl -s http://localhost:3000/en | grep -o '<title>[^<]*</title>'
curl -sI -H "Accept-Language: fr" http://localhost:3000/ | head -5   # expect redirect to /fr
```

Expected: each locale's `<title>` matches that locale's `meta.title`; the `Accept-Language: fr` request redirects to `/fr`.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat(i18n): add French, Italian, and English translations

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 4: `validate.ts` returns error codes, not display text

**Files:**
- Modify: `src/lib/validate.ts`
- Modify: `src/lib/validate.test.ts`
- Modify: `src/components/inputs/PlzInput.tsx`, `src/components/inputs/BirthYearInput.tsx`, `src/components/current-plan/CurrentPlanSection.tsx`

**Interfaces:**
- Consumes: `messages/{locale}.json`'s `validation.*` namespace (Task 1/3) — six keys: `invalidPlzFormat`, `invalidPremium`, `nonPositivePremium`, `invalidBirthYear`, `futureBirthYear`, `unrealisticBirthYear`.
- Produces: `ValidationErrorCode` (union of those six string literals) and `ValidationResult = { valid: true } | { valid: false; code: ValidationErrorCode }`, exported from `src/lib/validate.ts` — consumed by the three components above.

- [ ] **Step 1: Write the failing test**

Replace the full file content of `src/lib/validate.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { validatePlz, validateBirthYear, validateCurrentPremium } from "@/lib/validate";

describe("validatePlz", () => {
  it("accepts a valid 4-digit PLZ", () => {
    expect(validatePlz("8044")).toEqual({ valid: true });
  });
  it("rejects non-4-digit input with invalidPlzFormat", () => {
    expect(validatePlz("99999")).toEqual({ valid: false, code: "invalidPlzFormat" });
    expect(validatePlz("12")).toEqual({ valid: false, code: "invalidPlzFormat" });
    expect(validatePlz("abcd")).toEqual({ valid: false, code: "invalidPlzFormat" });
  });
});

describe("validateBirthYear", () => {
  const currentYear = new Date().getFullYear();

  it("accepts a realistic birth year", () => {
    expect(validateBirthYear(1988)).toEqual({ valid: true });
  });
  it("rejects a future birth year with futureBirthYear", () => {
    expect(validateBirthYear(currentYear + 1)).toEqual({ valid: false, code: "futureBirthYear" });
  });
  it("rejects an implausibly old birth year with unrealisticBirthYear", () => {
    expect(validateBirthYear(currentYear - 150)).toEqual({ valid: false, code: "unrealisticBirthYear" });
  });
});

describe("validateCurrentPremium", () => {
  it("accepts a positive premium", () => {
    expect(validateCurrentPremium(350.5)).toEqual({ valid: true });
  });
  it("rejects non-finite values with invalidPremium", () => {
    expect(validateCurrentPremium(NaN)).toEqual({ valid: false, code: "invalidPremium" });
    expect(validateCurrentPremium(Infinity)).toEqual({ valid: false, code: "invalidPremium" });
  });
  it("rejects zero or negative values with nonPositivePremium", () => {
    expect(validateCurrentPremium(0)).toEqual({ valid: false, code: "nonPositivePremium" });
    expect(validateCurrentPremium(-5)).toEqual({ valid: false, code: "nonPositivePremium" });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/validate.test.ts`
Expected: FAIL — current `validate.ts` still returns `{ valid: false, message: "..." }`, not `{ valid: false, code: "..." }`.

- [ ] **Step 3: Rewrite `validate.ts` to return codes**

Replace the full file content of `src/lib/validate.ts`:

```ts
// Inline validation for the two required free-form inputs (requirement.md REQ-13).
// Returns error *codes*, not display text — callers translate the code via
// next-intl's `validation` message namespace (src/messages/{locale}.json), since this
// pure lib module has no business owning display text once there's more than one
// language to display it in.

const CURRENT_YEAR = new Date().getFullYear();
const MAX_PLAUSIBLE_AGE = 120;

export type ValidationErrorCode =
  | "invalidPlzFormat"
  | "invalidPremium"
  | "nonPositivePremium"
  | "invalidBirthYear"
  | "futureBirthYear"
  | "unrealisticBirthYear";

export type ValidationResult = { valid: true } | { valid: false; code: ValidationErrorCode };

export function validatePlz(raw: string): ValidationResult {
  if (!/^\d{4}$/.test(raw.trim())) {
    return { valid: false, code: "invalidPlzFormat" };
  }
  return { valid: true };
}

export function validateCurrentPremium(raw: number): ValidationResult {
  if (!Number.isFinite(raw)) {
    return { valid: false, code: "invalidPremium" };
  }
  if (raw <= 0) {
    return { valid: false, code: "nonPositivePremium" };
  }
  return { valid: true };
}

export function validateBirthYear(raw: number): ValidationResult {
  if (!Number.isInteger(raw)) {
    return { valid: false, code: "invalidBirthYear" };
  }
  if (raw > CURRENT_YEAR) {
    return { valid: false, code: "futureBirthYear" };
  }
  if (CURRENT_YEAR - raw > MAX_PLAUSIBLE_AGE) {
    return { valid: false, code: "unrealisticBirthYear" };
  }
  return { valid: true };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/validate.test.ts`
Expected: PASS.

- [ ] **Step 5: Update `PlzInput.tsx` to translate the code**

Replace the full file content of `src/components/inputs/PlzInput.tsx`:

```tsx
"use client";

import { useTranslations } from "next-intl";
import { validatePlz } from "@/lib/validate";

type Props = {
  value: string;
  onChange: (value: string) => void;
  /** True when the PLZ has valid format but doesn't resolve to any known Gemeinde (REQ-13). */
  notFound?: boolean;
};

export function PlzInput({ value, onChange, notFound }: Props) {
  const t = useTranslations();
  const formatResult = value ? validatePlz(value) : { valid: true as const };
  const invalid = !formatResult.valid || Boolean(notFound);
  const message = !formatResult.valid
    ? t(`validation.${formatResult.code}`)
    : notFound
      ? t("inputs.plzNotFound")
      : null;

  return (
    <div>
      <label htmlFor="plz" className="block text-label-large text-on-surface-variant mb-1.5">
        {t("inputs.plzLabel")}
      </label>
      <input
        id="plz"
        type="text"
        inputMode="numeric"
        maxLength={4}
        placeholder={t("inputs.plzPlaceholder")}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-describedby="plz-hint"
        aria-invalid={invalid}
        className={`w-full h-10 px-3 rounded-md border text-[15px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary-container ${
          invalid ? "border-error focus:border-error" : "border-outline-variant focus:border-primary"
        }`}
      />
      {message && (
        <p id="plz-hint" className="text-body-small text-error mt-1">
          {message}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Update `BirthYearInput.tsx` to translate the code**

In `src/components/inputs/BirthYearInput.tsx`, replace the hint paragraph's body:

```tsx
{!result.valid
  ? result.message
  : altersklasse && tiers
```

with:

```tsx
{!result.valid
  ? t(`validation.${result.code}`)
  : altersklasse && tiers
```

(No other change needed in this file — `result` already comes from `validateBirthYear`, which now returns `code` instead of `message`.)

- [ ] **Step 7: Update `CurrentPlanSection.tsx` to translate the code**

In `src/components/current-plan/CurrentPlanSection.tsx`, replace:

```tsx
{!result.valid && (
  <p id="current-premium-hint" className="text-body-small text-error mt-1">
    {result.message}
  </p>
)}
```

with:

```tsx
{!result.valid && (
  <p id="current-premium-hint" className="text-body-small text-error mt-1">
    {t(`validation.${result.code}`)}
  </p>
)}
```

- [ ] **Step 8: Verify**

Run: `npm test`
Expected: all tests PASS.

Run: `npm run build`
Expected: succeeds (no leftover references to `.message` on a `ValidationResult`).

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "refactor(validate): return error codes instead of display text

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 5: Locale-aware `formatMemberCount`/`formatMemberCountDetail`, and locale-aware footer date

**Files:**
- Modify: `src/lib/format.ts`
- Modify: `src/lib/format.test.ts`
- Modify: `src/components/results/PlanRow.tsx`, `src/components/InsuranceComparator.tsx`

**Interfaces:**
- Produces: `formatMemberCount(count: number, locale: string): string` and `formatMemberCountDetail(count: number, asOfYear: number, locale: string): string` — both now take a third/second-and-third `locale` argument (breaking change from Task 2's call sites, which this task updates).
- `formatChf(amount: number): string` is unchanged — no `locale` parameter, per Global Constraints.

- [ ] **Step 1: Write the failing test**

Replace the full file content of `src/lib/format.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { formatChf, formatMemberCount, formatMemberCountDetail } from "@/lib/format";

describe("formatChf", () => {
  it("formats with apostrophe thousands separator and two decimals", () => {
    expect(formatChf(1234.5)).toBe("CHF 1'234.50");
  });
  it("formats small amounts without a separator", () => {
    expect(formatChf(301.1)).toBe("CHF 301.10");
  });
  it("formats large amounts with multiple separators", () => {
    expect(formatChf(1234567.89)).toBe("CHF 1'234'567.89");
  });
});

describe("formatMemberCount", () => {
  it("formats sub-1000 counts as an exact integer regardless of locale", () => {
    expect(formatMemberCount(999, "de")).toBe("999");
    expect(formatMemberCount(999, "en")).toBe("999");
  });
  it("formats thousands rounded to the nearest whole unit, per locale", () => {
    expect(formatMemberCount(1000, "de")).toBe("1 Tsd.");
    expect(formatMemberCount(2792, "de")).toBe("3 Tsd."); // real: Krankenkasse Birchmeier
    expect(formatMemberCount(813080, "de")).toBe("813 Tsd."); // real: Swica
    expect(formatMemberCount(813080, "en")).toBe("813 k");
    expect(formatMemberCount(813080, "fr")).toBe("813 k");
    expect(formatMemberCount(813080, "it")).toBe("813 mila");
  });
  it("formats millions with one decimal, per locale", () => {
    expect(formatMemberCount(1537730, "de")).toBe("1.5 Mio."); // real: CSS
    expect(formatMemberCount(1290207, "de")).toBe("1.3 Mio."); // real: Helsana
    expect(formatMemberCount(1537730, "en")).toBe("1.5 M");
    expect(formatMemberCount(1537730, "fr")).toBe("1.5 mio");
    expect(formatMemberCount(1537730, "it")).toBe("1.5 mio");
  });
  it("rounds the thousand/million cutover boundary up", () => {
    expect(formatMemberCount(999999, "de")).toBe("1.0 Mio.");
  });
  it("crosses over to million as low as ~950'000, not a clean 1'000'000", () => {
    expect(formatMemberCount(960000, "de")).toBe("1.0 Mio.");
  });
  it("stays in thousands just below the effective cutover", () => {
    expect(formatMemberCount(949999, "de")).toBe("950 Tsd.");
  });
  it("falls back to German units for an unrecognized locale", () => {
    expect(formatMemberCount(2792, "xx")).toBe("3 Tsd.");
  });
});

describe("formatMemberCountDetail", () => {
  it("formats the exact grouped count with the data-as-of year, per locale", () => {
    expect(formatMemberCountDetail(1537730, 2024, "de")).toBe("1'537'730 Versicherte · Stand 2024");
    expect(formatMemberCountDetail(1537730, 2024, "en")).toBe("1'537'730 insured · as of 2024");
    expect(formatMemberCountDetail(1537730, 2024, "fr")).toBe("1'537'730 assurés · en 2024");
    expect(formatMemberCountDetail(1537730, 2024, "it")).toBe("1'537'730 assicurati · nel 2024");
  });
  it("rounds a fractional count before grouping", () => {
    expect(formatMemberCountDetail(2791.6, 2024, "de")).toBe("2'792 Versicherte · Stand 2024");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/format.test.ts`
Expected: FAIL — `formatMemberCount`/`formatMemberCountDetail` don't accept a `locale` argument yet.

- [ ] **Step 3: Rewrite `format.ts`**

Replace the full file content of `src/lib/format.ts`:

```ts
// Swiss-convention monetary formatting (requirement.md §9): apostrophe thousands
// separator, two decimal places, "CHF" prefix — identical across all UI languages,
// since this is a currency convention, not a language one.

function groupThousands(intPart: string): string {
  return intPart.replace(/\B(?=(\d{3})+(?!\d))/g, "'");
}

export function formatChf(amount: number): string {
  const parts = amount.toFixed(2).split(".");
  return `CHF ${groupThousands(parts[0])}.${parts[1]}`;
}

const MEMBER_COUNT_UNITS: Record<string, { million: string; thousand: string }> = {
  de: { million: "Mio.", thousand: "Tsd." },
  fr: { million: "mio", thousand: "k" },
  it: { million: "mio", thousand: "mila" },
  en: { million: "M", thousand: "k" },
};

// Abbreviated OKP enrollment count for the member-count badge (PlanRow). Real BAG 2024
// range: ~2'800 (smallest regional Kasse) to ~1.5 Mio. (largest).
//
// NOTE: the million/thousand cutover below effectively triggers starting ~950'000, not
// at a clean 1'000'000 — because the boundary check compares the *rounded-to-one-decimal*
// million value (e.g. 960'000 -> "1.0" -> >= 1.0 -> million unit), not the raw count
// against 1_000_000. This is intentional: it's what makes 999'999 round up to the
// "1.0 million" form instead of the confusing "1000 thousand" a naive
// `rounded >= 1_000_000` check would produce. Don't "fix" this back to a raw threshold
// without re-introducing that bug — see the formatMemberCount tests around
// 949'999/960'000/999'999 for the pinned behavior.
export function formatMemberCount(count: number, locale: string): string {
  const units = MEMBER_COUNT_UNITS[locale] ?? MEMBER_COUNT_UNITS.de;
  const rounded = Math.round(count);
  const milliFormat = (rounded / 1_000_000).toFixed(1);
  if (parseFloat(milliFormat) >= 1.0) return `${milliFormat} ${units.million}`;
  if (rounded >= 1_000) return `${Math.round(rounded / 1_000)} ${units.thousand}`;
  return String(rounded);
}

const INSURED_WORD: Record<string, string> = {
  de: "Versicherte",
  fr: "assurés",
  it: "assicurati",
  en: "insured",
};

const AS_OF_WORD: Record<string, string> = {
  de: "Stand",
  fr: "en",
  it: "nel",
  en: "as of",
};

// Exact count + the enrollment data's own publication year, for the badge's tooltip
// (the enrollment data lags the premium year — see Metadata.memberCountAsOf).
export function formatMemberCountDetail(count: number, asOfYear: number, locale: string): string {
  const insured = INSURED_WORD[locale] ?? INSURED_WORD.de;
  const asOf = AS_OF_WORD[locale] ?? AS_OF_WORD.de;
  return `${groupThousands(String(Math.round(count)))} ${insured} · ${asOf} ${asOfYear}`;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/format.test.ts`
Expected: PASS.

- [ ] **Step 5: Update `PlanRow.tsx`'s call sites**

In `src/components/results/PlanRow.tsx`, add `useLocale` to the import:

```tsx
import { useLocale, useTranslations } from "next-intl";
```

Inside the component, alongside `const t = useTranslations();`, add:

```tsx
const locale = useLocale();
```

Replace:

```tsx
title={formatMemberCountDetail(memberCount, memberCountAsOf)}
aria-label={formatMemberCountDetail(memberCount, memberCountAsOf)}
```

with:

```tsx
title={formatMemberCountDetail(memberCount, memberCountAsOf, locale)}
aria-label={formatMemberCountDetail(memberCount, memberCountAsOf, locale)}
```

Replace:

```tsx
<span aria-hidden="true">👥</span> {formatMemberCount(memberCount)}
```

with:

```tsx
<span aria-hidden="true">👥</span> {formatMemberCount(memberCount, locale)}
```

- [ ] **Step 6: Make the footer date locale-aware in `InsuranceComparator.tsx`**

Add `useLocale` to the existing `next-intl` import:

```tsx
import { useLocale, useTranslations } from "next-intl";
```

Add a module-level constant near the top of the file (alongside `ALT_MODELS`):

```tsx
const DATE_LOCALE: Record<string, string> = { de: "de-CH", fr: "fr-CH", it: "it-CH", en: "en-CH" };
```

Inside the component, alongside `const t = useTranslations();`, add:

```tsx
const locale = useLocale();
```

Replace the footer's date formatting:

```tsx
date: new Date(metadata.publicationDate).toLocaleDateString("de-CH", {
  day: "numeric",
  month: "long",
  year: "numeric",
}),
```

with:

```tsx
date: new Date(metadata.publicationDate).toLocaleDateString(DATE_LOCALE[locale] ?? "de-CH", {
  day: "numeric",
  month: "long",
  year: "numeric",
}),
```

- [ ] **Step 7: Verify**

Run: `npm test`
Expected: all tests PASS.

Run: `npm run build`
Expected: succeeds.

Run: `npm run dev`, visit `http://localhost:3000/fr` with a plan that has a member count — expect the badge to read e.g. `813 k` and its tooltip to read e.g. `813'080 assurés · en 2024`, and the footer date to read in French (e.g. "15 octobre 2025").

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(i18n): locale-aware member-count formatting and footer date

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 6: Language switcher

**Files:**
- Create: `src/components/LanguageSwitcher.tsx`
- Modify: `src/components/InsuranceComparator.tsx`

**Interfaces:**
- Consumes: `routing` (Task 1/3), `usePathname`/`useRouter` from `src/i18n/navigation.ts` (Task 1), `languageSwitcher.menuLabel` (Task 1/3).
- Produces: `LanguageSwitcher()` — a self-contained component with no props, rendered once in `InsuranceComparator.tsx`.

- [ ] **Step 1: Create the switcher**

Create `src/components/LanguageSwitcher.tsx`:

```tsx
"use client";

import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

// Each language's own name is shown in that language, not translated per the
// active locale — the standard convention for language switchers (spec:
// "Language switcher").
const LANGUAGE_NAMES: Record<(typeof routing.locales)[number], string> = {
  de: "Deutsch",
  fr: "Français",
  it: "Italiano",
  en: "English",
};

export function LanguageSwitcher() {
  const locale = useLocale();
  const t = useTranslations("languageSwitcher");
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  const handleChange = (nextLocale: string) => {
    const query = searchParams.toString();
    // Preserve every query param (plz, birthYear, franchise, ...) across the
    // locale switch, so a shared comparison link keeps working (spec:
    // "Language switcher").
    router.replace(`${pathname}${query ? `?${query}` : ""}`, { locale: nextLocale });
  };

  return (
    <label className="inline-flex items-center gap-1.5 text-sm text-on-surface-variant">
      <span className="sr-only">{t("menuLabel")}</span>
      <select
        aria-label={t("menuLabel")}
        value={locale}
        onChange={(e) => handleChange(e.target.value)}
        className="h-8 rounded-md border border-outline-variant bg-surface px-2 text-sm outline-none focus:border-primary"
      >
        {routing.locales.map((code) => (
          <option key={code} value={code}>
            {LANGUAGE_NAMES[code]}
          </option>
        ))}
      </select>
    </label>
  );
}
```

- [ ] **Step 2: Render it in `InsuranceComparator.tsx`**

Add the import:

```tsx
import { LanguageSwitcher } from "./LanguageSwitcher";
```

Replace:

```tsx
<h1 className="text-title-large text-on-surface mb-1">{t("inputs.title")}</h1>
<p className="text-body-medium text-on-surface-variant mb-5">{t("inputs.tagline")}</p>
```

with:

```tsx
<div className="flex items-start justify-between gap-3 mb-1">
  <h1 className="text-title-large text-on-surface">{t("inputs.title")}</h1>
  <LanguageSwitcher />
</div>
<p className="text-body-medium text-on-surface-variant mb-5">{t("inputs.tagline")}</p>
```

- [ ] **Step 3: Verify**

Run: `npm test`
Expected: all tests PASS (no test coverage of this component; this just confirms nothing else broke).

Run: `npm run build`
Expected: succeeds.

Run: `npm run dev`, visit `http://localhost:3000/de?plz=8000&by=1990`, switch to French via the dropdown — expect the URL to become `/fr?plz=8000&by=1990` (query params preserved) and the page text to switch to French.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(i18n): add language switcher

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 7: hreflang alternates and per-locale sitemap

**Files:**
- Modify: `src/app/[locale]/layout.tsx`, `src/app/sitemap.ts`

**Interfaces:**
- Consumes: `routing.locales`, `routing.defaultLocale` (Task 1/3).
- No new exports — `generateMetadata` and `sitemap()` are Next.js file conventions, not imported elsewhere.

- [ ] **Step 1: Add hreflang alternates to `generateMetadata`**

In `src/app/[locale]/layout.tsx`, add the `routing` import already present, and update `generateMetadata`:

```tsx
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://example.com";

  return {
    title: t("title"),
    description: t("description"),
    alternates: {
      languages: {
        ...Object.fromEntries(routing.locales.map((l) => [l, `${baseUrl}/${l}`])),
        "x-default": `${baseUrl}/${routing.defaultLocale}`,
      },
    },
    openGraph: { title: t("ogTitle"), description: t("ogDescription"), type: "website" },
    twitter: { card: "summary", title: t("twitterTitle"), description: t("twitterDescription") },
  };
}
```

- [ ] **Step 2: Emit one sitemap entry per locale**

Replace the full file content of `src/app/sitemap.ts`:

```ts
import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";

// One entry per locale (REQ-20 still holds: only base URLs are indexable, no
// parameterised comparison URLs), each carrying hreflang alternates so search
// engines can link the language versions of the same page together.
export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://example.com";
  const languages = Object.fromEntries(routing.locales.map((l) => [l, `${baseUrl}/${l}`]));

  return routing.locales.map((locale) => ({
    url: `${baseUrl}/${locale}`,
    lastModified: new Date(),
    changeFrequency: "yearly",
    priority: locale === routing.defaultLocale ? 1 : 0.9,
    alternates: { languages },
  }));
}
```

- [ ] **Step 3: Verify `robots.ts` needs no change**

Read `src/app/robots.ts` and confirm it already disallows only `/admin` and points at `/sitemap.xml` — both still correct (the sitemap now lists 4 URLs instead of 1, but its location is unchanged). No edit needed.

- [ ] **Step 4: Verify**

Run: `npm test`
Expected: all tests PASS.

Run: `npm run build`
Expected: succeeds.

Run: `npm run dev`, then:

```bash
curl -s http://localhost:3000/sitemap.xml | grep -c '<loc>'          # expect 4
curl -s http://localhost:3000/sitemap.xml | grep 'hreflang'          # expect one xhtml:link per locale, per URL
curl -s http://localhost:3000/de | grep -o '<link rel="alternate"[^>]*>' # expect 5 tags (4 locales + x-default)
```

Expected: sitemap lists 4 `<loc>` entries with hreflang alternates; each locale page's `<head>` carries 5 `<link rel="alternate" hreflang=...>` tags.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(i18n): hreflang alternates and per-locale sitemap

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```
