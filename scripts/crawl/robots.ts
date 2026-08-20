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
    const matchesUs =
      currentAgents.includes("*") ||
      currentAgents.some((agent) => matchesUserAgentToken(agent, userAgent));
    if (key === "disallow" && value !== "" && matchesUs) {
      disallowed.push(value);
    }
  }
  return disallowed;
}

// A robots.txt "User-agent" line commonly names just the product token (e.g.
// "PrixioProductDescriptionBot"), while our crawler's real UA header carries a
// version/comment suffix (e.g. "PrixioProductDescriptionBot/1.0 (+https://...)").
// Match on the token before the first "/", case-insensitively, rather than requiring
// byte-for-byte equality — otherwise a site that names us by product token alone would
// never match and its Disallow rules for us would be silently ignored.
function matchesUserAgentToken(robotsAgent: string, ourAgent: string): boolean {
  const robotsToken = robotsAgent.split("/")[0].trim();
  const ourToken = ourAgent.toLowerCase().split("/")[0].trim();
  return robotsToken === ourToken;
}

export function isPathAllowed(disallowedPaths: string[], path: string): boolean {
  return !disallowedPaths.some((rule) => path.startsWith(rule));
}
