import { describe, it, expect } from "vitest";
import { carryForwardEnvironmentalLevy } from "./metadata";

function metadataJson(environmentalLevyPerMonth: unknown): string {
  return JSON.stringify({
    publicationDate: "2025-09-23",
    availableYears: [2026],
    memberCountAsOf: 2024,
    environmentalLevyPerMonth,
  });
}

describe("carryForwardEnvironmentalLevy", () => {
  it("carries forward the map when the ingested year is already published", () => {
    const result = carryForwardEnvironmentalLevy(metadataJson({ "2026": 5.15 }), 2026);
    expect(result).toEqual({ ok: true, environmentalLevyPerMonth: { "2026": 5.15 } });
  });

  it("preserves other years' figures alongside the ingested one", () => {
    const result = carryForwardEnvironmentalLevy(metadataJson({ "2025": 4.9, "2026": 5.15 }), 2026);
    expect(result).toEqual({ ok: true, environmentalLevyPerMonth: { "2025": 4.9, "2026": 5.15 } });
  });

  it("keeps newer years when re-ingesting an older one", () => {
    const result = carryForwardEnvironmentalLevy(metadataJson({ "2025": 4.9, "2026": 5.15 }), 2025);
    expect(result).toEqual({ ok: true, environmentalLevyPerMonth: { "2025": 4.9, "2026": 5.15 } });
  });

  it("fails, naming the year and the file, when the ingested year has no figure", () => {
    const result = carryForwardEnvironmentalLevy(metadataJson({ "2026": 5.15 }), 2027);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.error).toContain("2027");
    expect(result.error).toContain("environmentalLevyPerMonth");
    expect(result.error).toContain("src/data/metadata.json");
    expect(result.error).toContain("Known years: 2026.");
  });

  it("fails when metadata.json does not exist", () => {
    const result = carryForwardEnvironmentalLevy(null, 2026);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.error).toContain("not found");
    expect(result.error).toContain("2026");
  });

  it("fails when the map is missing entirely", () => {
    const result = carryForwardEnvironmentalLevy(
      JSON.stringify({ publicationDate: "2025-09-23", availableYears: [2026], memberCountAsOf: 2024 }),
      2026,
    );
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.error).toContain('no "environmentalLevyPerMonth" map');
  });

  it("fails on invalid JSON", () => {
    const result = carryForwardEnvironmentalLevy("{ not json", 2026);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.error).toContain("not valid JSON");
  });

  it("fails on a non-numeric levy amount", () => {
    const result = carryForwardEnvironmentalLevy(metadataJson({ "2026": "5.15" }), 2026);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.error).toContain("must be a finite number");
  });
});
