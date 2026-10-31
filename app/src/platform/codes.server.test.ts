import { describe, expect, it } from "vitest";
import { normalizeShortCode, QR_CODE_LENGTH, SHORT_CODE_ALPHABET } from "../core/codes";
import { randomCodeGenerator } from "./codes.server";

const { shortCode: newShortCode, qrCode: newQrCode } = randomCodeGenerator;

describe("random codes", () => {
  it("the short code is one the barista can type", () => {
    const code = newShortCode();
    expect(normalizeShortCode(code)).toBe(code);
  });

  it("the QR code has the agreed length", () => {
    expect(newQrCode()).toHaveLength(QR_CODE_LENGTH);
  });

  it("the QR code only uses the codes' alphabet", () => {
    expect(newQrCode()).toMatch(new RegExp(`^[${SHORT_CODE_ALPHABET}]+$`));
  });

  it("QR codes don't repeat", () => {
    const codes = new Set(Array.from({ length: 10_000 }, newQrCode));
    expect(codes.size).toBe(10_000);
  });

  it("use every character in the alphabet", () => {
    const used = new Set(Array.from({ length: 2_000 }, newShortCode).join(""));
    expect(used.size).toBe(SHORT_CODE_ALPHABET.length);
  });
});
