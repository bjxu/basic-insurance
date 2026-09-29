import { describe, it, expect } from "vitest";
import {
  parsePremiumRows,
  VALID_CANTONS,
  ALTERSKLASSE_MAP,
  TARIFART_MAP,
  parseFranchise,
  parseRegionNumber,
  parseUnfalldeckung,
} from "./parsePremiums";

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
        tarifCode: "BASE",
        productName: "Grundversicherung",
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

  it("maps a standard adult row using 2027's raw code format", () => {
    const { rows } = parsePremiumRows(
      csv(
        "8,ZH,P_OKPCH,2027,2026,PR_REG_1,AKA_03_ERW,MIT_UNF,BASE,BASE,E1,FRASTU_01,FRA_01_E_0300,301.1,1,1,Grundversicherung",
      ),
      NAMES,
    );
    expect(rows).toEqual([
      {
        year: 2027,
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
      },
    ]);
  });

  it("maps all four 2027 Tariftyp codes to the right Tarifart, distinct from their 2026 counterparts", () => {
    const { rows } = parsePremiumRows(
      csv(
        "8,ZH,P_OKPCH,2027,2026,PR_REG_1,AKA_03_ERW,OHN_UNF,X,PRAXIS,E1,FRASTU_01,FRA_01_E_0300,200,0,0,Praxis",
        "8,ZH,P_OKPCH,2027,2026,PR_REG_1,AKA_03_ERW,OHN_UNF,X,FLEX,E1,FRASTU_01,FRA_01_E_0300,190,0,0,Flex",
        "8,ZH,P_OKPCH,2027,2026,PR_REG_1,AKA_03_ERW,OHN_UNF,X,TEL_DIG,E1,FRASTU_01,FRA_01_E_0300,180,0,0,Telmed",
      ),
      NAMES,
    );
    expect(rows.map((r) => r.tarifart)).toEqual(["praxis", "flex", "telmed"]);
  });

  it("keeps only the K1 (base) child rate using 2027's sibling-discount code", () => {
    const { rows } = parsePremiumRows(
      csv(
        "8,ZH,P_OKPCH,2027,2026,PR_REG_1,AKA_01_KIN,MIT_UNF,BASE,BASE,K1,FRASTU_01,FRA_01_K_0000,120,0,1,Grundversicherung",
        "8,ZH,P_OKPCH,2027,2026,PR_REG_1,AKA_01_KIN,MIT_UNF,BASE,BASE,K3,FRASTU_01,FRA_01_K_0000,60,0,1,Grundversicherung",
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

  it("keeps distinct BAG products at the same insurer/region/age/franchise/accident/model as separate rows", () => {
    const { rows } = parsePremiumRows(
      csv(
        "8,ZH,CH,2026,2025,PR-REG CH1,AKL-ERW,MIT-UNF,01_016,TAR-HAM,,FRAST1,FRA-300,301.1,0,0,Hausarztversicherung Profit",
        "8,ZH,CH,2026,2025,PR-REG CH1,AKL-ERW,MIT-UNF,01_046,TAR-HAM,,FRAST1,FRA-300,289.5,0,0,Casa",
      ),
      NAMES,
    );
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => ({ tarifCode: r.tarifCode, productName: r.productName, monthlyPremium: r.monthlyPremium }))).toEqual([
      { tarifCode: "01_016", productName: "Hausarztversicherung Profit", monthlyPremium: 301.1 },
      { tarifCode: "01_046", productName: "Casa", monthlyPremium: 289.5 },
    ]);
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

describe("exported parsing helpers (reused by validateIngest.ts)", () => {
  it("VALID_CANTONS contains real cantons and excludes cross-border codes", () => {
    expect(VALID_CANTONS.has("ZH")).toBe(true);
    expect(VALID_CANTONS.has("ZE")).toBe(false);
  });

  it("ALTERSKLASSE_MAP maps both 2026 and 2027 BAG codes", () => {
    expect(ALTERSKLASSE_MAP["AKL-KIN"]).toBe("kind");
    expect(ALTERSKLASSE_MAP["AKL-JUG"]).toBe("jung");
    expect(ALTERSKLASSE_MAP["AKL-ERW"]).toBe("erwachsen");
    expect(ALTERSKLASSE_MAP["AKA_01_KIN"]).toBe("kind");
    expect(ALTERSKLASSE_MAP["AKA_02_JUG"]).toBe("jung");
    expect(ALTERSKLASSE_MAP["AKA_03_ERW"]).toBe("erwachsen");
  });

  it("TARIFART_MAP maps both 2026 and 2027 BAG Tariftyp codes", () => {
    expect(TARIFART_MAP["TAR-BASE"]).toBe("standard");
    expect(TARIFART_MAP["TAR-HAM"]).toBe("hausarzt");
    expect(TARIFART_MAP["TAR-HMO"]).toBe("hmo");
    expect(TARIFART_MAP["TAR-DIV"]).toBe("telmed");
    expect(TARIFART_MAP["BASE"]).toBe("standard");
    expect(TARIFART_MAP["PRAXIS"]).toBe("praxis");
    expect(TARIFART_MAP["FLEX"]).toBe("flex");
    expect(TARIFART_MAP["TEL_DIG"]).toBe("telmed");
  });

  it("parseFranchise extracts the numeric value from either year's Franchise code", () => {
    expect(parseFranchise("FRA-300")).toBe(300);
    expect(parseFranchise("FRA_01_E_0300")).toBe(300);
    expect(parseFranchise("FRA_04_K_0300")).toBe(300);
    expect(parseFranchise("FRA_01_J_0300")).toBe(300);
    expect(() => parseFranchise("XYZ")).toThrow(/Franchise/);
  });

  it("parseRegionNumber extracts the numeric value from either year's Region code", () => {
    expect(parseRegionNumber("PR-REG CH1")).toBe("1");
    expect(parseRegionNumber("PR_REG_1")).toBe("1");
    expect(() => parseRegionNumber("XYZ")).toThrow(/Region/);
  });

  it("parseUnfalldeckung maps either year's Unfalleinschluss codes to true/false", () => {
    expect(parseUnfalldeckung("MIT-UNF")).toBe(true);
    expect(parseUnfalldeckung("OHN-UNF")).toBe(false);
    expect(parseUnfalldeckung("MIT_UNF")).toBe(true);
    expect(parseUnfalldeckung("OHN_UNF")).toBe(false);
    expect(() => parseUnfalldeckung("XYZ")).toThrow(/Unfalleinschluss/);
  });
});
