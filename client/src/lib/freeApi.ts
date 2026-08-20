export const freeProviders = ["Gemini", "Groq", "Mistral", "OpenAI", "OpenRouter", "Together AI", "SambaNova", "Hugging Face"] as const;
export type FreeProvider = (typeof freeProviders)[number];
export const openRouterFreeVisionModel = "nvidia/nemotron-nano-12b-v2-vl:free";
export const groqVisionModel = "qwen/qwen3.6-27b";
export const groqTextFallbackModel = "openai/gpt-oss-120b";
export const VISION_IMAGE_MAX_DATA_URL_CHARS = 900_000;
export const COMPACT_VISION_IMAGE_MAX_DATA_URL_CHARS = 450_000;
export const PAID_API_RETRY_IMAGE_MAX_DATA_URL_CHARS = 180_000;

type ApiKeyStore = Partial<Record<FreeProvider, string[]>>;
type ModelStore = Record<string, string>;
type ModelSelectionSource = "detected" | "documented-default";
type ModelSelection = { model: string; source: ModelSelectionSource };
type ApiErrorPayload = { error?: { message?: string }; message?: string };
type ProviderModelConfig = { chatUrl: string; modelsUrl?: string; visionCandidates: string[]; textCandidates: string[] };

const providerModelConfig: Record<FreeProvider, ProviderModelConfig> = {
  Gemini: { chatUrl: "https://generativelanguage.googleapis.com/v1beta", modelsUrl: "https://generativelanguage.googleapis.com/v1beta/models", visionCandidates: ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-2.5-flash-lite"], textCandidates: ["gemini-2.5-flash", "gemini-2.0-flash"] },
  Groq: { chatUrl: "https://api.groq.com/openai/v1/chat/completions", modelsUrl: "https://api.groq.com/openai/v1/models", visionCandidates: [groqVisionModel, "meta-llama/llama-4-scout-17b-16e-instruct"], textCandidates: [groqVisionModel, groqTextFallbackModel] },
  Mistral: { chatUrl: "https://api.mistral.ai/v1/chat/completions", modelsUrl: "https://api.mistral.ai/v1/models", visionCandidates: ["pixtral-large-latest", "pixtral-12b-latest", "pixtral-12b-2409"], textCandidates: ["mistral-small-latest", "mistral-large-latest"] },
  OpenAI: { chatUrl: "https://api.openai.com/v1/chat/completions", modelsUrl: "https://api.openai.com/v1/models", visionCandidates: ["gpt-4.1-mini", "gpt-4o-mini"], textCandidates: ["gpt-4.1-mini", "gpt-4o-mini"] },
  OpenRouter: { chatUrl: "https://openrouter.ai/api/v1/chat/completions", modelsUrl: "https://openrouter.ai/api/v1/models", visionCandidates: [openRouterFreeVisionModel, "meta-llama/llama-4-scout:free", "qwen/qwen2.5-vl-32b-instruct:free"], textCandidates: [openRouterFreeVisionModel, "meta-llama/llama-4-scout:free"] },
  "Together AI": { chatUrl: "https://api.together.xyz/v1/chat/completions", modelsUrl: "https://api.together.xyz/v1/models", visionCandidates: ["moonshotai/Kimi-K2.6", "meta-llama/Llama-3.2-11B-Vision-Instruct-Turbo"], textCandidates: ["moonshotai/Kimi-K2.6", "meta-llama/Llama-3.3-70B-Instruct-Turbo"] },
  SambaNova: { chatUrl: "https://api.sambanova.ai/v1/chat/completions", visionCandidates: ["gemma-4-31B-it", "Llama-4-Scout-17B-16E-Instruct"], textCandidates: ["gemma-4-31B-it", "Llama-4-Scout-17B-16E-Instruct"] },
  "Hugging Face": { chatUrl: "https://router.huggingface.co/v1/chat/completions", modelsUrl: "https://router.huggingface.co/v1/models", visionCandidates: ["Qwen/Qwen2.5-VL-7B-Instruct", "meta-llama/Llama-3.2-11B-Vision-Instruct"], textCandidates: ["Qwen/Qwen2.5-VL-7B-Instruct", "openai/gpt-oss-120b"] },
};

let sessionKeyStore: ApiKeyStore = {};
let selectedModelStore: ModelStore = {};
let selectedModelSourceStore: Record<string, ModelSelectionSource> = {};
let rotationIndices: Partial<Record<FreeProvider, number>> = {};

export class ProviderApiError extends Error {
  constructor(readonly provider: FreeProvider, readonly status: number, message: string) {
    super(message);
    this.name = "ProviderApiError";
  }
}

export function loadFreeKeys(): ApiKeyStore {
  return sessionKeyStore;
}

function modelStoreId(provider: FreeProvider, key: string) {
  return `${provider}:${key}`;
}

export function getSelectedFreeModel(provider: FreeProvider, key: string) {
  return selectedModelStore[modelStoreId(provider, key)] ?? null;
}

export function getSelectedFreeModelLabel(provider: FreeProvider, key: string) {
  const model = getSelectedFreeModel(provider, key);
  if (!model) return "Model will be selected when used.";
  return selectedModelSourceStore[modelStoreId(provider, key)] === "documented-default" ? `Documented default: ${model}` : `Auto-detected: ${model}`;
}

export function saveFreeKey(provider: FreeProvider, rawKey: string) {
  const key = rawKey.trim();
  if (!key) return false;
  const store = loadFreeKeys();
  const values = store[provider] ?? [];
  if (!values.includes(key)) store[provider] = [...values, key];
  sessionKeyStore = store;
  return true;
}

export async function addFreeKeyWithAutoModel(provider: FreeProvider, rawKey: string) {
  const key = rawKey.trim();
  if (!key) throw new Error("Paste an API key before adding it.");
  const model = await detectBestModel(provider, key, true);
  const added = saveFreeKey(provider, key);
  selectedModelStore[modelStoreId(provider, key)] = model.model;
  selectedModelSourceStore[modelStoreId(provider, key)] = model.source;
  return { added, ...model };
}

export function removeFreeKey(provider: FreeProvider, key: string) {
  const store = loadFreeKeys();
  store[provider] = (store[provider] ?? []).filter((entry) => entry !== key);
  delete selectedModelStore[modelStoreId(provider, key)];
  delete selectedModelSourceStore[modelStoreId(provider, key)];
  sessionKeyStore = store;
}

function getKeysInAttemptOrder(provider: FreeProvider) {
  const keys = [...(loadFreeKeys()[provider] ?? [])];
  if (!keys.length) return [];
  const index = (rotationIndices[provider] ?? 0) % keys.length;
  rotationIndices[provider] = (index + 1) % keys.length;
  return [...keys.slice(index), ...keys.slice(0, index)];
}

function normalizeModelId(model: string) {
  return model.replace(/^models\//, "").trim();
}

function modelMatches(candidate: string, available: string) {
  const normalizedCandidate = normalizeModelId(candidate).toLowerCase();
  const normalizedAvailable = normalizeModelId(available).toLowerCase();
  return normalizedCandidate === normalizedAvailable || normalizedAvailable.includes(normalizedCandidate) || normalizedCandidate.includes(normalizedAvailable);
}

function looksVisionCapable(model: string) {
  return /vision|\bvl\b|pixtral|gemma-4|llama-4|kimi|gemini|gpt-4|nemotron.*vl|qwen3\.6/i.test(model);
}

export function selectBestProviderModel(provider: FreeProvider, availableModels: readonly string[] | null, needsVision: boolean) {
  const config = providerModelConfig[provider];
  const candidates = needsVision ? config.visionCandidates : config.textCandidates;
  if (availableModels === null) return candidates[0];
  if (!availableModels.length) throw new ProviderApiError(provider, 400, `${provider} did not expose any usable models for this API key.`);
  const normalizedAvailable = availableModels.map(normalizeModelId);
  for (const candidate of candidates) {
    const match = normalizedAvailable.find((available) => modelMatches(candidate, available));
    if (match) return match;
  }
  if (!needsVision) return normalizedAvailable[0];
  const detectedVision = normalizedAvailable.find(looksVisionCapable);
  if (detectedVision) return detectedVision;
  throw new ProviderApiError(provider, 400, `${provider} did not expose an image-capable model for this API key. Choose another configured provider for image metadata and image-to-prompt.`);
}

export function selectGroqModel(availableModels: readonly string[] | null, needsVision: boolean) {
  return selectBestProviderModel("Groq", availableModels, needsVision);
}

function providerHeaders(provider: FreeProvider, key: string) {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${key}`,
    ...(provider === "OpenRouter" ? { "HTTP-Referer": window.location.origin, "X-Title": "Sweet AI Lab by SONET" } : {}),
  };
}

function extractModelIds(payload: unknown) {
  const value = payload as { data?: Array<{ id?: string; name?: string }>; models?: Array<{ name?: string; id?: string }> };
  const models = value.data ?? value.models ?? [];
  return models.map((model) => model.id ?? model.name ?? "").filter(Boolean).map(normalizeModelId);
}

async function discoverProviderModels(provider: FreeProvider, key: string) {
  const config = providerModelConfig[provider];
  if (!config.modelsUrl) return null;
  const url = provider === "Gemini" ? `${config.modelsUrl}?key=${encodeURIComponent(key)}` : config.modelsUrl;
  const headers = provider === "Gemini" ? undefined : providerHeaders(provider, key);
  try {
    const response = await fetch(url, { headers });
    if (response.status === 401 || response.status === 403) throw new ProviderApiError(provider, response.status, `${provider} rejected this API key. Check the key and its project permissions.`);
    if (!response.ok) return null;
    return extractModelIds(await response.json());
  } catch (error) {
    if (error instanceof ProviderApiError) throw error;
    return null;
  }
}

async function detectBestModel(provider: FreeProvider, key: string, needsVision: boolean, force = false) {
  const stored = getSelectedFreeModel(provider, key);
  if (stored && !force) return { model: stored, source: selectedModelSourceStore[modelStoreId(provider, key)] ?? "detected" } satisfies ModelSelection;
  const available = await discoverProviderModels(provider, key);
  const selection = { model: selectBestProviderModel(provider, available, needsVision), source: available === null ? "documented-default" : "detected" } satisfies ModelSelection;
  selectedModelStore[modelStoreId(provider, key)] = selection.model;
  selectedModelSourceStore[modelStoreId(provider, key)] = selection.source;
  return selection;
}

async function readErrorMessage(response: Response) {
  try {
    const payload = await response.json() as ApiErrorPayload;
    return payload.error?.message ?? payload.message ?? "";
  } catch {
    return "";
  }
}

function isRetryableError(error: unknown) {
  return error instanceof ProviderApiError && [400, 401, 403, 404, 408, 409, 413, 429, 500, 502, 503, 504].includes(error.status);
}

export function needsVisionImageNormalization(image: string, limit = VISION_IMAGE_MAX_DATA_URL_CHARS) {
  return image.startsWith("data:image/") && image.length > limit;
}

async function normalizeVisionImage(image: string, compact = false, force = false) {
  const limit = compact ? COMPACT_VISION_IMAGE_MAX_DATA_URL_CHARS : VISION_IMAGE_MAX_DATA_URL_CHARS;
  if (!force && !needsVisionImageNormalization(image, limit)) return image;
  const source = await loadBrowserImage(image);
  const targetEdge = compact ? 1024 : 1600;
  const scale = Math.min(1, targetEdge / Math.max(source.naturalWidth, source.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(source.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(source.naturalHeight * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Your browser could not prepare a safe image payload for the AI provider.");
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  let workingCanvas = canvas;
  let quality = compact ? 0.78 : 0.86;
  let output = workingCanvas.toDataURL("image/jpeg", quality);
  while (output.length > limit && quality > 0.42) {
    quality -= 0.08;
    output = workingCanvas.toDataURL("image/jpeg", quality);
  }
  for (let pass = 0; output.length > limit && pass < 4; pass += 1) {
    const smaller = document.createElement("canvas");
    smaller.width = Math.max(1, Math.round(workingCanvas.width * 0.7));
    smaller.height = Math.max(1, Math.round(workingCanvas.height * 0.7));
    const smallerContext = smaller.getContext("2d");
    if (!smallerContext) throw new Error("Your browser could not compact this image for the AI provider.");
    smallerContext.imageSmoothingEnabled = true;
    smallerContext.imageSmoothingQuality = "high";
    smallerContext.drawImage(workingCanvas, 0, 0, smaller.width, smaller.height);
    workingCanvas = smaller;
    output = workingCanvas.toDataURL("image/jpeg", compact ? 0.68 : 0.74);
  }
  return output;
}

async function shrinkImageDataUrl(image: string, limit: number) {
  const source = await loadBrowserImage(image);
  let workingCanvas = document.createElement("canvas");
  const firstScale = Math.min(1, 720 / Math.max(source.naturalWidth, source.naturalHeight));
  workingCanvas.width = Math.max(1, Math.round(source.naturalWidth * firstScale));
  workingCanvas.height = Math.max(1, Math.round(source.naturalHeight * firstScale));
  const context = workingCanvas.getContext("2d");
  if (!context) throw new Error("Your browser could not compact this image for the Paid API.");
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(source, 0, 0, workingCanvas.width, workingCanvas.height);
  let output = workingCanvas.toDataURL("image/jpeg", 0.68);
  for (let pass = 0; output.length > limit && pass < 5; pass += 1) {
    const smaller = document.createElement("canvas");
    smaller.width = Math.max(1, Math.round(workingCanvas.width * 0.64));
    smaller.height = Math.max(1, Math.round(workingCanvas.height * 0.64));
    const smallerContext = smaller.getContext("2d");
    if (!smallerContext) throw new Error("Your browser could not compact this image for the Paid API.");
    smallerContext.imageSmoothingEnabled = true;
    smallerContext.imageSmoothingQuality = "high";
    smallerContext.drawImage(workingCanvas, 0, 0, smaller.width, smaller.height);
    workingCanvas = smaller;
    output = workingCanvas.toDataURL("image/jpeg", 0.62);
  }
  return output;
}

export async function preparePaidApiImage(image: string, retry = false) {
  const compact = await normalizeVisionImage(image, true, true);
  return retry ? shrinkImageDataUrl(compact, PAID_API_RETRY_IMAGE_MAX_DATA_URL_CHARS) : compact;
}

function loadBrowserImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("The selected image could not be prepared for the AI provider."));
    image.src = url;
  });
}

async function callGemini(key: string, model: string, prompt: string, image: string | null) {
  const parts = image ? [{ inline_data: { mime_type: image.match(/^data:([^;,]+)/)?.[1] ?? "image/jpeg", data: image.split(",")[1] } }, { text: prompt }] : [{ text: prompt }];
  const response = await fetch(`${providerModelConfig.Gemini.chatUrl}/models/${encodeURIComponent(model)}:generateContent?key=${key}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ parts }], generationConfig: { responseMimeType: prompt.includes("return valid JSON only") ? "application/json" : "text/plain" } }) });
  if (!response.ok) {
    const detail = await readErrorMessage(response);
    throw new ProviderApiError("Gemini", response.status, `Gemini request failed (${response.status})${detail ? `: ${detail}` : ""}`);
  }
  const payload = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  const output = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim() ?? "";
  if (!output) throw new ProviderApiError("Gemini", 502, "Gemini returned an empty response.");
  return output;
}

async function callOpenAiCompatible(provider: Exclude<FreeProvider, "Gemini">, key: string, model: string, prompt: string, image: string | null) {
  const content = image ? [{ type: "text", text: prompt }, { type: "image_url", image_url: { url: image } }] : prompt;
  const response = await fetch(providerModelConfig[provider].chatUrl, {
    method: "POST",
    headers: providerHeaders(provider, key),
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content }],
      max_tokens: 1200,
      temperature: 0.7,
      ...(prompt.includes("return valid JSON only") ? { response_format: { type: "json_object" } } : {}),
      ...(provider === "Groq" ? { max_completion_tokens: 1200, reasoning_effort: "none", reasoning_format: "hidden" } : {}),
    }),
  });
  if (!response.ok) {
    const detail = await readErrorMessage(response);
    throw new ProviderApiError(provider, response.status, `${provider} request failed (${response.status})${detail ? `: ${detail}` : "."}`);
  }
  const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  const output = payload.choices?.[0]?.message?.content?.trim() ?? "";
  if (!output) throw new ProviderApiError(provider, 502, `${provider} returned an empty response.`);
  return output;
}

async function generateWithProviderKey(provider: FreeProvider, key: string, prompt: string, image: string | null) {
  let model = await detectBestModel(provider, key, Boolean(image));
  const run = async (imagePayload: string | null) => {
    try {
      return provider === "Gemini" ? await callGemini(key, model.model, prompt, imagePayload) : await callOpenAiCompatible(provider, key, model.model, prompt, imagePayload);
    } catch (error) {
      if (!(error instanceof ProviderApiError) || error.status !== 404) throw error;
      model = await detectBestModel(provider, key, Boolean(imagePayload), true);
      return provider === "Gemini" ? await callGemini(key, model.model, prompt, imagePayload) : await callOpenAiCompatible(provider, key, model.model, prompt, imagePayload);
    }
  };
  const normalizedImage = image ? await normalizeVisionImage(image) : null;
  try {
    return { output: await run(normalizedImage), model: model.model };
  } catch (error) {
    if (!(error instanceof ProviderApiError) || error.status !== 413 || !image) throw error;
    const compactImage = await normalizeVisionImage(image, true, true);
    if (compactImage === normalizedImage) throw error;
    return { output: await run(compactImage), model: model.model };
  }
}

export async function generateWithFreeApi(primaryProvider: FreeProvider, prompt: string, image: string | null) {
  const providerOrder = [primaryProvider, ...freeProviders.filter((provider) => provider !== primaryProvider && (loadFreeKeys()[provider] ?? []).length)];
  const attempts: string[] = [];
  for (const provider of providerOrder) {
    const keys = getKeysInAttemptOrder(provider);
    if (!keys.length) continue;
    for (const key of keys) {
      try {
        const result = await generateWithProviderKey(provider, key, prompt, image);
        return result.output;
      } catch (error) {
        const message = error instanceof Error ? error.message : `${provider} could not complete the request.`;
        attempts.push(message);
        if (!isRetryableError(error)) throw error;
      }
    }
  }
  const fallbackAdvice = freeProviders.filter((provider) => provider !== primaryProvider && !(loadFreeKeys()[provider] ?? []).length).slice(0, 3).join(", ");
  throw new Error(`No configured provider could complete this request. ${attempts[attempts.length - 1] ?? ""} Add an image-capable key for ${fallbackAdvice || "another provider"} to enable automatic fallback.`.trim());
}

export function createFreePrompt(mode: "metadata" | "prompt", platform: string, style: string, settings: { titleRange: number[]; keywordRange: number[]; descriptionRange: number[]; singleWords: boolean; silhouette: boolean; customPrompt: string; prohibitedWords: string; prefix: string; suffix: string }) {
  if (mode === "prompt") return `Analyze this image and return one detailed AI image-generation prompt in the ${style} style. Mention subject, composition, lighting, material, color, mood, and important visual details. Return plain text only.`;
  return [
    `You are a ${platform} stock metadata specialist. Analyze this image and return valid JSON only.`,
    "Schema: {\"title\":string,\"keywords\":string[],\"description\":string,\"category\":string}.",
    `Title: ${settings.titleRange[0]}–${settings.titleRange[1]} words. Keywords: ${settings.keywordRange[0]}–${settings.keywordRange[1]}. Description: ${settings.descriptionRange[0]}–${settings.descriptionRange[1]} words.`,
    settings.singleWords ? "Prefer single-word keywords." : "Use the most precise search terms.",
    settings.silhouette ? "Treat the subject as a silhouette; do not invent unobservable details." : "",
    settings.customPrompt ? `Creator instruction: ${settings.customPrompt}` : "",
    settings.prohibitedWords ? `Avoid: ${settings.prohibitedWords}` : "",
    settings.prefix ? `Start the title with: ${settings.prefix}` : "",
    settings.suffix ? `End the title with: ${settings.suffix}` : "",
  ].filter(Boolean).join("\n");
}

export function normalizeMetadata(output: string) {
  const cleaned = output.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  const json = cleaned.match(/\{[\s\S]*\}/)?.[0] ?? cleaned;
  const parsed = JSON.parse(json) as { title?: string; keywords?: string[]; description?: string; category?: string };
  if (!parsed.title || !parsed.description || !Array.isArray(parsed.keywords)) throw new Error("The AI response was not complete metadata. Try another provider or image.");
  return { title: parsed.title, keywords: parsed.keywords.filter(Boolean), description: parsed.description, category: parsed.category ?? "" };
}
