// Blackbox test: compares live prixio.ch premiums against the official BAG
// calculator (priminfo.ch) for a batch of randomly sampled premium-region ×
// franchise combinations. Run via `npm run test:blackbox`.
//
// Fixed for every case (matching prixio's own defaults, so this is an
// apples-to-apples comparison): adult birth year, Standard model only,
// accident coverage included, current year. Only premium region and
// franchise vary, per the request this script was built for.
//
// Price basis: prixio's displayed premium already nets out the BAFU
// CO2-/VOC-levy credit (see src/lib/environmentalLevy.ts) — the equivalent
// figure on priminfo is its "Total" column, not the raw "Prämie" column.
// This was verified by hand before writing this script (see
// docs/superpowers/specs — the 2026-08-26 brainstorming conversation) and is
// asserted again at runtime: if priminfo's Total isn't Prämie − Vergütung
// for a row, that row is reported as an error rather than silently compared.

import { chromium, type Page } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import plzMap from "../src/data/plz-map.json";
import insurers from "../src/data/insurers.json";
import metadata from "../src/data/metadata.json";

const PRIXIO_BASE = "https://prixio.ch/de";
const PRIMINFO_BASE = "https://www.priminfo.admin.ch/de/praemien";
const ADULT_FRANCHISES = [300, 500, 1000, 1500, 2000, 2500] as const;
const FIXED_BIRTH_YEAR = 1990;
const YEAR = metadata.availableYears[0];
const CASE_COUNT = 10;

type PlzEntry = { bfsNr: number; name: string; kanton: string; praemienregionId: string };
type Case = { regionId: string; plz: string; franchise: number };
type SiteRow = { insurerRaw: string; price: number };
type MatchedRow = {
  insurerCode: string;
  insurerName: string;
  prixioPrice: number | null;
  priminfoPrice: number | null;
  priminfoRaw: string | null;
};
type CaseResult = {
  case: Case;
  status: "ok" | "error";
  error?: string;
  rows: MatchedRow[];
  onlyOnPrixio: SiteRow[];
  onlyOnPriminfo: SiteRow[];
  unrecognizedPriminfoNames: string[];
  mismatches: MatchedRow[];
  prixioScreenshot?: string;
  priminfoScreenshot?: string;
};

// ---------- 1. Region sampling ----------

function representativePlzByRegion(): Map<string, string> {
  const byRegion = new Map<string, string>();
  for (const [plz, entries] of Object.entries(plzMap as Record<string, PlzEntry[]>)) {
    const regionIds = new Set(entries.map((e) => e.praemienregionId));
    if (regionIds.size !== 1) continue; // ambiguous PLZ — skip, don't risk a disambiguation prompt
    const [regionId] = regionIds;
    if (!byRegion.has(regionId)) byRegion.set(regionId, plz);
  }
  return byRegion;
}

function sampleCases(n: number): Case[] {
  const byRegion = [...representativePlzByRegion().entries()];
  const shuffled = [...byRegion].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n).map(([regionId, plz]) => ({
    regionId,
    plz,
    franchise: ADULT_FRANCHISES[Math.floor(Math.random() * ADULT_FRANCHISES.length)],
  }));
}

// ---------- 2. Insurer name matching ----------

type Insurer = { insurerCode: string; insurerName: string; memberCount: number };
const INSURERS = insurers as Insurer[];

// Known priminfo display names that don't fold onto insurers.json's name by
// normalization or substring containment alone.
const EXPLICIT_ALIASES: Record<string, string> = {
  kklh: "Krankenkasse Luzerner Hinterland",
  einsiedeln: "Einsiedler Krankenkasse",
  cmveo: "Caisse-maladie de la vallée d'Entremont",
};

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/\(groupe mutuel\)/g, "")
    .replace(/\b(krankenkasse|kranken-versicherung|krankenversicherung|versicherung|assurances?|caisse-maladie)\b/g, "")
    .replace(/[^a-z0-9äöüéèà]+/g, " ")
    .trim();
}

const NORMALIZED_INSURERS = INSURERS.map((i) => ({ insurer: i, norm: normalize(i.insurerName) }));

function matchInsurer(priminfoName: string): Insurer | null {
  const norm = normalize(priminfoName);
  const alias = EXPLICIT_ALIASES[norm];
  if (alias) {
    const hit = INSURERS.find((i) => i.insurerName === alias);
    if (hit) return hit;
  }
  const exact = NORMALIZED_INSURERS.find((e) => e.norm === norm);
  if (exact) return exact.insurer;
  const substring = NORMALIZED_INSURERS.find(
    (e) => e.norm.length > 2 && norm.length > 2 && (e.norm.includes(norm) || norm.includes(e.norm)),
  );
  return substring ? substring.insurer : null;
}

// ---------- 3. prixio adapter ----------

async function fetchPrixio(page: Page, c: Case, screenshotPath?: string): Promise<SiteRow[]> {
  const url =
    `${PRIXIO_BASE}?plz=${c.plz}&by=${FIXED_BIRTH_YEAR}&fran=${c.franchise}` +
    `&year=${YEAR}&acc=1&models=standard`;
  await page.goto(url, { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForSelector('[role="listitem"]', { timeout: 15000 });
  if (screenshotPath) await page.screenshot({ path: screenshotPath, fullPage: true });
  const rows = await page.locator('[role="listitem"]').evaluateAll((els) =>
    els.map((el) => el.textContent ?? ""),
  );
  return rows
    .map((text) => {
      const priceMatch = text.match(/CHF\s*([\d'.,]+)\s*\/Monat/);
      const nameMatch = text.match(/^\s*(?:\d+)?\s*([^\d][^·]*?)(?:Standard|Freie|HMO|Hausarzt|Telmed|Andere)/);
      if (!priceMatch) return null;
      const price = Number(priceMatch[1].replace(/'/g, ""));
      // Insurer name is everything before the model badge text; fall back to
      // splitting on the price if the badge-based regex doesn't land.
      const insurerRaw = (nameMatch?.[1] ?? text.split(/CHF/)[0]).trim();
      return { insurerRaw, price };
    })
    .filter((r): r is SiteRow => r != null && r.insurerRaw.length > 0 && Number.isFinite(r.price));
}

// ---------- 4. priminfo adapter ----------

async function fetchPriminfo(page: Page, c: Case, screenshotPath?: string): Promise<SiteRow[]> {
  await page.goto(PRIMINFO_BASE, { waitUntil: "networkidle", timeout: 45000 });

  const locInput = page.locator("#form-typeahead-input");
  await locInput.click();
  await locInput.pressSequentially(c.plz, { delay: 60 });
  await page.waitForSelector('#algolia-autocomplete-listbox-0 [role="option"]', { timeout: 15000 });
  await page.locator('#algolia-autocomplete-listbox-0 [role="option"]').first().click();

  await page.locator("#insured0-yob-input").fill(String(FIXED_BIRTH_YEAR));
  await page.locator("#insured0-yob-input").blur();
  await page.waitForFunction(
    () => document.querySelectorAll("#insured0-franchise-input option").length > 1,
    { timeout: 15000 },
  );
  await page.locator("#insured0-franchise-input").selectOption(String(c.franchise));

  for (const id of ["form-models-ham-input", "form-models-hmo-input", "form-models-div-input"]) {
    const cb = page.locator("#" + id);
    if (await cb.isChecked()) await cb.uncheck({ force: true });
  }
  const coverageYes = page.locator("#form-insured0-coverage-yes-input");
  if (!(await coverageYes.isChecked())) await coverageYes.check({ force: true });

  await page.getByRole("button", { name: /berechnen/i }).first().click();

  // The page has an unrelated "Medienmitteilung" table in its sidebar that's
  // present even before submitting, so a generic `table tbody tr` selector
  // resolves immediately and races the actual results table, which only
  // appears once the (re-)calculation finishes. Scope to the results table
  // specifically, identified by its "Krankenkasse" header, and wait for it.
  const resultsTable = page.locator("table").filter({ has: page.locator("th", { hasText: "Krankenkasse" }) });
  await resultsTable.waitFor({ state: "visible", timeout: 20000 });

  // Each row always carries BOTH monthly and yearly figures (the Monat/Jahr
  // radio just toggles a `hiddenCell` CSS class — the yearly `td`s stay in
  // the DOM either way), so cell count/position isn't a safe way to find the
  // monthly Prämie/Vergütung/Total; the "monthlyCell" class is.
  const rows = await resultsTable.locator("tbody tr").evaluateAll((trs) =>
    trs
      .map((tr) => ({
        insurerRaw: tr.querySelector("th")?.textContent?.trim() ?? "",
        monthly: Array.from(tr.querySelectorAll("td.monthlyCell")).map((c) => c.textContent?.trim() ?? ""),
      }))
      .filter((r) => r.insurerRaw && r.monthly.length === 3 && /^[\d'.,]+$/.test(r.monthly[2])),
  );
  if (rows.length === 0) {
    throw new Error("priminfo results table rendered but had 0 matching rows — selector likely broke");
  }
  if (screenshotPath) await page.screenshot({ path: screenshotPath, fullPage: true });

  const out: SiteRow[] = [];
  for (const { insurerRaw, monthly } of rows) {
    const [praemieRaw, verguetungRaw, totalRaw] = monthly;
    const praemie = Number(praemieRaw.replace(/'/g, ""));
    const verguetung = Number(verguetungRaw.replace(/'/g, ""));
    const total = Number(totalRaw.replace(/'/g, ""));
    const expectedTotal = Math.round((praemie - verguetung) * 100) / 100;
    if (Math.abs(expectedTotal - total) > 0.01) {
      throw new Error(
        `priminfo row "${insurerRaw}": Total (${total}) != Prämie - Vergütung (${expectedTotal}) — price-basis assumption broke`,
      );
    }
    out.push({ insurerRaw, price: total });
  }
  return out;
}

// ---------- 5. Compare ----------

function compareCase(c: Case, prixioRows: SiteRow[], priminfoRows: SiteRow[]): CaseResult {
  const unrecognized: string[] = [];
  const onlyOnPrixio: SiteRow[] = [];
  const onlyOnPriminfo: SiteRow[] = [];

  const prixioByCode = new Map<string, SiteRow>();
  for (const row of prixioRows) {
    const insurer = INSURERS.find((i) => i.insurerName === row.insurerRaw) ?? matchInsurer(row.insurerRaw);
    if (!insurer) {
      onlyOnPrixio.push(row); // shouldn't happen — prixio names should always be in insurers.json
      continue;
    }
    prixioByCode.set(insurer.insurerCode, row);
  }

  const priminfoByCode = new Map<string, { row: SiteRow; matched: Insurer } >();
  for (const row of priminfoRows) {
    const insurer = matchInsurer(row.insurerRaw);
    if (!insurer) {
      unrecognized.push(row.insurerRaw);
      onlyOnPriminfo.push(row);
      continue;
    }
    priminfoByCode.set(insurer.insurerCode, { row, matched: insurer });
  }

  const allCodes = new Set([...prixioByCode.keys(), ...priminfoByCode.keys()]);
  const rows: MatchedRow[] = [];
  for (const code of allCodes) {
    const insurer = INSURERS.find((i) => i.insurerCode === code)!;
    const p = prixioByCode.get(code);
    const q = priminfoByCode.get(code);
    if (p && !q) onlyOnPrixio.push(p);
    if (q && !p) onlyOnPriminfo.push(q.row);
    rows.push({
      insurerCode: code,
      insurerName: insurer.insurerName,
      prixioPrice: p?.price ?? null,
      priminfoPrice: q?.row.price ?? null,
      priminfoRaw: q?.row.insurerRaw ?? null,
    });
  }

  const mismatches = rows.filter(
    (r) => r.prixioPrice != null && r.priminfoPrice != null && r.prixioPrice !== r.priminfoPrice,
  );

  return {
    case: c,
    status: "ok",
    rows: rows.sort((a, b) => a.insurerName.localeCompare(b.insurerName)),
    onlyOnPrixio,
    onlyOnPriminfo,
    unrecognizedPriminfoNames: [...new Set(unrecognized)],
    mismatches,
  };
}

// priminfo.admin.ch is flaky under back-to-back automated requests (its
// typeahead widget sometimes just never initializes for a given load) —
// empirically observed while building this script. Retry with real backoff
// rather than a short fixed delay.
async function withRetry<T>(fn: () => Promise<T>, attempts = 3, backoffMs = [5000, 15000]): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, backoffMs[i] ?? 15000));
    }
  }
  throw lastErr;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---------- 6. Main ----------

async function main() {
  const cases = sampleCases(CASE_COUNT);
  console.log(`Sampled ${cases.length} (premium region, franchise) cases for ${YEAR}, birth year ${FIXED_BIRTH_YEAR}:`);
  for (const c of cases) console.log(`  ${c.regionId}  PLZ ${c.plz}  franchise CHF ${c.franchise}`);
  console.log("");

  const runDir = join(tmpdir(), `blackbox-compare-${Date.now()}`);
  await mkdir(runDir, { recursive: true });

  const browser = await chromium.launch();
  const results: CaseResult[] = [];

  for (const [i, c] of cases.entries()) {
    process.stdout.write(`→ ${c.regionId} / CHF ${c.franchise} ... `);
    const slug = `${String(i + 1).padStart(2, "0")}-${c.regionId}-${c.franchise}`;
    const prixioScreenshot = join(runDir, `${slug}-prixio.png`);
    const priminfoScreenshot = join(runDir, `${slug}-priminfo.png`);
    const page = await browser.newPage();
    try {
      const prixioRows = await withRetry(() => fetchPrixio(page, c, prixioScreenshot));
      const priminfoRows = await withRetry(() => fetchPriminfo(page, c, priminfoScreenshot));
      const result = compareCase(c, prixioRows, priminfoRows);
      result.prixioScreenshot = prixioScreenshot;
      result.priminfoScreenshot = priminfoScreenshot;
      results.push(result);
      console.log(
        `${result.mismatches.length === 0 ? "OK" : "MISMATCH"} ` +
          `(${result.rows.length} matched, ${result.onlyOnPrixio.length} prixio-only, ${result.onlyOnPriminfo.length} priminfo-only)`,
      );
    } catch (err) {
      // Paths are recorded even on failure: whichever site's fetch got far
      // enough to screenshot before the other one failed will have a real
      // file here — harmless if a path never actually got written to.
      results.push({
        case: c,
        status: "error",
        error: err instanceof Error ? err.message : String(err),
        rows: [],
        onlyOnPrixio: [],
        onlyOnPriminfo: [],
        unrecognizedPriminfoNames: [],
        mismatches: [],
        prixioScreenshot,
        priminfoScreenshot,
      });
      console.log(`ERROR: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      await page.close();
    }
    await sleep(4000); // be polite to priminfo.admin.ch between cases
  }
  await browser.close();

  // ---------- Report ----------
  const okResults = results.filter((r) => r.status === "ok");
  const errored = results.filter((r) => r.status === "error");
  const withMismatches = okResults.filter((r) => r.mismatches.length > 0);
  const totalMismatches = okResults.reduce((n, r) => n + r.mismatches.length, 0);
  const totalUnrecognized = new Set(okResults.flatMap((r) => r.unrecognizedPriminfoNames));

  console.log("\n=== Summary ===");
  console.log(`Cases: ${results.length}  OK: ${okResults.length}  Errored: ${errored.length}`);
  console.log(`Cases with price mismatches: ${withMismatches.length}  (total mismatched rows: ${totalMismatches})`);
  if (totalUnrecognized.size > 0) {
    console.log(`Unrecognized priminfo insurer names seen: ${[...totalUnrecognized].join(", ")}`);
  }

  if (totalMismatches > 0) {
    console.log("\n--- Price mismatches ---");
    for (const r of withMismatches) {
      console.log(`${r.case.regionId} (PLZ ${r.case.plz}), franchise CHF ${r.case.franchise}:`);
      for (const m of r.mismatches) {
        console.log(`  ${m.insurerName}: prixio CHF ${m.prixioPrice}  vs  priminfo CHF ${m.priminfoPrice}`);
      }
    }
  }

  if (errored.length > 0) {
    console.log("\n--- Errors ---");
    for (const r of errored) console.log(`${r.case.regionId} (PLZ ${r.case.plz}): ${r.error}`);
  }

  const reportPath = join(runDir, "report.json");
  await writeFile(reportPath, JSON.stringify({ generatedAt: new Date().toISOString(), year: YEAR, results }, null, 2));
  console.log(`\nFull report written to ${reportPath}`);
  console.log(`Screenshots (full-page, one prixio + one priminfo per case) written to ${runDir}`);

  if (totalMismatches > 0 || errored.length > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
