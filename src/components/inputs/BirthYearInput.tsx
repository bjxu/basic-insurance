"use client";

import { useTranslations } from "next-intl";
import { validateBirthYear } from "@/lib/validate";
import { getAltersklasse, getFranchiseTiers } from "@/lib/ageband";
import { HelpTip } from "@/components/help/HelpTip";

type Props = {
  value: string;
  onChange: (value: string) => void;
  calendarYear: number;
};

export function BirthYearInput({ value, onChange, calendarYear }: Props) {
  const t = useTranslations();
  const parsed = value ? Number(value) : null;
  const result = parsed != null ? validateBirthYear(parsed) : { valid: true as const };
  const altersklasse = parsed != null && result.valid ? getAltersklasse(parsed, calendarYear) : null;
  const tiers = altersklasse ? getFranchiseTiers(altersklasse) : null;

  return (
    <div className="relative">
      <div className="flex items-start gap-1 mb-1.5">
        <label htmlFor="by" className="text-label-large text-on-surface-variant">
          {t("inputs.birthYearLabel")}
        </label>
        <HelpTip term="birthYear" />
      </div>
      <input
        id="by"
        type="number"
        placeholder={t("inputs.birthYearPlaceholder")}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-describedby="by-hint"
        aria-invalid={!result.valid}
        className={`w-full h-10 px-3 rounded-md border text-[15px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary-container ${
          result.valid ? "border-outline-variant focus:border-primary" : "border-error focus:border-error"
        }`}
      />
      <p id="by-hint" className={`text-body-small mt-1 ${result.valid ? "text-outline" : "text-error"}`}>
        {!result.valid
          ? t(`validation.${result.code}`)
          : altersklasse && tiers
            ? t("inputs.birthYearHintResolved", {
                altersklasse: t(`copy.altersklasse.${altersklasse}`),
                min: tiers[0],
                max: tiers[tiers.length - 1],
              })
            : t("inputs.birthYearHintDefault")}
      </p>
    </div>
  );
}
