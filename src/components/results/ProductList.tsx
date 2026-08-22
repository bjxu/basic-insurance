"use client";

import { useLocale, useTranslations } from "next-intl";
import type { PremiumRow } from "@/lib/types";
import { groupProductsByTarifart, discountVsStandardPct, deriveVariantLabel, type ProductGroup } from "@/lib/lookup";
import { MODEL_TAG_CLASSES, DEFAULT_MODEL_TAG_CLASSES } from "@/lib/tarifart-style";
import { formatChf } from "@/lib/format";
import { applyEnvironmentalLevy } from "@/lib/environmentalLevy";
import { getProductDescription, type ProductDescriptions } from "@/lib/productDescriptions";
import type { ProductGroups } from "@/lib/productGroups";
import rawProductDescriptions from "@/data/product-descriptions.json";
import rawProductGroups from "@/data/product-groups.json";

// Cast, not inferred: both JSON files start as `{}` and are edited by hand/by
// scripts/crawl/crawlDescriptions.ts — their structural shape isn't statically known.
const PRODUCT_DESCRIPTIONS = rawProductDescriptions as ProductDescriptions;
const PRODUCT_GROUPS = rawProductGroups as ProductGroups;

type Props = {
  products: PremiumRow[];
  standardPremium: number | undefined;
  shownTarifCode: string;
  // Passed down from PlanRow (which already imports metadata.json) rather than importing
  // metadata.json here too — keeps this leaf component's data dependencies to just its props,
  // same pattern as standardPremium.
  levyPerMonthByYear: Record<string, number>;
};

type RowProps = {
  standardPremium: number | undefined;
  shownTarifCode: string;
  levyPerMonthByYear: Record<string, number>;
};

export function ProductList({ products, standardPremium, shownTarifCode, levyPerMonthByYear }: Props) {
  const t = useTranslations();
  const tarifartGroups = groupProductsByTarifart(products, PRODUCT_GROUPS);

  return (
    <div className="mt-2 ml-8 pl-3 border-l-2 border-outline-variant flex flex-col gap-2.5">
      {tarifartGroups.map((tarifartGroup) => (
        <div key={tarifartGroup.tarifart}>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-outline mb-1">
            {t(`copy.tarifart.${tarifartGroup.tarifart}.label`)}
          </p>
          <div className="flex flex-col gap-1">
            {tarifartGroup.groups.map((group) =>
              group.variants.length === 1 ? (
                <SingleProductRow
                  key={group.variants[0].tarifCode}
                  product={group.variants[0]}
                  standardPremium={standardPremium}
                  shownTarifCode={shownTarifCode}
                  levyPerMonthByYear={levyPerMonthByYear}
                />
              ) : (
                <GroupedProductRow
                  key={`${group.tarifart}:${group.groupName}`}
                  group={group}
                  standardPremium={standardPremium}
                  shownTarifCode={shownTarifCode}
                  levyPerMonthByYear={levyPerMonthByYear}
                />
              ),
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// Unchanged from before this feature — a group of one renders as a single flat row, tag+name+
// discount+price on one line, description below. Used for every insurer with no
// product-groups.json entries (the common case today).
function SingleProductRow({ product, standardPremium, shownTarifCode, levyPerMonthByYear }: RowProps & { product: PremiumRow }) {
  const t = useTranslations();
  const locale = useLocale();
  const discountPct =
    product.tarifart === "standard" ? null : discountVsStandardPct(standardPremium, product.monthlyPremium);
  const isShown = product.tarifCode === shownTarifCode;
  return (
    <div className={`rounded-md px-1.5 py-1 border-l-[3px] ${isShown ? "border-primary" : "border-transparent"}`}>
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
          {formatChf(applyEnvironmentalLevy(product.monthlyPremium, product.year, levyPerMonthByYear))}
        </span>
      </div>
      <p className="text-[11px] text-on-surface-variant mt-0.5">
        {getProductDescription(PRODUCT_DESCRIPTIONS, product.insurerCode, product.tarifCode, locale) ??
          t(`copy.tarifart.${product.tarifart}.description`)}
      </p>
    </div>
  );
}

// New shape for a group with 2+ price tiers: one name + one description, then each tier as an
// indented VariantRow underneath (design: provider-product-grouping).
function GroupedProductRow({ group, standardPremium, shownTarifCode, levyPerMonthByYear }: RowProps & { group: ProductGroup }) {
  const t = useTranslations();
  const locale = useLocale();
  const description =
    group.variants
      .map((v) => getProductDescription(PRODUCT_DESCRIPTIONS, v.insurerCode, v.tarifCode, locale))
      .find((d): d is string => d != null) ?? t(`copy.tarifart.${group.tarifart}.description`);

  return (
    <div className="rounded-md px-1.5 py-1">
      <div className="flex items-center gap-2">
        <span
          className={`inline-block px-1.5 py-px rounded text-[11px] font-semibold ${
            MODEL_TAG_CLASSES[group.tarifart] ?? DEFAULT_MODEL_TAG_CLASSES
          }`}
        >
          {t(`copy.tarifart.${group.tarifart}.label`)}
        </span>
        <span className="flex-1 min-w-0 text-[13px] truncate">{group.groupName}</span>
      </div>
      <p className="text-[11px] text-on-surface-variant mt-0.5">{description}</p>
      <div className="mt-1 ml-2 pl-2 border-l-2 border-outline-variant flex flex-col gap-0.5">
        {group.variants.map((variant) => (
          <VariantRow
            key={variant.tarifCode}
            variant={variant}
            label={deriveVariantLabel(group.groupName, variant.productName)}
            standardPremium={standardPremium}
            isShown={variant.tarifCode === shownTarifCode}
            levyPerMonthByYear={levyPerMonthByYear}
          />
        ))}
      </div>
    </div>
  );
}

function VariantRow({
  variant,
  label,
  standardPremium,
  isShown,
  levyPerMonthByYear,
}: {
  variant: PremiumRow;
  label: string;
  standardPremium: number | undefined;
  isShown: boolean;
  levyPerMonthByYear: Record<string, number>;
}) {
  const t = useTranslations();
  const discountPct =
    variant.tarifart === "standard" ? null : discountVsStandardPct(standardPremium, variant.monthlyPremium);
  return (
    <div className={`flex items-center gap-2 rounded-md px-1.5 py-0.5 border-l-[3px] ${isShown ? "border-primary" : "border-transparent"}`}>
      <span className="flex-1 min-w-0 text-[12px] text-on-surface-variant truncate">
        {label}
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
        {formatChf(applyEnvironmentalLevy(variant.monthlyPremium, variant.year, levyPerMonthByYear))}
      </span>
    </div>
  );
}
