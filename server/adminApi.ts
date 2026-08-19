import type { Express, Request, Response } from "express";
import { createClient } from "@supabase/supabase-js";

export function registerAdminRoutes(app: Express) {
  app.post("/api/admin/bootstrap", async (req: Request, res: Response) => {
    try {
      const authHeader = req.header("authorization") ?? "";
      const accessToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
      if (!accessToken) return res.status(401).json({ error: "not_authenticated" });
      const projectUrl = process.env.VITE_SUPABASE_URL;
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      const configuredEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
      if (!projectUrl || !serviceRoleKey || !configuredEmail) return res.status(500).json({ error: "admin_bootstrap_not_configured" });

      const admin = createClient(projectUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
      const { data: userData, error: userError } = await admin.auth.getUser(accessToken);
      if (userError || !userData.user) return res.status(401).json({ error: "not_authenticated" });
      if (userData.user.email?.toLowerCase() !== configuredEmail) return res.json({ success: true, elevated: false });

      const { error: updateError } = await admin.from("profiles").update({ role: "admin" }).eq("id", userData.user.id);
      if (updateError) return res.status(500).json({ error: "profile_role_update_failed" });
      return res.json({ success: true, elevated: true });
    } catch (error) {
      console.error("[Admin bootstrap]", error instanceof Error ? error.message : "unknown error");
      return res.status(500).json({ error: "admin_bootstrap_failed" });
    }
  });
}
