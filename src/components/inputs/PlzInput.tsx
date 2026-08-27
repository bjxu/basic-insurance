"use client";

import { useTranslations } from "next-intl";
import { validatePlz } from "@/lib/validate";
import { HelpTip } from "@/components/help/HelpTip";

type Props = {
  value: string;
  onChange: (value: string) => void;
  /** True when the PLZ has valid format but doesn't resolve to any known Gemeinde (REQ-13). */
  notFound?: boolean;
};

export function PlzInput({ value, onChange, notFound }: Props) {
  const t = useTranslations();
  const formatResult = value ? validatePlz(value) : { valid: true as const };
  const invalid = !formatResult.valid || Boolean(notFound);
  const errorMessage = !formatResult.valid
    ? t(`validation.${formatResult.code}`)
    : notFound
      ? t("inputs.plzNotFound")
      : null;

  return (
    <div className="relative">
      <div className="flex items-start gap-1 mb-1.5">
        <label htmlFor="plz" className="text-label-large text-on-surface-variant">
          {t("inputs.plzLabel")}
        </label>
        <HelpTip term="plz" />
      </div>
      <input
        id="plz"
        type="text"
        inputMode="numeric"
        maxLength={4}
        placeholder={t("inputs.plzPlaceholder")}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-describedby={errorMessage ? "plz-hint plz-error" : "plz-hint"}
        aria-invalid={invalid}
        className={`w-full h-10 px-3 rounded-md border text-[15px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary-container ${
          invalid ? "border-error focus:border-error" : "border-outline-variant focus:border-primary"
        }`}
      />
      <p id="plz-hint" className="text-body-small text-outline mt-1">
        {t("help.terms.plz.oneLiner")}
      </p>
      {errorMessage && (
        <p id="plz-error" className="text-body-small text-error mt-1">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
