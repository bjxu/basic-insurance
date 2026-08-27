import type { Metadata } from "next";
import { Suspense } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { getSiteUrl } from "@/lib/site-url";
import { Link } from "@/i18n/navigation";
import { HowItWorksContent } from "@/components/help/HowItWorksContent";
import { BackToComparisonLink } from "@/components/help/BackToComparisonLink";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  const baseUrl = getSiteUrl();

  return {
    title: t("howItWorksTitle"),
    description: t("howItWorksDescription"),
    alternates: {
      languages: {
        ...Object.fromEntries(routing.locales.map((l) => [l, `${baseUrl}/${l}/how-it-works`])),
        "x-default": `${baseUrl}/${routing.defaultLocale}/how-it-works`,
      },
    },
    openGraph: {
      title: t("howItWorksTitle"),
      description: t("howItWorksDescription"),
      type: "article",
    },
    twitter: {
      card: "summary",
      title: t("howItWorksTitle"),
      description: t("howItWorksDescription"),
    },
  };
}

export default async function HowItWorksPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Static fallback so the back-link is in the prerendered HTML (crawl graph, no
  // layout shift); BackToComparisonLink upgrades it to the query-preserving
  // version on hydration.
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
        <HowItWorksContent full />
      </div>
      <div className="mt-6">
        <Suspense fallback={backFallback}>
          <BackToComparisonLink />
        </Suspense>
      </div>
    </main>
  );
}
