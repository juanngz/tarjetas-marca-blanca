import { describe, expect, it } from "vitest";
import { normalizeShortCode, readCardCode, SHORT_CODE_ALPHABET } from "./codes";

describe("short code alphabet", () => {
  it("doesn't use characters that get mixed up when read out", () => {
    for (const confusing of ["0", "O", "1", "I", "L"]) {
      expect(SHORT_CODE_ALPHABET).not.toContain(confusing);
    }
  });
});

describe("normalize the code the barista types", () => {
  it("accepts lowercase", () => {
    expect(normalizeShortCode("k7m2qx")).toBe("K7M2QX");
  });

  it("ignores spaces", () => {
    expect(normalizeShortCode(" K7M 2QX ")).toBe("K7M2QX");
  });

  it("rejects a code that is too long or too short", () => {
    expect(normalizeShortCode("K7M2Q")).toBeNull();
  });

  it("rejects characters the code doesn't use", () => {
    expect(normalizeShortCode("K0M2QX")).toBeNull();
  });
});

describe("what the register typed or read", () => {
  const QR = "K7M2QXK7M2QXK7M2QXK7M2QX";

  it("a short code, typed as the customer reads it out", () => {
    expect(readCardCode("k7m 2qx")).toEqual({ shortCode: "K7M2QX" });
  });

  it("the long code the QR carries", () => {
    expect(readCardCode(QR)).toEqual({ qrCode: QR });
  });

  it("anything else isn't a Club card", () => {
    expect(readCardCode("https://example.com")).toBeNull();
  });

  it("a long code with characters the Club doesn't use isn't one", () => {
    expect(readCardCode(`${QR.slice(0, 23)}0`)).toBeNull();
  });

  it("empty isn't a code", () => {
    expect(readCardCode("  ")).toBeNull();
  });
});
