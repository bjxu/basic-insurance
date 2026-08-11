// Centralised German-only copy (v1, requirement.md §12). One-line plain-language
// restriction descriptions for alternative models (REQ-4).

import type { Tarifart } from "./types";

export const TARIFART_LABELS: Record<Tarifart, string> = {
  standard: "Standard",
  hausarzt: "Hausarzt",
  telmed: "Telmed",
  hmo: "HMO",
  andere: "Alternativmodell",
};

export const TARIFART_DESCRIPTIONS: Record<Tarifart, string> = {
  standard: "Freie Arztwahl",
  hausarzt: "Erstbehandlung immer beim gewählten Hausarzt",
  telmed: "Anruf bei Hotline erforderlich vor jedem Arztbesuch",
  hmo: "Erstanlaufstelle immer beim HMO-Zentrum",
  andere: "Eingeschränkte Wahl des Erstanlaufpunkts",
};

export const ALTERSKLASSE_LABELS = {
  kind: "Kind (0–18)",
  jung: "Junge Erwachsene (19–25)",
  erwachsen: "Erwachsen (26+)",
} as const;
