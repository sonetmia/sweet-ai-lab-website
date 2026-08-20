import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { plans } from "../client/src/lib/catalog";

describe("initial Free credit contract", () => {
  it("shows the requested 200-credit Free plan in the public catalog", () => {
    expect(plans.free).toMatchObject({ credits: 200, price: "৳0" });
  });

  it("creates new Free profiles with the requested 200 credits without changing existing balances", () => {
    const schema = readFileSync(new URL("../supabase/schema.sql", import.meta.url), "utf8");
    expect(schema).toContain("credits integer not null default 200");
    expect(schema).toContain("'free'::public.plan_name,\n    200");
    expect(schema).not.toContain("set credits = 200");
  });
});
