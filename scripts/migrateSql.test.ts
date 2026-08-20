import { describe, it, expect } from "vitest";
import { CREATE_TABLE_SQL, CREATE_INDEX_SQL } from "./migrateSql";

describe("CREATE_TABLE_SQL", () => {
  it("creates inquiry_log idempotently", () => {
    expect(CREATE_TABLE_SQL).toContain("CREATE TABLE IF NOT EXISTS inquiry_log");
  });

  it("declares every column the stats and log-inquiry queries expect", () => {
    for (const column of ["id", "ts", "region_id", "altersklasse", "franchise", "year", "models", "accident"]) {
      expect(CREATE_TABLE_SQL).toContain(column);
    }
  });

  it("uses the column types specified in architecture.md §10.3", () => {
    expect(CREATE_TABLE_SQL).toContain("id           BIGSERIAL PRIMARY KEY");
    expect(CREATE_TABLE_SQL).toContain("franchise    SMALLINT NOT NULL");
    expect(CREATE_TABLE_SQL).toContain("year         SMALLINT NOT NULL");
  });
});

describe("CREATE_INDEX_SQL", () => {
  it("creates an index on ts, since every stats query filters on it", () => {
    expect(CREATE_INDEX_SQL).toContain("CREATE INDEX IF NOT EXISTS idx_inquiry_log_ts ON inquiry_log (ts);");
  });
});
