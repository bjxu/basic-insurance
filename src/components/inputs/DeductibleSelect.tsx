"use client";

import { useTranslations } from "next-intl";
import type { Altersklasse } from "@/lib/types";
import { getFranchiseTiers } from "@/lib/ageband";
import { HelpTip } from "@/components/help/HelpTip";

type Props = {
  altersklasse: Altersklasse | null;
  value: number | null;
  onChange: (value: number) => void;
  onOpenGuide: (section?: string) => void;
};

export function DeductibleSelect({ altersklasse, value, onChange, onOpenGuide }: Props) {
  const t = useTranslations("inputs");
  const th = useTranslations("help");
  const tiers = altersklasse ? getFranchiseTiers(altersklasse) : [];

  return (
    <div className="relative">
      <div className="flex items-start gap-1 mb-1.5">
        <label htmlFor="fran" className="text-label-large text-on-surface-variant">
          {t("deductibleLabel")}
        </label>
        <HelpTip term="franchise" onOpenGuide={onOpenGuide} />
      </div>
      <select
        id="fran"
        value={value ?? ""}
        disabled={!altersklasse}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-describedby="fran-hint"
        className="w-full h-10 px-3 rounded-md border border-outline-variant text-[15px] bg-surface outline-none focus:border-primary focus-visible:ring-2 focus-visible:ring-primary-container disabled:bg-surface-variant disabled:text-outline"
      >
        <option value="" disabled>
          {altersklasse ? t("deductibleChoose") : t("deductibleNeedsBirthYear")}
        </option>
        {tiers.map((tier) => (
          <option key={tier} value={tier}>
            CHF {tier}
          </option>
        ))}
      </select>
      <p id="fran-hint" className="text-body-small text-outline mt-1">
        {th("terms.franchise.oneLiner")}
      </p>
    </div>
  );
}
