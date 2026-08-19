import { describe, expect, it } from "vitest";
import { createFreePrompt, freeProviders, normalizeMetadata } from "../client/src/lib/freeApi";

describe("Free API mode contract", () => {
  it("keeps the exact provider catalog in the required order", () => {
    expect(freeProviders).toEqual(["Gemini", "Groq", "Mistral", "OpenAI", "OpenRouter"]);
  });

  it("builds metadata constraints and normalizes fenced JSON output", () => {
    const prompt = createFreePrompt("metadata", "Adobe Stock", "Original", { titleRange: [6, 12], keywordRange: [35, 40], descriptionRange: [12, 30], singleWords: true, silhouette: false, customPrompt: "", prohibitedWords: "", prefix: "", suffix: "" });
    expect(prompt).toContain("Adobe Stock");
    expect(prompt).toContain("35–40");
    expect(normalizeMetadata('```json\n{"title":"Green vase","keywords":["vase"],"description":"Green vase in sunlight","category":"Objects"}\n```')).toMatchObject({ title: "Green vase", category: "Objects" });
  });
});
