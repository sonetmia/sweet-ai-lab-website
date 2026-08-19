import { describe, expect, it } from "vitest";

describe("payment contact configuration", () => {
  it("contains valid Bangladesh mobile contact values", () => {
    const bkash = process.env.VITE_BKASH_RECEIVER;
    const whatsapp = process.env.VITE_WHATSAPP_SUPPORT_NUMBER;

    expect(bkash).toMatch(/^01[0-9]{9}$/);
    expect(whatsapp).toMatch(/^8801[0-9]{9}$/);
  });
});
