import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { testDb } from "../../../test/db";
import { createStaffMember } from "../../../test/factories";
import { staff } from "../db/schema";
import { d1StaffRepository } from "../db/staffRepository.server";
import {
  createSession,
  endSession,
  readCustomerSession,
  readStaffSession,
} from "./sessions.server";

const NOW = new Date("2026-10-06T13:00:00Z");
const DAY = 24 * 60 * 60 * 1000;
const later = (days: number) => new Date(NOW.getTime() + days * DAY);

const KEYS = {
  customerSessionKey: "test-key-customer-session",
  staffSessionKey: "test-key-staff-session",
};

const IN_PROD = "https://club.example.test/cards";
const MARTA = "martas-id";

/** A request like the phone sends, with the cookie it received. */
function requestWith(setCookie: string, url = IN_PROD) {
  return new Request(url, { headers: { cookie: setCookie.split(";")[0] } });
}
const maxAge = (setCookie: string) => Number(/Max-Age=(\d+)/.exec(setCookie)?.[1]);
const value = (setCookie: string) => setCookie.split(";")[0].split("=")[1];
/** What the cookie says, readable: it's signed, not encrypted. */
const decode = (encoded: string) => atob(encoded.replaceAll("-", "+").replaceAll("_", "/"));
const encode = (text: string) =>
  btoa(text).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");

function martasSession(url = IN_PROD) {
  return createSession(new Request(url), KEYS, { customerId: MARTA }, NOW);
}

describe("the cookie", () => {
  it("can't be read from the page", async () => {
    expect(await martasSession()).toContain("HttpOnly");
  });

  it("only travels over a secure connection", async () => {
    expect(await martasSession()).toMatch(/^__Host-.*; Secure/);
  });

  it("doesn't travel on requests from other sites that change something", async () => {
    expect(await martasSession()).toContain("SameSite=Lax");
  });

  it("locally, without https, works all the same", async () => {
    expect(await martasSession("http://localhost:5173/cards")).not.toMatch(/__Host-|Secure/);
  });
});

describe("the customer session", () => {
  it("lasts 12 months", async () => {
    expect(maxAge(await martasSession())).toBe(365 * 24 * 60 * 60);
  });

  it("with their cookie, it's that customer's", async () => {
    const session = await readCustomerSession(requestWith(await martasSession()), KEYS, NOW);
    expect(session?.customerId).toBe(MARTA);
  });

  it("without a cookie, there's no session", async () => {
    expect(await readCustomerSession(new Request(IN_PROD), KEYS, NOW)).toBeNull();
  });

  it("with a made-up cookie, there's no session", async () => {
    const madeUp = requestWith("__Host-session=made-up");
    expect(await readCustomerSession(madeUp, KEYS, NOW)).toBeNull();
  });

  it("if what the cookie says is changed, it's no good", async () => {
    const [payload, signature] = value(await martasSession()).split(".");
    const someoneElses = encode(decode(payload).replace(MARTA, "someone-elses-id"));
    const changed = requestWith(`__Host-session=${someoneElses}.${signature}`);
    expect(await readCustomerSession(changed, KEYS, NOW)).toBeNull();
  });

  it("signed with another key, it's no good", async () => {
    const cookie = await martasSession();
    const others = { ...KEYS, customerSessionKey: "other-key" };
    expect(await readCustomerSession(requestWith(cookie), others, NOW)).toBeNull();
  });

  it("expired, there's no session", async () => {
    const cookie = await martasSession();
    expect(await readCustomerSession(requestWith(cookie), KEYS, later(366))).toBeNull();
  });

  it("is renewed when used: lasts 12 months again", async () => {
    const cookie = await martasSession();
    const session = await readCustomerSession(requestWith(cookie), KEYS, later(200));
    const renewed = session?.cookie ?? "";
    expect(await readCustomerSession(requestWith(renewed), KEYS, later(500))).not.toBeNull();
  });

  it("isn't renewed more than once a day", async () => {
    const session = await readCustomerSession(requestWith(await martasSession()), KEYS, NOW);
    expect(session?.cookie).toBeNull();
  });
});

describe("the staff session", () => {
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

  async function anasSession() {
    const ana = await createStaffMember(t.db);
    const cookie = await createSession(new Request(IN_PROD), KEYS, { member: ana }, NOW);
    return { ana, cookie };
  }

  it("lasts 30 days", async () => {
    const { cookie } = await anasSession();
    expect(maxAge(cookie)).toBe(30 * 24 * 60 * 60);
  });

  it("with their cookie, it's that person", async () => {
    const { ana, cookie } = await anasSession();
    const session = await readStaffSession(requestWith(cookie), KEYS, NOW, d1StaffRepository(t.db));
    expect(session?.member).toEqual({ id: ana.id, name: "Ana", role: "barista" });
  });

  it("is renewed when used: lasts 30 days again", async () => {
    const { cookie } = await anasSession();
    const session = await readStaffSession(
      requestWith(cookie),
      KEYS,
      later(20),
      d1StaffRepository(t.db),
    );
    expect(maxAge(session?.cookie ?? "")).toBe(30 * 24 * 60 * 60);
  });

  it("with renew: false, it isn't renewed", async () => {
    const { cookie } = await anasSession();
    const session = await readStaffSession(
      requestWith(cookie),
      KEYS,
      later(20),
      d1StaffRepository(t.db),
      { renew: false },
    );
    expect(session?.cookie).toBeNull();
  });

  it("the cookie doesn't carry the PIN hash", async () => {
    const { ana, cookie } = await anasSession();
    const [payload] = value(cookie).split(".");
    expect(decode(payload)).not.toContain(ana.pinHmac);
  });

  it("a customer's doesn't work for the register", async () => {
    const martas = (await martasSession()).replace("__Host-session=", "__Host-staff-session=");
    expect(
      await readStaffSession(requestWith(martas), KEYS, NOW, d1StaffRepository(t.db)),
    ).toBeNull();
  });

  it("expired, there's no session", async () => {
    const { cookie } = await anasSession();
    expect(
      await readStaffSession(requestWith(cookie), KEYS, later(31), d1StaffRepository(t.db)),
    ).toBeNull();
  });

  it("if they're deactivated, their session stops working", async () => {
    const { ana, cookie } = await anasSession();
    await t.db.update(staff).set({ deactivatedAt: NOW }).where(eq(staff.id, ana.id));
    expect(
      await readStaffSession(requestWith(cookie), KEYS, NOW, d1StaffRepository(t.db)),
    ).toBeNull();
  });

  it("if their PIN changes, their session stops working", async () => {
    const { ana, cookie } = await anasSession();
    await t.db.update(staff).set({ pinHmac: "other-test-pin-hmac" }).where(eq(staff.id, ana.id));
    expect(
      await readStaffSession(requestWith(cookie), KEYS, NOW, d1StaffRepository(t.db)),
    ).toBeNull();
  });

  it("changing someone else's PIN doesn't sign them out", async () => {
    const { cookie } = await anasSession();
    const juan = await createStaffMember(t.db);
    await t.db.update(staff).set({ pinHmac: "other-test-pin-hmac" }).where(eq(staff.id, juan.id));
    expect(
      await readStaffSession(requestWith(cookie), KEYS, NOW, d1StaffRepository(t.db)),
    ).not.toBeNull();
  });

  it("if the person no longer exists, there's no session", async () => {
    const { ana, cookie } = await anasSession();
    await t.db.delete(staff).where(eq(staff.id, ana.id));
    expect(
      await readStaffSession(requestWith(cookie), KEYS, NOW, d1StaffRepository(t.db)),
    ).toBeNull();
  });
});

describe("sign out", () => {
  it("asks the phone to delete the cookie", () => {
    expect(endSession(new Request(IN_PROD), "customer")).toContain("Max-Age=0");
  });

  it("deletes the cookie of that kind of session", () => {
    expect(endSession(new Request(IN_PROD), "staff")).toMatch(/^__Host-staff-session=;/);
  });
});
