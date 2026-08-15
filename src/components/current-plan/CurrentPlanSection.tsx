"use client";

import { useTranslations } from "next-intl";
import { validateCurrentPremium } from "@/lib/validate";
import type { CurrentPlan, Insurer } from "@/lib/types";

type Props = {
  insurers: Insurer[];
  value: Partial<CurrentPlan>;
  onChange: (value: Partial<CurrentPlan>) => void;
};

export function CurrentPlanSection({ insurers, value, onChange }: Props) {
  const t = useTranslations("currentPlan");
  const tv = useTranslations("validation");
  const result = value.monthlyPremium != null ? validateCurrentPremium(value.monthlyPremium) : { valid: true as const };

  return (
    <details className="mt-5 pt-4 border-t border-surface-variant">
      <summary className="flex items-center gap-2 cursor-pointer select-none text-title-medium text-primary list-none [&::-webkit-details-marker]:hidden before:content-['▸'] before:text-xs [details[open]_&]:before:content-['▾']">
        {t("summaryTitle")}{" "}
        <span className="font-normal text-on-surface-variant">&nbsp;{t("summaryHint")}</span>
      </summary>
      <div className="mt-3.5 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label htmlFor="current-insurer" className="block text-label-large text-on-surface-variant mb-1.5">
            {t("insurerLabel")}
          </label>
          <select
            id="current-insurer"
            value={value.insurerCode ?? ""}
            onChange={(e) => onChange({ ...value, insurerCode: e.target.value })}
            className="w-full h-10 px-3 rounded-md border border-outline-variant text-[15px] bg-surface outline-none focus:border-primary"
          >
            <option value="">–</option>
            {insurers.map((i) => (
              <option key={i.insurerCode} value={i.insurerCode}>
                {i.insurerName}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="current-premium" className="block text-label-large text-on-surface-variant mb-1.5">
            {t("premiumLabel")}
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[15px] text-on-surface-variant pointer-events-none">
              CHF
            </span>
            <input
              id="current-premium"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.05"
              placeholder={t("premiumPlaceholder")}
              value={value.monthlyPremium ?? ""}
              onChange={(e) => {
                const raw = e.target.value;
                onChange({ ...value, monthlyPremium: raw === "" ? undefined : Number(raw) });
              }}
              aria-describedby="current-premium-hint"
              aria-invalid={!result.valid}
              className={`w-full h-10 pl-11 pr-3 rounded-md border text-[15px] bg-surface outline-none transition-colors ${
                result.valid ? "border-outline-variant focus:border-primary" : "border-error focus:border-error"
              }`}
            />
          </div>
          {!result.valid && (
            <p id="current-premium-hint" className="text-body-small text-error mt-1">
              {tv(result.code)}
            </p>
          )}
        </div>
      </div>
    </details>
  );
}
