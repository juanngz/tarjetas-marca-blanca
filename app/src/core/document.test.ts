import { describe, expect, it } from "vitest";
import {
  cleanDniWhileTyping,
  documentKey,
  documentTypeFrom,
  formatDni,
  validateDocument,
} from "./document";

describe("validate the DNI", () => {
  it("accepts 8 digits", () => {
    expect(validateDocument("dni", "30123456")).toEqual({ ok: true, number: "30123456" });
  });

  it("accepts 7 digits", () => {
    expect(validateDocument("dni", "4123456")).toEqual({ ok: true, number: "4123456" });
  });

  it("ignores spaces at the ends", () => {
    expect(validateDocument("dni", " 30123456 ")).toEqual({ ok: true, number: "30123456" });
  });

  it("empty, asks for the number", () => {
    expect(validateDocument("dni", "")).toEqual({
      ok: false,
      message: "Poné tu número de documento.",
    });
  });

  it("rejects too few digits", () => {
    expect(validateDocument("dni", "301234")).toEqual({
      ok: false,
      message: "Ese número tiene pocos dígitos. Revisalo y probá de nuevo.",
    });
  });

  it("rejects too many digits", () => {
    expect(validateDocument("dni", "301234567")).toEqual({
      ok: false,
      message: "Ese número tiene dígitos de más. Revisalo y probá de nuevo.",
    });
  });

  it("rejects dots", () => {
    expect(validateDocument("dni", "30.123.456")).toEqual({
      ok: false,
      message: "Escribilo sin puntos, solo los números.",
    });
  });

  it("rejects letters", () => {
    expect(validateDocument("dni", "30I23456")).toEqual({
      ok: false,
      message: "El DNI lleva solo números. Revisalo y probá de nuevo.",
    });
  });
});

describe("validate another document", () => {
  it("accepts letters and digits, uppercased", () => {
    expect(validateDocument("other", "ab1234567")).toEqual({ ok: true, number: "AB1234567" });
  });

  it("empty, asks for the number", () => {
    expect(validateDocument("other", " ")).toEqual({
      ok: false,
      message: "Poné tu número de documento.",
    });
  });

  it("rejects symbols", () => {
    expect(validateDocument("other", "AB-123/45")).toEqual({
      ok: false,
      message: "Poné solo las letras y los números del documento.",
    });
  });

  it("rejects fewer than 5 characters", () => {
    expect(validateDocument("other", "AB12")).toEqual({
      ok: false,
      message: "Ese número es muy corto. Revisalo y probá de nuevo.",
    });
  });

  it("rejects more than 20 characters", () => {
    expect(validateDocument("other", "A".repeat(21))).toEqual({
      ok: false,
      message: "Ese número es muy largo. Revisalo y probá de nuevo.",
    });
  });
});

describe("type the DNI", () => {
  it("lets only digits through", () => {
    expect(cleanDniWhileTyping("30a12b")).toBe("3012");
  });

  it("removes dots and spaces from a pasted number", () => {
    expect(cleanDniWhileTyping("30.123.456")).toBe("30123456");
    expect(cleanDniWhileTyping(" 30 123 456 ")).toBe("30123456");
  });

  it("doesn't go past 8 digits", () => {
    expect(cleanDniWhileTyping("301234567")).toBe("30123456");
  });
});

describe("document key", () => {
  it("a DNI and another document with the same number don't get mixed up", () => {
    expect(documentKey("dni", "30123456")).not.toBe(documentKey("other", "30123456"));
  });
});

describe("format the DNI", () => {
  it("with thousands dots", () => {
    expect(formatDni("30123456")).toBe("30.123.456");
  });

  it("with 7 digits", () => {
    expect(formatDni("4123456")).toBe("4.123.456");
  });
});

describe("the document type from the form", () => {
  it("other is another document", () => {
    expect(documentTypeFrom("other")).toBe("other");
  });

  it("anything else counts as a DNI", () => {
    expect([documentTypeFrom("dni"), documentTypeFrom("passport"), documentTypeFrom(null)]).toEqual(
      ["dni", "dni", "dni"],
    );
  });
});
