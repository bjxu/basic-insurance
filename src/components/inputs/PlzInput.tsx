"use client";

import { useTranslations } from "next-intl";
import { validatePlz } from "@/lib/validate";

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
  const message = !formatResult.valid
    ? t(`validation.${formatResult.code}`)
    : notFound
      ? t("inputs.plzNotFound")
      : null;

  return (
    <div>
      <label htmlFor="plz" className="block text-label-large text-on-surface-variant mb-1.5">
        {t("inputs.plzLabel")}
      </label>
      <input
        id="plz"
        type="text"
        inputMode="numeric"
        maxLength={4}
        placeholder={t("inputs.plzPlaceholder")}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-describedby="plz-hint"
        aria-invalid={invalid}
        className={`w-full h-10 px-3 rounded-md border text-[15px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary-container ${
          invalid ? "border-error focus:border-error" : "border-outline-variant focus:border-primary"
        }`}
      />
      {message && (
        <p id="plz-hint" className="text-body-small text-error mt-1">
          {message}
        </p>
      )}
    </div>
  );
}
