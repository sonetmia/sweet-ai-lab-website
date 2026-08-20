import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Studio API reliability contract", () => {
  it("tries stable vision-capable OpenRouter models and validates metadata before debiting credits", () => {
    const source = readFileSync(new URL("./studioApi.ts", import.meta.url), "utf8");
    expect(source).toContain('"meta-llama/llama-4-scout", "qwen/qwen3.6-27b"');
    expect(source).toContain('error: "invalid_generation_format"');
    expect(source.indexOf("let result:")).toBeLessThan(source.indexOf('rpc("deduct_credit"'));
  });
});
