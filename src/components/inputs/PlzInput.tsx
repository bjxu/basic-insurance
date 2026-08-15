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
  const result =
    formatResult.valid && notFound
      ? { valid: false as const, message: t("inputs.plzNotFound") }
      : formatResult;

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
        aria-invalid={!result.valid}
        className={`w-full h-10 px-3 rounded-md border text-[15px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary-container ${
          result.valid ? "border-outline-variant focus:border-primary" : "border-error focus:border-error"
        }`}
      />
      {!result.valid && (
        <p id="plz-hint" className="text-body-small text-error mt-1">
          {result.message}
        </p>
      )}
    </div>
  );
}
