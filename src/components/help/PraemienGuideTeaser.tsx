"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import metadata from "@/data/metadata.json";
import projection from "@/data/praemienProjection.json";

// Standalone teaser above the comparator card (InsuranceComparator), linking to
// the /de/praemien SEO guide. Rendered on every locale: the guide is
// German-only content, so the copy here is German too (the praemienGuide
// namespace), matching the page it links to. `locale="de"` on the Link keeps
// the target at /de/praemien even from /fr, /it, /en.
//
// SEO: `lang="de"` scopes this German block for crawlers on the non-German
// homepages (the surrounding page is `lang="fr"` etc.). The title is a plain
// styled <p>, not a heading — it's a promo blurb that sits above the page's
// own <h1>, so making it <h2> would break the heading outline.
export function PraemienGuideTeaser() {
  const t = useTranslations("praemienGuide");
  const year = Math.max(...metadata.availableYears);

  return (
    <div
      lang="de"
      className="mb-4 rounded-lg border border-outline-variant bg-surface p-4 shadow-sm"
    >
      <p className="text-title-medium text-on-surface">{t("h1", { year })}</p>
      <p className="mt-1 text-body-small text-on-surface-variant">
        {t("intro")}{" "}
        {t("projected", {
          comparis: projection.comparis.increase,
          bag: projection.bag.increase,
          asOf: projection.asOf,
        })}
      </p>
      <Link
        href="/praemien"
        locale="de"
        className="mt-2 inline-block text-body-small font-semibold text-primary"
      >
        {t("teaserCta")}
      </Link>
    </div>
  );
}
