import { describe, expect, it } from "vitest";
import { canShowAgain, nameForSearch, readSearch } from "./search";

describe("what the barista typed in Buscar tarjeta", () => {
  it("a card's short code, as the customer reads it out", () => {
    expect(readSearch("k7m 2qx")).toMatchObject({ kind: "code", code: { shortCode: "K7M2QX" } });
  });

  it("a 6-letter name that could be a code is a code and a name too", () => {
    expect(readSearch("Andrea")).toMatchObject({
      kind: "code",
      code: { shortCode: "ANDREA" },
      orName: ["andrea"],
    });
  });

  it("6 letters and numbers that could be a code are a code and another document too", () => {
    expect(readSearch("ab2345")).toEqual({
      kind: "code",
      code: { shortCode: "AB2345" },
      orDocument: "AB2345",
    });
  });

  it("6 letters only are a name, not a document: a document has numbers", () => {
    expect(readSearch("Andrea")).not.toHaveProperty("orDocument");
  });

  it("the long code a QR carries isn't a document: it's too long for one", () => {
    expect(readSearch("QRTAKEAWAY23456789ABCDEF")).not.toHaveProperty("orDocument");
  });

  it("a DNI, only numbers", () => {
    expect(readSearch("30123456")).toEqual({ kind: "document", number: "30123456" });
  });

  it("a DNI with its dots, as it's on the card", () => {
    expect(readSearch("30.123.456")).toEqual({ kind: "document", number: "30123456" });
  });

  it("a DNI with spaces or dashes", () => {
    for (const typed of ["30 123 456", "30-123-456", " 30 123.456 "]) {
      expect(readSearch(typed), typed).toEqual({ kind: "document", number: "30123456" });
    }
  });

  it("a DNI with DNI in front, as it's said or copied", () => {
    for (const typed of ["DNI 30123456", "dni: 30.123.456", "DNI30123456", "Dni. 30 123 456"]) {
      expect(readSearch(typed), typed).toEqual({ kind: "document", number: "30123456" });
    }
  });

  it("another document, with letters and numbers", () => {
    expect(readSearch("aab123456")).toEqual({ kind: "document", number: "AAB123456" });
  });

  it("a name, word by word, in lowercase and without accents", () => {
    expect(readSearch("  Marta  GARCÍA ")).toEqual({ kind: "name", words: ["marta", "garcia"] });
  });

  it("a name with an apostrophe or a hyphen", () => {
    expect(readSearch("D'Amico Pérez-Ríos")).toEqual({
      kind: "name",
      words: ["d'amico", "perez-rios"],
    });
  });

  it("empty is nothing to look up", () => {
    expect(readSearch("   ")).toEqual({ kind: "empty" });
  });

  it("a single letter is too short to look up a name", () => {
    expect(readSearch("m")).toEqual({ kind: "too-short" });
  });

  it("symbols aren't a name or a document", () => {
    expect(readSearch("%_*")).toEqual({ kind: "too-short" });
  });
});

describe("a name as it's stored to search it", () => {
  it("in lowercase, without accents and with single spaces", () => {
    expect(nameForSearch("  María José   Núñez ")).toBe("maria jose nunez");
  });
});

describe("what can show again in the field after searching", () => {
  it("a name or a card's code", () => {
    expect(canShowAgain("Marta García")).toBe(true);
    expect(canShowAgain("K7M2QX")).toBe(true);
  });

  it("never something with a document's digits in it, however it was typed", () => {
    for (const typed of ["30123456", "30 123 456", "Marta 30123456", "3a0b1c2d3e4f5g6"]) {
      expect(canShowAgain(typed), typed).toBe(false);
    }
  });
});
