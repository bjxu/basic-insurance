"use client";

import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

// Carries the in-progress comparison (query string) back to /[locale] so a user
// who opened the guide mid-comparison returns to their inputs (spec §"Standalone
// page"). Client component so the page itself stays statically rendered.
export function BackToComparisonLink() {
  const t = useTranslations("help");
  const qs = useSearchParams().toString();
  return (
    <Link href={qs ? `/?${qs}` : "/"} className="text-[12.5px] font-semibold text-primary">
      {t("guide.back")}
    </Link>
  );
}
