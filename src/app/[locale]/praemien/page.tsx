// src/app/[locale]/praemien/page.tsx
// SEO content page on every locale (docs/superpowers/specs/2026-09-02-
// praemien-guide-i18n-design.md). Mirrors how-it-works/page.tsx.

import type { Metadata } from "next";
import { Suspense } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { getSiteUrl } from "@/lib/site-url";
import { Link } from "@/i18n/navigation";
import { PraemienGuideContent } from "@/components/help/PraemienGuideContent";
import { BackToComparisonLink } from "@/components/help/BackToComparisonLink";
import { averagePremiumByCanton, buildFaqJsonLd } from "@/lib/praemienGuide";
import { readPremiumRows } from "@/lib/praemienGuideData";
import metadata from "@/data/metadata.json";
import projection from "@/data/praemienProjection.json";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;

  const t = await getTranslations({ locale, namespace: "meta" });
  const baseUrl = getSiteUrl();
  const year = Math.max(...metadata.availableYears);
  // Title identity is the data year (matches the canton table), and flips to
  // the new year automatically once that year's BAG file is ingested. The
  // description additionally name-checks {nextYear} for the forecast hook —
  // derived, not a second source of truth.
  const vars = { year, nextYear: year + 1 };

  return {
    title: t("praemienGuideTitle", vars),
    description: t("praemienGuideDescription", vars),
    alternates: {
      languages: {
        ...Object.fromEntries(
          routing.locales.map((l) => [l, `${baseUrl}/${l}/praemien`]),
        ),
        "x-default": `${baseUrl}/${routing.defaultLocale}/praemien`,
      },
    },
    openGraph: {
      title: t("praemienGuideTitle", vars),
      description: t("praemienGuideDescription", vars),
      type: "article",
    },
    twitter: {
      card: "summary",
      title: t("praemienGuideTitle", vars),
      description: t("praemienGuideDescription", vars),
    },
  };
}

export default async function PraemienGuidePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
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

  // FAQPage structured data from the same q/a pairs the page renders
  // (praemienGuide.faq.*), so the FAQ is machine-readable for search engines.
  const tg = await getTranslations({ locale, namespace: "praemienGuide" });
  const faqLd = buildFaqJsonLd((key) => tg(key));

  return (
    <main className="mx-auto my-8 max-w-[720px] px-4">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }}
      />
      <Suspense fallback={backFallback}>
        <BackToComparisonLink />
      </Suspense>
      <div className="mt-4">
        <PraemienGuideContent
          year={year}
          cantonAverages={cantonAverages}
          projection={projection}
        />
      </div>
      <div className="mt-6">
        <Suspense fallback={backFallback}>
          <BackToComparisonLink />
        </Suspense>
      </div>
    </main>
  );
}
