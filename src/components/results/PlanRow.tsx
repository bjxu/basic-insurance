"use client";

import { useLocale, useTranslations } from "next-intl";
import type { PremiumRow } from "@/lib/types";
import { discountVsStandardPct } from "@/lib/lookup";
import { formatChf, formatMemberCount, formatMemberCountDetail } from "@/lib/format";
import { applyEnvironmentalLevy } from "@/lib/environmentalLevy";
import metadata from "@/data/metadata.json";
import { MODEL_TAG_CLASSES, DEFAULT_MODEL_TAG_CLASSES } from "@/lib/tarifart-style";
import { ProductList } from "./ProductList";

const ENVIRONMENTAL_LEVY_PER_MONTH: Record<string, number> = metadata.environmentalLevyPerMonth;

type Props = {
  plan: PremiumRow;
  rank: number;
  isCheapest: boolean;
  isCurrentPlan: boolean;
  standardPremium: number | undefined;
  products: PremiumRow[];
  memberCount?: number;
  memberCountAsOf: number;
  previousYearPremium?: number;
};

export function PlanRow({
  plan,
  rank,
  isCheapest,
  isCurrentPlan,
  standardPremium,
  products,
  memberCount,
  memberCountAsOf,
  previousYearPremium,
}: Props) {
  const t = useTranslations();
  const locale = useLocale();
  const yoy =
    previousYearPremium != null && previousYearPremium !== plan.monthlyPremium
      ? ((plan.monthlyPremium - previousYearPremium) / previousYearPremium) * 100
      : null;
  const discountPct =
    plan.tarifart === "standard" ? null : discountVsStandardPct(standardPremium, plan.monthlyPremium);

  return (
    <details
      role="listitem"
      className={`rounded-lg border shadow-sm ${
        isCurrentPlan ? "border-error bg-error-container" : "border-outline-variant bg-surface"
      }`}
    >
      <summary className="flex items-center gap-3 p-3.5 cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden">
        <div className={`w-5 text-center text-sm font-bold ${rank === 1 ? "text-primary" : "text-outline"}`}>
          {rank}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-[15px] truncate">{plan.insurerName}</div>
          <div className="text-xs text-on-surface-variant mt-0.5 flex flex-wrap items-center gap-1">
            <span
              className={`inline-block px-1.5 py-px rounded text-[11px] font-semibold ${
                MODEL_TAG_CLASSES[plan.tarifart] ?? DEFAULT_MODEL_TAG_CLASSES
              }`}
            >
              {t(`copy.tarifart.${plan.tarifart}.label`)}
            </span>
            {discountPct != null && discountPct > 0 && (
              <span className="inline-block px-1.5 py-px rounded text-[11px] font-bold bg-primary-container text-on-primary-container whitespace-nowrap">
                {t("results.discountBadge", { pct: discountPct.toFixed(1) })}
              </span>
            )}
            <span>· {t(`copy.tarifart.${plan.tarifart}.description`)}</span>
          </div>
        </div>
        {memberCount != null && (
          <div
            className="hidden sm:flex flex-col items-end gap-0.5 flex-shrink-0"
            title={formatMemberCountDetail(memberCount, memberCountAsOf, locale)}
            aria-label={formatMemberCountDetail(memberCount, memberCountAsOf, locale)}
          >
            <span className="text-[11px] font-semibold px-1.5 py-px rounded bg-surface-variant text-on-surface-variant whitespace-nowrap">
              <span aria-hidden="true">👥</span> {formatMemberCount(memberCount, locale)}
            </span>
          </div>
        )}
        {isCurrentPlan && (
          <span className="text-[11px] font-semibold px-1.5 py-px rounded bg-error-container text-error">
            {t("results.yourInsurerBadge")}
          </span>
        )}
        {yoy != null && (
          <div
            className={`text-xs font-semibold px-1.5 py-px rounded ${
              yoy > 0 ? "bg-error-container text-error" : yoy < 0 ? "bg-success-container text-success" : "text-outline font-normal"
            }`}
          >
            {yoy > 0 ? "+" : ""}
            {yoy.toFixed(1)}%
          </div>
        )}
        <div className="text-right">
          <div className={`text-headline-small ${isCheapest ? "text-primary" : "text-on-surface"}`}>
            {formatChf(applyEnvironmentalLevy(plan.monthlyPremium, plan.year, ENVIRONMENTAL_LEVY_PER_MONTH))}
          </div>
          <div className="text-body-small text-outline">{t("results.perMonth")}</div>
        </div>
        <span
          aria-hidden="true"
          className="text-outline text-xs w-3 text-center flex-shrink-0 before:content-['▸'] [details[open]_&]:before:content-['▾']"
        />
      </summary>
      <div className="px-3.5 pb-3.5">
        <ProductList
          products={products}
          standardPremium={standardPremium}
          shownTarifCode={plan.tarifCode}
          levyPerMonthByYear={ENVIRONMENTAL_LEVY_PER_MONTH}
        />
      </div>
    </details>
  );
}
