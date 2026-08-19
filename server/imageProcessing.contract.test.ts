import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("local AI image-processing contract", () => {
  it("uses Swin2SR AI super-resolution models for the dedicated bulk Image Upscaler", () => {
    const source = readFileSync(new URL("../client/src/workers/upscale.worker.ts", import.meta.url), "utf8");
    expect(source).toContain("Xenova/swin2SR-lightweight-x2-64");
    expect(source).toContain("Xenova/swin2SR-compressed-sr-x4-48");
    expect(source).toContain('pipeline("image-to-image"');
  });

  it("uses BiRefNet for higher-quality local background matting", () => {
    const source = readFileSync(new URL("../client/src/workers/bgRemoval.worker.ts", import.meta.url), "utf8");
    expect(source).toContain("onnx-community/BiRefNet-ONNX");
    expect(source).toContain("RawImage.fromTensor");
  });
});
