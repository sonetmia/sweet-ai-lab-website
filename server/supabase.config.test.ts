import { describe, expect, it } from "vitest";

describe("Supabase configuration", () => {
  it("accepts the configured public client credentials", async () => {
    const url = process.env.VITE_SUPABASE_URL;
    const anonKey = process.env.VITE_SUPABASE_ANON_KEY;

    expect(url).toMatch(/^https:\/\/.+\.supabase\.co$/);
    expect(anonKey).toBeTruthy();

    const response = await fetch(`${url}/auth/v1/health`, {
      headers: { apikey: anonKey! },
    });

    expect(response.ok).toBe(true);
  });
});
