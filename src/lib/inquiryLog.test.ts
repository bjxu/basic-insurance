// REQ-21 (architecture.md §10.1): builds the /api/log-inquiry payload from the
// comparator's resolved query state. Pure so the "when do we have a loggable
// query" gate and the exact field mapping are testable without a browser.

import { describe, it, expect } from "vitest";
import { buildInquiryLogPayload } from "./inquiryLog";

const BASE_INPUT = {
  praemienregionId: "ZH-1",
  altersklasse: "erwachsen",
  franchise: 300,
  year: 2026,
  altModelsActive: false,
  unfalldeckung: true,
  locale: "de",
  currentInsurerCode: null,
  currentMonthlyPremium: null,
  birthYear: null,
};

describe("buildInquiryLogPayload", () => {
  it("maps the resolved query state to the log-inquiry payload shape", () => {
    expect(buildInquiryLogPayload(BASE_INPUT)).toEqual({
      regionId: "ZH-1",
      altersklasse: "erwachsen",
      franchise: 300,
      year: 2026,
      models: ["standard"],
      accident: true,
      locale: "de",
    });
  });

  it("includes every tarifart when the alternative-models filter is active", () => {
    const payload = buildInquiryLogPayload({ ...BASE_INPUT, altModelsActive: true });
    expect(payload?.models).toEqual(["standard", "hausarzt", "telmed", "hmo", "andere"]);
  });

  it("maps unfalldeckung=false to accident=false", () => {
    const payload = buildInquiryLogPayload({ ...BASE_INPUT, unfalldeckung: false });
    expect(payload?.accident).toBe(false);
  });

  it("returns null when praemienregionId is not resolved yet", () => {
    expect(buildInquiryLogPayload({ ...BASE_INPUT, praemienregionId: null })).toBeNull();
  });

  it("returns null when altersklasse is not resolved yet", () => {
    expect(buildInquiryLogPayload({ ...BASE_INPUT, altersklasse: null })).toBeNull();
  });

  it("returns null when franchise is not selected yet", () => {
    expect(buildInquiryLogPayload({ ...BASE_INPUT, franchise: null })).toBeNull();
  });

  it("carries the locale through unchanged", () => {
    expect(buildInquiryLogPayload({ ...BASE_INPUT, locale: "fr" })?.locale).toBe("fr");
  });

  it("includes currentInsurer only when an insurer code is set", () => {
    expect(buildInquiryLogPayload(BASE_INPUT)).not.toHaveProperty("currentInsurer");
    expect(
      buildInquiryLogPayload({ ...BASE_INPUT, currentInsurerCode: "1542" })?.currentInsurer,
    ).toBe("1542");
  });

  it("includes currentPremiumBand only when a usable premium is given", () => {
    expect(buildInquiryLogPayload(BASE_INPUT)).not.toHaveProperty("currentPremiumBand");
    expect(
      buildInquiryLogPayload({ ...BASE_INPUT, currentMonthlyPremium: 372.4 })?.currentPremiumBand,
    ).toBe("350-449");
    expect(
      buildInquiryLogPayload({ ...BASE_INPUT, currentMonthlyPremium: 0 }),
    ).not.toHaveProperty("currentPremiumBand");
  });

  it("returns null (no current-plan fields consulted) when required inputs are missing", () => {
    expect(
      buildInquiryLogPayload({
        ...BASE_INPUT,
        praemienregionId: null,
        currentInsurerCode: "1542",
        currentMonthlyPremium: 400,
      }),
    ).toBeNull();
  });

  it("includes ageBand only when a birth year is given", () => {
    expect(buildInquiryLogPayload(BASE_INPUT)).not.toHaveProperty("ageBand");
    // year 2026 − birthYear 1985 = age 41 → "36-45"
    expect(
      buildInquiryLogPayload({ ...BASE_INPUT, birthYear: 1985 })?.ageBand,
    ).toBe("36-45");
  });

  it("derives ageBand against the active year, not the current date", () => {
    // year 2026 − birthYear 2009 = age 17 → "0-18"
    expect(buildInquiryLogPayload({ ...BASE_INPUT, birthYear: 2009 })?.ageBand).toBe("0-18");
  });

  it("omits ageBand when the birth year implies a negative age", () => {
    expect(
      buildInquiryLogPayload({ ...BASE_INPUT, birthYear: 2030 }),
    ).not.toHaveProperty("ageBand");
  });
});
