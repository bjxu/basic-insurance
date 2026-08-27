"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { readHelpSeen, markHelpSeen } from "@/lib/help";

// Renders exactly one newcomer entry point at a time, both opening the same
// guide (spec §"First-run": "thereafter only the always-present banner shows"):
// - first visit: the dismissible slim card;
// - after dismissal / return visits: the quieter always-present banner.
// `showCard` starts false so SSR and the first client paint render the banner
// (a real element in the static HTML); the effect then swaps in the card for
// first-time visitors. No hydration mismatch — the swap is a post-mount update.
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

  if (showCard) {
    return (
      <div className="mb-4 flex items-start gap-2.5 rounded-lg bg-primary-container p-3 text-[13px] text-on-primary-container">
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
    );
  }

  return (
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
  );
}
