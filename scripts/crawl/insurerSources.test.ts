import { describe, it, expect } from "vitest";
import { buildInsurerSources, type InsurerSources } from "./insurerSources";

describe("buildInsurerSources", () => {
  const names = { "8": "CSS", "32": "Aquilana" };

  it("seeds every insurer with a null seedUrl when there's no existing registry", () => {
    expect(buildInsurerSources({}, names)).toEqual({
      "8": { insurerName: "CSS", seedUrl: null },
      "32": { insurerName: "Aquilana", seedUrl: null },
    });
  });

  it("preserves an already-filled-in seedUrl", () => {
    const existing: InsurerSources = { "8": { insurerName: "CSS", seedUrl: "https://css.ch" } };
    expect(buildInsurerSources(existing, names)).toEqual({
      "8": { insurerName: "CSS", seedUrl: "https://css.ch" },
      "32": { insurerName: "Aquilana", seedUrl: null },
    });
  });

  it("adds a newly-added insurer with a null seedUrl without disturbing others", () => {
    const existing: InsurerSources = { "8": { insurerName: "CSS", seedUrl: "https://css.ch" } };
    const namesWithNew = { ...names, "999": "New Insurer" };
    expect(buildInsurerSources(existing, namesWithNew)).toEqual({
      "8": { insurerName: "CSS", seedUrl: "https://css.ch" },
      "32": { insurerName: "Aquilana", seedUrl: null },
      "999": { insurerName: "New Insurer", seedUrl: null },
    });
  });

  it("defaults to INSURER_NAMES and an empty registry when called with no arguments", () => {
    const result = buildInsurerSources();
    expect(Object.keys(result).length).toBeGreaterThan(30); // 34 real insurers as of 2026-08-19
    expect(result["1509"]).toEqual({ insurerName: "Sanitas", seedUrl: null });
  });
});
