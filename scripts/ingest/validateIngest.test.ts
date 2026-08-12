import { describe, it, expect } from "vitest";
import { validateIngestOutput, verifyWrittenFile } from "./validateIngest";
import type { PremiumRow } from "../../src/lib/types";

const HEADER =
  "Versicherer,Kanton,Hoheitsgebiet,Geschäftsjahr,Erhebungsjahr,Region,Altersklasse,Unfalleinschluss,Tarif,Tariftyp,Altersuntergruppe,Franchisestufe,Franchise,Prämie,isBaseP,isBaseF,Tarifbezeichnung";

function csv(...rows: string[]): string {
  return [HEADER, ...rows].join("\n");
}

function row(overrides: Partial<PremiumRow> = {}): PremiumRow {
  return {
    year: 2026,
    insurerCode: "8",
    insurerName: "CSS",
    praemienregionId: "ZH-1",
    altersklasse: "erwachsen",
    franchise: 300,
    unfalldeckung: true,
    tarifart: "standard",
    tarifCode: "BASE",
    productName: "Grundversicherung",
    monthlyPremium: 301.1,
    ...overrides,
  };
}

describe("validateIngestOutput", () => {
  it("passes when every output row matches its source CSV row exactly", () => {
    const csvText = csv(
      "8,ZH,CH,2026,2025,PR-REG CH1,AKL-ERW,MIT-UNF,BASE,TAR-BASE,,FRAST1,FRA-300,301.1,1,1,Grundversicherung",
    );
    expect(validateIngestOutput(csvText, [row()])).toEqual({ ok: true, errors: [] });
  });

  it("accounts for dropped sibling-discount and invalid-canton rows in the conservation check", () => {
    const csvText = csv(
      "8,ZH,CH,2026,2025,PR-REG CH1,AKL-ERW,MIT-UNF,BASE,TAR-BASE,,FRAST1,FRA-300,301.1,1,1,Grundversicherung",
      "8,ZH,CH,2026,2025,PR-REG CH1,AKL-KIN,MIT-UNF,BASE,TAR-BASE,K1,FRAST1,FRA-0,120,0,1,Grundversicherung",
      "8,ZH,CH,2026,2025,PR-REG CH1,AKL-KIN,MIT-UNF,BASE,TAR-BASE,K3,FRAST1,FRA-0,60,0,1,Grundversicherung",
      "312,ZE,CH,2026,2025,PR-REG CH0,AKL-KIN,MIT-UNF,BASE,TAR-BASE,K1,FRAST1,FRA-0,175,1,1,Grundversicherung",
    );
    const rows = [
      row(),
      row({ altersklasse: "kind", franchise: 0, monthlyPremium: 120 }),
    ];
    expect(validateIngestOutput(csvText, rows)).toEqual({ ok: true, errors: [] });
  });

  it("fails when a source row is missing from the output", () => {
    const csvText = csv(
      "8,ZH,CH,2026,2025,PR-REG CH1,AKL-ERW,MIT-UNF,BASE,TAR-BASE,,FRAST1,FRA-300,301.1,1,1,Grundversicherung",
      "1542,BE,CH,2026,2025,PR-REG CH1,AKL-ERW,MIT-UNF,BASE,TAR-BASE,,FRAST1,FRA-300,250,1,1,Grundversicherung",
    );
    const result = validateIngestOutput(csvText, [row()]);
    expect(result.ok).toBe(false);
    expect(result.errors).toEqual([expect.stringContaining("conservation:")]);
  });

  it("fails when two output rows share the same natural key", () => {
    const csvText = csv(
      "8,ZH,CH,2026,2025,PR-REG CH1,AKL-ERW,MIT-UNF,BASE,TAR-BASE,,FRAST1,FRA-300,301.1,1,1,Grundversicherung",
      "8,ZH,CH,2026,2025,PR-REG CH1,AKL-ERW,MIT-UNF,BASE,TAR-BASE,,FRAST1,FRA-300,301.1,1,1,Grundversicherung",
    );
    const result = validateIngestOutput(csvText, [row(), row()]);
    expect(result.ok).toBe(false);
    expect(result.errors).toEqual([expect.stringContaining("uniqueness:")]);
  });

  it("fails when an output row's premium doesn't match the source", () => {
    const csvText = csv(
      "8,ZH,CH,2026,2025,PR-REG CH1,AKL-ERW,MIT-UNF,BASE,TAR-BASE,,FRAST1,FRA-300,301.1,1,1,Grundversicherung",
    );
    const result = validateIngestOutput(csvText, [row({ monthlyPremium: 999 })]);
    expect(result.ok).toBe(false);
    expect(result.errors).toEqual([expect.stringContaining("value:")]);
  });

  it("fails when an output row has no matching source row at all", () => {
    const csvText = csv(
      "8,ZH,CH,2026,2025,PR-REG CH1,AKL-ERW,MIT-UNF,BASE,TAR-BASE,,FRAST1,FRA-300,301.1,1,1,Grundversicherung",
    );
    const result = validateIngestOutput(
      csvText,
      [row({ insurerCode: "1542", insurerName: "Assura" })],
    );
    expect(result.ok).toBe(false);
    expect(result.errors).toEqual([expect.stringContaining("value:")]);
  });
});

describe("verifyWrittenFile", () => {
  it("passes when the written text matches what was meant to be written", () => {
    expect(verifyWrittenFile('{"a":1}', '{"a":1}')).toEqual({ ok: true, errors: [] });
  });

  it("fails when the written text differs from what was meant to be written", () => {
    const result = verifyWrittenFile('{"a":1}', '{"a":2}');
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toMatch(/read-after-write/);
  });
});
