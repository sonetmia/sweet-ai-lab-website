import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { plans } from "../client/src/lib/catalog";

describe("Pro plan pricing contract", () => {
  it("keeps the public Pro price at ৳200 and the Max price at ৳500", () => {
    expect(plans.pro).toMatchObject({ credits: 6000, price: "৳200" });
    expect(plans.max).toMatchObject({ credits: 8000, price: "৳500" });
  });

  it("creates new Pro payment requests at ৳200 while allowing historic ৳400 records", () => {
    const schema = readFileSync(new URL("../supabase/schema.sql", import.meta.url), "utf8");
    expect(schema).toContain("amount_bdt in (200, 400, 500)");
    expect(schema).toContain("case when p_plan = 'pro' then 200 else 500 end");
  });
});
