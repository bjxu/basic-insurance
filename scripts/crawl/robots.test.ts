import { describe, it, expect } from "vitest";
import { parseDisallowedPaths, isPathAllowed } from "./robots";

describe("parseDisallowedPaths", () => {
  it("collects Disallow rules under the wildcard user-agent group", () => {
    const robotsTxt = ["User-agent: *", "Disallow: /admin", "Disallow: /private"].join("\n");
    expect(parseDisallowedPaths(robotsTxt, "PrixioProductDescriptionBot/1.0")).toEqual([
      "/admin",
      "/private",
    ]);
  });

  it("ignores rules under an unrelated user-agent group", () => {
    const robotsTxt = ["User-agent: Googlebot", "Disallow: /no-google", "", "User-agent: *", "Disallow: /all"].join(
      "\n",
    );
    expect(parseDisallowedPaths(robotsTxt, "PrixioProductDescriptionBot/1.0")).toEqual(["/all"]);
  });

  it("matches rules under a group naming our own user-agent, case-insensitively", () => {
    const robotsTxt = ["User-agent: prixioproductdescriptionbot/1.0", "Disallow: /bot-only"].join("\n");
    expect(parseDisallowedPaths(robotsTxt, "PrixioProductDescriptionBot/1.0")).toEqual(["/bot-only"]);
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
