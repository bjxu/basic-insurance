// Client for the real, official Swiss mandatory health insurance ("KVG/OKP") premium
// data, served as a static asset built by scripts/build-premium-data.mjs from BAG's
// open data (see that script for the full provenance/methodology notes — in short,
// this is the *cheapest* premium per insurer for a canton/age-class/franchise/
// accident-coverage combination, minimized across premium region and insurance model).
//
// Unlike src/lib/estimate.ts (used for car/home, which have no such source wired up
// yet), every number returned here traces back to BAG's published dataset.

export type AgeClass = 'AKL-KIN' | 'AKL-JUG' | 'AKL-ERW'

export interface PremiumsData {
  generatedAt: string
  premiumYear: number
  sourceDataset: string
  license: string
  attribution: string
  unit: string
  notes: string
  cantons: Record<string, string>
  ageClasses: Record<AgeClass, { label: string; franchises: number[] }>
  insurers: Record<string, string>
  // [canton, ageClass, franchise, accidentIncluded(0/1), insurerCode, monthlyPremium]
  rows: [string, AgeClass, number, 0 | 1, number, number][]
}

export interface HealthQuery {
  canton: string
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
  dataPromise ??= fetch('/data/premiums.json').then((res) => {
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
  for (const [canton, rowAgeClass, franchise, rowAccident, insurerCode, premium] of data.rows) {
    if (
      canton === query.canton &&
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
