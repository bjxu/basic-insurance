import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";

// One entry per locale (REQ-20 still holds: only base URLs are indexable, no
// parameterised comparison URLs), each carrying hreflang alternates so search
// engines can link the language versions of the same page together.
export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://example.com";
  const languages = Object.fromEntries(routing.locales.map((l) => [l, `${baseUrl}/${l}`]));

  return routing.locales.map((locale) => ({
    url: `${baseUrl}/${locale}`,
    lastModified: new Date(),
    changeFrequency: "yearly",
    priority: locale === routing.defaultLocale ? 1 : 0.9,
    alternates: { languages },
  }));
}
