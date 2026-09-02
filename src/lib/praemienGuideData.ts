// src/lib/praemienGuideData.ts
// Server-only disk read for the /de/praemien guide. Split out of
// praemienGuide.ts so that module stays browser-safe for the "use client"
// content component (node:fs/promises cannot be bundled for the client).

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { PremiumRow } from "./types";

/** Reads public/data/premiums-{year}.json off disk. I/O — server-side only
 *  (mirrors how scripts/ingest.ts writes to the same path via
 *  PUBLIC_DATA_DIR = join(process.cwd(), "public", "data")). Never call this
 *  from a "use client" component. */
export async function readPremiumRows(year: number): Promise<PremiumRow[]> {
  const filePath = join(process.cwd(), "public", "data", `premiums-${year}.json`);
  const json = await readFile(filePath, "utf-8");
  return JSON.parse(json) as PremiumRow[];
}
