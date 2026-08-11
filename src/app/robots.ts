import type { MetadataRoute } from "next";

// Only the base URL is indexable; parameterised comparison URLs carry
// noindex + canonical instead (REQ-20).
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: "/admin",
    },
    sitemap: `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://example.com"}/sitemap.xml`,
  };
}
