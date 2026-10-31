import { describe, expect, it } from "vitest";
import { firstName, validateName } from "./customerName";

describe("validate the name", () => {
  it("accepts first and last name", () => {
    expect(validateName("Marta García")).toEqual({ ok: true, name: "Marta García" });
  });

  it("accepts accents, ñ, apostrophes and hyphens", () => {
    expect(validateName("María José D'Angelo-Núñez")).toEqual({
      ok: true,
      name: "María José D'Angelo-Núñez",
    });
  });

  it("removes extra spaces", () => {
    expect(validateName("  Marta   García ")).toEqual({ ok: true, name: "Marta García" });
  });

  it("empty, asks for the name", () => {
    expect(validateName("   ")).toEqual({ ok: false, message: "Poné tu nombre." });
  });

  it("rejects digits", () => {
    expect(validateName("Marta 2")).toEqual({
      ok: false,
      message: "Escribí tu nombre solo con letras.",
    });
  });

  it("rejects a name longer than 40 letters", () => {
    expect(validateName("M".repeat(41))).toEqual({
      ok: false,
      message: "Ese nombre es muy largo. Poné solo tu nombre y tu apellido.",
    });
  });
});

describe("the first name, to say it at the register", () => {
  it("is the first word of the name", () => {
    expect(firstName("Marta García")).toBe("Marta");
  });

  it("with a single name, it's that name", () => {
    expect(firstName("Marta")).toBe("Marta");
  });
});
