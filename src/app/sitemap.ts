import type { MetadataRoute } from "next";

// Sitemap contains only the base URL — parameterised comparison URLs are
// intentionally excluded (REQ-20, requirement.md §10).
export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://example.com";
  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 1,
    },
  ];
}
