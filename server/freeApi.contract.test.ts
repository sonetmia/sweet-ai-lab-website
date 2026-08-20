import { describe, expect, it, vi } from "vitest";
import { addFreeKeyWithAutoModel, createFreePrompt, freeProviders, generateWithFreeApi, getSelectedFreeModelLabel, groqTextFallbackModel, groqVisionModel, normalizeMetadata, openRouterFreeVisionModel, removeFreeKey, selectBestProviderModel, selectGroqModel } from "../client/src/lib/freeApi";

describe("Free API mode contract", () => {
  it("keeps the exact provider catalog in the required order", () => {
    expect(freeProviders).toEqual(["Gemini", "Groq", "Mistral", "OpenAI", "OpenRouter", "Together AI", "SambaNova", "Hugging Face"]);
    expect(openRouterFreeVisionModel).toBe("nvidia/nemotron-nano-12b-v2-vl:free");
    expect(groqVisionModel).toBe("qwen/qwen3.6-27b");
    expect(groqTextFallbackModel).toBe("openai/gpt-oss-120b");
    expect(selectGroqModel([groqVisionModel], true)).toBe(groqVisionModel);
    expect(selectGroqModel([groqTextFallbackModel], false)).toBe(groqTextFallbackModel);
    expect(() => selectGroqModel([groqTextFallbackModel], true)).toThrow("did not expose an image-capable model");
    expect(selectBestProviderModel("SambaNova", null, true)).toBe("gemma-4-31B-it");
    expect(selectBestProviderModel("Together AI", ["meta-llama/Llama-3.2-11B-Vision-Instruct-Turbo"], true)).toBe("meta-llama/Llama-3.2-11B-Vision-Instruct-Turbo");
  });

  it("builds metadata constraints and normalizes fenced JSON output", () => {
    const prompt = createFreePrompt("metadata", "Adobe Stock", "Original", { titleRange: [6, 12], keywordRange: [35, 40], descriptionRange: [12, 30], singleWords: true, silhouette: false, customPrompt: "", prohibitedWords: "", prefix: "", suffix: "" });
    expect(prompt).toContain("Adobe Stock");
    expect(prompt).toContain("35–40");
    expect(normalizeMetadata('```json\n{"title":"Green vase","keywords":["vase"],"description":"Green vase in sunlight","category":"Objects"}\n```')).toMatchObject({ title: "Green vase", category: "Objects" });
    expect(normalizeMetadata('Here is the result: {"title":"Green vase","keywords":["vase"],"description":"Green vase in sunlight","category":"Objects"}')).toMatchObject({ title: "Green vase" });
  });

  it("automatically retries another configured provider after a quota response", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ id: groqVisionModel }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ models: [{ name: "models/gemini-2.0-flash" }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { message: "rate limit reached" } }), { status: 429 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"title":"Fallback title","keywords":["fallback"],"description":"Recovered generation","category":"Objects"}' }] } }] }), { status: 200 }));
    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchMock as typeof fetch;
    try {
      await addFreeKeyWithAutoModel("Groq", "groq-test-key");
      await addFreeKeyWithAutoModel("Gemini", "gemini-test-key");
      expect(getSelectedFreeModelLabel("Groq", "groq-test-key")).toContain("Auto-detected");
      const output = await generateWithFreeApi("Groq", "return valid JSON only", "data:image/png;base64,AA==");
      expect(normalizeMetadata(output)).toMatchObject({ title: "Fallback title" });
      expect(fetchMock).toHaveBeenCalledTimes(4);
    } finally {
      removeFreeKey("Groq", "groq-test-key");
      removeFreeKey("Gemini", "gemini-test-key");
      globalThis.fetch = originalFetch;
    }
  });

  it("labels catalog-less provider choices as documented defaults rather than falsely claiming discovery", async () => {
    const result = await addFreeKeyWithAutoModel("SambaNova", "sambanova-test-key");
    try {
      expect(result.source).toBe("documented-default");
      expect(getSelectedFreeModelLabel("SambaNova", "sambanova-test-key")).toContain("Documented default");
    } finally {
      removeFreeKey("SambaNova", "sambanova-test-key");
    }
  });
});
