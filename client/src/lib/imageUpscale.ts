export type UpscaleFactor = 2 | 4;

export const MAX_UPSCALE_EDGE = 8192;

export function getUpscaledDimensions(sourceWidth: number, sourceHeight: number, factor: UpscaleFactor) {
  if (!Number.isFinite(sourceWidth) || !Number.isFinite(sourceHeight) || sourceWidth <= 0 || sourceHeight <= 0) {
    throw new Error("The source image does not have valid dimensions.");
  }

  const safeScale = Math.min(factor, MAX_UPSCALE_EDGE / Math.max(sourceWidth, sourceHeight));
  return {
    width: Math.max(1, Math.round(sourceWidth * safeScale)),
    height: Math.max(1, Math.round(sourceHeight * safeScale)),
    appliedScale: safeScale,
  };
}

export function getUpscaledFilename(originalName: string, factor: UpscaleFactor) {
  const baseName = originalName.replace(/\.[^.]+$/, "") || "image";
  return `${baseName}-${factor}x-upscaled.png`;
}
