import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { testDb } from "../../../test/db";
import {
  createCustomer,
  createStaffMember,
  signedInCookie,
  staffCookie,
} from "../../../test/factories";
import { args, dataOf, get, headersOf, redirectOf } from "../../../test/routes";
import { staff } from "../../platform/db/schema";
import { loader } from "./route";

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

async function goesToSignIn(cookie?: string) {
  const response = await redirectOf(loader(args(get("/register", cookie), t.d1)));
  return response.headers.get("Location") === "/register/sign-in";
}

describe("the register screens", () => {
  it("without a session, ask to sign in", async () => {
    expect(await goesToSignIn()).toBe(true);
  });

  it("a customer's session doesn't open the register", async () => {
    const { customer } = await createCustomer(t.db);
    expect(await goesToSignIn(await signedInCookie(customer.id))).toBe(true);
  });

  it("someone who no longer works there is out, even with their session", async () => {
    const ana = await createStaffMember(t.db);
    const cookie = await staffCookie(ana);
    await t.db.update(staff).set({ deactivatedAt: new Date() }).where(eq(staff.id, ana.id));
    expect(await goesToSignIn(cookie)).toBe(true);
  });

  it("with a session, say who's at the register: their name and role", async () => {
    const ana = await createStaffMember(t.db, { role: "manager" });
    const result = await loader(args(get("/register", await staffCookie(ana)), t.d1));
    expect(dataOf(result)).toEqual({ member: { name: "Ana", role: "manager" } });
  });

  it("never send the PIN hash or the email to the phone", async () => {
    const ana = await createStaffMember(t.db);
    const result = await loader(args(get("/register", await staffCookie(ana)), t.d1));
    const sent = JSON.stringify(dataOf(result));
    expect(sent).not.toContain(ana.pinHmac);
    expect(sent).not.toContain(ana.email);
  });

  it("renew the session when used: lasts 30 days again", async () => {
    const ana = await createStaffMember(t.db);
    const cookie = await staffCookie(ana, TWO_DAYS_AGO);
    const result = await loader(args(get("/register", cookie), t.d1));
    expect(headersOf(result).get("Set-Cookie")).toContain(`Max-Age=${30 * 24 * 60 * 60}`);
  });
});
