import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { crawlSite } from "./crawlSite";

// A tiny fake site graph served entirely from memory, keyed by full URL.
const SITE: Record<string, string> = {
  "https://x.ch/robots.txt": "User-agent: *\nDisallow: /admin",
  "https://x.ch/start": `<html><head><title>Start</title></head><body>
    <a href="/produkte/hausarzt">Hausarzt</a>
    <a href="/admin">Admin (disallowed)</a>
    <a href="https://other.ch/page">External</a>
  </body></html>`,
  "https://x.ch/produkte/hausarzt": `<html><head><title>Hausarztversicherung</title></head><body>
    <p>Details about the Hausarzt product.</p>
    <a href="/produkte/telmed">Telmed</a>
  </body></html>`,
  "https://x.ch/produkte/telmed": `<html><head><title>Telmed-Modell</title></head><body>
    <p>Details about the Telmed product.</p>
    <a href="/produkte/broken">Broken link</a>
  </body></html>`,
  "https://x.ch/admin": `<html><head><title>Admin</title></head><body>Secret</body></html>`,
};

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const body = SITE[url];
      if (body == null) return { ok: false, status: 404, text: async () => "" } as Response;
      return { ok: true, status: 200, text: async () => body } as Response;
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("crawlSite", () => {
  it("crawls same-origin pages reachable from the seed URL", async () => {
    const pages = await crawlSite("https://x.ch/start");
    const urls = pages.map((p) => p.url).sort();
    expect(urls).toEqual([
      "https://x.ch/produkte/hausarzt",
      "https://x.ch/produkte/telmed",
      "https://x.ch/start",
    ]);
  });

  it("does not fetch a path disallowed by robots.txt", async () => {
    const pages = await crawlSite("https://x.ch/start");
    expect(pages.some((p) => p.url === "https://x.ch/admin")).toBe(false);
  });

  it("extracts title and text for each crawled page", async () => {
    const pages = await crawlSite("https://x.ch/start");
    const hausarzt = pages.find((p) => p.url === "https://x.ch/produkte/hausarzt");
    expect(hausarzt?.title).toBe("Hausarztversicherung");
    expect(hausarzt?.text).toContain("Details about the Hausarzt product.");
  });

  it("stops once it hits the maxPages bound", async () => {
    const pages = await crawlSite("https://x.ch/start", { maxPages: 1 });
    expect(pages.length).toBe(1);
    expect(pages[0].url).toBe("https://x.ch/start");
  });

  it("skips a page whose fetch fails instead of throwing", async () => {
    const pages = await crawlSite("https://x.ch/start");
    // https://x.ch/produkte/broken is same-origin and robots-allowed but absent from
    // SITE, so its fetch mock resolves to { ok: false, status: 404 }. It must be
    // skipped rather than thrown, and the rest of the crawl must still complete.
    expect(pages.some((p) => p.url === "https://x.ch/produkte/broken")).toBe(false);
    expect(pages.some((p) => p.url === "https://x.ch/start")).toBe(true);
  });
});
