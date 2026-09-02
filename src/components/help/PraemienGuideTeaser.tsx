"use client";

import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { formatProjection } from "@/lib/praemienGuide";
import metadata from "@/data/metadata.json";
import projection from "@/data/praemienProjection.json";

// Standalone teaser above the comparator card (InsuranceComparator), linking to
// the /praemien SEO guide. Rendered on every locale: it shows the active
// locale's copy (the praemienGuide namespace) and links to /praemien in that
// same locale.
//
// SEO: the title is a plain styled <p>, not a heading — it's a promo blurb that
// sits above the page's own <h1>, so making it <h2> would break the heading
// outline.
export function PraemienGuideTeaser() {
  const t = useTranslations("praemienGuide");
  const locale = useLocale();
  const year = Math.max(...metadata.availableYears);

  return (
    <div className="mb-4 rounded-lg border border-outline-variant bg-surface p-4 shadow-sm">
      <p className="text-title-medium text-on-surface">{t("h1", { year })}</p>
      <p className="mt-1 text-body-small text-on-surface-variant">
        {t("intro")}{" "}
        {t("projected", formatProjection(projection, locale))}
      </p>
      <Link
        href="/praemien"
        className="mt-2 inline-block text-body-small font-semibold text-primary"
      >
        {t("teaserCta")}
      </Link>
    </div>
  );
}
