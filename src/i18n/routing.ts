import { defineRouting } from "next-intl/routing";

// All six locales are live, each backed by its own translated message file
// under src/messages/.
export const routing = defineRouting({
  locales: ["de", "fr", "it", "en", "pt", "es"],
  defaultLocale: "de",
  localePrefix: "always",
});

export type Locale = (typeof routing.locales)[number];
