#!/usr/bin/env node
// Downloads the Swiss Federal Office of Public Health's (BAG) official mandatory
// health insurance ("KVG/OKP") premium data and compacts it into
// public/data/premiums.json for the site to fetch at runtime.
//
// Two official sources, both under opendata.swiss's "open use" terms
// (https://opendata.swiss/terms-of-use#terms_open):
//  - Prämien_CH.csv (opendata.bagnet.ch): ~217k rows, one per
//    insurer × canton × premium-region × age-class × deductible × accident-coverage ×
//    insurance model, for CH residents (not the separate EU/cross-border file).
//  - praemienregionen.xlsx (priminfo.admin.ch): the official municipality (Gemeinde) /
//    postal-code (PLZ) -> premium-region lookup, used so the app can ask for a
//    postcode/municipality instead of a bare canton.
//
// For each (canton, region, age class, franchise, accident-coverage, insurer)
// combination we keep the *cheapest* premium found, minimizing across insurance model
// (standard/HMO/family-doctor/other) — but, unlike the first version of this script,
// NOT across premium region within a canton anymore. Region is now resolved exactly
// from the user's municipality/postcode (see src/lib/health-premiums.ts).
//
// Note on gender: intentionally absent. Swiss law (Art. 61 KVG) requires insurers to
// charge the same OKP premium regardless of sex — BAG's dataset has no such column,
// so there's nothing to model.
//
// Run manually (`npm run build:data`) and commit the result — this is NOT part of
// `npm run build`, so the deployed site never needs network access to BAG/priminfo.
// Note for regenerating from *inside* the devcontainer: opendata.bagnet.ch and
// priminfo.admin.ch aren't on the firewall allowlist by default; add them in
// .devcontainer/init-firewall.sh first (see .devcontainer/README.md), or run this on
// the host.

import { writeFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readXlsxSheetRows } from './lib/xlsx-lite.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_PATH = join(__dirname, '../public/data/premiums.json')

// Resolved via https://ckan.opendata.swiss/api/3/action/package_show?id=health-insurance-premiums
// (resource "Prämien_CH.csv"). The path segment is a stable base64 encoding of the
// filename, not a rotating token, but if BAG restructures the download re-resolve it
// from that package_show endpoint.
const CSV_URL =
  'https://opendata.bagnet.ch/?r=/download&path=L1ByYWVtaWVuL1Byw6RtaWVuX0NILmNzdg%3D%3D'
const REGIONS_XLSX_URL = 'https://www.priminfo.admin.ch/downloads/praemienregionen.xlsx'

const SOURCE_DATASET_URL = 'https://opendata.swiss/de/dataset/health-insurance-premiums'
const SOURCE_REGIONS_URL = 'https://www.bag.admin.ch/de/krankenversicherung-praemienregionen'
const LICENSE_URL = 'https://opendata.swiss/terms-of-use#terms_open'

// Only the 26 real cantons — the raw file also contains a couple of near-empty (<150
// row) "ZE"/"ZR" codes that aren't standard canton identifiers; excluded as data noise.
const CANTONS = {
  AG: 'Aargau',
  AI: 'Appenzell Innerrhoden',
  AR: 'Appenzell Ausserrhoden',
  BE: 'Bern',
  BL: 'Basel-Landschaft',
  BS: 'Basel-Stadt',
  FR: 'Fribourg',
  GE: 'Genève',
  GL: 'Glarus',
  GR: 'Graubünden',
  JU: 'Jura',
  LU: 'Luzern',
  NE: 'Neuchâtel',
  NW: 'Nidwalden',
  OW: 'Obwalden',
  SG: 'St. Gallen',
  SH: 'Schaffhausen',
  SO: 'Solothurn',
  SZ: 'Schwyz',
  TG: 'Thurgau',
  TI: 'Ticino',
  UR: 'Uri',
  VD: 'Vaud',
  VS: 'Valais',
  ZG: 'Zug',
  ZH: 'Zürich',
}

const AGE_CLASSES = {
  'AKL-KIN': { label: 'Child (0–18)', franchises: [0, 100, 200, 300, 400, 500, 600] },
  'AKL-JUG': { label: 'Young adult (19–25)', franchises: [300, 500, 1000, 1500, 2000, 2500] },
  'AKL-ERW': { label: 'Adult (26+)', franchises: [300, 500, 1000, 1500, 2000, 2500] },
}

// Hand-curated from BAG's official insurer registry (Verzeichnis der zugelassenen
// Krankenversicherer, https://www.bag.admin.ch/de/verzeichnisse-der-zugelassenen-kranken-und-rueckversicherer),
// matched by BAG number. The registry's XLSX has awkward multi-language/multi-row
// cells, so names are shortened to common brand names rather than full legal entity
// names. If a future data pull contains an insurer code not listed here, it falls
// back to "Insurer <code>" — check the registry and add it.
const INSURERS = {
  8: 'CSS',
  32: 'Aquilana',
  134: 'Einsiedler Krankenkasse',
  194: 'Sumiswalder Krankenkasse',
  246: 'Krankenkasse Steffisburg',
  290: 'Concordia',
  312: 'Atupri',
  343: 'Avenir Assurance (Groupe Mutuel)',
  360: 'Krankenkasse Luzerner Hinterland',
  376: 'KPT',
  455: 'ÖKK',
  509: 'Sympany',
  780: 'Glarner Krankenversicherung',
  820: 'curaulta',
  881: 'EGK',
  923: 'SLKK',
  941: 'sodalis',
  966: 'vita surselva',
  1040: 'Krankenkasse Visperterminen',
  1113: "Caisse-maladie de la vallée d'Entremont",
  1318: 'Krankenkasse Wädenswil',
  1322: 'Krankenkasse Birchmeier',
  1384: 'Swica',
  1386: 'Galenos',
  1401: 'rhenusana',
  1479: 'Mutuel Assurance (Groupe Mutuel)',
  1507: 'AMB Assurances (Groupe Mutuel)',
  1509: 'Sanitas',
  1535: 'Philos Assurance (Groupe Mutuel)',
  1542: 'Assura',
  1555: 'Visana',
  1560: 'Agrisano',
  1562: 'Helsana',
  1568: 'sana24',
}

// Minimal RFC4180-ish CSV line parser (handles quoted fields; the source file
// doesn't appear to need it, but it's one screen of code and cheap insurance).
function parseCsvLine(line) {
  const fields = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        cur += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      fields.push(cur)
      cur = ''
    } else {
      cur += ch
    }
  }
  fields.push(cur)
  return fields
}

async function fetchBuffer(url, label) {
  console.log(`Fetching ${label}: ${url} ...`)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Download failed for ${label}: HTTP ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  console.log(`  -> ${(buf.length / 1e6).toFixed(1)} MB`)
  return buf
}

// --- Premium regions: municipality (Gemeinde) / postcode (PLZ) -> canton + region ---
// number. Region numbers are BAG's own (0 for cantons with a single, unsplit region;
// 1..3 for split cantons, where 1 is consistently the most expensive / most urban and
// higher numbers are cheaper — verified against BAG's published average-premium-by-
// region figures, which is also how we confirmed the "PR-REG CH<N>" codes in
// Prämien_CH.csv directly *are* this same region number, with no indirection needed.
function parseGemeinden(xlsxBuf) {
  const rows = readXlsxSheetRows(xlsxBuf, 'A_COM')
  const gemeinden = []
  for (const row of rows) {
    const bfsNr = Number(row[0])
    const kanton = row[1]
    const gemeinde = row[2]
    const region = Number(row[3])
    const plz = Number(row[5])
    const ort = row[6]
    // Skip the sheet's title/legend rows (col 0 isn't a BFS number there) and any
    // canton not in our standard 26 (mirrors the same filter applied to the CSV).
    if (!Number.isInteger(bfsNr) || !(kanton in CANTONS) || !Number.isInteger(plz)) continue
    gemeinden.push([bfsNr, kanton, gemeinde, region, plz, ort])
  }
  return gemeinden
}

function parsePremiumRows(csvText) {
  const lines = csvText.split(/\r?\n/).filter((l) => l.length > 0)
  const header = parseCsvLine(lines[0]).map((h) => h.replace(/^﻿/, ''))
  const col = Object.fromEntries(header.map((name, i) => [name, i]))

  let premiumYear = null
  // key: `${canton}|${region}|${ageClass}|${franchise}|${accident}|${insurer}` -> min premium
  const best = new Map()

  for (let i = 1; i < lines.length; i++) {
    const f = parseCsvLine(lines[i])
    const canton = f[col.Kanton]
    if (!(canton in CANTONS)) continue

    const regionMatch = /^PR-REG CH(\d+)$/.exec(f[col.Region])
    if (!regionMatch) continue
    const region = Number(regionMatch[1])

    const ageClass = f[col.Altersklasse]
    const franchise = Number(f[col.Franchise].replace('FRA-', ''))
    const accident = f[col.Unfalleinschluss] === 'MIT-UNF' ? 1 : 0
    const insurer = Number(f[col.Versicherer])
    const premium = Number(f[col['Prämie']])
    if (!Number.isFinite(premium)) continue

    premiumYear ??= f[col['Geschäftsjahr']]

    const key = `${canton}|${region}|${ageClass}|${franchise}|${accident}|${insurer}`
    const existing = best.get(key)
    if (existing === undefined || premium < existing) best.set(key, premium)
  }

  const rows = []
  for (const [key, premium] of best) {
    const [canton, region, ageClass, franchise, accident, insurer] = key.split('|')
    rows.push([
      canton,
      Number(region),
      ageClass,
      Number(franchise),
      Number(accident),
      Number(insurer),
      premium,
    ])
  }
  return { rows, premiumYear }
}

/** Cheap cross-check that the two independently-sourced files agree on how many
 * premium regions each canton has — would catch e.g. BAG changing the region-code
 * scheme in a future year's CSV, or a mismatched xlsx sheet layout. */
function validateRegionsAgree(premiumRows, gemeinden) {
  const regionsFromPremiums = new Map()
  for (const [canton, region] of premiumRows) {
    if (!regionsFromPremiums.has(canton)) regionsFromPremiums.set(canton, new Set())
    regionsFromPremiums.get(canton).add(region)
  }
  const regionsFromGemeinden = new Map()
  for (const [, canton, , region] of gemeinden) {
    if (!regionsFromGemeinden.has(canton)) regionsFromGemeinden.set(canton, new Set())
    regionsFromGemeinden.get(canton).add(region)
  }

  let problems = 0
  for (const canton of Object.keys(CANTONS)) {
    const a = [...(regionsFromPremiums.get(canton) ?? [])].sort()
    const b = [...(regionsFromGemeinden.get(canton) ?? [])].sort()
    if (a.join(',') !== b.join(',')) {
      console.warn(`WARNING: region mismatch for ${canton}: premiums=[${a}] vs gemeinden=[${b}]`)
      problems++
    }
  }
  if (problems === 0) console.log('Region cross-check OK: premiums and gemeinden agree for all 26 cantons.')
  return problems
}

async function main() {
  const [csvBuf, xlsxBuf] = await Promise.all([
    fetchBuffer(CSV_URL, 'Prämien_CH.csv'),
    fetchBuffer(REGIONS_XLSX_URL, 'praemienregionen.xlsx'),
  ])

  const { rows, premiumYear } = parsePremiumRows(csvBuf.toString('utf8'))
  const gemeinden = parseGemeinden(xlsxBuf)
  console.log(`Parsed ${rows.length} premium rows, ${gemeinden.length} gemeinde/PLZ entries`)

  validateRegionsAgree(rows, gemeinden)

  const unknownInsurers = [...new Set(rows.map((r) => r[5]))].filter((code) => !(code in INSURERS))
  if (unknownInsurers.length > 0) {
    console.warn(
      `WARNING: ${unknownInsurers.length} insurer code(s) not in the curated INSURERS map: ${unknownInsurers.join(', ')}. They'll show as "Insurer <code>" in the UI — check BAG's registry and add them.`,
    )
  }

  const out = {
    generatedAt: new Date().toISOString(),
    premiumYear: premiumYear ? Number(premiumYear) : null,
    sourceDataset: SOURCE_DATASET_URL,
    sourceFile: CSV_URL,
    sourceRegions: SOURCE_REGIONS_URL,
    sourceRegionsFile: REGIONS_XLSX_URL,
    license: LICENSE_URL,
    attribution: 'Bundesamt für Gesundheit (BAG)',
    unit: 'CHF/month',
    notes:
      'Cheapest premium per insurer for the given municipality (exact premium region) / age class / franchise / accident-coverage choice, minimized across insurance model (standard, HMO, family-doctor, other). Gender is not a factor: Swiss law requires OKP premiums to be gender-neutral.',
    cantons: CANTONS,
    ageClasses: AGE_CLASSES,
    insurers: INSURERS,
    // [bfsNr, canton, gemeinde, region, plz, ort] — one row per (municipality, PLZ)
    // pair, since municipalities can span multiple postcodes and vice versa.
    gemeinden,
    // [canton, region, ageClass, franchise, accidentIncluded(0/1), insurerCode, monthlyPremium]
    rows,
  }

  await mkdir(dirname(OUT_PATH), { recursive: true })
  await writeFile(OUT_PATH, JSON.stringify(out))
  console.log(`Wrote ${rows.length} premium rows + ${gemeinden.length} gemeinden to ${OUT_PATH}`)
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
