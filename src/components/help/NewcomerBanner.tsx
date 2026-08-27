"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { readHelpSeen, markHelpSeen } from "@/lib/help";

// Always renders the banner. The first-run slim card renders only when the user
// hasn't dismissed it before — gated in an effect so SSR and first client render
// agree (no hydration mismatch), then it appears if needed (spec §"First-run").
export function NewcomerBanner({ onOpenGuide }: { onOpenGuide: () => void }) {
  const t = useTranslations("help");
  const [showCard, setShowCard] = useState(false);

  useEffect(() => {
    setShowCard(!readHelpSeen());
  }, []);

  function dismiss() {
    markHelpSeen();
    setShowCard(false);
  }

  return (
    <>
      {showCard && (
        <div className="mb-3 flex items-start gap-2.5 rounded-lg bg-primary-container p-3 text-[13px] text-on-primary-container">
          <p className="flex-1">
            {t("firstRun.text")}{" "}
            <button
              type="button"
              onClick={onOpenGuide}
              className="font-semibold text-primary underline-offset-2 hover:underline"
            >
              {t("firstRun.cta")}
            </button>
          </p>
          <button
            type="button"
            onClick={dismiss}
            aria-label={t("firstRun.dismiss")}
            className="p-0.5 text-sm leading-none text-on-surface-variant"
          >
            ✕
          </button>
        </div>
      )}
      <div className="mb-4 flex items-center justify-between gap-3 rounded-md bg-primary-container px-3 py-2 text-[13px] text-on-primary-container">
        <span>{t("banner.text")}</span>
        <button
          type="button"
          onClick={onOpenGuide}
          className="whitespace-nowrap font-semibold text-primary"
        >
          {t("banner.cta")}
        </button>
      </div>
    </>
  );
}
