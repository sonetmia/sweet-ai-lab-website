import { describe, expect, it } from "vitest";

describe("administrator configuration", () => {
  it("contains a valid initial administrator email", () => {
    const adminEmail = process.env.ADMIN_EMAIL;
    expect(adminEmail).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
  });
});
