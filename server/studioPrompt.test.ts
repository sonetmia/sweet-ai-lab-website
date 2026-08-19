import { describe, expect, it } from "vitest";
import { buildStudioPrompt, parseMetadataResult } from "./studioPrompt";

describe("studio prompt builder", () => {
  it("builds platform-aware metadata instructions with creator constraints", () => {
    const prompt = buildStudioPrompt({ mode: "metadata", platform: "Adobe Stock", titleMin: 6, titleMax: 12, keywordMin: 35, keywordMax: 40, singleWordKeywords: true, titlePrefix: "Editorial" });
    expect(prompt).toContain("Adobe Stock");
    expect(prompt).toContain("6 and 12");
    expect(prompt).toContain("35 to 40");
    expect(prompt).toContain("Begin the title with: Editorial");
  });

  it("normalizes a valid metadata response", () => {
    const result = parseMetadataResult('{"title":"Green ceramic vase on a sunlit table","keywords":["ceramic","vase"],"description":"Minimal handmade green ceramic vase in soft natural sunlight.","category":"Objects"}');
    expect(result.keywords).toEqual(["ceramic", "vase"]);
    expect(result.category).toBe("Objects");
  });
});
