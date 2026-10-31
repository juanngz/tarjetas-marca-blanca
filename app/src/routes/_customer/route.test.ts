import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { testDb } from "../../../test/db";
import { createCustomer, signedInCookie } from "../../../test/factories";
import { args, get, headersOf, redirectOf, refetches } from "../../../test/routes";
import { loader, shouldRevalidate } from "./route";

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

const TWO_DAYS_AGO = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);

describe("the customer screens", () => {
  it("bringing another card to the front doesn't check the session again", () => {
    expect(refetches(shouldRevalidate, "/cards", "/cards?front=beans-half")).toBe(false);
  });

  // The screen doesn't wait for it (web/instant.ts): each screen's loader checks the session itself, and the
  // layout renews it each time the app opens and each time the screen asks the server again.
  it("going to another screen doesn't check it again either", () => {
    expect(refetches(shouldRevalidate, "/cards", "/cards/take-away")).toBe(false);
    expect(refetches(shouldRevalidate, "/cards/take-away", "/cards?front=take-away")).toBe(false);
  });

  it("without a session, go back to the welcome screen", async () => {
    const response = await redirectOf(loader(args(get("/cards"), t.d1)));
    expect(response.headers.get("Location")).toBe("/");
  });

  it("with a session, let through", async () => {
    const { customer } = await createCustomer(t.db);
    const cookie = await signedInCookie(customer.id);
    await expect(loader(args(get("/cards", cookie), t.d1))).resolves.toBeNull();
  });

  it("renew the session when used: lasts 12 months again", async () => {
    const { customer } = await createCustomer(t.db);
    const cookie = await signedInCookie(customer.id, TWO_DAYS_AGO);
    const result = await loader(args(get("/cards", cookie), t.d1));
    expect(headersOf(result).get("Set-Cookie")).toContain(`Max-Age=${365 * 24 * 60 * 60}`);
  });

  it("if the session is from today, don't renew it", async () => {
    const { customer } = await createCustomer(t.db);
    const cookie = await signedInCookie(customer.id);
    const result = await loader(args(get("/cards", cookie), t.d1));
    expect(headersOf(result).get("Set-Cookie")).toBeNull();
  });
});
