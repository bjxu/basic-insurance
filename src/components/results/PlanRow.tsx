import { useLocale, useTranslations } from "next-intl";
import type { PremiumRow } from "@/lib/types";
import { formatChf, formatMemberCount, formatMemberCountDetail } from "@/lib/format";

type Props = {
  plan: PremiumRow;
  rank: number;
  isCheapest: boolean;
  isCurrentPlan: boolean;
  discountPct: number | null;
  memberCount?: number;
  memberCountAsOf: number;
  previousYearPremium?: number;
};

// Model tag color per Tarifart, matching mockups/main.html's .model-tag.hmo/.telmed/.haus
// (hausarzt maps to the mockup's "haus" class — same success-container treatment).
const MODEL_TAG_CLASSES: Record<string, string> = {
  hmo: "bg-warning-container text-on-warning-container",
  telmed: "bg-tertiary-container text-on-tertiary-container",
  hausarzt: "bg-success-container text-on-success-container",
};
const DEFAULT_MODEL_TAG_CLASSES = "bg-surface-variant text-on-surface-variant";

export function PlanRow({
  plan,
  rank,
  isCheapest,
  isCurrentPlan,
  discountPct,
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

  return (
    <div
      role="listitem"
      className={`flex items-center gap-3 rounded-lg border p-3.5 shadow-sm ${
        isCurrentPlan ? "border-error bg-error-container" : "border-outline-variant bg-surface"
      }`}
    >
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
          {discountPct != null && (
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
          {formatChf(plan.monthlyPremium)}
        </div>
        <div className="text-body-small text-outline">{t("results.perMonth")}</div>
      </div>
    </div>
  );
}
