import { describe, expect, it } from "vitest";
import { MAX_UPSCALE_EDGE, getUpscaledDimensions, getUpscaledFilename } from "./imageUpscale";

describe("bulk image upscaling helpers", () => {
  it("preserves the image aspect ratio at the selected scale", () => {
    expect(getUpscaledDimensions(1200, 800, 4)).toEqual({ width: 4800, height: 3200, appliedScale: 4 });
  });

  it("limits large images to the browser-safe maximum edge", () => {
    const result = getUpscaledDimensions(6000, 3000, 4);
    expect(result.width).toBe(MAX_UPSCALE_EDGE);
    expect(result.height).toBe(4096);
    expect(result.appliedScale).toBeCloseTo(8192 / 6000);
  });

  it("creates a clear PNG download name without the input extension", () => {
    expect(getUpscaledFilename("stock.image.jpeg", 2)).toBe("stock.image-2x-upscaled.png");
  });

  it("rejects invalid image dimensions", () => {
    expect(() => getUpscaledDimensions(0, 100, 2)).toThrow("valid dimensions");
  });
});
