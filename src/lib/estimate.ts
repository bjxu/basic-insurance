// Placeholder premium estimator.
//
// This is a deliberately simple, transparent formula for demo purposes — it is NOT
// pulled from any real insurer or rate table. Swap `estimatePremium` out once a real
// pricing source (e.g. an open-data API) is wired up; keep the same input/output shape
// so `CompareView.vue` doesn't need to change.

export type InsuranceType = 'health' | 'car' | 'home'

export interface EstimateInput {
  type: InsuranceType
  age: number
  coverageAmount: number
  deductible: number
}

export interface EstimateResult {
  monthlyPremium: number
  annualPremium: number
}

const BASE_RATE: Record<InsuranceType, number> = {
  health: 180,
  car: 90,
  home: 40,
}

// Coverage is priced per 10,000 of sum insured, on top of the base rate.
const COVERAGE_RATE_PER_10K = 4

export function estimatePremium(input: EstimateInput): EstimateResult {
  const { type, age, coverageAmount, deductible } = input

  const base = BASE_RATE[type]
  const coverageComponent = (coverageAmount / 10_000) * COVERAGE_RATE_PER_10K

  // Rough age curve: premiums rise faster past 50, dip slightly for the 25-40 range.
  let ageFactor = 1
  if (age < 25) ageFactor = 1.15
  else if (age <= 40) ageFactor = 1
  else if (age <= 55) ageFactor = 1.1
  else if (age <= 70) ageFactor = 1.35
  else ageFactor = 1.6

  // Higher deductible lowers the premium, capped so it can't go to zero.
  const deductibleDiscount = Math.min(0.4, deductible / 10_000)

  const monthlyPremium = (base + coverageComponent) * ageFactor * (1 - deductibleDiscount)

  return {
    monthlyPremium: Math.round(monthlyPremium * 100) / 100,
    annualPremium: Math.round(monthlyPremium * 12 * 100) / 100,
  }
}
