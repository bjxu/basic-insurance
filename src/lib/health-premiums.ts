// Client for the real, official Swiss mandatory health insurance ("KVG/OKP") premium
// data, served as a static asset built by scripts/build-premium-data.mjs from BAG's
// open data (see that script for the full provenance/methodology notes — in short,
// this is the *cheapest* premium per insurer for an exact municipality's premium
// region / age-class / franchise / accident-coverage combination, minimized across
// insurance model). Every number here traces back to BAG's or priminfo.admin.ch's
// published data — nothing is estimated or fabricated.
//
// No gender field: Swiss law (Art. 61 KVG) requires OKP premiums to be gender-neutral,
// so there's nothing to model — see the README for more on this.

export type AgeClass = 'AKL-KIN' | 'AKL-JUG' | 'AKL-ERW'

export interface PremiumsData {
  generatedAt: string
  premiumYear: number
  sourceDataset: string
  sourceRegions: string
  license: string
  attribution: string
  unit: string
  notes: string
  cantons: Record<string, string>
  ageClasses: Record<AgeClass, { label: string; franchises: number[] }>
  insurers: Record<string, string>
  // [bfsNr, canton, gemeinde, region, plz, ort] — one row per (municipality, PLZ) pair.
  gemeinden: [number, string, string, number, number, string][]
  // [canton, region, ageClass, franchise, accidentIncluded(0/1), insurerCode, monthlyPremium]
  rows: [string, number, AgeClass, number, 0 | 1, number, number][]
}

export interface Gemeinde {
  bfsNr: number
  canton: string
  gemeinde: string
  region: number
  plz: number
  ort: string
}

export interface HealthQuery {
  canton: string
  region: number
  age: number
  franchise: number
  accidentIncluded: boolean
}

export interface InsurerQuote {
  insurerCode: number
  insurerName: string
  monthlyPremium: number
}

export interface HealthQuoteResult {
  ageClass: AgeClass
  quotes: InsurerQuote[]
  cheapest: InsurerQuote | null
  medianPremium: number | null
}

let dataPromise: Promise<PremiumsData> | null = null

export function loadPremiumsData(): Promise<PremiumsData> {
  // BASE_URL already carries a trailing slash (e.g. "/basic-insurance/", or "/" in
  // dev) — see the `base` comment in vite.config.ts for why this can't be hardcoded.
  dataPromise ??= fetch(`${import.meta.env.BASE_URL}data/premiums.json`).then((res) => {
    if (!res.ok) throw new Error(`Failed to load premium data: HTTP ${res.status}`)
    return res.json() as Promise<PremiumsData>
  })
  return dataPromise
}

export function ageToAgeClass(age: number): AgeClass {
  if (age <= 18) return 'AKL-KIN'
  if (age <= 25) return 'AKL-JUG'
  return 'AKL-ERW'
}

/**
 * Finds municipalities/postcodes matching free text — either a postcode prefix
 * ("80" -> 8001 Zürich, 8002 Zürich, ...) or a substring of the municipality/locality
 * name (case/accent-insensitive). Municipalities can have several postcodes and a
 * postcode can span several municipalities, so results are deduplicated by
 * (bfsNr, plz) — see build-premium-data.mjs's A_COM notes.
 */
export function searchGemeinden(data: PremiumsData, query: string, limit = 20): Gemeinde[] {
  const q = normalize(query.trim())
  if (!q) return []

  const isNumeric = /^\d+$/.test(q)
  const results: Gemeinde[] = []
  for (const [bfsNr, canton, gemeinde, region, plz, ort] of data.gemeinden) {
    const matches = isNumeric
      ? String(plz).startsWith(q)
      : normalize(gemeinde).includes(q) || normalize(ort).includes(q)
    if (matches) {
      results.push({ bfsNr, canton, gemeinde, region, plz, ort })
      if (results.length >= limit) break
    }
  }
  return results
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip combining accents so "Zürich"/"zurich" both match
}

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!
}

export async function getHealthPremiums(query: HealthQuery): Promise<HealthQuoteResult> {
  const data = await loadPremiumsData()
  const ageClass = ageToAgeClass(query.age)
  const accident = query.accidentIncluded ? 1 : 0

  const quotes: InsurerQuote[] = []
  for (const [canton, region, rowAgeClass, franchise, rowAccident, insurerCode, premium] of data.rows) {
    if (
      canton === query.canton &&
      region === query.region &&
      rowAgeClass === ageClass &&
      franchise === query.franchise &&
      rowAccident === accident
    ) {
      quotes.push({
        insurerCode,
        insurerName: data.insurers[String(insurerCode)] ?? `Insurer ${insurerCode}`,
        monthlyPremium: premium,
      })
    }
  }
  quotes.sort((a, b) => a.monthlyPremium - b.monthlyPremium)

  return {
    ageClass,
    quotes,
    cheapest: quotes[0] ?? null,
    medianPremium: median(quotes.map((q) => q.monthlyPremium)),
  }
}
