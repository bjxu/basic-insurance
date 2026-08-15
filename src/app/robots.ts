import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site-url";

// Only the base URL is indexable; parameterised comparison URLs carry
// noindex + canonical instead (REQ-20).
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: "/admin",
    },
    sitemap: `${getSiteUrl()}/sitemap.xml`,
  };
}
