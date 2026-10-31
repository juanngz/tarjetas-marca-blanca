import { describe, expect, it } from "vitest";
import {
  fakeGate,
  fakeHasher,
  fakeSessions,
  fixedClock,
  inMemoryDb,
  memoryLogger,
  sequentialCodes,
} from "../../test/fakes";
import { exampleCafe } from "../cafes/example";
import type { CodeGenerator } from "./ports";
import { type SignUpInput, signUp } from "./signUp";

const MARTA: SignUpInput = {
  step: "sign-up",
  type: "dni",
  number: "30123456",
  name: "Marta García",
  consent: "yes",
  turnstileToken: "token",
};

function setup({ gate = fakeGate(), codes = sequentialCodes() as CodeGenerator } = {}) {
  const db = inMemoryDb();
  const logger = memoryLogger();
  const deps = {
    customers: db.customers,
    hasher: fakeHasher,
    gate,
    sessions: fakeSessions,
    codes,
    clock: fixedClock(),
    logger,
  };
  const run = (changes: Partial<SignUpInput> = {}) =>
    signUp({ ...MARTA, ...changes }, exampleCafe, deps);
  return { db, logger, run };
}

describe("confirm the document", () => {
  it("with the number confirmed, asks for the name", async () => {
    const { run } = setup();
    expect(await run({ step: "name", name: "" })).toMatchObject({
      result: "ask-name",
      error: null,
    });
  });

  it("with a number tampered with in the form, starts over", async () => {
    const { run } = setup();
    expect(await run({ number: "3012" })).toEqual({ result: "start-over" });
  });
});

describe("sign up", () => {
  it("signs up the customer with their name, stored by the hash", async () => {
    const { db, run } = setup();
    await run();
    expect([...db.stored.customers.values()]).toEqual([
      expect.objectContaining({ name: "Marta García", dniHmac: "hmac(dni:65432103)" }),
    ]);
  });

  it("gives them the café's cards", async () => {
    const { db, run } = setup();
    await run();
    expect([...db.stored.cards.values()].map((c) => c.type)).toEqual([
      "take-away",
      "beans-quarter",
      "beans-half",
      "beans-kilo",
    ]);
  });

  it("they stay signed in", async () => {
    const { run } = setup();
    expect(await run()).toMatchObject({ result: "signed-up", cookie: expect.any(String) });
  });

  it("logs the sign-up without personal data", async () => {
    const { logger, run } = setup();
    await run();
    expect(logger.events).toEqual([{ event: "customer-signed-up", data: { cards: 4 } }]);
  });

  it("without consent, points out the checkbox and doesn't sign them up", async () => {
    const { db, run } = setup();
    expect(await run({ consent: "" })).toMatchObject({ error: { reason: "no-consent" } });
    expect(db.stored.customers.size).toBe(0);
  });

  it("with a bad name, points out the name", async () => {
    const { run } = setup();
    expect(await run({ name: "Marta 2" })).toMatchObject({
      error: { reason: "invalid-name", message: "Escribí tu nombre solo con letras." },
    });
  });

  it("the name and consent are checked before the gate", async () => {
    const gate = fakeGate();
    const { run } = setup({ gate });
    await run({ name: " " });
    expect(gate.tokens).toEqual([]);
  });

  it("if the gate doesn't open, doesn't sign them up", async () => {
    const { db, run } = setup({ gate: fakeGate("too-many-attempts") });
    expect(await run()).toMatchObject({ error: { reason: "too-many-attempts" } });
    expect(db.stored.customers.size).toBe(0);
  });

  it("if the document was already signed up, gets into that account", async () => {
    const { db, run } = setup();
    await run();
    expect(await run()).toMatchObject({ result: "already-signed-up" });
    expect(db.stored.customers.size).toBe(1);
  });

  it("if a random code collides, tries with others", async () => {
    const codes = sequentialCodes();
    let first = true;
    const colliding: CodeGenerator = {
      qrCode: codes.qrCode,
      shortCode: () => {
        if (first) {
          first = false;
          return "SAME00";
        }
        return codes.shortCode();
      },
    };
    const { db, run } = setup({ codes: colliding });
    db.stored.cards.set("other", {
      id: "other",
      customerId: null,
      type: "take-away",
      qrCode: "q",
      shortCode: "SAME00",
      stamps: 0,
      rewards: 0,
      version: 0,
    });
    expect(await run()).toMatchObject({ result: "signed-up" });
  });
});
