import { buildStudioPrompt, parseMetadataResult, type StudioMode } from "../server/studioPrompt";

export const config = { runtime: "nodejs" };

type VercelRequestLike = { method?: string; headers: Record<string, string | string[] | undefined>; body?: unknown };
type VercelResponseLike = { status: (code: number) => VercelResponseLike; json: (payload: unknown) => void; setHeader: (name: string, value: string) => void };
type StudioRequest = { prompt?: string; image?: string | null; mode?: StudioMode; tier?: "standard" | "premium"; settings?: Record<string, unknown> };

const COST_BY_TIER = { standard: 2, premium: 3 } as const;

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

function parseBody(body: unknown) {
  if (typeof body !== "string") return (body ?? {}) as StudioRequest;
  try {
    return JSON.parse(body) as StudioRequest;
  } catch {
    return {} as StudioRequest;
  }
}

export default async function handler(req: VercelRequestLike, res: VercelResponseLike) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });
  try {
    const authorization = Array.isArray(req.headers.authorization) ? req.headers.authorization[0] : req.headers.authorization ?? "";
    const accessToken = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
    if (!accessToken) return res.status(401).json({ error: "not_authenticated" });

    const projectUrl = requiredEnv("VITE_SUPABASE_URL");
    const anonKey = requiredEnv("VITE_SUPABASE_ANON_KEY");
    const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
    const { createClient } = await import("@supabase/supabase-js");
    const admin = createClient(projectUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: userData, error: userError } = await admin.auth.getUser(accessToken);
    if (userError || !userData.user) return res.status(401).json({ error: "not_authenticated" });

    const body = parseBody(req.body);
    const mode = body.mode === "prompt" ? "prompt" : "metadata";
    const tier = body.tier === "premium" ? "premium" : "standard";
    const creditsRequired = COST_BY_TIER[tier];
    const settings = body.settings ?? {};
    const userClient = createClient(projectUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: `Bearer ${accessToken}` } } });
    const { data: creditData, error: creditError } = await userClient.rpc("get_my_credits");
    if (creditError || !creditData?.success) return res.status(403).json({ error: creditData?.error ?? "credit_service_unavailable" });
    if (creditData.expired) return res.status(403).json({ error: "credits_expired" });
    if ((creditData.credits ?? 0) < creditsRequired) return res.status(403).json({ error: "insufficient_credits" });

    const prompt = typeof body.prompt === "string" && body.prompt.trim() ? body.prompt.trim() : buildStudioPrompt({
      mode,
      platform: typeof settings.platform === "string" ? settings.platform : "General",
      promptStyle: typeof settings.promptStyle === "string" ? settings.promptStyle : undefined,
      titleMin: typeof settings.titleMin === "number" ? settings.titleMin : undefined,
      titleMax: typeof settings.titleMax === "number" ? settings.titleMax : undefined,
      keywordMin: typeof settings.keywordMin === "number" ? settings.keywordMin : undefined,
      keywordMax: typeof settings.keywordMax === "number" ? settings.keywordMax : undefined,
      descriptionMin: typeof settings.descriptionMin === "number" ? settings.descriptionMin : undefined,
      descriptionMax: typeof settings.descriptionMax === "number" ? settings.descriptionMax : undefined,
      singleWordKeywords: settings.singleWordKeywords === true,
      silhouetteMode: settings.silhouetteMode === true,
      customPrompt: typeof settings.customPrompt === "string" ? settings.customPrompt : undefined,
      prohibitedWords: typeof settings.prohibitedWords === "string" ? settings.prohibitedWords : undefined,
      titlePrefix: typeof settings.titlePrefix === "string" ? settings.titlePrefix : undefined,
      titleSuffix: typeof settings.titleSuffix === "string" ? settings.titleSuffix : undefined,
    });
    const content = body.image ? [{ type: "text", text: prompt }, { type: "image_url", image_url: { url: body.image } }] : prompt;
    const models = tier === "premium" ? ["meta-llama/llama-4-maverick", "meta-llama/llama-4-scout", "qwen/qwen3.6-27b"] : ["meta-llama/llama-4-scout", "qwen/qwen3.6-27b", "meta-llama/llama-4-maverick"];
    let output = "";
    let providerDetail = "";
    for (const model of models) {
      const upstream = await fetch("https://openrouter.ai/api/v1/chat/completions", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${requiredEnv("OPENROUTER_API_KEY")}`, "HTTP-Referer": `https://${Array.isArray(req.headers.host) ? req.headers.host[0] : req.headers.host ?? "sweet-ai-lab-website.vercel.app"}`, "X-Title": "Sweet AI Lab by SONET" }, body: JSON.stringify({ model, messages: [{ role: "user", content }], max_tokens: mode === "metadata" ? 1100 : 700 }) });
      if (!upstream.ok) {
        try {
          const payload = await upstream.json() as { error?: { message?: string }; message?: string };
          providerDetail = payload.error?.message ?? payload.message ?? providerDetail;
        } catch { providerDetail = providerDetail || `Provider returned ${upstream.status}.`; }
        continue;
      }
      const payload = await upstream.json() as { choices?: Array<{ message?: { content?: string } }> };
      output = payload.choices?.[0]?.message?.content?.trim() ?? "";
      if (output) break;
    }
    if (!output) return res.status(502).json({ error: "generation_provider_unavailable", detail: providerDetail || "All configured generation models were unavailable." });

    let result: ReturnType<typeof parseMetadataResult> | { prompt: string };
    try { result = mode === "metadata" ? parseMetadataResult(output) : { prompt: output }; }
    catch { return res.status(502).json({ error: "invalid_generation_format", detail: "The provider returned an incomplete result. No credits were deducted; please retry." }); }

    const { data: debitData, error: debitError } = await userClient.rpc("deduct_credit", { action_type: mode === "metadata" ? "paid_metadata_generation" : "paid_image_to_prompt", amount: creditsRequired });
    if (debitError || !debitData?.success) return res.status(409).json({ error: debitData?.error ?? "credit_debit_failed" });
    return res.status(200).json({ success: true, result, credits: debitData.credits, tier });
  } catch (error) {
    console.error("[Vercel Studio API]", error instanceof Error ? error.message : "unknown error");
    return res.status(500).json({ error: "studio_request_failed", detail: "The Paid API server could not complete this request. No credits were deducted." });
  }
}
