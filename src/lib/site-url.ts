// Canonical base URL for absolute links (sitemap, robots, hreflang alternates).
// Must be set via NEXT_PUBLIC_SITE_URL in production — the fallback exists only
// so local/preview builds without the env var configured still produce valid,
// internally-consistent URLs instead of crashing.
export function getSiteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "https://example.com";
}
