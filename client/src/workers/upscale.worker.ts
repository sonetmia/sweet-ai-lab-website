import { env, pipeline } from "@huggingface/transformers";

env.allowRemoteModels = true;
env.allowLocalModels = false;

type UpscaleFactor = 2 | 4;
type WorkerMessage = { type: "load"; factor: UpscaleFactor } | { type: "process"; id: string; url: string; factor: UpscaleFactor };

const models: Record<UpscaleFactor, string> = {
  2: "Xenova/swin2SR-lightweight-x2-64",
  4: "Xenova/swin2SR-compressed-sr-x4-48",
};

let activeFactor: UpscaleFactor | null = null;
let upscaler: any = null;

async function loadModel(factor: UpscaleFactor) {
  if (upscaler && activeFactor === factor) return;
  upscaler = await pipeline("image-to-image", models[factor], {
    dtype: "fp32",
    progress_callback: (progress: any) => {
      const percentage = typeof progress.progress === "number"
        ? progress.progress
        : progress.loaded && progress.total ? (progress.loaded / progress.total) * 100 : 0;
      self.postMessage({ type: "progress", factor, percentage: Math.max(0, Math.min(100, percentage)) });
    },
  });
  activeFactor = factor;
}

self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const { data } = event;
  try {
    if (data.type === "load") {
      await loadModel(data.factor);
      self.postMessage({ type: "ready", factor: data.factor });
      return;
    }

    await loadModel(data.factor);
    const output = await upscaler(data.url);
    const blob = await output.toBlob("image/png");
    const buffer = await blob.arrayBuffer();
    (self as unknown as Worker).postMessage({ type: "done", id: data.id, width: output.width, height: output.height, buffer }, [buffer]);
  } catch (error) {
    self.postMessage({ type: "error", id: data.type === "process" ? data.id : null, message: error instanceof Error ? error.message : "AI super-resolution failed." });
  }
};
