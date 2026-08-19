// Extracts same-origin absolute links from a raw HTML page — used by crawlSite.ts to
// discover candidate product pages starting from an insurer's seed URL.

export function extractLinks(html: string, baseUrl: string): string[] {
  const base = new URL(baseUrl);
  const hrefs = [...html.matchAll(/<a\b[^>]*href=["']([^"']+)["']/gi)].map((m) => m[1]);
  const links = new Set<string>();
  for (const href of hrefs) {
    let resolved: URL;
    try {
      resolved = new URL(href, base);
    } catch {
      continue; // malformed href, e.g. "javascript:void(0)" or "mailto:..."
    }
    if (resolved.origin !== base.origin) continue; // stay same-origin
    if (resolved.protocol !== "http:" && resolved.protocol !== "https:") continue;
    resolved.hash = "";
    links.add(resolved.toString());
  }
  return [...links];
}
