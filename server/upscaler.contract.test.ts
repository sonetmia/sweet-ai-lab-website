import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("browser-local Image Upscaler contract", () => {
  it("keeps the Image Upscaler in the protected image-tools route with a two-credit post-success charge", () => {
    const source = readFileSync(new URL("../client/src/pages/BackgroundRemover.tsx", import.meta.url), "utf8");
    expect(source).toContain("IMAGE UPSCALER");
    expect(source).toContain('action_type: "image_upscale", amount: 2');
    expect(source).toContain("createUpscaledImage");
    expect(source).toContain("const safeScale = Math.min(factor, maxEdge / Math.max(image.naturalWidth, image.naturalHeight))");
    expect(source).toContain("2× upscale");
    expect(source).toContain("4× upscale");
  });
});
