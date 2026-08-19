import { describe, it, expect } from "vitest";
import { extractLinks } from "./extractLinks";

describe("extractLinks", () => {
  it("resolves relative hrefs against the base URL", () => {
    const html = `<a href="/produkte/hausarzt">Hausarzt</a>`;
    expect(extractLinks(html, "https://example.ch/start")).toEqual(["https://example.ch/produkte/hausarzt"]);
  });

  it("drops links to a different origin", () => {
    const html = `<a href="https://other.ch/page">Other</a><a href="/local">Local</a>`;
    expect(extractLinks(html, "https://example.ch/start")).toEqual(["https://example.ch/local"]);
  });

  it("strips URL fragments and de-duplicates", () => {
    const html = `<a href="/page#section1">A</a><a href="/page#section2">B</a>`;
    expect(extractLinks(html, "https://example.ch/start")).toEqual(["https://example.ch/page"]);
  });

  it("ignores malformed hrefs instead of throwing", () => {
    const html = `<a href="javascript:void(0)">Bad</a><a href="/ok">Ok</a>`;
    expect(extractLinks(html, "https://example.ch/start")).toEqual(["https://example.ch/ok"]);
  });

  it("returns an empty array when there are no anchor tags", () => {
    expect(extractLinks("<p>No links</p>", "https://example.ch/start")).toEqual([]);
  });
});
