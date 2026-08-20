import studioHandler from "./studio";

type RequestLike = { method?: string; url?: string; headers: Record<string, string | string[] | undefined>; body?: unknown };
type ResponseLike = { status: (code: number) => ResponseLike; json: (payload: unknown) => void; setHeader: (name: string, value: string) => void };

function bearerToken(headers: RequestLike["headers"]) {
  const authorization = Array.isArray(headers.authorization) ? headers.authorization[0] : headers.authorization ?? "";
  return authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
}

async function adminBootstrap(req: RequestLike, res: ResponseLike) {
  const token = bearerToken(req.headers);
  const projectUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (!token) return res.status(401).json({ error: "not_authenticated" });
  if (!projectUrl || !serviceRoleKey || !adminEmail) return res.status(500).json({ error: "admin_bootstrap_not_configured" });
  try {
    const { createClient } = await import("@supabase/supabase-js");
    const admin = createClient(projectUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await admin.auth.getUser(token);
    if (error || !data.user) return res.status(401).json({ error: "not_authenticated" });
    if (data.user.email?.toLowerCase() !== adminEmail) return res.status(200).json({ success: true, elevated: false });
    const { error: updateError } = await admin.from("profiles").update({ role: "admin" }).eq("id", data.user.id);
    if (updateError) return res.status(500).json({ error: "profile_role_update_failed" });
    return res.status(200).json({ success: true, elevated: true });
  } catch {
    return res.status(500).json({ error: "admin_bootstrap_failed" });
  }
}

export default async function handler(req: RequestLike, res: ResponseLike) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  const pathname = (req.url ?? "").split("?")[0];
  if (pathname.endsWith("/api/studio") || pathname.endsWith("/studio")) return studioHandler(req, res);
  if (pathname.endsWith("/api/admin/bootstrap") || pathname.endsWith("/admin/bootstrap")) return adminBootstrap(req, res);
  return res.status(404).json({ error: "api_route_not_found" });
}
