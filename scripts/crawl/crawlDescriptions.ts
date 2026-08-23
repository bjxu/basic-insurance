// Crawls insurer websites (from src/data/insurer-sources.json) to generate
// product-specific descriptions for src/data/product-descriptions.json
// (docs/superpowers/specs/2026-08-19-provider-product-descriptions-design.md), and derives
// product-groups.json entries along the way (scripts/crawl/deriveProductGroups.ts). Run
// manually via `npm run crawl-descriptions` (add `-- --insurer <code>` to scope to one
// insurer while iterating) — kept separate from `npm run ingest`: this is network- and
// LLM-dependent, non-deterministic, and every file it writes is meant to be spot-checked,
// not trusted blindly.
//
// Requires ANTHROPIC_API_KEY in the environment (see README.md).

import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import type { PremiumRow } from "../../src/lib/types";
import type { ProductDescriptions } from "../../src/lib/productDescriptions";
import { buildInsurerSources, type InsurerSources } from "./insurerSources";
import { crawlSite } from "./crawlSite";
import { matchProductPage } from "./matchProductPage";
import { extractDescription } from "./extractDescription";
import { deriveProductGroups, mergeProductGroups, type MatchedProduct } from "./deriveProductGroups";
import type { ProductGroups } from "../../src/lib/productGroups";

const DATA_DIR = join(process.cwd(), "src", "data");
const INSURER_SOURCES_PATH = join(DATA_DIR, "insurer-sources.json");
const PRODUCT_DESCRIPTIONS_PATH = join(DATA_DIR, "product-descriptions.json");
const PRODUCT_GROUPS_PATH = join(DATA_DIR, "product-groups.json");

async function main() {
  const onlyInsurer = parseInsurerArg(process.argv.slice(2));
  if (!process.env.ANTHROPIC_API_KEY) fail("missing ANTHROPIC_API_KEY environment variable.");

  const existingSources = await readJson<InsurerSources>(INSURER_SOURCES_PATH, {});
  const sources = buildInsurerSources(existingSources);
  await writeFile(INSURER_SOURCES_PATH, JSON.stringify(sources, null, 2) + "\n");

  if (onlyInsurer && !sources[onlyInsurer]) {
    fail(`--insurer ${onlyInsurer} not found in insurer-sources.json`);
  }

  const products = await loadLatestProducts();
  const descriptions = await readJson<ProductDescriptions>(PRODUCT_DESCRIPTIONS_PATH, {});
  let productGroups = await readJson<ProductGroups>(PRODUCT_GROUPS_PATH, {});
  const client = new Anthropic();

  const insurerCodes = onlyInsurer ? [onlyInsurer] : Object.keys(sources);
  let matched = 0;
  let noPageMatch = 0;
  let extractionFailed = 0;

  for (const insurerCode of insurerCodes) {
    const source = sources[insurerCode];
    if (!source?.seedUrl) continue;

    const insurerProducts = uniqueByTarifCode(products.filter((p) => p.insurerCode === insurerCode));
    if (insurerProducts.length === 0) continue;

    console.log(`Crawling ${source.insurerName} (${insurerCode}) from ${source.seedUrl}…`);
    const matchedProducts: MatchedProduct[] = [];
    let pages;
    try {
      pages = await crawlSite(source.seedUrl);
    } catch (err) {
      // A bad seedUrl (new URL throws) or a network failure loses only this insurer.
      console.log(`  ✗ crawl failed for ${source.insurerName}: ${String(err)}`);
      continue;
    }

    for (const product of insurerProducts) {
      const page = matchProductPage(pages, product.productName);
      if (!page) {
        console.log(`  ✗ no page match for "${product.productName}" (${product.tarifCode})`);
        noPageMatch++;
        continue;
      }
      matchedProducts.push({ tarifCode: product.tarifCode, productName: product.productName, pageUrl: page.url });
      try {
        const result = await extractDescription(client, {
          pageText: page.text,
          productName: product.productName,
          tarifart: product.tarifart,
        });
        if (!result) {
          console.log(
            `  ✗ extraction returned no usable description for "${product.productName}" (${product.tarifCode})`,
          );
          extractionFailed++;
          continue;
        }
        // Created lazily so an insurer with no successful extraction leaves no empty {}.
        (descriptions[insurerCode] ??= {})[product.tarifCode] = {
          ...result,
          sourceUrl: page.url,
          crawledAt: new Date().toISOString().slice(0, 10),
        };
        console.log(`  ✔ matched "${product.productName}" (${product.tarifCode}) → ${page.url}`);
        matched++;
      } catch (err) {
        // Rate limits / 5xx from the Anthropic API cost one product, not the whole run.
        console.log(
          `  ✗ extraction call failed for "${product.productName}" (${product.tarifCode}): ${String(err)}`,
        );
        extractionFailed++;
      }
    }

    // Hand-entered groups always win — mergeProductGroups only fills in a tarifCode with no
    // existing entry.
    const productGroupsBeforeMerge = productGroups;
    productGroups = mergeProductGroups(productGroups, insurerCode, deriveProductGroups(matchedProducts));
    // mergeProductGroups returns the same reference when nothing changed — skip the write then.
    if (productGroups !== productGroupsBeforeMerge) {
      await writeFile(PRODUCT_GROUPS_PATH, JSON.stringify(productGroups, null, 2) + "\n");
    }

    // Persist after each insurer so one later failure doesn't lose earlier progress.
    await writeFile(PRODUCT_DESCRIPTIONS_PATH, JSON.stringify(descriptions, null, 2) + "\n");
  }

  console.log(
    `\n✔ ${matched} product(s) described, ${noPageMatch} no page match, ${extractionFailed} extraction failed.`,
  );
}

function parseInsurerArg(argv: string[]): string | undefined {
  const idx = argv.indexOf("--insurer");
  return idx !== -1 ? argv[idx + 1] : undefined;
}

function fail(message: string): never {
  console.error(`✖ crawl-descriptions failed: ${message}`);
  process.exit(1);
}

async function readJson<T>(path: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(path, "utf-8")) as T;
  } catch {
    return fallback;
  }
}

async function loadLatestProducts(): Promise<PremiumRow[]> {
  const metadata = JSON.parse(await readFile(join(DATA_DIR, "metadata.json"), "utf-8")) as {
    availableYears: number[];
  };
  const year = Math.max(...metadata.availableYears);
  const premiumsPath = join(process.cwd(), "public", "data", `premiums-${year}.json`);
  return JSON.parse(await readFile(premiumsPath, "utf-8")) as PremiumRow[];
}

function uniqueByTarifCode(rows: PremiumRow[]): PremiumRow[] {
  const seen = new Map<string, PremiumRow>();
  for (const row of rows) {
    if (!seen.has(row.tarifCode)) seen.set(row.tarifCode, row);
  }
  return [...seen.values()];
}

main().catch((err) => fail(String(err)));
