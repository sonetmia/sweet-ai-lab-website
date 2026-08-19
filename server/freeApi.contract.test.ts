import { describe, expect, it } from "vitest";
import { createFreePrompt, freeProviders, groqTextFallbackModel, groqVisionModel, normalizeMetadata, openRouterFreeVisionModel, selectGroqModel } from "../client/src/lib/freeApi";

describe("Free API mode contract", () => {
  it("keeps the exact provider catalog in the required order", () => {
    expect(freeProviders).toEqual(["Gemini", "Groq", "Mistral", "OpenAI", "OpenRouter"]);
    expect(openRouterFreeVisionModel).toBe("nvidia/nemotron-nano-12b-v2-vl:free");
    expect(groqVisionModel).toBe("qwen/qwen3.6-27b");
    expect(groqTextFallbackModel).toBe("openai/gpt-oss-120b");
    expect(selectGroqModel([groqVisionModel], true)).toBe(groqVisionModel);
    expect(selectGroqModel([groqTextFallbackModel], false)).toBe(groqTextFallbackModel);
    expect(() => selectGroqModel([groqTextFallbackModel], true)).toThrow("does not currently have an active vision model");
  });

  it("builds metadata constraints and normalizes fenced JSON output", () => {
    const prompt = createFreePrompt("metadata", "Adobe Stock", "Original", { titleRange: [6, 12], keywordRange: [35, 40], descriptionRange: [12, 30], singleWords: true, silhouette: false, customPrompt: "", prohibitedWords: "", prefix: "", suffix: "" });
    expect(prompt).toContain("Adobe Stock");
    expect(prompt).toContain("35–40");
    expect(normalizeMetadata('```json\n{"title":"Green vase","keywords":["vase"],"description":"Green vase in sunlight","category":"Objects"}\n```')).toMatchObject({ title: "Green vase", category: "Objects" });
    expect(normalizeMetadata('Here is the result: {"title":"Green vase","keywords":["vase"],"description":"Green vase in sunlight","category":"Objects"}')).toMatchObject({ title: "Green vase" });
  });
});
