import { describe, it, expect, vi, afterEach } from "vitest";
import {
  TERM_KEYS,
  GUIDE_TERM_KEYS,
  HELP_ANCHORS,
  HELP_SEEN_KEY,
  readHelpSeen,
  markHelpSeen,
} from "@/lib/help";
import de from "@/messages/de.json";

afterEach(() => {
  vi.unstubAllGlobals();
});

function fakeStorage(initial: Record<string, string> = {}) {
  const store: Record<string, string> = { ...initial };
  return {
    getItem: (k: string) => (k in store ? store[k] : null),
    setItem: (k: string, v: string) => {
      store[k] = v;
    },
  };
}

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

describe("readHelpSeen / markHelpSeen", () => {
  it("readHelpSeen is false when the key is absent", () => {
    vi.stubGlobal("window", { localStorage: fakeStorage() });
    expect(readHelpSeen()).toBe(false);
  });

  it("readHelpSeen is true after markHelpSeen", () => {
    const ls = fakeStorage();
    vi.stubGlobal("window", { localStorage: ls });
    markHelpSeen();
    expect(ls.getItem(HELP_SEEN_KEY)).toBe("1");
    expect(readHelpSeen()).toBe(true);
  });

  it("readHelpSeen is false (no throw) when localStorage access throws", () => {
    vi.stubGlobal("window", {
      get localStorage(): Storage {
        throw new Error("blocked");
      },
    });
    expect(() => readHelpSeen()).not.toThrow();
    expect(readHelpSeen()).toBe(false);
  });

  it("markHelpSeen swallows a throwing localStorage", () => {
    vi.stubGlobal("window", {
      get localStorage(): Storage {
        throw new Error("blocked");
      },
    });
    expect(() => markHelpSeen()).not.toThrow();
  });

  it("readHelpSeen is false when window is undefined (SSR)", () => {
    vi.stubGlobal("window", undefined);
    expect(readHelpSeen()).toBe(false);
  });

  it("markHelpSeen is a no-op (no throw) when window is undefined (SSR)", () => {
    vi.stubGlobal("window", undefined);
    expect(() => markHelpSeen()).not.toThrow();
  });
});
