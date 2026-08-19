import { describe, it, expect } from "vitest";
import { parseDisallowedPaths, isPathAllowed } from "./robots";
// The real crawler's UA — imported rather than hardcoded so a mismatch between the
// constant and the matching logic can't hide behind a convenient test literal.
import { USER_AGENT } from "./crawlSite";

describe("parseDisallowedPaths", () => {
  it("collects Disallow rules under the wildcard user-agent group", () => {
    const robotsTxt = ["User-agent: *", "Disallow: /admin", "Disallow: /private"].join("\n");
    expect(parseDisallowedPaths(robotsTxt, USER_AGENT)).toEqual(["/admin", "/private"]);
  });

  it("ignores rules under an unrelated user-agent group", () => {
    const robotsTxt = ["User-agent: Googlebot", "Disallow: /no-google", "", "User-agent: *", "Disallow: /all"].join(
      "\n",
    );
    expect(parseDisallowedPaths(robotsTxt, USER_AGENT)).toEqual(["/all"]);
  });

  it("matches rules under a group naming our own user-agent, case-insensitively", () => {
    const robotsTxt = ["User-agent: prixioproductdescriptionbot/1.0", "Disallow: /bot-only"].join("\n");
    expect(parseDisallowedPaths(robotsTxt, USER_AGENT)).toEqual(["/bot-only"]);
  });

  it("matches a group naming the bare product token, without our version/comment suffix", () => {
    // The common robots.txt style is the product token alone; our real UA is
    // "PrixioProductDescriptionBot/1.0 (+https://prixio.ch)". Exact-string matching
    // silently ignored these rules, letting us crawl a site that banned us by name.
    const robotsTxt = ["User-agent: PrixioProductDescriptionBot", "Disallow: /no-bots"].join("\n");
    expect(parseDisallowedPaths(robotsTxt, USER_AGENT)).toEqual(["/no-bots"]);
  });

  it("ignores comments and blank Disallow values (an empty Disallow means 'allow everything')", () => {
    const robotsTxt = ["# comment", "User-agent: *", "Disallow:", "Disallow: /x"].join("\n");
    expect(parseDisallowedPaths(robotsTxt, "AnyBot")).toEqual(["/x"]);
  });

  it("returns an empty array for empty input", () => {
    expect(parseDisallowedPaths("", "AnyBot")).toEqual([]);
  });
});

describe("isPathAllowed", () => {
  it("disallows a path matching a disallowed prefix", () => {
    expect(isPathAllowed(["/admin"], "/admin/settings")).toBe(false);
  });

  it("allows a path not matching any disallowed prefix", () => {
    expect(isPathAllowed(["/admin"], "/produkte/hausarzt")).toBe(true);
  });

  it("allows everything when there are no disallowed paths", () => {
    expect(isPathAllowed([], "/anything")).toBe(true);
  });
});
