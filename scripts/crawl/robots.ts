// Minimal robots.txt support — just enough to respect Disallow rules for our crawler's
// user-agent (or the wildcard "*" group) before fetching an insurer's pages. Not a full
// robots.txt parser (no Allow-rule precedence, no crawl-delay, no sitemap directives):
// insurer product pages are simple marketing sites, not search engines defending
// against aggressive bots, and crawlSite.ts already rate-limits + bounds page count.

export function parseDisallowedPaths(robotsTxt: string, userAgent: string): string[] {
  const lines = robotsTxt
    .split(/\r?\n/)
    .map((line) => line.replace(/#.*$/, "").trim())
    .filter((line) => line !== "");

  const disallowed: string[] = [];
  let currentAgents: string[] = [];
  let inGroup = false;

  for (const line of lines) {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim().toLowerCase();
    const value = line.slice(colonIdx + 1).trim();

    if (key === "user-agent") {
      if (!inGroup) currentAgents = []; // first User-agent line after a non-UA line starts a new group
      currentAgents.push(value.toLowerCase());
      inGroup = true;
      continue;
    }
    inGroup = false;
    const matchesUs = currentAgents.includes("*") || currentAgents.includes(userAgent.toLowerCase());
    if (key === "disallow" && value !== "" && matchesUs) {
      disallowed.push(value);
    }
  }
  return disallowed;
}

export function isPathAllowed(disallowedPaths: string[], path: string): boolean {
  return !disallowedPaths.some((rule) => path.startsWith(rule));
}
