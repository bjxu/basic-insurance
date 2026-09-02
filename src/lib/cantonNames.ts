// src/lib/cantonNames.ts
// Canton display names per locale for the Prämien guide's canton table
// (src/components/help/PraemienGuideContent.tsx). Stable reference data, kept
// out of the message catalogs — canton names are labels, not UI prose.
// Browser-safe (the "use client" content component imports this): no Node
// built-ins.
//
// Spellings are machine-authored; requirement.md §12's native-speaker review
// covers this table. Where a language has no established exonym, the local
// (de/fr/it) name is kept.

export const CANTON_CODES = [
  "AG", "AI", "AR", "BE", "BL", "BS", "FR", "GE", "GL", "GR", "JU", "LU", "NE",
  "NW", "OW", "SG", "SH", "SO", "SZ", "TG", "TI", "UR", "VD", "VS", "ZG", "ZH",
] as const;

export type CantonCode = (typeof CANTON_CODES)[number];

export const CANTON_NAMES: Record<
  "de" | "fr" | "it" | "en" | "es" | "pt",
  Record<CantonCode, string>
> = {
  de: {
    AG: "Aargau", AI: "Appenzell Innerrhoden", AR: "Appenzell Ausserrhoden",
    BE: "Bern", BL: "Basel-Landschaft", BS: "Basel-Stadt", FR: "Freiburg",
    GE: "Genf", GL: "Glarus", GR: "Graubünden", JU: "Jura", LU: "Luzern",
    NE: "Neuenburg", NW: "Nidwalden", OW: "Obwalden", SG: "St. Gallen",
    SH: "Schaffhausen", SO: "Solothurn", SZ: "Schwyz", TG: "Thurgau",
    TI: "Tessin", UR: "Uri", VD: "Waadt", VS: "Wallis", ZG: "Zug", ZH: "Zürich",
  },
  fr: {
    AG: "Argovie", AI: "Appenzell Rhodes-Intérieures",
    AR: "Appenzell Rhodes-Extérieures", BE: "Berne", BL: "Bâle-Campagne",
    BS: "Bâle-Ville", FR: "Fribourg", GE: "Genève", GL: "Glaris",
    GR: "Grisons", JU: "Jura", LU: "Lucerne", NE: "Neuchâtel", NW: "Nidwald",
    OW: "Obwald", SG: "Saint-Gall", SH: "Schaffhouse", SO: "Soleure",
    SZ: "Schwytz", TG: "Thurgovie", TI: "Tessin", UR: "Uri", VD: "Vaud",
    VS: "Valais", ZG: "Zoug", ZH: "Zurich",
  },
  it: {
    AG: "Argovia", AI: "Appenzello Interno", AR: "Appenzello Esterno",
    BE: "Berna", BL: "Basilea Campagna", BS: "Basilea Città", FR: "Friburgo",
    GE: "Ginevra", GL: "Glarona", GR: "Grigioni", JU: "Giura", LU: "Lucerna",
    NE: "Neuchâtel", NW: "Nidvaldo", OW: "Obvaldo", SG: "San Gallo",
    SH: "Sciaffusa", SO: "Soletta", SZ: "Svitto", TG: "Turgovia",
    TI: "Ticino", UR: "Uri", VD: "Vaud", VS: "Vallese", ZG: "Zugo",
    ZH: "Zurigo",
  },
  en: {
    AG: "Aargau", AI: "Appenzell Innerrhoden", AR: "Appenzell Ausserrhoden",
    BE: "Bern", BL: "Basel-Landschaft", BS: "Basel-Stadt", FR: "Fribourg",
    GE: "Geneva", GL: "Glarus", GR: "Graubünden", JU: "Jura", LU: "Lucerne",
    NE: "Neuchâtel", NW: "Nidwalden", OW: "Obwalden", SG: "St. Gallen",
    SH: "Schaffhausen", SO: "Solothurn", SZ: "Schwyz", TG: "Thurgau",
    TI: "Ticino", UR: "Uri", VD: "Vaud", VS: "Valais", ZG: "Zug",
    ZH: "Zurich",
  },
  es: {
    AG: "Argovia", AI: "Appenzell Rodas Interiores",
    AR: "Appenzell Rodas Exteriores", BE: "Berna", BL: "Basilea-Campiña",
    BS: "Basilea-Ciudad", FR: "Friburgo", GE: "Ginebra", GL: "Glaris",
    GR: "Grisones", JU: "Jura", LU: "Lucerna", NE: "Neuchâtel",
    NW: "Nidwalden", OW: "Obwalden", SG: "San Galo", SH: "Schaffhausen",
    SO: "Soleura", SZ: "Schwyz", TG: "Turgovia", TI: "Tesino", UR: "Uri",
    VD: "Vaud", VS: "Valais", ZG: "Zug", ZH: "Zúrich",
  },
  pt: {
    AG: "Argóvia", AI: "Appenzell Rodes Interiores",
    AR: "Appenzell Rodes Exteriores", BE: "Berna", BL: "Basileia-Campo",
    BS: "Basileia-Cidade", FR: "Friburgo", GE: "Genebra", GL: "Glaris",
    GR: "Grisões", JU: "Jura", LU: "Lucerna", NE: "Neuchâtel",
    NW: "Nidvaldo", OW: "Obvaldo", SG: "São Galo", SH: "Schaffhausen",
    SO: "Solothurn", SZ: "Schwyz", TG: "Turgóvia", TI: "Tessino", UR: "Uri",
    VD: "Vaud", VS: "Valais", ZG: "Zug", ZH: "Zurique",
  },
};
