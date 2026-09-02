"use client";

import { useTranslations, useLocale } from "next-intl";
import {
  formatProjection,
  type CantonAverage,
  type RawProjection,
} from "@/lib/praemienGuide";
import { CANTON_NAMES, type CantonCode } from "@/lib/cantonNames";

// Mirrors HowItWorksContent's role (src/components/help/HowItWorksContent.tsx)
// for the /praemien page. "use client" for useTranslations — Next still
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
  projection,
}: {
  year: number;
  cantonAverages: CantonAverage[];
  projection: RawProjection;
}) {
  const t = useTranslations("praemienGuide");
  const locale = useLocale();
  const cantonNames =
    CANTON_NAMES[locale as keyof typeof CANTON_NAMES] ?? CANTON_NAMES.de;

  return (
    <div className="text-on-surface">
      <h1 className="text-title-large">{t("h1", { year })}</h1>
      <p className="mt-2 text-body-medium text-on-surface-variant">
        {t("intro")}{" "}
        {t("projected", formatProjection(projection, locale))}
      </p>

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
                <td className="py-1 pr-2">
                  {cantonNames[kanton as CantonCode] ??
                    CANTON_NAMES.de[kanton as CantonCode] ??
                    kanton}
                </td>
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
