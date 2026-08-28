import { describe, it, expect } from "vitest";
import { premiumBand, PREMIUM_BANDS } from "./premiumBand";

describe("premiumBand", () => {
  it("bands typical adult premiums", () => {
    expect(premiumBand(249.99)).toBe("<250");
    expect(premiumBand(250)).toBe("250-349");
    expect(premiumBand(349.99)).toBe("250-349");
    expect(premiumBand(350)).toBe("350-449");
    expect(premiumBand(449.99)).toBe("350-449");
    expect(premiumBand(450)).toBe("450-549");
    expect(premiumBand(549.99)).toBe("450-549");
    expect(premiumBand(550)).toBe("550+");
    expect(premiumBand(1200)).toBe("550+");
  });

  it("returns null for non-positive or non-finite input", () => {
    expect(premiumBand(0)).toBeNull();
    expect(premiumBand(-10)).toBeNull();
    expect(premiumBand(Number.NaN)).toBeNull();
    expect(premiumBand(Number.POSITIVE_INFINITY)).toBeNull();
  });

  it("exposes the bands in ascending order", () => {
    expect(PREMIUM_BANDS).toEqual(["<250", "250-349", "350-449", "450-549", "550+"]);
  });
});
