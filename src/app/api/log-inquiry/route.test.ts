import { describe, it, expect, vi, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";
import * as db from "@/lib/db";

vi.mock("@/lib/db", () => ({ getSql: vi.fn() }));

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/api/log-inquiry", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

const validPayload = {
  regionId: "ZH-1",
  altersklasse: "erwachsen",
  franchise: 300,
  year: 2026,
  models: ["standard"],
  accident: true,
  locale: "de",
};

describe("POST /api/log-inquiry", () => {
  const originalUrl = process.env.POSTGRES_URL;

  afterEach(() => {
    process.env.POSTGRES_URL = originalUrl;
    vi.restoreAllMocks();
  });

  it("returns 400 on invalid payload", async () => {
    const res = await POST(makeRequest({ regionId: "" }));
    expect(res.status).toBe(400);
  });

  it("no-ops with 204 when POSTGRES_URL is unset", async () => {
    delete process.env.POSTGRES_URL;
    const res = await POST(makeRequest(validPayload));
    expect(res.status).toBe(204);
  });

  it("inserts the validated fields and returns 204 when POSTGRES_URL is set", async () => {
    process.env.POSTGRES_URL = "postgres://test";
    const fakeSql = vi.fn().mockResolvedValue([]);
    vi.mocked(db.getSql).mockReturnValue(fakeSql as unknown as ReturnType<typeof db.getSql>);

    const res = await POST(makeRequest(validPayload));

    expect(res.status).toBe(204);
    expect(fakeSql).toHaveBeenCalledTimes(1);
    const [strings, ...values] = fakeSql.mock.calls[0];
    expect(strings.join("?")).toContain("INSERT INTO inquiry_log");
    expect(values).toEqual(["ZH-1", "erwachsen", 300, 2026, ["standard"], true, "de", null, null]);
  });

  it("inserts NULL locale when locale is omitted", async () => {
    process.env.POSTGRES_URL = "postgres://test";
    const fakeSql = vi.fn().mockResolvedValue([]);
    vi.mocked(db.getSql).mockReturnValue(fakeSql as unknown as ReturnType<typeof db.getSql>);

    const { locale, ...noLocale } = validPayload;
    void locale;
    const res = await POST(makeRequest(noLocale));

    expect(res.status).toBe(204);
    const [, ...values] = fakeSql.mock.calls[0];
    expect(values).toEqual(["ZH-1", "erwachsen", 300, 2026, ["standard"], true, null, null, null]);
  });

  it("returns 400 on an unknown locale", async () => {
    const res = await POST(makeRequest({ ...validPayload, locale: "xx" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 on an unknown current insurer code", async () => {
    const res = await POST(makeRequest({ ...validPayload, currentInsurer: "not-a-code" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 on an unknown premium band", async () => {
    const res = await POST(makeRequest({ ...validPayload, currentPremiumBand: "999+" }));
    expect(res.status).toBe(400);
  });

  it("stores current insurer and premium band when valid", async () => {
    process.env.POSTGRES_URL = "postgres://test";
    const fakeSql = vi.fn().mockResolvedValue([]);
    vi.mocked(db.getSql).mockReturnValue(fakeSql as unknown as ReturnType<typeof db.getSql>);

    const res = await POST(
      makeRequest({ ...validPayload, currentInsurer: "1542", currentPremiumBand: "350-449" }),
    );

    expect(res.status).toBe(204);
    const [, ...values] = fakeSql.mock.calls[0];
    expect(values).toEqual([
      "ZH-1", "erwachsen", 300, 2026, ["standard"], true, "de", "1542", "350-449",
    ]);
  });

  it("still returns 204 if the insert throws", async () => {
    process.env.POSTGRES_URL = "postgres://test";
    const fakeSql = vi.fn().mockRejectedValue(new Error("db down"));
    vi.mocked(db.getSql).mockReturnValue(fakeSql as unknown as ReturnType<typeof db.getSql>);
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await POST(makeRequest(validPayload));
    expect(res.status).toBe(204);
    expect(errSpy).toHaveBeenCalledWith("log-inquiry insert failed", expect.any(Error));
  });
});
