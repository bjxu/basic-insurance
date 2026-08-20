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
      continue; // genuinely unparseable href
    }
    // Stay same-origin. This is also what filters out "javascript:"/"mailto:" hrefs:
    // they parse fine as URLs but have the opaque origin "null", so they never match.
    if (resolved.origin !== base.origin) continue;
    // Secondary defensive guard for any other non-http(s) scheme that parses to a
    // matching origin — the origin check above already handles the common cases.
    if (resolved.protocol !== "http:" && resolved.protocol !== "https:") continue;
    resolved.hash = "";
    links.add(resolved.toString());
  }
  return [...links];
}
