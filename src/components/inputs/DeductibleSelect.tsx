"use client";

import { useTranslations } from "next-intl";
import type { Altersklasse } from "@/lib/types";
import { getFranchiseTiers } from "@/lib/ageband";

type Props = {
  altersklasse: Altersklasse | null;
  value: number | null;
  onChange: (value: number) => void;
};

export function DeductibleSelect({ altersklasse, value, onChange }: Props) {
  const t = useTranslations("inputs");
  const tiers = altersklasse ? getFranchiseTiers(altersklasse) : [];

  return (
    <div>
      <label htmlFor="fran" className="block text-label-large text-on-surface-variant mb-1.5">
        {t("deductibleLabel")}
      </label>
      <select
        id="fran"
        value={value ?? ""}
        disabled={!altersklasse}
        onChange={(e) => onChange(Number(e.target.value))}
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
    </div>
  );
}
