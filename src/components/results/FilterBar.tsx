"use client";

import { useTranslations } from "next-intl";
import { HelpTip } from "@/components/help/HelpTip";

type Props = {
  year: number;
  availableYears: number[];
  onYearChange: (year: number) => void;
  altModelsActive: boolean;
  onToggleAltModels: () => void;
  unfalldeckung: boolean;
  onToggleUnfalldeckung: () => void;
  onOpenGuide: (section?: string) => void;
};

export function FilterBar({
  year,
  availableYears,
  onYearChange,
  altModelsActive,
  onToggleAltModels,
  unfalldeckung,
  onToggleUnfalldeckung,
  onOpenGuide,
}: Props) {
  const t = useTranslations("filterBar");
  return (
    <div className="mt-4 flex items-center gap-2 flex-wrap">
      <span className="text-sm text-on-surface-variant mr-1">{t("yearLabel")}</span>
      <div className="flex rounded-md border border-outline-variant overflow-hidden">
        {availableYears.map((y, i) => (
          <button
            key={y}
            type="button"
            onClick={() => onYearChange(y)}
            aria-pressed={year === y}
            className={`px-3.5 py-1.5 text-sm ${i > 0 ? "border-l border-outline-variant" : ""} ${
              year === y ? "bg-primary text-on-primary font-semibold" : "bg-surface text-on-surface-variant"
            }`}
          >
            {y}
          </button>
        ))}
      </div>
      <div className="w-px h-6 bg-outline-variant mx-1" />
      <span className="relative inline-flex items-center gap-1">
        <button
          type="button"
          role="button"
          aria-pressed={altModelsActive}
          onClick={onToggleAltModels}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm ${
            altModelsActive ? "bg-primary-container border-primary-container text-primary font-semibold" : "border-outline-variant text-on-surface-variant"
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${altModelsActive ? "bg-primary" : "bg-outline"}`} />
          {t("altModelsLabel", { state: altModelsActive ? t("stateOn") : t("stateOff") })}
        </button>
        <HelpTip term="models" onOpenGuide={onOpenGuide} />
      </span>
      <span className="relative inline-flex items-center gap-1">
        <button
          type="button"
          role="button"
          aria-pressed={unfalldeckung}
          onClick={onToggleUnfalldeckung}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm ${
            unfalldeckung ? "bg-primary-container border-primary-container text-primary font-semibold" : "border-outline-variant text-on-surface-variant"
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${unfalldeckung ? "bg-primary" : "bg-outline"}`} />
          {t("accidentLabel", { state: unfalldeckung ? t("included") : t("excluded") })}
        </button>
        <HelpTip term="unfalldeckung" onOpenGuide={onOpenGuide} />
      </span>
    </div>
  );
}
