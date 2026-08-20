export const config = { runtime: "nodejs" };

type RequestLike = { method?: string; headers: Record<string, string | string[] | undefined> };
type ResponseLike = { status: (code: number) => ResponseLike; json: (payload: unknown) => void; setHeader: (name: string, value: string) => void };

function tokenFrom(headers: RequestLike["headers"]) {
  const authorization = Array.isArray(headers.authorization) ? headers.authorization[0] : headers.authorization ?? "";
  return authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
}

export default async function handler(req: RequestLike, res: ResponseLike) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });
  const accessToken = tokenFrom(req.headers);
  const projectUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const configuredEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (!accessToken) return res.status(401).json({ error: "not_authenticated" });
  if (!projectUrl || !serviceRoleKey || !configuredEmail) return res.status(500).json({ error: "admin_bootstrap_not_configured" });
  try {
    const { createClient } = await import("@supabase/supabase-js");
    const admin = createClient(projectUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await admin.auth.getUser(accessToken);
    if (error || !data.user) return res.status(401).json({ error: "not_authenticated" });
    if (data.user.email?.toLowerCase() !== configuredEmail) return res.status(200).json({ success: true, elevated: false });
    const { error: updateError } = await admin.from("profiles").update({ role: "admin" }).eq("id", data.user.id);
    if (updateError) return res.status(500).json({ error: "profile_role_update_failed" });
    return res.status(200).json({ success: true, elevated: true });
  } catch {
    return res.status(500).json({ error: "admin_bootstrap_failed" });
  }
}
