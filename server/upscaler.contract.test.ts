import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("browser-local Image Upscaler contract", () => {
  it("keeps the Image Upscaler on its own protected bulk-processing route with a two-credit post-success charge", () => {
    const source = readFileSync(new URL("../client/src/pages/ImageUpscaler.tsx", import.meta.url), "utf8");
    expect(source).toContain("IMAGE UPSCALER");
    expect(source).toContain('action_type: "image_upscale", amount: 2');
    expect(source).toContain("runResilientUpscale");
    expect(source).toContain("createBrowserUpscaledImage");
    expect(source).toContain('multiple accept="image/*"');
    expect(source).toContain("new JSZip()");
    expect(source).toContain("sweet-ai-lab-ai-upscaled-images.zip");
    expect(source).toContain("2× upscale");
    expect(source).toContain("4× upscale");
  });
});
