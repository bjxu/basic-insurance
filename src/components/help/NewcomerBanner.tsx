"use client";

import { useTranslations } from "next-intl";

// Always-present newcomer entry point at the top of the input card. Opens the
// how-it-works guide (spec §"Banner"). No first-run / dismissal state — the
// banner is quiet enough to live there permanently.
export function NewcomerBanner({ onOpenGuide }: { onOpenGuide: () => void }) {
  const t = useTranslations("help");

  return (
    <div className="mb-4 flex items-center justify-between gap-3 rounded-md bg-primary-container px-3 py-2 text-[13px] text-on-primary-container">
      <span>{t("banner.text")}</span>
      <button
        type="button"
        onClick={() => onOpenGuide()}
        className="whitespace-nowrap font-semibold text-primary"
      >
        {t("banner.cta")}
      </button>
    </div>
  );
}
