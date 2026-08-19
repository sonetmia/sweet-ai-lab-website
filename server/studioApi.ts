import type { Express, Request, Response } from "express";
import { createClient } from "@supabase/supabase-js";
import { buildStudioPrompt, parseMetadataResult, type StudioMode } from "./studioPrompt";

type StudioRequest = {
  prompt?: string;
  image?: string | null;
  mode?: StudioMode;
  tier?: "standard" | "premium";
  settings?: Record<string, unknown>;
};

const COST_BY_TIER = { standard: 2, premium: 3 } as const;

function getRequiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

export function registerStudioRoutes(app: Express) {
  app.post("/api/studio", async (req: Request, res: Response) => {
    try {
      const authHeader = req.header("authorization") ?? "";
      const accessToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
      if (!accessToken) return res.status(401).json({ error: "not_authenticated" });

      const projectUrl = getRequiredEnv("VITE_SUPABASE_URL");
      const anonKey = getRequiredEnv("VITE_SUPABASE_ANON_KEY");
      const serviceRoleKey = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");
      const admin = createClient(projectUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
      const { data: userData, error: userError } = await admin.auth.getUser(accessToken);
      if (userError || !userData.user) return res.status(401).json({ error: "not_authenticated" });

      const body = req.body as StudioRequest;
      const mode = body.mode === "prompt" ? "prompt" : "metadata";
      const tier = body.tier === "premium" ? "premium" : "standard";
      const creditsRequired = COST_BY_TIER[tier];
      const settings = body.settings ?? {};
      const userClient = createClient(projectUrl, anonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { Authorization: `Bearer ${accessToken}` } },
      });

      const { data: creditData, error: creditError } = await userClient.rpc("get_my_credits");
      if (creditError || !creditData?.success) return res.status(403).json({ error: creditData?.error ?? "credit_service_unavailable" });
      if (creditData.expired) return res.status(403).json({ error: "credits_expired" });
      if ((creditData.credits ?? 0) < creditsRequired) return res.status(403).json({ error: "insufficient_credits" });

      const prompt = typeof body.prompt === "string" && body.prompt.trim()
        ? body.prompt.trim()
        : buildStudioPrompt({
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

      const content = body.image
        ? [{ type: "image_url", image_url: { url: body.image } }, { type: "text", text: prompt }]
        : prompt;
      const model = tier === "premium" ? "meta-llama/llama-4-maverick" : "meta-llama/llama-4-scout";
      const upstream = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getRequiredEnv("OPENROUTER_API_KEY")}`,
          "HTTP-Referer": req.protocol + "://" + req.get("host"),
          "X-Title": "Sweet AI Lab by SONET",
        },
        body: JSON.stringify({ model, messages: [{ role: "user", content }], max_tokens: mode === "metadata" ? 1100 : 700 }),
      });
      if (!upstream.ok) return res.status(502).json({ error: "generation_provider_unavailable" });

      const responseData = await upstream.json() as { choices?: Array<{ message?: { content?: string } }> };
      const output = responseData.choices?.[0]?.message?.content?.trim() ?? "";
      if (!output) return res.status(502).json({ error: "empty_generation" });

      const { data: debitData, error: debitError } = await userClient.rpc("deduct_credit", { action_type: mode === "metadata" ? "paid_metadata_generation" : "paid_image_to_prompt", amount: creditsRequired });
      if (debitError || !debitData?.success) return res.status(409).json({ error: debitData?.error ?? "credit_debit_failed" });

      const result = mode === "metadata" ? parseMetadataResult(output) : { prompt: output };
      return res.json({ success: true, result, credits: debitData.credits, tier });
    } catch (error) {
      console.error("[Studio API]", error instanceof Error ? error.message : "unknown error");
      return res.status(500).json({ error: "studio_request_failed" });
    }
  });
}
