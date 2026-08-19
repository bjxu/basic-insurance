// Crawls same-origin pages outward from an insurer's seed URL, bounded so a single
// misconfigured seed can't turn into an unbounded fetch loop. Respects robots.txt and
// rate-limits between requests — insurer sites aren't built for automated crawling
// (docs/superpowers/specs/2026-08-19-provider-product-descriptions-design.md).

import { extractLinks } from "./extractLinks";
import { extractTitle, htmlToText } from "./htmlText";
import { isPathAllowed, parseDisallowedPaths } from "./robots";
import type { CrawledPage } from "./matchProductPage";

export const USER_AGENT = "PrixioProductDescriptionBot/1.0 (+https://prixio.ch)";
const DEFAULT_MAX_PAGES = 25;
const REQUEST_DELAY_MS = 500;

export async function crawlSite(
  seedUrl: string,
  options?: { maxPages?: number },
): Promise<CrawledPage[]> {
  const maxPages = options?.maxPages ?? DEFAULT_MAX_PAGES;
  const origin = new URL(seedUrl).origin;
  const disallowed = await fetchDisallowedPaths(origin);

  const visited = new Set<string>();
  const queue: string[] = [seedUrl];
  const pages: CrawledPage[] = [];

  while (queue.length > 0 && pages.length < maxPages) {
    const url = queue.shift()!;
    if (visited.has(url)) continue;
    visited.add(url);
    if (!isPathAllowed(disallowed, new URL(url).pathname)) continue;

    await sleep(REQUEST_DELAY_MS);
    const html = await fetchText(url);
    if (html == null) continue;

    pages.push({ url, title: extractTitle(html), text: htmlToText(html) });
    for (const link of extractLinks(html, url)) {
      if (!visited.has(link)) queue.push(link);
    }
  }
  return pages;
}

async function fetchDisallowedPaths(origin: string): Promise<string[]> {
  const robotsText = await fetchText(`${origin}/robots.txt`);
  return robotsText ? parseDisallowedPaths(robotsText, USER_AGENT) : [];
}

async function fetchText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
