import { describe, expect, it } from "vitest";
import { validatePin } from "./staffPin";

describe("validate the staff PIN", () => {
  it("accepts 6 digits", () => {
    expect(validatePin("482915")).toEqual({ ok: true });
  });

  it("rejects fewer than 6 digits", () => {
    expect(validatePin("48291")).toEqual({ ok: false, reason: "format" });
  });

  it("rejects letters", () => {
    expect(validatePin("48291a")).toEqual({ ok: false, reason: "format" });
  });

  it.each(["000000", "111111", "999999"])("rejects the repeated %s", (pin) => {
    expect(validatePin(pin)).toEqual({ ok: false, reason: "weak" });
  });

  it.each(["123456", "012345", "456789"])("rejects the sequence %s", (pin) => {
    expect(validatePin(pin)).toEqual({ ok: false, reason: "weak" });
  });

  it.each(["654321", "987654", "543210"])("rejects the reverse sequence %s", (pin) => {
    expect(validatePin(pin)).toEqual({ ok: false, reason: "weak" });
  });

  it.each(["121212", "123123"])("rejects the repeated pattern %s", (pin) => {
    expect(validatePin(pin)).toEqual({ ok: false, reason: "weak" });
  });
});
