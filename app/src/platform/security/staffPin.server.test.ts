import { describe, expect, it } from "vitest";
import { validatePin } from "../../core/staffPin";
import { hmacPinIssuer, hmacPinVerifier, pinHmac, pinMatches, randomPin } from "./staffPin.server";

const KEY = "test-key-pin";

describe("staff PIN", () => {
  it("matches the correct PIN", async () => {
    const stored = await pinHmac(KEY, "ana", "482915");
    expect(await pinMatches(KEY, "ana", "482915", stored)).toBe(true);
  });

  it("doesn't match another PIN", async () => {
    const stored = await pinHmac(KEY, "ana", "482915");
    expect(await pinMatches(KEY, "ana", "482916", stored)).toBe(false);
  });

  it("one person's PIN doesn't work for another", async () => {
    const anas = await pinHmac(KEY, "ana", "482915");
    expect(await pinMatches(KEY, "juan", "482915", anas)).toBe(false);
  });

  it("two people with the same PIN don't have the same hash", async () => {
    expect(await pinHmac(KEY, "ana", "482915")).not.toBe(await pinHmac(KEY, "juan", "482915"));
  });

  it("without the right key it doesn't match", async () => {
    const stored = await pinHmac(KEY, "ana", "482915");
    expect(await pinMatches("other-key", "ana", "482915", stored)).toBe(false);
  });

  it("a broken stored hash doesn't match", async () => {
    expect(await pinMatches(KEY, "ana", "482915", "not-a-hash")).toBe(false);
  });
});

describe("the PIN verifier", () => {
  it("matches the PIN of that person, with the environment's key", async () => {
    const stored = await pinHmac(KEY, "ana", "482915");
    expect(await hmacPinVerifier(KEY).matches("ana", "482915", stored)).toBe(true);
  });

  it("doesn't match another PIN", async () => {
    const stored = await pinHmac(KEY, "ana", "482915");
    expect(await hmacPinVerifier(KEY).matches("ana", "482916", stored)).toBe(false);
  });
});

describe("a new PIN for the team", () => {
  it("is 6 digits and never an easy one", () => {
    for (let i = 0; i < 500; i++) expect(validatePin(randomPin())).toEqual({ ok: true });
  });

  it("isn't always the same", () => {
    expect(new Set(Array.from({ length: 20 }, randomPin)).size).toBeGreaterThan(1);
  });

  it("is hashed so that person signs in with it", async () => {
    const issuer = hmacPinIssuer(KEY);
    const pin = issuer.generate();
    const stored = await issuer.hash("ana", pin);
    expect(await pinMatches(KEY, "ana", pin, stored)).toBe(true);
  });
});
