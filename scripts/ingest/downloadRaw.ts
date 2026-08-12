// scripts/ingest/downloadRaw.ts
//
// Downloads the two real BAG source files (URLs verified live during planning,
// 2026-08-11 — see this plan's Global Constraints) into destDir as
// praemien.csv / praemienregionen.xlsx, matching the filenames scripts/ingest.ts
// reads under --local.

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const PREMIUM_CSV_URL =
  "https://opendata.bagnet.ch/?r=/download&path=L1ByYWVtaWVuL1Byw6RtaWVuX0NILmNzdg%3D%3D"; // BAG: /Praemien/Praemien_CH.csv
const REGION_XLSX_URL = "https://www.priminfo.admin.ch/downloads/praemienregionen.xlsx";

export async function downloadRawFiles(destDir: string): Promise<void> {
  await mkdir(destDir, { recursive: true });
  await Promise.all([
    downloadTo(PREMIUM_CSV_URL, join(destDir, "praemien.csv")),
    downloadTo(REGION_XLSX_URL, join(destDir, "praemienregionen.xlsx")),
  ]);
}

async function downloadTo(url: string, path: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download failed: ${url} → HTTP ${res.status}`);
  await writeFile(path, Buffer.from(await res.arrayBuffer()));
}
