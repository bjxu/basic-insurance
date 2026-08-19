// Finds which crawled page most likely describes a given product. Title matches are
// weighted far above body-text mentions, since insurer product pages consistently name
// the product in the page <title>/heading (verified against several insurers' sites
// during design — docs/superpowers/specs/2026-08-19-provider-product-descriptions-design.md).
// Returns null rather than guessing when nothing matches.

export type CrawledPage = { url: string; title: string; text: string };

const TITLE_MATCH_WEIGHT = 1000;

export function matchProductPage(pages: CrawledPage[], productName: string): CrawledPage | null {
  const needle = normalize(productName);
  if (needle === "") return null;

  let best: { page: CrawledPage; score: number } | null = null;
  for (const page of pages) {
    const titleHit = normalize(page.title).includes(needle);
    const textOccurrences = countOccurrences(normalize(page.text), needle);
    if (!titleHit && textOccurrences === 0) continue;

    const score = (titleHit ? TITLE_MATCH_WEIGHT : 0) + textOccurrences;
    if (!best || score > best.score) best = { page, score };
  }
  return best?.page ?? null;
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, ""); // strip combining diacritical marks left by NFKD
}

function countOccurrences(haystack: string, needle: string): number {
  if (needle === "") return 0;
  return haystack.split(needle).length - 1;
}
