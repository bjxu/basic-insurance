import { describe, it, expect, afterEach } from "vitest";
import { getSql, __resetSqlCacheForTests } from "./db";

describe("getSql", () => {
  const original = process.env.POSTGRES_URL;

  afterEach(() => {
    process.env.POSTGRES_URL = original;
    __resetSqlCacheForTests();
  });

  it("throws when POSTGRES_URL is not set", () => {
    delete process.env.POSTGRES_URL;
    __resetSqlCacheForTests();
    expect(() => getSql()).toThrow("POSTGRES_URL is not set");
  });

  it("returns a callable client when POSTGRES_URL is set", () => {
    process.env.POSTGRES_URL = "postgres://user:pass@host/db";
    __resetSqlCacheForTests();
    expect(typeof getSql()).toBe("function");
  });

  it("caches the client across calls", () => {
    process.env.POSTGRES_URL = "postgres://user:pass@host/db";
    __resetSqlCacheForTests();
    expect(getSql()).toBe(getSql());
  });
});
