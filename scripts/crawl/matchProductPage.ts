// Finds which crawled page most likely describes a given product. Requires a title hit:
// insurer product pages consistently name the product in the page <title>/heading
// (verified against several insurers' sites during design —
// docs/superpowers/specs/2026-08-19-provider-product-descriptions-design.md), whereas a
// page that only mentions the product in body text is not confident enough to attribute
// to a specific product — nav/footer boilerplate repeats short/generic product names
// ("HMO", "Casa", "Grundversicherung", shared across all 34 insurers) on every page, so
// the body-text fallback used to match category/nav pages instead of the real product
// page (see the final-review fix in
// docs/superpowers/plans/2026-08-19-provider-product-descriptions.md). Body-text
// occurrences now only break ties between title hits. Returns null rather than guessing
// when nothing matches.

export type CrawledPage = { url: string; title: string; text: string };

const TITLE_MATCH_WEIGHT = 1000;

export function matchProductPage(pages: CrawledPage[], productName: string): CrawledPage | null {
  const needle = normalize(productName);
  if (needle === "") return null;

  let best: { page: CrawledPage; score: number } | null = null;
  for (const page of pages) {
    const titleHit = normalize(page.title).includes(needle);
    if (!titleHit) continue; // body-text-only mentions are too weak a signal — see the module comment
    const textOccurrences = countOccurrences(normalize(page.text), needle);

    const score = TITLE_MATCH_WEIGHT + textOccurrences;
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
