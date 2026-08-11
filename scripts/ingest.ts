// BAG data ingestion (architecture.md §3.2). Run via `npm run ingest`.
//
// Downloads (or reads --local) the BAG premium and PLZ/Gemeinde/Region CSV
// exports, validates them, and writes typed JSON to src/data/.
//
// This is a scaffold: the actual opendata.swiss URLs and CSV column mapping
// need to be filled in against the real BAG file schema before this runs
// against live data. For now it supports --local <dir> so development/tests
// can run against fixture CSVs.

import { existsSync } from "node:fs";
import { join } from "node:path";

const DATA_DIR = join(process.cwd(), "src", "data");

type Args = { local?: string };

function parseArgs(argv: string[]): Args {
  const args: Args = {};
  const localIdx = argv.indexOf("--local");
  if (localIdx !== -1) args.local = argv[localIdx + 1] ?? "data/raw";
  return args;
}

function fail(message: string): never {
  console.error(`✖ ingest failed: ${message}`);
  process.exit(1);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.local) {
    fail(
      "downloading from opendata.swiss is not yet implemented — run with --local <dir> " +
        "pointing at BAG CSV exports, or see architecture.md §3.1 for the source URLs to wire up.",
    );
  }

  const rawDir = args.local!;
  const premiumsPath = join(rawDir, "praemien.csv");
  const plzPath = join(rawDir, "plz_gemeinde_region.csv");

  if (!existsSync(premiumsPath) || !existsSync(plzPath)) {
    fail(
      `expected ${premiumsPath} and ${plzPath} to exist. ` +
        "Place BAG CSV exports there, or adjust the paths once the real filenames are confirmed.",
    );
  }

  // TODO: parse CSVs (e.g. with `csv-parse`), validate column presence/ranges
  // per architecture.md §3.2 step 2, and emit:
  //   premiums-{year}.json, plz-map.json, gemeinde-region-map.json,
  //   insurers.json, metadata.json
  console.log(`Read ${premiumsPath} and ${plzPath}. CSV parsing not yet implemented — see TODO in this file.`);
  console.log(`Existing sample data in ${DATA_DIR} was left untouched.`);
}

main();
