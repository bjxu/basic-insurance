import { describe, it, expect } from "vitest";
import { parsePremiumRows } from "./parsePremiums";

const HEADER =
  "Versicherer,Kanton,Hoheitsgebiet,Geschäftsjahr,Erhebungsjahr,Region,Altersklasse,Unfalleinschluss,Tarif,Tariftyp,Altersuntergruppe,Franchisestufe,Franchise,Prämie,isBaseP,isBaseF,Tarifbezeichnung";

function csv(...rows: string[]): string {
  return [HEADER, ...rows].join("\n");
}

const NAMES = { "8": "CSS", "1542": "Assura", "312": "Atupri" };

describe("parsePremiumRows", () => {
  it("maps a standard adult row into a PremiumRow", () => {
    const { rows } = parsePremiumRows(
      csv(
        "8,ZH,CH,2026,2025,PR-REG CH1,AKL-ERW,MIT-UNF,BASE,TAR-BASE,,FRAST1,FRA-300,301.1,1,1,Grundversicherung",
      ),
      NAMES,
    );
    expect(rows).toEqual([
      {
        year: 2026,
        insurerCode: "8",
        insurerName: "CSS",
        praemienregionId: "ZH-1",
        altersklasse: "erwachsen",
        franchise: 300,
        unfalldeckung: true,
        tarifart: "standard",
        monthlyPremium: 301.1,
      },
    ]);
  });

  it("maps all four real Tariftyp codes to the right Tarifart", () => {
    const { rows } = parsePremiumRows(
      csv(
        "8,ZH,CH,2026,2025,PR-REG CH1,AKL-ERW,OHN-UNF,X,TAR-HAM,,FRAST1,FRA-300,200,0,0,Hausarzt",
        "8,ZH,CH,2026,2025,PR-REG CH1,AKL-ERW,OHN-UNF,X,TAR-HMO,,FRAST1,FRA-300,190,0,0,HMO",
        "8,ZH,CH,2026,2025,PR-REG CH1,AKL-ERW,OHN-UNF,X,TAR-DIV,,FRAST1,FRA-300,180,0,0,Telmed",
      ),
      NAMES,
    );
    expect(rows.map((r) => r.tarifart)).toEqual(["hausarzt", "hmo", "telmed"]);
  });

  it("keeps only the K1 (base) child rate and drops sibling-discount subgroups", () => {
    const { rows } = parsePremiumRows(
      csv(
        "8,ZH,CH,2026,2025,PR-REG CH1,AKL-KIN,MIT-UNF,BASE,TAR-BASE,K1,FRAST1,FRA-0,120,0,1,Grundversicherung",
        "8,ZH,CH,2026,2025,PR-REG CH1,AKL-KIN,MIT-UNF,BASE,TAR-BASE,K3,FRAST1,FRA-0,60,0,1,Grundversicherung",
      ),
      NAMES,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].monthlyPremium).toBe(120);
  });

  it("drops rows for cantons with no Gemeinde/PLZ mapping (e.g. ZE, ZR) and reports them", () => {
    const { rows, skippedCantons } = parsePremiumRows(
      csv(
        "312,ZE,CH,2026,2025,PR-REG CH0,AKL-KIN,MIT-UNF,BASE,TAR-BASE,K1,FRAST1,FRA-0,175,1,1,Grundversicherung",
      ),
      NAMES,
    );
    expect(rows).toHaveLength(0);
    expect(skippedCantons.get("ZE")).toBe(1);
  });

  it("maps an unrecognized Tariftyp to 'andere' and reports it", () => {
    const { rows, unknownTariftypes } = parsePremiumRows(
      csv(
        "8,ZH,CH,2026,2025,PR-REG CH1,AKL-ERW,MIT-UNF,X,TAR-FUTURE,,FRAST1,FRA-300,250,0,0,Neues Modell",
      ),
      NAMES,
    );
    expect(rows[0].tarifart).toBe("andere");
    expect(unknownTariftypes.has("TAR-FUTURE")).toBe(true);
  });

  it("throws on an unrecognized Altersklasse code", () => {
    expect(() =>
      parsePremiumRows(
        csv(
          "8,ZH,CH,2026,2025,PR-REG CH1,AKL-XXX,MIT-UNF,BASE,TAR-BASE,,FRAST1,FRA-300,250,0,0,Grundversicherung",
        ),
        NAMES,
      ),
    ).toThrow(/Altersklasse/);
  });

  it("throws on an unknown insurer code", () => {
    expect(() =>
      parsePremiumRows(
        csv(
          "99999,ZH,CH,2026,2025,PR-REG CH1,AKL-ERW,MIT-UNF,BASE,TAR-BASE,,FRAST1,FRA-300,250,0,0,Grundversicherung",
        ),
        NAMES,
      ),
    ).toThrow(/unknown insurer code/);
  });
});
