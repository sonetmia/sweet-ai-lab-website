function json(response, status, payload) {
  response.status(status).json(payload);
}

function env(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

function accessToken(headers) {
  const value = headers.authorization || "";
  return value.startsWith("Bearer ") ? value.slice(7) : "";
}

function buildPrompt(mode, settings) {
  if (mode === "prompt") {
    return ["Analyze the supplied image and return one detailed AI image-generation prompt.", `Style: ${settings.promptStyle || "Original"}.`, "Mention subject, composition, lighting, materials, colors, and mood.", "Return plain text only."].join("\n");
  }
  const optional = [settings.silhouetteMode ? "Treat the subject as a silhouette." : "", settings.titlePrefix ? `Begin the title with: ${settings.titlePrefix}.` : "", settings.titleSuffix ? `End the title with: ${settings.titleSuffix}.` : "", settings.prohibitedWords ? `Avoid these words: ${settings.prohibitedWords}.` : "", settings.customPrompt ? `Extra instruction: ${settings.customPrompt}.` : ""].filter(Boolean);
  return [`You are a senior ${settings.platform || "General"} stock-metadata specialist. Analyze the supplied image and return valid JSON only.`, "Use exactly: {\"title\": string, \"keywords\": string[], \"description\": string, \"category\": string}.", `Title: ${settings.titleMin || 6}–${settings.titleMax || 12} words.`, `Keywords: ${settings.keywordMin || 35}–${settings.keywordMax || 40}.`, `Description: ${settings.descriptionMin || 12}–${settings.descriptionMax || 30} words.`, settings.singleWordKeywords ? "Prefer single-word keywords." : "Use clear search keywords.", ...optional].join("\n");
}

function parseMetadata(output) {
  const value = JSON.parse(output.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, ""));
  const title = typeof value.title === "string" ? value.title.trim() : "";
  const description = typeof value.description === "string" ? value.description.trim() : "";
  const category = typeof value.category === "string" ? value.category.trim() : "";
  const keywords = Array.isArray(value.keywords) ? value.keywords.filter((keyword) => typeof keyword === "string").map((keyword) => keyword.trim()).filter(Boolean) : [];
  if (!title || !description || !keywords.length) throw new Error("The AI response did not contain complete metadata.");
  return { title, description, keywords, category };
}

async function readJson(response) {
  try { return await response.json(); } catch { return {}; }
}

export default async function handler(request, response) {
  if (request.method !== "POST") return json(response, 405, { error: "method_not_allowed" });
  const token = accessToken(request.headers);
  if (!token) return json(response, 401, { error: "not_authenticated" });
  if (process.env.HOSTED_PAID_API_ENABLED !== "true") {
    return json(response, 503, {
      error: "hosted_provider_unavailable",
      detail: "The hosted Paid API is disabled because its provider account has no credits. Use Own-key API with your own provider key instead.",
    });
  }
  try {
    const supabaseUrl = env("VITE_SUPABASE_URL");
    const anonKey = env("VITE_SUPABASE_ANON_KEY");
    const headers = { apikey: anonKey, Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
    const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, { headers });
    if (!userResponse.ok) return json(response, 401, { error: "not_authenticated" });

    const body = typeof request.body === "string" ? JSON.parse(request.body) : (request.body || {});
    const mode = body.mode === "prompt" ? "prompt" : "metadata";
    const tier = body.tier === "premium" ? "premium" : "standard";
    const cost = tier === "premium" ? 3 : 2;
    const creditResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/get_my_credits`, { method: "POST", headers, body: "{}" });
    const credit = await readJson(creditResponse);
    if (!creditResponse.ok || !credit.success) return json(response, 403, { error: credit.error || "credit_service_unavailable" });
    if (credit.expired) return json(response, 403, { error: "credits_expired" });
    if ((credit.credits || 0) < cost) return json(response, 403, { error: "insufficient_credits" });

    const prompt = typeof body.prompt === "string" && body.prompt.trim() ? body.prompt.trim() : buildPrompt(mode, body.settings || {});
    const content = body.image ? [{ type: "text", text: prompt }, { type: "image_url", image_url: { url: body.image } }] : prompt;
    const models = tier === "premium" ? ["meta-llama/llama-4-maverick", "meta-llama/llama-4-scout", "qwen/qwen3.6-27b"] : ["meta-llama/llama-4-scout", "qwen/qwen3.6-27b", "meta-llama/llama-4-maverick"];
    let output = "";
    let detail = "";
    for (const model of models) {
      const upstream = await fetch("https://openrouter.ai/api/v1/chat/completions", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${env("OPENROUTER_API_KEY")}`, "HTTP-Referer": "https://sweet-ai-lab-website.vercel.app", "X-Title": "Sweet AI Lab by SONET" }, body: JSON.stringify({ model, messages: [{ role: "user", content }], max_tokens: mode === "metadata" ? 1100 : 700 }) });
      const data = await readJson(upstream);
      if (!upstream.ok) { detail = data?.error?.message || data?.message || detail; continue; }
      output = data?.choices?.[0]?.message?.content?.trim() || "";
      if (output) break;
    }
    if (!output) return json(response, 502, { error: "generation_provider_unavailable", detail: detail || "The AI provider is unavailable. No credits were deducted." });
    let result;
    try { result = mode === "metadata" ? parseMetadata(output) : { prompt: output }; }
    catch { return json(response, 502, { error: "invalid_generation_format", detail: "The AI provider returned an incomplete result. No credits were deducted." }); }

    const debitResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/deduct_credit`, { method: "POST", headers, body: JSON.stringify({ action_type: mode === "metadata" ? "paid_metadata_generation" : "paid_image_to_prompt", amount: cost }) });
    const debit = await readJson(debitResponse);
    if (!debitResponse.ok || !debit.success) return json(response, 409, { error: debit.error || "credit_debit_failed" });
    return json(response, 200, { success: true, result, credits: debit.credits, tier });
  } catch (error) {
    console.error("[Sweet AI Paid API]", error instanceof Error ? error.message : "unknown error");
    return json(response, 500, { error: "studio_request_failed", detail: "The Paid API server could not complete this request. No credits were deducted." });
  }
}
