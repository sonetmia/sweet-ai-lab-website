export const freeProviders = ["Gemini", "Groq", "Mistral", "OpenAI", "OpenRouter"] as const;
export type FreeProvider = (typeof freeProviders)[number];
export const openRouterFreeVisionModel = "nvidia/nemotron-nano-12b-v2-vl:free";
export const groqVisionModel = "qwen/qwen3.6-27b";
export const groqTextFallbackModel = "openai/gpt-oss-120b";
type ApiKeyStore = Partial<Record<FreeProvider, string[]>>;

let sessionKeyStore: ApiKeyStore = {};
let rotationIndices: Partial<Record<FreeProvider, number>> = {};

export function loadFreeKeys(): ApiKeyStore {
  return sessionKeyStore;
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

export function removeFreeKey(provider: FreeProvider, key: string) {
  const store = loadFreeKeys();
  store[provider] = (store[provider] ?? []).filter((entry) => entry !== key);
  sessionKeyStore = store;
}

function nextKey(provider: FreeProvider) {
  const store = loadFreeKeys();
  const keys = store[provider] ?? [];
  if (!keys.length) throw new Error(`Add a ${provider} API key to use Free API mode.`);
  const index = (rotationIndices[provider] ?? 0) % keys.length;
  rotationIndices[provider] = (index + 1) % keys.length;
  return keys[index];
}

export function selectGroqModel(availableModels: readonly string[] | null, needsVision: boolean) {
  if (needsVision) {
    if (availableModels && !availableModels.includes(groqVisionModel)) {
      throw new Error("This Groq API key does not currently have an active vision model. Use Gemini or OpenRouter for image metadata and image-to-prompt, then retry Groq after vision access is restored.");
    }
    return groqVisionModel;
  }
  return availableModels?.includes(groqVisionModel) ? groqVisionModel : groqTextFallbackModel;
}

async function getGroqModelIds(key: string) {
  try {
    const response = await fetch("https://api.groq.com/openai/v1/models", { headers: { Authorization: `Bearer ${key}` } });
    if (!response.ok) return null;
    const payload = await response.json() as { data?: Array<{ id?: string }> };
    return payload.data?.map((model) => model.id).filter((id): id is string => Boolean(id)) ?? null;
  } catch {
    return null;
  }
}

export async function generateWithFreeApi(provider: FreeProvider, prompt: string, image: string | null) {
  const key = nextKey(provider);
  const content = image ? [{ type: "text", text: prompt }, { type: "image_url", image_url: { url: image } }] : prompt;

  if (provider === "Gemini") {
    const parts = image ? [{ inline_data: { mime_type: image.match(/^data:([^;,]+)/)?.[1] ?? "image/jpeg", data: image.split(",")[1] } }, { text: prompt }] : [{ text: prompt }];
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ parts }] }) });
    if (!response.ok) throw new Error(`Gemini request failed (${response.status}).`);
    const data = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  }

  const groqModel = provider === "Groq" ? selectGroqModel(await getGroqModelIds(key), Boolean(image)) : null;
  const config = provider === "Groq"
    ? { url: "https://api.groq.com/openai/v1/chat/completions", model: groqModel! }
    : provider === "Mistral"
      ? { url: "https://api.mistral.ai/v1/chat/completions", model: "mistral-small-latest" }
      : provider === "OpenAI"
        ? { url: "https://api.openai.com/v1/chat/completions", model: "gpt-4o-mini" }
        : { url: "https://openrouter.ai/api/v1/chat/completions", model: openRouterFreeVisionModel };
  const requestBody = (model: string) => ({
    model,
    messages: [{ role: "user", content }],
    ...(provider === "Groq" ? { max_completion_tokens: 1200, temperature: 0.7, reasoning_effort: "none", reasoning_format: "hidden", ...(prompt.includes("return valid JSON only") ? { response_format: { type: "json_object" } } : {}) } : { max_tokens: 1200 }),
  });
  const request = (model: string) => fetch(config.url, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}`, ...(provider === "OpenRouter" ? { "HTTP-Referer": window.location.origin, "X-Title": "Sweet AI Lab by SONET" } : {}) }, body: JSON.stringify(requestBody(model)) });
  let response = await request(config.model);
  if (provider === "Groq" && response.status === 404 && !image) response = await request(groqTextFallbackModel);
  if (!response.ok) {
    let detail = "";
    try {
      const errorPayload = await response.json() as { error?: { message?: string }; message?: string };
      detail = errorPayload.error?.message ?? errorPayload.message ?? "";
    } catch {
      // Preserve the status-only fallback when a provider does not return JSON.
    }
    const visionHint = provider === "Groq" && image && response.status === 404 ? " Groq's vision model became unavailable. Use Gemini or OpenRouter for image metadata and image-to-prompt, then retry Groq after vision access is restored." : "";
    throw new Error(`${provider} request failed (${response.status})${detail ? `: ${detail}` : "."}${visionHint}`);
  }
  const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  const output = data.choices?.[0]?.message?.content?.trim() ?? "";
  if (!output) throw new Error(`${provider} returned an empty response. Please retry or select another provider.`);
  return output;
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
