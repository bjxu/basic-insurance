import type { Insurer } from "../../src/lib/types";

//
// Seed insurer code → display name lookup (requirement.md §6.1, architecture.md §3.2).
// The premium CSV only carries the numeric `Versicherer` code, not a name, and BAG
// doesn't publish a separate machine-readable Versicherer-Liste alongside it — so this
// table is maintained by hand. It was cross-checked against the same 34 codes present
// in the real data during planning (2026-08-11).
//
// If scripts/ingest/parsePremiums.ts ever throws "unknown insurer code", it means BAG
// added a new insurer or renumbered one — add the missing code here.
export const INSURER_NAMES: Record<string, string> = {
  "8": "CSS",
  "32": "Aquilana",
  "134": "Einsiedler Krankenkasse",
  "194": "Sumiswalder Krankenkasse",
  "246": "Krankenkasse Steffisburg",
  "290": "Concordia",
  "312": "Atupri",
  "343": "Avenir Assurance (Groupe Mutuel)",
  "360": "Krankenkasse Luzerner Hinterland",
  "376": "KPT",
  "455": "ÖKK",
  "509": "Sympany",
  "780": "Glarner Krankenversicherung",
  "820": "curaulta",
  "881": "EGK",
  "923": "SLKK",
  "941": "sodalis",
  "966": "vita surselva",
  "1040": "Krankenkasse Visperterminen",
  "1113": "Caisse-maladie de la vallée d'Entremont",
  "1318": "Krankenkasse Wädenswil",
  "1322": "Krankenkasse Birchmeier",
  "1384": "Swica",
  "1386": "Galenos",
  "1401": "rhenusana",
  "1479": "Mutuel Assurance (Groupe Mutuel)",
  "1507": "AMB Assurances (Groupe Mutuel)",
  "1509": "Sanitas",
  "1535": "Philos Assurance (Groupe Mutuel)",
  "1542": "Assura",
  "1555": "Visana",
  "1560": "Agrisano",
  "1562": "Helsana",
  "1568": "sana24",
};

export function buildInsurersJson(
  names: Record<string, string> = INSURER_NAMES,
  memberCounts: Record<string, number> = {},
): Insurer[] {
  return Object.entries(names)
    .map(([insurerCode, insurerName]): Insurer => {
      const memberCount = memberCounts[insurerCode];
      return memberCount != null ? { insurerCode, insurerName, memberCount } : { insurerCode, insurerName };
    })
    .sort((a, b) => a.insurerName.localeCompare(b.insurerName, "de-CH"));
}
