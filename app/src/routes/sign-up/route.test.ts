import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { findInDb, testDb } from "../../../test/db";
import { createCustomer } from "../../../test/factories";
import {
  args,
  cookieOf,
  dataOf,
  post,
  redirectOf,
  statusOf,
  TEST_SECRETS,
} from "../../../test/routes";
import { normalizeShortCode } from "../../core/codes";
import { cards, customers } from "../../platform/db/schema";
import { hmacDocumentHasher } from "../../platform/security/documentHasher.server";
import { action } from "./route";

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

const MARTA = {
  step: "sign-up",
  type: "dni",
  number: "30123456",
  name: "Marta García",
  consent: "yes",
  "cf-turnstile-response": "valid-token",
};

const signUp = (changes: Record<string, string> = {}) =>
  action(args(post("/sign-up", { ...MARTA, ...changes }), t.d1));

const allCustomers = () => t.db.select().from(customers);

describe("confirm the document", () => {
  it("with the number confirmed, asks for the name", async () => {
    const result = await action(
      args(post("/sign-up", { step: "name", type: "dni", number: "30123456" }), t.d1),
    );
    expect(dataOf(result)).toMatchObject({
      step: "name",
      type: "dni",
      number: "30123456",
      siteKey: TEST_SECRETS.TURNSTILE_SITE_KEY,
    });
  });

  it("with a number tampered with in the form, starts over", async () => {
    const response = await redirectOf(
      action(args(post("/sign-up", { step: "name", type: "dni", number: "3012" }), t.d1)),
    );
    expect(response.headers.get("Location")).toBe("/");
  });
});

describe("sign up", () => {
  it("signs up the customer with their name", async () => {
    await signUp();
    expect((await allCustomers()).map((c) => c.name)).toEqual(["Marta García"]);
  });

  it("gives them their four cards", async () => {
    await signUp();
    const [marta] = await allCustomers();
    const theirs = await t.db.select().from(cards).where(eq(cards.customerId, marta.id));
    expect(theirs.map((c) => c.type).sort()).toEqual([
      "beans-half",
      "beans-kilo",
      "beans-quarter",
      "take-away",
    ]);
  });

  it("the cards are created when the customer signs up", async () => {
    await signUp();
    const [marta] = await allCustomers();
    const theirs = await t.db.select().from(cards).where(eq(cards.customerId, marta.id));
    expect(theirs.map((c) => c.createdAt)).toEqual([
      marta.createdAt,
      marta.createdAt,
      marta.createdAt,
      marta.createdAt,
    ]);
  });

  it("each card has a short code the barista can type", async () => {
    await signUp();
    const theirs = await t.db.select().from(cards);
    for (const card of theirs) {
      expect(normalizeShortCode(card.shortCode)).toBe(card.shortCode);
    }
  });

  it("stays signed in and goes straight to their cards", async () => {
    const response = await redirectOf(signUp());
    expect([response.headers.get("Location"), cookieOf(response)]).toEqual([
      "/cards",
      expect.stringMatching(/^__Host-session=.+/),
    ]);
  });

  it("the DNI is never stored as text in any column", async () => {
    await signUp();
    expect(await findInDb(t.d1, "30123456")).toEqual([]);
  });

  it("without ticking that they agree, doesn't sign them up", async () => {
    const result = await signUp({ consent: "" });
    expect([statusOf(result), (await allCustomers()).length]).toEqual([400, 0]);
  });

  it("without ticking that they agree, points out the checkbox and not the name", async () => {
    const result = await signUp({ consent: "" });
    expect(dataOf(result)).toMatchObject({ field: "consent" });
  });

  it("with a bad name, points out the name", async () => {
    const result = await signUp({ name: "Marta 2" });
    expect(dataOf(result)).toMatchObject({ field: "name" });
  });

  it("without a name, doesn't sign them up and asks for the name", async () => {
    const result = await signUp({ name: " " });
    expect(dataOf(result)).toMatchObject({ error: "Poné tu nombre." });
  });

  it("without a valid Turnstile, doesn't sign them up", async () => {
    const result = await signUp({ "cf-turnstile-response": "made-up" });
    expect([statusOf(result), (await allCustomers()).length]).toEqual([400, 0]);
  });

  it("with many attempts from the same connection, doesn't sign them up", async () => {
    const result = await action(
      args(
        post("/sign-up", MARTA),
        t.d1,
        {},
        {
          SIGN_IN_LIMIT: { limit: async () => ({ success: false }) },
        },
      ),
    );
    expect([statusOf(result), (await allCustomers()).length]).toEqual([429, 0]);
  });

  it("if the document was already signed up, gets into that account and doesn't create another", async () => {
    const dniHmac = await hmacDocumentHasher(TEST_SECRETS.DNI_HMAC_KEY).hmac("dni", "30123456");
    await createCustomer(t.db, { dniHmac });
    const response = await redirectOf(signUp());
    expect([response.headers.get("Location"), (await allCustomers()).length]).toEqual([
      "/cards",
      1,
    ]);
  });
});
