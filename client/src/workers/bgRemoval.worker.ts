import { AutoModel, AutoProcessor, RawImage, env } from "@huggingface/transformers";

env.allowRemoteModels = true;
env.allowLocalModels = false;

type WorkerMessage = { type: "load" } | { type: "process"; id: string; url: string };
let model: any = null;
let processor: any = null;

async function loadModel() {
  if (model && processor) return;
  const modelId = "onnx-community/BiRefNet-ONNX";
  const progressCallback = (progress: any) => {
    const percentage = typeof progress.progress === "number"
      ? progress.progress
      : progress.loaded && progress.total ? (progress.loaded / progress.total) * 100 : 0;
    self.postMessage({ type: "progress", percentage: Math.max(0, Math.min(100, percentage)) });
  };
  model = await AutoModel.from_pretrained(modelId, { dtype: "fp32", progress_callback: progressCallback });
  processor = await AutoProcessor.from_pretrained(modelId, { progress_callback: progressCallback });
}

self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const { data } = event;
  try {
    if (data.type === "load") {
      await loadModel();
      self.postMessage({ type: "ready" });
      return;
    }

    await loadModel();
    const image = await RawImage.fromURL(data.url);
    const { pixel_values } = await processor(image);
    const { output_image } = await model({ input_image: pixel_values });
    const mask = await RawImage.fromTensor(output_image[0].sigmoid().mul(255).to("uint8"));
    const resizedMask = await mask.resize(image.width, image.height);
    const pixels = new Uint8ClampedArray(resizedMask.data);
    self.postMessage({ type: "done", id: data.id, width: resizedMask.width, height: resizedMask.height, channels: resizedMask.channels, pixels });
  } catch (error) {
    self.postMessage({ type: "error", id: data.type === "process" ? data.id : null, message: error instanceof Error ? error.message : "Background removal failed." });
  }
};
