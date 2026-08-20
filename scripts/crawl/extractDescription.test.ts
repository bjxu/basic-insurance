import { describe, it, expect, vi } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import { buildPrompt, parseResponse, extractDescription } from "./extractDescription";

describe("buildPrompt", () => {
  it("includes the product name, tarifart, and page text", () => {
    const prompt = buildPrompt({ pageText: "Some page content here.", productName: "Callmed", tarifart: "telmed" });
    expect(prompt).toContain("Callmed");
    expect(prompt).toContain("telmed");
    expect(prompt).toContain("Some page content here.");
  });

  it("truncates very long page text so the prompt stays bounded", () => {
    const longText = "x".repeat(20000);
    const prompt = buildPrompt({ pageText: longText, productName: "P", tarifart: "hmo" });
    expect(prompt.length).toBeLessThan(longText.length);
  });
});

describe("parseResponse", () => {
  it("parses a valid JSON response with all four locales", () => {
    const text = '{"de": "Anruf erforderlich.", "en": "Call required.", "fr": "Appel requis.", "it": "Chiamata richiesta."}';
    expect(parseResponse(text)).toEqual({
      de: "Anruf erforderlich.",
      en: "Call required.",
      fr: "Appel requis.",
      it: "Chiamata richiesta.",
    });
  });

  it("returns null for malformed JSON", () => {
    expect(parseResponse("not json")).toBeNull();
  });

  it("returns null when a locale key is missing", () => {
    expect(parseResponse('{"de": "x", "en": "y", "fr": "z"}')).toBeNull();
  });

  it("returns null when a locale value is an empty string", () => {
    expect(parseResponse('{"de": "", "en": "y", "fr": "z", "it": "w"}')).toBeNull();
  });

  it("returns null when a locale value is not a string", () => {
    expect(parseResponse('{"de": 1, "en": "y", "fr": "z", "it": "w"}')).toBeNull();
  });

  it("returns null for the {\"insufficient\": true} sentinel so the i18n fallback stays in charge", () => {
    expect(parseResponse('{"insufficient": true}')).toBeNull();
  });

  it("returns null when a locale value exceeds the 200-character limit", () => {
    const tooLong = "x".repeat(201);
    expect(parseResponse(JSON.stringify({ de: tooLong, en: "y", fr: "z", it: "w" }))).toBeNull();
  });
});

describe("extractDescription", () => {
  it("calls the Anthropic client with the built prompt and returns the parsed result", async () => {
    const fakeResponse = {
      content: [
        {
          type: "text",
          text: '{"de": "Anruf erforderlich.", "en": "Call required.", "fr": "Appel requis.", "it": "Chiamata richiesta."}',
        },
      ],
    };
    const client = { messages: { create: vi.fn().mockResolvedValue(fakeResponse) } } as unknown as Anthropic;

    const result = await extractDescription(client, {
      pageText: "Page about Callmed.",
      productName: "Callmed",
      tarifart: "telmed",
    });

    expect(result).toEqual({
      de: "Anruf erforderlich.",
      en: "Call required.",
      fr: "Appel requis.",
      it: "Chiamata richiesta.",
    });
    expect(client.messages.create).toHaveBeenCalledTimes(1);
    const callArgs = (client.messages.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(callArgs.messages[0].content).toContain("Callmed");
  });

  it("returns null when the response has no text content block", async () => {
    const client = { messages: { create: vi.fn().mockResolvedValue({ content: [] }) } } as unknown as Anthropic;
    const result = await extractDescription(client, { pageText: "x", productName: "P", tarifart: "hmo" });
    expect(result).toBeNull();
  });

  it("returns null when the response text isn't valid JSON", async () => {
    const client = {
      messages: { create: vi.fn().mockResolvedValue({ content: [{ type: "text", text: "not json" }] }) },
    } as unknown as Anthropic;
    const result = await extractDescription(client, { pageText: "x", productName: "P", tarifart: "hmo" });
    expect(result).toBeNull();
  });
});
