import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { findInDb, testDb } from "../../../test/db";
import { createCustomer, signedInCookie } from "../../../test/factories";
import {
  args,
  cookieOf,
  dataOf,
  get,
  post,
  redirectOf,
  statusOf,
  TEST_SECRETS,
} from "../../../test/routes";
import { customers } from "../../platform/db/schema";
import { hmacDocumentHasher } from "../../platform/security/documentHasher.server";
import { action, loader } from "./route";

vi.mock("../../platform/security/turnstile.server", () => ({
  turnstileValid: async (token: string | null | undefined) => token === "valid-token",
}));

let t: Awaited<ReturnType<typeof testDb>>;
beforeAll(async () => {
  t = await testDb();
});
beforeEach(async () => {
  await t.clear();
});
afterAll(async () => {
  await t.close();
});

async function signUpMarta() {
  const dniHmac = await hmacDocumentHasher(TEST_SECRETS.DNI_HMAC_KEY).hmac("dni", "30123456");
  return createCustomer(t.db, { dniHmac });
}

const signInWith = (document: string, changes: Record<string, string> = {}) =>
  action(
    args(
      post("/", {
        type: "dni",
        document,
        "cf-turnstile-response": "valid-token",
        ...changes,
      }),
      t.d1,
    ),
  );

describe("the welcome screen", () => {
  it("shows the document field with the Turnstile key", async () => {
    const data = dataOf(await loader(args(get("/"), t.d1)));
    expect(data).toMatchObject({ type: "dni", siteKey: TEST_SECRETS.TURNSTILE_SITE_KEY });
  });

  // The fan has room for three, like the paper cards on the counter (14/10/2026: the 1 kg one, the fourth,
  // covered the others). It's only to look at: every card is in the wallet.
  it("fans out the first three cards, the ones from the paper", async () => {
    const data = dataOf<{ cards: { type: string }[] }>(await loader(args(get("/"), t.d1)));
    expect(data.cards.map((card) => card.type)).toEqual([
      "take-away",
      "beans-quarter",
      "beans-half",
    ]);
  });

  it("without an Argentine DNI, asks for another document", async () => {
    const data = dataOf(await loader(args(get("/?document=other"), t.d1)));
    expect(data).toMatchObject({ type: "other" });
  });

  it("if they already have a session, goes straight to their cards", async () => {
    const { customer } = await signUpMarta();
    const cookie = await signedInCookie(customer.id);
    const response = await redirectOf(loader(args(get("/", cookie), t.d1)));
    expect(response.headers.get("Location")).toBe("/cards");
  });
});

describe("sign in with the document", () => {
  it("if they're already in the Club, they're in and go to their cards", async () => {
    await signUpMarta();
    const response = await redirectOf(signInWith("30123456"));
    expect(response.headers.get("Location")).toBe("/cards");
  });

  it("if they're already in the Club, they stay signed in", async () => {
    await signUpMarta();
    const response = await redirectOf(signInWith("30123456"));
    expect(cookieOf(response)).toMatch(/^__Host-session=.+/);
  });

  it("if they're new, asks them to confirm the number", async () => {
    expect(dataOf(await signInWith("30123456"))).toEqual({
      step: "confirm",
      type: "dni",
      number: "30123456",
    });
  });

  it("if they're new, doesn't sign them up yet", async () => {
    await signInWith("30123456");
    expect(await t.db.select().from(customers)).toHaveLength(0);
  });

  it("with a mistyped DNI, explains what's wrong in the café's voice", async () => {
    const result = await signInWith("301234");
    expect(dataOf(result)).toMatchObject({
      error: "Ese número tiene pocos dígitos. Revisalo y probá de nuevo.",
    });
  });

  it("with a mistyped DNI, doesn't get in", async () => {
    await signUpMarta();
    expect(statusOf(await signInWith("301234"))).toBe(400);
  });

  it("without a valid Turnstile, doesn't get in", async () => {
    await signUpMarta();
    const result = await signInWith("30123456", { "cf-turnstile-response": "made-up" });
    expect(statusOf(result)).toBe(400);
  });

  it("with many attempts from the same connection, asks to wait", async () => {
    const result = await action(
      args(
        post("/", {
          type: "dni",
          document: "30123456",
          "cf-turnstile-response": "valid-token",
        }),
        t.d1,
        {},
        { SIGN_IN_LIMIT: { limit: async () => ({ success: false }) } },
      ),
    );
    expect(dataOf(result)).toMatchObject({ error: "Probá de nuevo en unos minutos." });
  });

  it("with another document, also gets in", async () => {
    const dniHmac = await hmacDocumentHasher(TEST_SECRETS.DNI_HMAC_KEY).hmac("other", "AB123456");
    await createCustomer(t.db, { dniHmac });
    const response = await redirectOf(signInWith("ab123456", { type: "other" }));
    expect(response.headers.get("Location")).toBe("/cards");
  });

  it("the number is never stored in the database", async () => {
    await signInWith("30123456");
    expect(await findInDb(t.d1, "30123456")).toEqual([]);
  });
});
