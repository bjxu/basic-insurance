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
});
