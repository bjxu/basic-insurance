// BAG data ingestion (architecture.md §3.2). Run via `npm run ingest`.
//
// Downloads (or reads --local) the BAG premium CSV and premium-region/PLZ
// spreadsheet, validates and reshapes them, and writes typed JSON to src/data/
// (plz-map, gemeinde-region-map, insurers, metadata) — except the premium file
// itself, which is large enough to be fetched as a static asset rather than
// bundled, so it goes to public/data/ instead (architecture.md §3.4).

import { existsSync } from "node:fs";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import * as XLSX from "xlsx";
import { parsePremiumRows } from "./ingest/parsePremiums";
import { parseRegionRows, type RawRegionRow } from "./ingest/parseRegions";
import { parseMemberCounts } from "./ingest/members";
import { buildInsurersJson, INSURER_NAMES } from "./ingest/insurers";
import { downloadRawFiles } from "./ingest/downloadRaw";
import { validateIngestOutput, verifyWrittenFile } from "./ingest/validateIngest";
import { carryForwardEnvironmentalLevy } from "./ingest/metadata";
import type { Metadata } from "../src/lib/types";

const DATA_DIR = join(process.cwd(), "src", "data");
const PUBLIC_DATA_DIR = join(process.cwd(), "public", "data");
const PUBLICATION_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

type Args = { local?: string; publicationDate?: string };

function parseArgs(argv: string[]): Args {
  const args: Args = {};
  const localIdx = argv.indexOf("--local");
  if (localIdx !== -1) args.local = argv[localIdx + 1] ?? "data/raw";
  const dateIdx = argv.indexOf("--publication-date");
  if (dateIdx !== -1) args.publicationDate = argv[dateIdx + 1];
  return args;
}

function fail(message: string): never {
  console.error(`✖ ingest failed: ${message}`);
  process.exit(1);
}

async function resolveRawDir(args: Args): Promise<string> {
  if (args.local) return args.local;
  const dir = join(process.cwd(), "data", "raw");
  await downloadRawFiles(dir);
  return dir;
}

function readRegionRows(xlsxPath: string): RawRegionRow[] {
  const workbook = XLSX.readFile(xlsxPath);
  const sheet = workbook.Sheets["A_COM"];
  if (!sheet) fail(`"${xlsxPath}" has no "A_COM" sheet — has BAG changed the file layout?`);
  // Header spans rows 1-5 (0-indexed 0-4); data starts at row 6 (0-indexed 5).
  return XLSX.utils.sheet_to_json<RawRegionRow>(sheet, { header: 1, range: 5, blankrows: false });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.publicationDate || !PUBLICATION_DATE_RE.test(args.publicationDate)) {
    fail(
      "missing/invalid --publication-date <YYYY-MM-DD>. BAG doesn't stamp this in the " +
        "source files, so pass the real BAG publication date (see data/raw/README.md).",
    );
  }

  const rawDir = await resolveRawDir(args);
  const premiumsPath = join(rawDir, "praemien.csv");
  const regionsPath = join(rawDir, "praemienregionen.xlsx");
  const membersPath = join(rawDir, "versichertenbestand.csv");
  if (!existsSync(premiumsPath) || !existsSync(regionsPath) || !existsSync(membersPath)) {
    fail(`expected ${premiumsPath}, ${regionsPath}, and ${membersPath} to exist.`);
  }

  const { gemeinden, plzMap, gemeindeRegionMap } = parseRegionRows(readRegionRows(regionsPath));

  const csvText = await readFile(premiumsPath, "utf-8");
  const { rows, skippedCantons, unknownTariftypes } = parsePremiumRows(csvText, INSURER_NAMES);
  if (rows.length === 0) fail("parsed 0 premium rows — check the CSV format/columns.");

  const membersCsvText = await readFile(membersPath, "utf-8");
  const { counts: memberCounts, year: memberCountAsOf, unmatchedCodes } = parseMemberCounts(
    membersCsvText,
    INSURER_NAMES,
  );
  if (Object.keys(memberCounts).length === 0) {
    fail("parsed 0 member counts — check the Versichertenbestand CSV format/columns.");
  }

  const validation = validateIngestOutput(csvText, rows);
  if (!validation.ok) {
    fail(`ingest output failed validation against source data:\n  ${validation.errors.join("\n  ")}`);
  }

  const year = rows[0].year;

  // metadata.json is rewritten from scratch below, but environmentalLevyPerMonth is a
  // hand-maintained BAFU figure with no counterpart in the BAG source files — carry the
  // existing map forward instead of dropping it (scripts/ingest/metadata.ts).
  const metadataPath = join(DATA_DIR, "metadata.json");
  const existingMetadataJson = await readFile(metadataPath, "utf-8").catch(() => null);
  const levy = carryForwardEnvironmentalLevy(existingMetadataJson, year);
  if (!levy.ok) fail(levy.error);

  const metadata: Metadata = {
    publicationDate: args.publicationDate,
    availableYears: [year],
    memberCountAsOf,
    environmentalLevyPerMonth: levy.environmentalLevyPerMonth,
  };

  await mkdir(PUBLIC_DATA_DIR, { recursive: true });
  const premiumsJson = JSON.stringify(rows);
  await writeFile(join(PUBLIC_DATA_DIR, `premiums-${year}.json`), premiumsJson);
  const premiumsWrittenBack = await readFile(join(PUBLIC_DATA_DIR, `premiums-${year}.json`), "utf-8");
  const roundTrip = verifyWrittenFile(premiumsJson, premiumsWrittenBack);
  if (!roundTrip.ok) {
    // Don't leave a corrupted premiums-{year}.json on disk under the same filename
    // the (unmodified) metadata.json already references — fail() exits before any
    // other file is written, so removing this one restores the pre-run state.
    await unlink(join(PUBLIC_DATA_DIR, `premiums-${year}.json`)).catch(() => {});
    fail(`premiums file failed round-trip verification:\n  ${roundTrip.errors.join("\n  ")}`);
  }
  await writeFile(join(DATA_DIR, "plz-map.json"), JSON.stringify(plzMap, null, 2));
  await writeFile(join(DATA_DIR, "gemeinde-region-map.json"), JSON.stringify(gemeindeRegionMap, null, 2));
  await writeFile(
    join(DATA_DIR, "insurers.json"),
    JSON.stringify(buildInsurersJson(INSURER_NAMES, memberCounts), null, 2),
  );
  await writeFile(metadataPath, JSON.stringify(metadata, null, 2));

  console.log(
    `✔ wrote ${rows.length} premium rows for ${year}, ${gemeinden.length} Gemeinden, ` +
      `${Object.keys(plzMap).length} PLZ.`,
  );
  if (skippedCantons.size > 0) {
    const summary = [...skippedCantons].map(([k, n]) => `${k}=${n}`).join(", ");
    console.log(`  skipped rows with no Gemeinde/PLZ mapping (unreachable via lookup): ${summary}`);
  }
  if (unknownTariftypes.size > 0) {
    console.log(
      `  ⚠ unrecognized Tariftyp code(s) mapped to "andere": ${[...unknownTariftypes].join(", ")} ` +
        `— check requirement.md §11.4`,
    );
  }
  if (unmatchedCodes.size > 0) {
    console.log(
      `  ⚠ Versichertenbestand code(s) with no matching insurer, skipped: ${[...unmatchedCodes].join(", ")}`,
    );
  }
}

main();
