import { useTranslations } from "next-intl";
import type { HeadlineState, PremiumRow } from "@/lib/types";
import { formatChf } from "@/lib/format";

type Props = {
  headline: HeadlineState;
  year: number;
};

export function Headline({ headline, year }: Props) {
  const t = useTranslations("headline");

  if (headline.kind === "savings") {
    return (
      <div role="status" className="mt-6 rounded-lg p-5 flex gap-3.5 bg-success-container border border-success-container">
        <span className="text-xl" aria-hidden>💡</span>
        <p className="text-sm text-on-success-container">
          <strong className="block text-base font-bold text-on-surface mb-0.5">
            {t("savingsCurrent", {
              amount: formatChf(headline.current.monthlyPremium),
              insurer: headline.current.insurerName,
            })}
          </strong>
          {t("savingsCheapest", {
            year,
            amount: formatChf(headline.cheapest.monthlyPremium),
            insurer: headline.cheapest.insurerName,
          })}{" "}
          <span className="text-success font-bold">
            {t("savingsAmount", { amount: formatChf(headline.savingsPerYear) })}
          </span>
        </p>
      </div>
    );
  }

  if (headline.kind === "already-cheapest") {
    const isExactMatch =
      headline.cheapest != null && headline.current.monthlyPremium === headline.cheapest.monthlyPremium;
    return (
      <div role="status" className="mt-6 rounded-lg p-5 flex gap-3.5 bg-success-container border border-success-container">
        <span className="text-xl" aria-hidden>✅</span>
        <p className="text-sm text-on-success-container">
          <strong className="block text-base font-bold text-on-surface mb-0.5">
            {isExactMatch ? t("alreadyCheapestExact") : t("alreadyCheapestBelow")}
          </strong>
          {t("alreadyCheapestDetail", {
            insurer: headline.current.insurerName,
            amount: formatChf(headline.current.monthlyPremium),
          })}
        </p>
      </div>
    );
  }

  return headline.cheapest ? <CheapestOnly cheapest={headline.cheapest} /> : null;
}

function CheapestOnly({ cheapest }: { cheapest: PremiumRow }) {
  const t = useTranslations("headline");
  return (
    <div role="status" className="mt-6 rounded-lg p-5 flex gap-3.5 bg-primary-container border border-primary-container">
      <span className="text-xl" aria-hidden>🔍</span>
      <p className="text-sm text-on-primary-container">
        <strong className="block text-base font-bold text-on-surface mb-0.5">
          {t("cheapestOnlyTitle", { amount: formatChf(cheapest.monthlyPremium), insurer: cheapest.insurerName })}
        </strong>
        {t("cheapestOnlyCta")}
      </p>
    </div>
  );
}
