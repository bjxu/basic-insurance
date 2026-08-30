import { describe, it, expect, vi, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";
import * as db from "@/lib/db";
import { fillTrendGaps } from "@/lib/adminStats";

vi.mock("@/lib/db", () => ({ getSql: vi.fn() }));

function makeRequest(query: string) {
  return new NextRequest(`http://localhost/api/admin/stats?${query}`);
}

describe("GET /api/admin/stats", () => {
  const originalUrl = process.env.POSTGRES_URL;

  afterEach(() => {
    process.env.POSTGRES_URL = originalUrl;
    vi.restoreAllMocks();
  });

  it("returns 400 when from/to are missing or malformed", async () => {
    expect((await GET(makeRequest("from=2026-08-01"))).status).toBe(400);
    expect((await GET(makeRequest("from=bad&to=2026-08-11"))).status).toBe(400);
  });

  it("returns an empty-but-well-formed payload when POSTGRES_URL is unset", async () => {
    delete process.env.POSTGRES_URL;
    const res = await GET(makeRequest("from=2026-07-12&to=2026-08-11"));
    expect(await res.json()).toEqual({
      total: 0,
      granularity: "day",
      trend: [],
      topRegions: [],
      altersklasse: [],
      franchise: [],
      models: [],
      accident: [],
      languages: [],
      currentInsurers: [],
      premiumBands: [],
      ageGroups: [],
    });
  });

  it("runs the aggregation queries and assembles the response when POSTGRES_URL is set", async () => {
    process.env.POSTGRES_URL = "postgres://test";
    const fakeSql = vi.fn((strings: TemplateStringsArray) => {
      const text = strings.join("?");
      if (text.includes("COUNT(*)::int AS total")) return Promise.resolve([{ total: 42 }]);
      if (text.includes("date_trunc")) return Promise.resolve([{ bucket: "2026-08-01T00:00:00.000Z", n: 5 }]);
      if (text.includes("region_id")) return Promise.resolve([{ regionId: "ZH-1", n: 20 }]);
      if (text.includes("altersklasse")) return Promise.resolve([{ altersklasse: "erwachsen", n: 30 }]);
      if (text.includes("franchise")) return Promise.resolve([{ franchise: 300, n: 10 }]);
      if (text.includes("unnest(models)")) return Promise.resolve([{ model: "standard", n: 40 }]);
      if (text.includes("accident")) return Promise.resolve([{ accident: true, n: 35 }]);
      if (text.includes("COALESCE(locale")) return Promise.resolve([{ locale: "de", n: 12 }]);
      if (text.includes("current_insurer")) return Promise.resolve([{ insurerCode: "1542", n: 7 }]);
      if (text.includes("current_premium_band")) return Promise.resolve([{ band: "250-349", n: 4 }]);
      if (text.includes("age_group")) {
        expect(text).toContain("age_group IS NOT NULL");
        return Promise.resolve([{ ageGroup: "26-35", n: 18 }]);
      }
      return Promise.resolve([]);
    });
    vi.mocked(db.getSql).mockReturnValue(fakeSql as unknown as ReturnType<typeof db.getSql>);

    const res = await GET(makeRequest("from=2026-07-12&to=2026-08-11"));
    const json = await res.json();

    // The trend query only returns rows for buckets with data — the route is
    // expected to gap-fill the rest with n: 0 (see src/lib/adminStats.ts).
    const expectedTrend = fillTrendGaps(
      [{ bucket: "2026-08-01T00:00:00.000Z", n: 5 }],
      "day",
      "2026-07-12",
      "2026-08-11",
    );

    expect(json).toEqual({
      total: 42,
      granularity: "day",
      trend: expectedTrend,
      topRegions: [{ regionId: "ZH-1", n: 20 }],
      altersklasse: [{ altersklasse: "erwachsen", n: 30 }],
      franchise: [{ franchise: 300, n: 10 }],
      models: [{ model: "standard", n: 40 }],
      accident: [{ accident: true, n: 35 }],
      languages: [{ locale: "de", n: 12 }],
      currentInsurers: [{ insurerCode: "1542", n: 7 }],
      premiumBands: [{ band: "250-349", n: 4 }],
      ageGroups: [{ ageGroup: "26-35", n: 18 }],
    });
  });

  it("anchors every range filter and the trend bucketing to Europe/Zurich", async () => {
    process.env.POSTGRES_URL = "postgres://test";
    const fakeSql = vi.fn(() => Promise.resolve([]));
    vi.mocked(db.getSql).mockReturnValue(fakeSql as unknown as ReturnType<typeof db.getSql>);

    await GET(makeRequest("from=2026-07-12&to=2026-08-11"));

    const queryTexts = (fakeSql.mock.calls as unknown as [TemplateStringsArray][]).map(([strings]) => strings.join("?"));
    expect(queryTexts.length).toBe(11); // total + trend + 9 breakdowns
    for (const text of queryTexts) {
      expect(text).toContain("AT TIME ZONE 'Europe/Zurich'");
    }
    expect(queryTexts.some((t) => t.includes("date_trunc"))).toBe(true);
  });

  it("returns 500 with an error body when the DB queries fail (e.g. inquiry_log not migrated yet)", async () => {
    process.env.POSTGRES_URL = "postgres://test";
    const fakeSql = vi.fn(() => Promise.reject(new Error("relation \"inquiry_log\" does not exist")));
    vi.mocked(db.getSql).mockReturnValue(fakeSql as unknown as ReturnType<typeof db.getSql>);

    const res = await GET(makeRequest("from=2026-07-12&to=2026-08-11"));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "query failed" });
  });
});
