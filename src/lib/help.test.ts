import { describe, it, expect } from "vitest";
import { TERM_KEYS, GUIDE_TERM_KEYS, HELP_ANCHORS } from "@/lib/help";
import de from "@/messages/de.json";

describe("HELP_ANCHORS", () => {
  it("has a non-empty anchor for every term key", () => {
    for (const key of TERM_KEYS) {
      expect(typeof HELP_ANCHORS[key]).toBe("string");
      expect(HELP_ANCHORS[key].length).toBeGreaterThan(0);
    }
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
