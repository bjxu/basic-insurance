// scripts/ingest/parseRegions.test.ts
import { describe, it, expect } from "vitest";
import { parseRegionRows, type RawRegionRow } from "./parseRegions";

describe("parseRegionRows", () => {
  it("builds a Gemeinde per BFS-Nr and computes praemienregionId as Kanton-Region", () => {
    const rows: RawRegionRow[] = [
      [261, "ZH", "Zürich", 1, "Zürich", 8001, "Zürich"],
    ];
    const { gemeinden } = parseRegionRows(rows);
    expect(gemeinden).toEqual([
      { bfsNr: 261, name: "Zürich", kanton: "ZH", praemienregionId: "ZH-1" },
    ]);
  });

  it("groups multiple Gemeinden under one PLZ that spans regions (REQ-1 disambiguation case)", () => {
    const rows: RawRegionRow[] = [
      [261, "ZH", "Zürich", 1, "Zürich", 8044, "Zürich"],
      [191, "ZH", "Dübendorf", 2, "Uster", 8044, "Dübendorf"],
    ];
    const { plzMap } = parseRegionRows(rows);
    expect(plzMap["8044"]).toEqual([
      { bfsNr: 261, name: "Zürich", kanton: "ZH", praemienregionId: "ZH-1" },
      { bfsNr: 191, name: "Dübendorf", kanton: "ZH", praemienregionId: "ZH-2" },
    ]);
  });

  it("dedupes repeated (Gemeinde, PLZ) pairs from multiple localities in the same Gemeinde", () => {
    const rows: RawRegionRow[] = [
      [1, "ZH", "Aeugst am Albis", 3, "Affoltern", 8914, "Aeugst am Albis"],
      [1, "ZH", "Aeugst am Albis", 3, "Affoltern", 8914, "Aeugstertal"], // 2nd locality, same Gemeinde+PLZ
    ];
    const { plzMap, gemeinden } = parseRegionRows(rows);
    expect(gemeinden).toHaveLength(1);
    expect(plzMap["8914"]).toHaveLength(1);
  });

  it("builds gemeindeRegionMap keyed by BFS-Nr as a string", () => {
    const rows: RawRegionRow[] = [[261, "ZH", "Zürich", 1, "Zürich", 8001, "Zürich"]];
    const { gemeindeRegionMap } = parseRegionRows(rows);
    expect(gemeindeRegionMap).toEqual({ "261": "ZH-1" });
  });

  it("throws if the same BFS-Nr appears with two different regions (data integrity)", () => {
    const rows: RawRegionRow[] = [
      [261, "ZH", "Zürich", 1, "Zürich", 8001, "Zürich"],
      [261, "ZH", "Zürich", 2, "Zürich", 8002, "Zürich"],
    ];
    expect(() => parseRegionRows(rows)).toThrow(/conflicting regions/);
  });
});
