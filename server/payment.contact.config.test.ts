import { describe, expect, it } from "vitest";

describe("payment contact configuration", () => {
  it("contains the configured bKash and WhatsApp contact values", () => {
    const bkash = process.env.VITE_BKASH_RECEIVER;
    const whatsapp = process.env.VITE_WHATSAPP_SUPPORT_NUMBER;

    expect(bkash).toBe("01797953059");
    expect(whatsapp).toBe("01797953059");
  });
});
