import { describe, expect, it } from "vitest";
import { normalizeStaffEmail, validateStaffName } from "./staff";

describe("a staff member's email", () => {
  it("accepts a simple email", () => {
    expect(normalizeStaffEmail("ana@example.com")).toBe("ana@example.com");
  });

  it("is stored and looked up in lowercase", () => {
    expect(normalizeStaffEmail("Ana@Example.COM")).toBe("ana@example.com");
  });

  it("ignores the spaces around it", () => {
    expect(normalizeStaffEmail("  ana@example.com ")).toBe("ana@example.com");
  });

  it.each(["", "ana", "ana@", "ana@example", "ana example@example.com", "ana@exa'mple.com"])(
    "rejects %j",
    (text) => {
      expect(normalizeStaffEmail(text)).toBeNull();
    },
  );

  it("accepts what real emails have: dots, plus, hyphens and subdomains", () => {
    for (const email of [
      "ana.paula@example.com",
      "ana+caja@example.com",
      "ana_p-2@mail.example.com.ar",
      "a@b-c.io",
    ]) {
      expect(normalizeStaffEmail(email), email).toBe(email);
    }
  });

  it("takes up to 64 characters before the @ and 254 in all", () => {
    const local = "a".repeat(64);
    expect(normalizeStaffEmail(`${local}@example.com`)).toBe(`${local}@example.com`);
    const domain = `${"b".repeat(63)}.${"c".repeat(63)}.${"d".repeat(63)}.${"e".repeat(57)}.ar`;
    expect(normalizeStaffEmail(`a@${domain}`)).toBe(`a@${domain}`);
  });

  it.each([
    ["more than 64 before the @", `${"a".repeat(65)}@example.com`],
    ["more than 254 in all", `a@${Array.from({ length: 5 }, () => "b".repeat(60)).join(".")}.ar`],
    ["a part of the domain of more than 63", `ana@${"b".repeat(64)}.com`],
    ["two @", "ana@pa@example.com"],
    ["a dot first", ".ana@example.com"],
    ["a dot before the @", "ana.@example.com"],
    ["two dots in a row", "ana..paula@example.com"],
    ["two dots in the domain", "ana@example..com"],
    ["a dot right after the @", "ana@.example.com"],
    ["a dot at the end", "ana@example.com."],
    ["a hyphen starting a part of the domain", "ana@-example.com"],
    ["a hyphen ending a part of the domain", "ana@example-.com"],
    ["an ending with numbers", "ana@example.123"],
    ["an ending of one letter", "ana@example.c"],
    ["a space inside", "ana @example.com"],
    ["a line break", "ana@example.com\nbcc@example.com"],
    ["letters that look like ours", "аna@example.com"],
  ])("rejects an email with %s", (_, text) => {
    expect(normalizeStaffEmail(text)).toBeNull();
  });
});

describe("a staff member's name, as it shows at the register", () => {
  it("is kept without extra spaces", () => {
    expect(validateStaffName("  Juan   Cruz ")).toEqual({ ok: true, name: "Juan Cruz" });
  });

  it("accepts letters from any language", () => {
    expect(validateStaffName("Ñata Ávila")).toEqual({ ok: true, name: "Ñata Ávila" });
  });

  it.each(["", "J", "Juan2", "Juan@", "a".repeat(31)])("rejects %j", (text) => {
    expect(validateStaffName(text)).toEqual({ ok: false });
  });
});
