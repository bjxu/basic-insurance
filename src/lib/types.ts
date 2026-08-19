// Core domain types shared across lookup, ETL, and UI layers (architecture.md §3.3).

export type Altersklasse = "kind" | "jung" | "erwachsen"; // 0–18, 19–25, 26+

export type Tarifart =
  | "standard"
  | "hmo"
  | "hausarzt"
  | "telmed"
  | "andere"; // driven by BAG classification, not hardcoded labels

export type PremiumRow = {
  year: number;
  insurerCode: string; // BAG insurer code
  insurerName: string;
  praemienregionId: string;
  altersklasse: Altersklasse;
  franchise: number; // CHF
  unfalldeckung: boolean; // true = accident coverage included
  tarifart: Tarifart;
  monthlyPremium: number; // CHF, two decimal places
  tarifCode: string; // BAG's raw product code (e.g. "01_016", "BASE") — 1:1 with productName
  productName: string; // e.g. "Grundversicherung", "Casa" — the specific named product within tarifart
};

export type Gemeinde = {
  bfsNr: number;
  name: string;
  kanton: string;
  praemienregionId: string;
};

export type Insurer = {
  insurerCode: string;
  insurerName: string;
  memberCount?: number; // OKP enrollment (BAG Versichertenbestand), absent if unmatched
};

export type Metadata = {
  publicationDate: string; // ISO date, e.g. "2025-10-15"
  availableYears: number[];
  memberCountAsOf: number; // publication year of the Versichertenbestand data (lags publicationDate)
  // Year -> monthly CO2-/VOC-Lenkungsabgabe redistribution per insured person, in CHF.
  // Published by BAFU, not BAG, so it is maintained by hand here and carried forward
  // across ingest runs (scripts/ingest/metadata.ts) rather than derived from the BAG files.
  environmentalLevyPerMonth: Record<string, number>;
};

export type CurrentPlan = {
  insurerCode: string;
  monthlyPremium: number; // CHF, self-reported by the user — not matched against the dataset (requirement.md Core Principle #3)
};

// The current-plan side of the headline comparison — deliberately narrower than
// PremiumRow (no region/franchise/tarifart/etc.) since it's a self-reported figure,
// not a matched dataset row (requirement.md §5.1).
export type SelfReportedPlan = {
  insurerCode: string;
  insurerName: string;
  monthlyPremium: number;
};

export type HeadlineState =
  | { kind: "savings"; current: SelfReportedPlan; cheapest: PremiumRow; savingsPerYear: number }
  | { kind: "already-cheapest"; current: SelfReportedPlan; cheapest: PremiumRow | null }
  | { kind: "no-current-plan"; cheapest: PremiumRow | null };
