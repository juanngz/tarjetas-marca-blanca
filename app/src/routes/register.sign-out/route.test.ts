import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { testDb } from "../../../test/db";
import { createStaffMember, staffCookie } from "../../../test/factories";
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
  const ana = await createStaffMember(t.db);
  const cookie = await staffCookie(ana);
  return redirectOf(action(args(post("/register/sign-out", {}, cookie), t.d1)));
}

// Without confirmation (decided on 07/10/2026): changing who's at the register has to be quick.
describe("signing out of the register", () => {
  it("goes back to the sign-in screen, for the next person", async () => {
    const response = await signOut();
    expect(response.headers.get("Location")).toBe("/register/sign-in");
  });

  it("deletes the staff session from the phone", async () => {
    const response = await signOut();
    expect(response.headers.get("Set-Cookie")).toMatch(/^__Host-staff-session=;.*Max-Age=0/);
  });
});
