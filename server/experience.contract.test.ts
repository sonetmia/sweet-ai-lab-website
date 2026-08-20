import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("requested experience update contract", () => {
  it("shows the requested direct contact details and removes the public tagline", () => {
    const home = readFileSync(new URL("../client/src/pages/Home.tsx", import.meta.url), "utf8");
    const billing = readFileSync(new URL("../client/src/pages/Billing.tsx", import.meta.url), "utf8");
    expect(home).toContain("01797953059");
    expect(home).toContain("mdsonetmia.vercel.app");
    expect(home).not.toContain("AI-Powered Tools for Creators");
    expect(billing).toContain("bKash number");
    expect(billing).toContain("toWhatsAppId");
  });

  it("uses Google profile metadata and text-first Paid API parsing in Studio", () => {
    const studio = readFileSync(new URL("../client/src/pages/Studio.tsx", import.meta.url), "utf8");
    expect(studio).toContain("metadata.avatar_url");
    expect(studio).toContain("profileImage");
    expect(studio).toContain("await response.text()");
    expect(studio).toContain("Paid API server error");
  });
});
