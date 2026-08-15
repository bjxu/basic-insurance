"use client";

import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

// Each language's own name is shown in that language, not translated per the
// active locale — the standard convention for language switchers (spec:
// "Language switcher").
const LANGUAGE_NAMES: Record<(typeof routing.locales)[number], string> = {
  de: "Deutsch",
  fr: "Français",
  it: "Italiano",
  en: "English",
};

export function LanguageSwitcher() {
  const locale = useLocale();
  const t = useTranslations("languageSwitcher");
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  const handleChange = (nextLocale: string) => {
    const query = searchParams.toString();
    // Preserve every query param (plz, birthYear, franchise, ...) across the
    // locale switch, so a shared comparison link keeps working (spec:
    // "Language switcher").
    router.replace(`${pathname}${query ? `?${query}` : ""}`, { locale: nextLocale });
  };

  return (
    <select
      aria-label={t("menuLabel")}
      value={locale}
      onChange={(e) => handleChange(e.target.value)}
      className="h-8 rounded-md border border-outline-variant bg-surface px-2 text-sm text-on-surface-variant outline-none focus:border-primary"
    >
      {routing.locales.map((code) => (
        <option key={code} value={code}>
          {LANGUAGE_NAMES[code]}
        </option>
      ))}
    </select>
  );
}
