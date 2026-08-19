import { describe, expect, it } from "vitest";

describe("Supabase server configuration", () => {
  it("accepts the configured administrator key and database URL", async () => {
    const projectUrl = process.env.VITE_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const databaseUrl = process.env.SUPABASE_DATABASE_URL;

    expect(projectUrl).toMatch(/^https:\/\/.+\.supabase\.co$/);
    expect(serviceRoleKey).toBeTruthy();
    expect(databaseUrl).toMatch(/^postgres(?:ql)?:\/\//);

    const response = await fetch(`${projectUrl}/rest/v1/`, {
      headers: { apikey: serviceRoleKey!, Authorization: `Bearer ${serviceRoleKey}` },
    });

    expect(response.ok).toBe(true);
  });
});
