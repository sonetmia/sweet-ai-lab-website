import { env, pipeline } from "@huggingface/transformers";

env.allowRemoteModels = true;
env.allowLocalModels = false;

type WorkerMessage = { type: "load" } | { type: "process"; id: string; url: string };
let remover: any = null;

self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const { data } = event;
  try {
    if (data.type === "load") {
      remover = await pipeline("image-segmentation", "briaai/RMBG-1.4", {
        dtype: "fp32",
        progress_callback: (progress: any) => {
          const percentage = typeof progress.progress === "number"
            ? progress.progress
            : progress.loaded && progress.total ? (progress.loaded / progress.total) * 100 : 0;
          self.postMessage({ type: "progress", percentage: Math.max(0, Math.min(100, percentage)) });
        },
      });
      self.postMessage({ type: "ready" });
      return;
    }
    if (!remover) throw new Error("The local background-removal model is not ready yet.");
    const output = await remover(data.url, { threshold: 0 }) as Array<{ mask: { data: ArrayLike<number>; width: number; height: number; channels: number } }>;
    const mask = output[0]?.mask;
    if (!mask) throw new Error("The background-removal model did not return a usable mask.");
    const pixels = new Uint8ClampedArray(mask.data);
    self.postMessage({ type: "done", id: data.id, width: mask.width, height: mask.height, channels: mask.channels, pixels });
  } catch (error) {
    self.postMessage({ type: "error", id: data.type === "process" ? data.id : null, message: error instanceof Error ? error.message : "Background removal failed." });
  }
};
