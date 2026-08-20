import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Vercel Studio API entrypoint", () => {
  it("uses a direct JSON-returning dedicated serverless function for paid Studio calls", () => {
    const source = readFileSync(new URL("../api/studio.ts", import.meta.url), "utf8");
    expect(source).toContain("export default async function handler");
    expect(source).toContain('export const config = { runtime: "nodejs" }');
    expect(source).toContain('res.setHeader("Content-Type", "application/json; charset=utf-8")');
    expect(source).toContain('error: "studio_request_failed"');
    expect(source).toContain('await import("@supabase/supabase-js")');
  });

  it("keeps simple direct API routes for health and admin bootstrap", () => {
    const health = readFileSync(new URL("../api/health.js", import.meta.url), "utf8");
    const admin = readFileSync(new URL("../api/admin/bootstrap.ts", import.meta.url), "utf8");
    expect(health).toContain('service: "sweet-ai-health"');
    expect(admin).toContain('export const config = { runtime: "nodejs" }');
    expect(admin).toContain('error: "admin_bootstrap_failed"');
  });
});
