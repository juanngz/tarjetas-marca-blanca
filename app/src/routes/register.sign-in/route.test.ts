import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { testDb } from "../../../test/db";
import {
  createCustomer,
  createStaffMember,
  signedInCookie,
  staffCookie,
} from "../../../test/factories";
import { args, dataOf, get, post, redirectOf, statusOf } from "../../../test/routes";
import { action, loader } from "./route";

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

const PIN = "428613";

async function signIn(fields: { email?: string; pin?: string }) {
  await createStaffMember(t.db, { email: "ana@example.com", pin: PIN });
  return action(
    args(post("/register/sign-in", { email: "ana@example.com", pin: PIN, ...fields }), t.d1),
  );
}

describe("signing in at the register", () => {
  it("with the email and PIN, goes to the register", async () => {
    const response = await redirectOf(signIn({}));
    expect(response.headers.get("Location")).toBe("/register");
  });

  it("leaves the staff session on the phone", async () => {
    const response = await redirectOf(signIn({}));
    expect(response.headers.get("Set-Cookie")).toMatch(/^__Host-staff-session=[^;]+;/);
  });

  it("with a wrong PIN, stays with the message and the email typed", async () => {
    const result = await signIn({ pin: "111222" });
    expect(statusOf(result)).toBe(401);
    expect(dataOf(result)).toEqual({
      error: "Revisá tu email y tu PIN. Si ya probaste varias veces, esperá 15 minutos.",
      email: "ana@example.com",
    });
  });

  it("with a wrong PIN, no session is left on the phone", async () => {
    const result = await signIn({ pin: "111222" });
    expect(result).not.toBeInstanceOf(Response);
  });

  it("a PIN that isn't 6 digits is a mistake in the form", async () => {
    expect(statusOf(await signIn({ pin: "4286" }))).toBe(400);
  });

  it("locked out after 5 wrong PINs, answers the same as a wrong PIN, and the message says to wait", async () => {
    await createStaffMember(t.db, { email: "ana@example.com", pin: PIN });
    const wrong = () =>
      action(args(post("/register/sign-in", { email: "ana@example.com", pin: "111222" }), t.d1));
    for (let i = 0; i < 5; i++) await wrong();
    const result = await action(
      args(post("/register/sign-in", { email: "ana@example.com", pin: PIN }), t.d1),
    );
    expect(statusOf(result)).toBe(401);
    expect(dataOf<{ error: string }>(result).error).toBe(
      "Revisá tu email y tu PIN. Si ya probaste varias veces, esperá 15 minutos.",
    );
  });

  it("after 5 wrong PINs, an email nobody has answers the same as one that's locked out", async () => {
    await createStaffMember(t.db, { email: "ana@example.com", pin: PIN });
    const wrong = (email: string) =>
      action(args(post("/register/sign-in", { email, pin: "111222" }), t.d1));
    for (let i = 0; i < 5; i++) await wrong("ana@example.com");
    for (let i = 0; i < 5; i++) await wrong("nadie@example.com");
    const ana = await wrong("ana@example.com");
    const nobody = await wrong("nadie@example.com");
    expect(statusOf(nobody)).toBe(statusOf(ana));
    expect(dataOf<{ error: string }>(nobody).error).toBe(dataOf<{ error: string }>(ana).error);
  });

  it("a body that isn't a form is a 400, never a server error", async () => {
    const json = new Request("https://club.example.test/register/sign-in", {
      method: "POST",
      body: JSON.stringify({ email: "ana@example.com", pin: PIN }),
      headers: { "Content-Type": "application/json" },
    });
    const thrown = await action(args(json, t.d1)).catch((error: unknown) => error);
    expect(statusOf(thrown)).toBe(400);
  });

  it("the response never carries the PIN", async () => {
    const result = await signIn({ pin: "111222" });
    expect(JSON.stringify(dataOf(result))).not.toContain("111222");
  });
});

describe("the sign-in screen", () => {
  it("if they're already signed in, goes straight to the register", async () => {
    const ana = await createStaffMember(t.db);
    const response = await redirectOf(
      loader(args(get("/register/sign-in", await staffCookie(ana)), t.d1)),
    );
    expect(response.headers.get("Location")).toBe("/register");
  });

  it("without a session, shows the screen", async () => {
    await expect(loader(args(get("/register/sign-in"), t.d1))).resolves.toBeNull();
  });

  it("a customer's session doesn't count as the register's", async () => {
    const { customer } = await createCustomer(t.db);
    const cookie = await signedInCookie(customer.id);
    await expect(loader(args(get("/register/sign-in", cookie), t.d1))).resolves.toBeNull();
  });
});
