import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { getSiteUrl } from "@/lib/site-url";

// One entry per (locale × indexable path). Only base URLs and the evergreen
// how-it-works guide are listed — never parameterised comparison URLs (REQ-20).
// Each entry carries hreflang alternates so search engines link the language
// versions of the same page together.
const INDEXABLE_PATHS = ["", "/how-it-works"] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = getSiteUrl();

  const localizedEntries = routing.locales.flatMap((locale) =>
    INDEXABLE_PATHS.map((path) => ({
      url: `${baseUrl}/${locale}${path}`,
      lastModified: new Date(),
      changeFrequency: "yearly" as const,
      priority: path === "" ? (locale === routing.defaultLocale ? 1 : 0.9) : 0.6,
      alternates: {
        languages: Object.fromEntries(
          routing.locales.map((l) => [l, `${baseUrl}/${l}${path}`]),
        ),
      },
    })),
  );

  // German-only content (docs/superpowers/specs/2026-08-31-praemien-guide-
  // content-page-design.md) — no other-locale version exists yet, so no
  // hreflang alternates map (there's nothing to alternate to).
  const praemienEntry: MetadataRoute.Sitemap[number] = {
    url: `${baseUrl}/de/praemien`,
    lastModified: new Date(),
    changeFrequency: "yearly",
    priority: 0.6,
  };

  return [...localizedEntries, praemienEntry];
}
