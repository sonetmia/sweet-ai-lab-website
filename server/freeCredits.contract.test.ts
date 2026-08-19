import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { plans } from "../client/src/lib/catalog";

describe("initial Free credit contract", () => {
  it("shows a 500-credit Free plan in the public catalog", () => {
    expect(plans.free).toMatchObject({ credits: 500, price: "৳0" });
  });

  it("creates new Free profiles with 500 credits and preserves historic spent balances", () => {
    const schema = readFileSync(new URL("../supabase/schema.sql", import.meta.url), "utf8");
    expect(schema).toContain("credits integer not null default 500");
    expect(schema).toContain("'free'::public.plan_name,\n    500");
    expect(schema).toContain("not exists (select 1 from public.credit_ledger");
  });
});
