import { describe, it, expect } from "vitest";
import { htmlToText, extractTitle } from "./htmlText";

describe("htmlToText", () => {
  it("strips tags and collapses whitespace", () => {
    const html = "<html><body><h1>Hausarzt</h1>\n<p>Erstbehandlung   beim  Hausarzt.</p></body></html>";
    expect(htmlToText(html)).toBe("Hausarzt Erstbehandlung beim Hausarzt.");
  });

  it("removes script and style block contents entirely, not just their tags", () => {
    const html = "<style>.x{color:red}</style><p>Text</p><script>alert('hi')</script>";
    expect(htmlToText(html)).toBe("Text");
  });

  it("decodes common HTML entities", () => {
    expect(htmlToText("<p>Ärzt&auml;in &amp; Praxis</p>")).toBe("Ärztäin & Praxis");
  });

  it("returns an empty string for empty input", () => {
    expect(htmlToText("")).toBe("");
  });
});

describe("extractTitle", () => {
  it("extracts and decodes the <title> text", () => {
    expect(extractTitle("<html><head><title>Callmed &ndash; Telmed</title></head></html>".replace("&ndash;", "-"))).toBe(
      "Callmed - Telmed",
    );
  });

  it("returns an empty string when there is no <title>", () => {
    expect(extractTitle("<html><body><p>No title here</p></body></html>")).toBe("");
  });
});
