import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Vercel Studio API entrypoint", () => {
  it("uses a direct JSON-returning dedicated serverless function for paid Studio calls", () => {
    const source = readFileSync(new URL("../api/studio.ts", import.meta.url), "utf8");
    expect(source).toContain("export default async function handler");
    expect(source).toContain('res.setHeader("Content-Type", "application/json; charset=utf-8")');
    expect(source).toContain('error: "studio_request_failed"');
  });
});
