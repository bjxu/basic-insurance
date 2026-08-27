import { describe, it, expect } from "vitest";
import {
  TERM_KEYS,
  GUIDE_TERM_KEYS,
  HELP_ANCHORS,
  GUIDE_SECTION_IDS,
  normalizeGuideSection,
} from "@/lib/help";
import de from "@/messages/de.json";

describe("HELP_ANCHORS", () => {
  it("has a non-empty anchor for every term key", () => {
    for (const key of TERM_KEYS) {
      expect(typeof HELP_ANCHORS[key]).toBe("string");
      expect(HELP_ANCHORS[key].length).toBeGreaterThan(0);
    }
  });
});

describe("normalizeGuideSection", () => {
  it("passes through a known guide section id", () => {
    for (const id of GUIDE_SECTION_IDS) {
      expect(normalizeGuideSection(id)).toBe(id);
    }
  });

  it("maps every HELP_ANCHORS target to a known section id", () => {
    for (const key of TERM_KEYS) {
      expect(normalizeGuideSection(HELP_ANCHORS[key])).toBe(HELP_ANCHORS[key]);
    }
  });

  it("returns undefined for a missing section", () => {
    expect(normalizeGuideSection(undefined)).toBeUndefined();
  });

  it("returns undefined for an unknown string", () => {
    expect(normalizeGuideSection("nope")).toBeUndefined();
  });

  it("returns undefined when handed a non-string (e.g. a click event)", () => {
    // Regression: NewcomerBanner wired onClick={onOpenGuide}, so React passed the
    // SyntheticEvent as `section` and the drawer built querySelector("#[object Object]").
    const fakeEvent = { type: "click", currentTarget: {}, nativeEvent: {} };
    expect(normalizeGuideSection(fakeEvent as unknown)).toBeUndefined();
  });
});

describe("term catalog", () => {
  const terms = de.help.terms as Record<string, { title?: string; short?: string }>;

  it("every inline-tip term key resolves in the default (de) catalog", () => {
    for (const key of TERM_KEYS) {
      expect(terms[key]?.title, key).toBeTruthy();
      expect(terms[key]?.short, key).toBeTruthy();
    }
  });

  it("every guide term key resolves in the default (de) catalog", () => {
    for (const key of GUIDE_TERM_KEYS) {
      expect(terms[key]?.title, key).toBeTruthy();
      expect(terms[key]?.short, key).toBeTruthy();
    }
  });

  it("GUIDE_TERM_KEYS is a superset of TERM_KEYS", () => {
    for (const key of TERM_KEYS) {
      expect(GUIDE_TERM_KEYS).toContain(key);
    }
  });
});
