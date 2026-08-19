import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("administrator plan activation schema contract", () => {
  it("defines the secured manual activation RPC with the exact Pro and Max credit bundles", () => {
    const schema = fs.readFileSync(path.resolve(import.meta.dirname, "../supabase/schema.sql"), "utf8");
    expect(schema).toContain("function public.admin_activate_plan");
    expect(schema).toContain("p_plan not in ('pro', 'max')");
    expect(schema).toContain("case when p_plan = 'pro' then 6000 else 8000 end");
    expect(schema).toContain("grant execute on function public.admin_activate_plan");
  });
});
