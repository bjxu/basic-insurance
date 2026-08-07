#!/usr/bin/env node
// Downloads the Swiss Federal Office of Public Health's (BAG) official mandatory
// health insurance ("KVG/OKP") premium data and compacts it into
// public/data/premiums.json for the site to fetch at runtime.
//
// Source: https://opendata.swiss/de/dataset/health-insurance-premiums (BAG),
// published under the "open use" terms: https://opendata.swiss/terms-of-use#terms_open
//
// Only the CH-resident file (Prämien_CH.csv, ~217k rows/~22MB for premium year 2026)
// is used — not the EU/cross-border-commuter variant. For each
// (canton, age class, franchise, accident-coverage inclusion, insurer) combination we
// keep the *cheapest* premium found, minimizing across premium region (some large
// cantons have several) and insurance model (standard/HMO/family-doctor/other). That
// keeps the dataset small and the UI simple (no municipality/postal-code input), at
// the cost of not being region-exact within a canton — see the "notes" field below,
// which is surfaced in the UI.
//
// Run manually (`npm run build:data`) and commit the result — this is NOT part of
// `npm run build`, so the deployed site never needs network access to BAG's servers.
// Note for regenerating from *inside* the devcontainer: opendata.bagnet.ch isn't on
// the firewall allowlist by default; add it in .devcontainer/init-firewall.sh first
// (see .devcontainer/README.md), or just run this script on the host.

import { writeFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_PATH = join(__dirname, '../public/data/premiums.json')

// Resolved via https://ckan.opendata.swiss/api/3/action/package_show?id=health-insurance-premiums
// (resource "Prämien_CH.csv"). The path segment is a stable base64 encoding of the
// filename, not a rotating token, but if BAG restructures the download re-resolve it
// from that package_show endpoint.
const CSV_URL =
  'https://opendata.bagnet.ch/?r=/download&path=L1ByYWVtaWVuL1Byw6RtaWVuX0NILmNzdg%3D%3D'

const SOURCE_DATASET_URL = 'https://opendata.swiss/de/dataset/health-insurance-premiums'
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

async function main() {
  console.log(`Fetching ${CSV_URL} ...`)
  const res = await fetch(CSV_URL)
  if (!res.ok) throw new Error(`Download failed: HTTP ${res.status}`)
  const text = await res.text()
  console.log(`Downloaded ${(text.length / 1e6).toFixed(1)} MB`)

  const lines = text.split(/\r?\n/).filter((l) => l.length > 0)
  const header = parseCsvLine(lines[0]).map((h) => h.replace(/^﻿/, ''))
  const col = Object.fromEntries(header.map((name, i) => [name, i]))

  let premiumYear = null
  // key: `${canton}|${ageClass}|${franchise}|${accident}|${insurer}` -> min premium
  const best = new Map()

  for (let i = 1; i < lines.length; i++) {
    const f = parseCsvLine(lines[i])
    const canton = f[col.Kanton]
    if (!(canton in CANTONS)) continue

    const ageClass = f[col.Altersklasse]
    const franchise = Number(f[col.Franchise].replace('FRA-', ''))
    const accident = f[col.Unfalleinschluss] === 'MIT-UNF' ? 1 : 0
    const insurer = Number(f[col.Versicherer])
    const premium = Number(f[col['Prämie']])
    if (!Number.isFinite(premium)) continue

    premiumYear ??= f[col['Geschäftsjahr']]

    const key = `${canton}|${ageClass}|${franchise}|${accident}|${insurer}`
    const existing = best.get(key)
    if (existing === undefined || premium < existing) best.set(key, premium)
  }

  const rows = []
  for (const [key, premium] of best) {
    const [canton, ageClass, franchise, accident, insurer] = key.split('|')
    rows.push([canton, ageClass, Number(franchise), Number(accident), Number(insurer), premium])
  }

  const unknownInsurers = [...new Set(rows.map((r) => r[4]))].filter((code) => !(code in INSURERS))
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
    license: LICENSE_URL,
    attribution: 'Bundesamt für Gesundheit (BAG)',
    unit: 'CHF/month',
    notes:
      'Cheapest premium per insurer for the given canton / age class / franchise / accident-coverage choice, minimized across premium region and insurance model (standard, HMO, family-doctor, other) within the canton — not exact to a specific municipality.',
    cantons: CANTONS,
    ageClasses: AGE_CLASSES,
    insurers: INSURERS,
    // [canton, ageClass, franchise, accidentIncluded(0/1), insurerCode, monthlyPremium]
    rows,
  }

  await mkdir(dirname(OUT_PATH), { recursive: true })
  await writeFile(OUT_PATH, JSON.stringify(out))
  console.log(`Wrote ${rows.length} rows to ${OUT_PATH}`)
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
