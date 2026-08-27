"use client";

import { useTranslations } from "next-intl";
import { GUIDE_TERM_KEYS } from "@/lib/help";
import { ModelList } from "./ModelList";

// Shared body for the drawer (full=false) and the standalone /how-it-works page
// (full=true: <h1> + the "same as next to each field" intro line). Section ids
// are always rendered so the drawer can scroll to a term's section when opened
// from an ⓘ's "full explainer" link. Content core, spec §"Content core" /
// §"Explainer surfaces". The drawer and the page never mount together (separate
// routes), so the shared ids don't collide.
export function HowItWorksContent({ full = false }: { full?: boolean }) {
  const t = useTranslations("help");
  const tt = useTranslations("help.terms");

  const Heading = full ? "h2" : "h3";

  return (
    <div className="text-on-surface">
      {full ? (
        <h1 className="text-title-large">{t("drawer.title")}</h1>
      ) : (
        <h2 className="text-title-medium">{t("drawer.title")}</h2>
      )}
      <p className="mt-2 text-body-medium text-on-surface-variant">{t("guide.lead")}</p>

      <section id="regeln" className="mt-5 border-t border-outline-variant pt-4">
        <Heading className="text-label-large text-on-surface">{t("guide.rules.heading")}</Heading>
        <ul className="mt-2 list-disc pl-5 text-body-small text-on-surface-variant space-y-1.5">
          <li>{t("guide.rules.item1")}</li>
          <li>{t("guide.rules.item2")}</li>
          <li>{t("guide.rules.item3")}</li>
          <li>{t("guide.rules.item4")}</li>
        </ul>
      </section>

      <section id="begriffe" className="mt-4 border-t border-outline-variant pt-4">
        <Heading className="text-label-large text-on-surface">{t("guide.terms.heading")}</Heading>
        {full && (
          <p className="mt-1 text-body-small text-on-surface-variant">{t("guide.terms.intro")}</p>
        )}
        <dl className="mt-3 space-y-3">
          {GUIDE_TERM_KEYS.map((key) => (
            <div key={key}>
              <dt className="text-body-small font-bold text-on-surface">{tt(`${key}.title`)}</dt>
              <dd className="text-body-small text-on-surface-variant">{tt(`${key}.short`)}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section id="modelle" className="mt-4 border-t border-outline-variant pt-4">
        <Heading className="text-label-large text-on-surface">{t("guide.models.heading")}</Heading>
        <ModelList className="mt-2" />
      </section>
    </div>
  );
}
