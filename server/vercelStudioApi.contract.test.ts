import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Vercel Studio API entrypoint", () => {
  it("uses a direct JSON-returning dedicated serverless function for paid Studio calls", () => {
    const source = readFileSync(new URL("../api/studio.js", import.meta.url), "utf8");
    expect(source).toContain("export default async function handler");
    expect(source).toContain("/auth/v1/user");
    expect(source).toContain("/rest/v1/rpc/get_my_credits");
    expect(source).toContain('error: "studio_request_failed"');
    expect(source).toContain('process.env.HOSTED_PAID_API_ENABLED !== "true"');
    expect(source).toContain('error: "hosted_provider_unavailable"');
  });

  it("keeps simple direct API routes for health and admin bootstrap", () => {
    const health = readFileSync(new URL("../api/health.js", import.meta.url), "utf8");
    const admin = readFileSync(new URL("../api/admin/bootstrap.ts", import.meta.url), "utf8");
    expect(health).toContain('service: "sweet-ai-health"');
    expect(admin).toContain('export const config = { runtime: "nodejs" }');
    expect(admin).toContain('error: "admin_bootstrap_failed"');
  });
});
