"use client";

import { useTranslations } from "next-intl";
import type { PremiumRow } from "@/lib/types";
import { groupProductsByTarifart, discountVsStandardPct } from "@/lib/lookup";
import { MODEL_TAG_CLASSES, DEFAULT_MODEL_TAG_CLASSES } from "@/lib/tarifart-style";
import { formatChf } from "@/lib/format";

type Props = {
  products: PremiumRow[];
  standardPremium: number | undefined;
  shownTarifCode: string;
};

export function ProductList({ products, standardPremium, shownTarifCode }: Props) {
  const t = useTranslations();
  const groups = groupProductsByTarifart(products);

  return (
    <div className="mt-2 ml-8 pl-3 border-l-2 border-outline-variant flex flex-col gap-2.5">
      {groups.map((group) => (
        <div key={group.tarifart}>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-outline mb-1">
            {t(`copy.tarifart.${group.tarifart}.label`)}
          </p>
          <div className="flex flex-col gap-1">
            {group.products.map((product) => {
              const discountPct =
                product.tarifart === "standard"
                  ? null
                  : discountVsStandardPct(standardPremium, product.monthlyPremium);
              const isShown = product.tarifCode === shownTarifCode;
              return (
                <div
                  key={product.tarifCode}
                  className={`rounded-md px-1.5 py-1 border-l-[3px] ${
                    isShown ? "border-primary" : "border-transparent"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-block px-1.5 py-px rounded text-[11px] font-semibold ${
                        MODEL_TAG_CLASSES[product.tarifart] ?? DEFAULT_MODEL_TAG_CLASSES
                      }`}
                    >
                      {t(`copy.tarifart.${product.tarifart}.label`)}
                    </span>
                    <span className="flex-1 min-w-0 text-[13px] truncate">
                      {product.productName}
                      {isShown && (
                        <span className="ml-1.5 inline-block px-1.5 py-px rounded text-[10px] font-semibold border border-primary text-primary bg-surface whitespace-nowrap">
                          {t("results.shownAboveTag")}
                        </span>
                      )}
                    </span>
                    {discountPct != null && discountPct > 0 && (
                      <span className="inline-block px-1.5 py-px rounded text-[11px] font-bold bg-primary-container text-on-primary-container whitespace-nowrap">
                        {t("results.discountBadgeExact", { pct: discountPct.toFixed(1) })}
                      </span>
                    )}
                    <span className="text-[13px] font-semibold w-20 text-right flex-shrink-0">
                      {formatChf(product.monthlyPremium)}
                    </span>
                  </div>
                  <p className="text-[11px] text-on-surface-variant mt-0.5">
                    {t(`copy.tarifart.${product.tarifart}.description`)}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
