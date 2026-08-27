"use client";

import { useTranslations } from "next-intl";
import { GUIDE_TERM_KEYS } from "@/lib/help";

// Shared body for both the drawer (full=false: term chips) and the standalone
// /how-it-works page (full=true: <h1>, section ids, full term list). Content
// core, spec §"Content core" / §"Explainer surfaces".
export function HowItWorksContent({ full = false }: { full?: boolean }) {
  const t = useTranslations("help");
  const tt = useTranslations("help.terms");

  return (
    <div className="text-on-surface">
      {full ? (
        <h1 className="text-title-large">{t("drawer.title")}</h1>
      ) : (
        <h2 className="text-title-medium">{t("drawer.title")}</h2>
      )}
      <p className="mt-2 text-body-medium text-on-surface-variant">{t("guide.lead")}</p>

      <section id={full ? "regeln" : undefined} className="mt-5 border-t border-outline-variant pt-4">
        {full ? (
          <h2 className="text-label-large text-on-surface">{t("guide.rules.heading")}</h2>
        ) : (
          <h3 className="text-label-large text-on-surface">{t("guide.rules.heading")}</h3>
        )}
        <ul className="mt-2 list-disc pl-5 text-body-small text-on-surface-variant space-y-1.5">
          <li>{t("guide.rules.item1")}</li>
          <li>{t("guide.rules.item2")}</li>
          <li>{t("guide.rules.item3")}</li>
          <li>{t("guide.rules.item4")}</li>
        </ul>
      </section>

      <section id={full ? "begriffe" : undefined} className="mt-4 border-t border-outline-variant pt-4">
        {full ? (
          <h2 className="text-label-large text-on-surface">{t("guide.terms.heading")}</h2>
        ) : (
          <h3 className="text-label-large text-on-surface">{t("guide.terms.heading")}</h3>
        )}
        {full ? (
          <>
            <p className="mt-1 text-body-small text-on-surface-variant">{t("guide.terms.intro")}</p>
            <dl className="mt-3 space-y-3">
              {GUIDE_TERM_KEYS.map((key) => (
                <div key={key}>
                  <dt className="text-body-small font-bold text-on-surface">{tt(`${key}.title`)}</dt>
                  <dd className="text-body-small text-on-surface-variant">{tt(`${key}.short`)}</dd>
                </div>
              ))}
            </dl>
          </>
        ) : (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {GUIDE_TERM_KEYS.map((key) => (
              <span
                key={key}
                className="rounded bg-primary-container px-1.5 py-0.5 text-[10.5px] font-semibold text-on-primary-container"
              >
                {tt(`${key}.title`)}
              </span>
            ))}
          </div>
        )}
      </section>

      <section id={full ? "modelle" : undefined} className="mt-4 border-t border-outline-variant pt-4">
        {full ? (
          <h2 className="text-label-large text-on-surface">{t("guide.models.heading")}</h2>
        ) : (
          <h3 className="text-label-large text-on-surface">{t("guide.models.heading")}</h3>
        )}
        <p className="mt-2 text-body-small text-on-surface-variant">{t("guide.models.body")}</p>
      </section>
    </div>
  );
}
