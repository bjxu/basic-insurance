import { describe, it, expect, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "./middleware";

// Mock next-intl middleware to avoid Edge Runtime module resolution issues in vitest
vi.mock("next-intl/middleware", () => ({
  default: () => (req: NextRequest) => {
    // Return a pass-through response
    const response = new (require("next/server").NextResponse)();
    return response;
  },
}));

describe("middleware — X-Robots-Tag on /admin routes", () => {
  const originalSecret = process.env.ADMIN_SECRET;

  afterEach(() => {
    process.env.ADMIN_SECRET = originalSecret;
  });

  it("sets X-Robots-Tag on an authorized /admin request", () => {
    process.env.ADMIN_SECRET = "s3cret";
    const req = new NextRequest("http://localhost/admin", { headers: { cookie: "admin_token=s3cret" } });
    const res = middleware(req);
    expect(res.headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
  });

  it("sets X-Robots-Tag on the login redirect for an unauthorized /admin request", () => {
    process.env.ADMIN_SECRET = "s3cret";
    const req = new NextRequest("http://localhost/admin");
    const res = middleware(req);
    expect(res.status).toBe(307);
    expect(res.headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
  });

  it("sets X-Robots-Tag on an unauthorized /api/admin request", () => {
    process.env.ADMIN_SECRET = "s3cret";
    const req = new NextRequest("http://localhost/api/admin/stats");
    const res = middleware(req);
    expect(res.status).toBe(401);
    expect(res.headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
  });

  it("does not set X-Robots-Tag on a non-admin locale-routed path", () => {
    const req = new NextRequest("http://localhost/de");
    const res = middleware(req);
    expect(res.headers.get("X-Robots-Tag")).toBeNull();
  });
});
