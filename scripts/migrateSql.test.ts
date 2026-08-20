import { describe, it, expect } from "vitest";
import { MIGRATE_SQL } from "./migrateSql";

describe("MIGRATE_SQL", () => {
  it("creates inquiry_log idempotently", () => {
    expect(MIGRATE_SQL).toContain("CREATE TABLE IF NOT EXISTS inquiry_log");
  });

  it("declares every column the stats and log-inquiry queries expect", () => {
    for (const column of ["id", "ts", "region_id", "altersklasse", "franchise", "year", "models", "accident"]) {
      expect(MIGRATE_SQL).toContain(column);
    }
  });
});
