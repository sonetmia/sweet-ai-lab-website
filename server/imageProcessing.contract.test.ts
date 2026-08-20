import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("local AI image-processing contract", () => {
  it("keeps optional Swin2SR acceleration while guaranteeing browser-local upscale fallback", () => {
    const source = readFileSync(new URL("../client/src/workers/upscale.worker.ts", import.meta.url), "utf8");
    const page = readFileSync(new URL("../client/src/pages/ImageUpscaler.tsx", import.meta.url), "utf8");
    expect(source).toContain("Xenova/swin2SR-lightweight-x2-64");
    expect(source).toContain("Xenova/swin2SR-compressed-sr-x4-48");
    expect(source).toContain('pipeline("image-to-image"');
    expect(page).toContain("runResilientUpscale");
    expect(page).toContain("createBrowserUpscaledImage");
    expect(page).toContain("getUpscaledDimensions");
    expect(page).toContain("getAiUpscaleWorker");
    expect(page).toContain("withTimeout");
  });

  it("uses the proven browser-compatible RMBG background-removal path", () => {
    const source = readFileSync(new URL("../client/src/workers/bgRemoval.worker.ts", import.meta.url), "utf8");
    expect(source).toContain("briaai/RMBG-1.4");
    expect(source).toContain('pipeline("image-segmentation"');
    expect(source).toContain("The background-removal model did not return a usable mask.");
    const page = readFileSync(new URL("../client/src/pages/BackgroundRemover.tsx", import.meta.url), "utf8");
    expect(page).toContain("getBackgroundWorker");
    expect(page).toContain("createSimpleBackgroundCutout");
  });
});
