// Strips a raw HTML page down to plain visible text — good enough to feed to an LLM as
// context and to search for a product name (matchProductPage.ts). Deliberately not a
// full HTML/DOM parser: no new dependency (cheerio/jsdom) for what's just "get the
// words off the page" (package.json keeps runtime deps minimal, same reasoning as the
// rest of scripts/ingest/).

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
  "&ouml;": "ö",
  "&auml;": "ä",
  "&uuml;": "ü",
  "&Ouml;": "Ö",
  "&Auml;": "Ä",
  "&Uuml;": "Ü",
  "&szlig;": "ß",
};

function decodeEntities(text: string): string {
  return text.replace(/&[a-zA-Z#0-9]+;/g, (entity) => ENTITIES[entity] ?? entity);
}

export function htmlToText(html: string): string {
  const withoutScriptsAndStyles = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ");
  const withoutTags = withoutScriptsAndStyles.replace(/<[^>]+>/g, " ");
  return decodeEntities(withoutTags).replace(/\s+/g, " ").trim();
}

export function extractTitle(html: string): string {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!match) return "";
  return decodeEntities(match[1]).replace(/\s+/g, " ").trim();
}
