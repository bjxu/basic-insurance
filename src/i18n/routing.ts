import { defineRouting } from "next-intl/routing";

// All four locales are live, each backed by its own translated message file
// under src/messages/.
export const routing = defineRouting({
  locales: ["de", "fr", "it", "en"],
  defaultLocale: "de",
  localePrefix: "always",
});

export type Locale = (typeof routing.locales)[number];
