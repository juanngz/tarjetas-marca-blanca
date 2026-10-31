import { describe, expect, it } from "vitest";
import { fakeGate, fakeHasher, fakeSessions, inMemoryDb } from "../../test/fakes";
import { signIn } from "./signIn";

async function setup({ gate = fakeGate(), signedUp = true } = {}) {
  const db = inMemoryDb();
  if (signedUp) {
    await db.customers.createWithCards(
      {
        id: "marta",
        name: "Marta García",
        createdAt: new Date(),
        dniHmac: await fakeHasher.hmac("dni", "30123456"),
      },
      [],
    );
  }
  const deps = { customers: db.customers, hasher: fakeHasher, gate, sessions: fakeSessions };
  const run = (document: string, type: string | null = "dni") =>
    signIn({ type, document, turnstileToken: "token" }, deps);
  return { run, gate };
}

describe("sign in with the document", () => {
  it("if they're already in the Club, they get their session", async () => {
    const { run } = await setup();
    expect(await run("30123456")).toEqual({ result: "signed-in", cookie: "session-of-marta" });
  });

  it("if they're new, asks to confirm the number", async () => {
    const { run } = await setup({ signedUp: false });
    expect(await run("30123456")).toEqual({ result: "new", type: "dni", number: "30123456" });
  });

  it("an unknown document type counts as a DNI", async () => {
    const { run } = await setup();
    expect(await run("30123456", "passport")).toMatchObject({ result: "signed-in" });
  });

  it("with another document, it's validated as another document", async () => {
    const { run } = await setup({ signedUp: false });
    expect(await run("ab123456", "other")).toEqual({
      result: "new",
      type: "other",
      number: "AB123456",
    });
  });

  it("a mistyped document doesn't get to the gate", async () => {
    const gate = fakeGate();
    const { run } = await setup({ gate });
    expect(await run("301234")).toMatchObject({ result: "error", reason: "invalid-document" });
    expect(gate.tokens).toEqual([]);
  });

  it("with many attempts, asks to wait", async () => {
    const { run } = await setup({ gate: fakeGate("too-many-attempts") });
    expect(await run("30123456")).toMatchObject({
      result: "error",
      reason: "too-many-attempts",
      message: "Probá de nuevo en unos minutos.",
    });
  });

  it("without Turnstile, doesn't get in", async () => {
    const { run } = await setup({ gate: fakeGate("no-turnstile") });
    expect(await run("30123456")).toMatchObject({ result: "error", reason: "no-turnstile" });
  });

  it("on an error, gives back what they typed to fix it", async () => {
    const { run } = await setup();
    expect(await run("301234")).toMatchObject({ type: "dni", text: "301234" });
  });
});
