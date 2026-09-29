import { describe, it, expect } from "vitest";
import { MODEL_TAG_CLASSES } from "./tarifart-style";
import { ALL_TARIFARTS } from "./lookup";

describe("MODEL_TAG_CLASSES", () => {
  it("has an explicit badge color for every alternative-model Tarifart", () => {
    // standard and andere intentionally have no entry — they fall back to
    // DEFAULT_MODEL_TAG_CLASSES — every other Tarifart needs its own color.
    const styledModels = ALL_TARIFARTS.filter((t) => t !== "standard" && t !== "andere");
    for (const tarifart of styledModels) {
      expect(MODEL_TAG_CLASSES[tarifart], `missing badge color for "${tarifart}"`).toBeDefined();
    }
  });
});
