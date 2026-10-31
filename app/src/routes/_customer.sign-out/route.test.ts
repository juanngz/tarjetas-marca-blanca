import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { testDb } from "../../../test/db";
import { createCustomer, signedInCookie } from "../../../test/factories";
import { args, post, redirectOf } from "../../../test/routes";
import { action } from "./route";

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

async function signOut() {
  const { customer } = await createCustomer(t.db);
  const cookie = await signedInCookie(customer.id);
  const response = await redirectOf(action(args(post("/sign-out", {}, cookie), t.d1)));
  return { cookie, response };
}

describe("sign out", () => {
  it("goes back to the welcome screen", async () => {
    const { response } = await signOut();
    expect(response.headers.get("Location")).toBe("/");
  });

  it("asks the phone to delete the cookie", async () => {
    const { response } = await signOut();
    expect(response.headers.get("Set-Cookie")).toContain("Max-Age=0");
  });

  // The session is a signed cookie, with no table: signing out deletes it from the phone, but a copy
  // would keep working until it expires. See docs/implementacion/arquitectura.md, "Las sesiones".
  it("the phone is left without the session", async () => {
    const { response } = await signOut();
    expect(response.headers.get("Set-Cookie")).toMatch(/^__Host-session=;/);
  });
});
