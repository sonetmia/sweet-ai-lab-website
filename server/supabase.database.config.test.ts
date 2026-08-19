import pg from "pg";
import { describe, expect, it } from "vitest";

describe("Supabase database configuration", () => {
  it("connects through the configured pooler and runs a lightweight query", async () => {
    const connectionString = process.env.SUPABASE_DATABASE_URL;

    expect(connectionString).toMatch(/^postgres(?:ql)?:\/\//);
    expect(connectionString).toContain("pooler.supabase.com");

    const client = new pg.Client({
      connectionString,
      ssl: { rejectUnauthorized: false },
    });

    try {
      await client.connect();
      const result = await client.query<{ ready: number }>("select 1 as ready");
      expect(result.rows[0]?.ready).toBe(1);
    } finally {
      await client.end().catch(() => undefined);
    }
  });
});
