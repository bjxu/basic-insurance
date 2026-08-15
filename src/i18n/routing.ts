import { defineRouting } from "next-intl/routing";

// Locale set starts with German only — Task 3 expands this to ["de", "fr", "it", "en"]
// once translated message files exist for the other three.
export const routing = defineRouting({
  locales: ["de"],
  defaultLocale: "de",
  localePrefix: "always",
});
