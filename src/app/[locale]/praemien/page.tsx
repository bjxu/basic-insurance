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
import { averagePremiumByCanton } from "@/lib/praemienGuide";
import { readPremiumRows } from "@/lib/praemienGuideData";
import metadata from "@/data/metadata.json";
import projection from "@/data/praemienProjection.json";

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
        <PraemienGuideContent
          year={year}
          cantonAverages={cantonAverages}
          projection={{
            comparis: projection.comparis.increase,
            bag: projection.bag.increase,
            asOf: projection.asOf,
          }}
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
