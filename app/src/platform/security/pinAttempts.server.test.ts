import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { testDb } from "../../../test/db";
import { createStaffMember } from "../../../test/factories";
import { staff } from "../db/schema";
import {
  claimAttempt,
  clearAttempts,
  lockedUntil,
  recordFailedAttempt,
} from "./pinAttempts.server";

const AT_10 = new Date("2026-10-06T13:00:00Z");
const minutesLater = (minutes: number) => new Date(AT_10.getTime() + minutes * 60_000);

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

/** Wrong PINs in a row: each one takes its attempt first, like the sign-in does. */
async function fail(memberId: string, times: number, at = AT_10) {
  let until: Date | null = null;
  for (let i = 0; i < times; i++) {
    if (!(await claimAttempt(t.db, memberId, at))) throw new Error("No attempt left.");
    until = await recordFailedAttempt(t.db, memberId, at);
  }
  return until;
}

async function reload(memberId: string) {
  const [member] = await t.db.select().from(staff).where(eq(staff.id, memberId));
  return member;
}

describe("PIN attempts", () => {
  it("four failed attempts don't lock out", async () => {
    const ana = await createStaffMember(t.db);
    expect(await fail(ana.id, 4)).toBeNull();
  });

  it("the fifth failed attempt locks out for 15 minutes", async () => {
    const ana = await createStaffMember(t.db);
    expect(await fail(ana.id, 5)).toEqual(minutesLater(15));
  });

  it("during the lockout, the person is locked out", async () => {
    const ana = await createStaffMember(t.db);
    await fail(ana.id, 5);
    expect(lockedUntil(await reload(ana.id), minutesLater(14))).toEqual(minutesLater(15));
  });

  it("after 15 minutes, they can try again", async () => {
    const ana = await createStaffMember(t.db);
    await fail(ana.id, 5);
    expect(lockedUntil(await reload(ana.id), minutesLater(15))).toBeNull();
  });

  it("after the lockout they get 5 attempts again", async () => {
    const ana = await createStaffMember(t.db);
    await fail(ana.id, 5);
    expect(await fail(ana.id, 4, minutesLater(20))).toBeNull();
  });

  it("a success clears the failed attempts", async () => {
    const ana = await createStaffMember(t.db);
    await fail(ana.id, 4);
    await clearAttempts(t.db, ana.id);
    expect(await fail(ana.id, 1)).toBeNull();
  });

  it("a failed PIN doesn't count as a change to the person", async () => {
    const ana = await createStaffMember(t.db);
    await fail(ana.id, 5);
    expect((await reload(ana.id)).updatedAt).toBeNull();
  });

  it("the lockout only applies to that person", async () => {
    const ana = await createStaffMember(t.db);
    const juan = await createStaffMember(t.db);
    await fail(ana.id, 5);
    expect(lockedUntil(await reload(juan.id), AT_10)).toBeNull();
  });

  it("an attempt is taken before the PIN is checked", async () => {
    const ana = await createStaffMember(t.db);
    expect(await claimAttempt(t.db, ana.id, AT_10)).toBe(true);
    expect((await reload(ana.id)).failedAttempts).toBe(1);
  });

  it("of thirty attempts taken at once, only five go through", async () => {
    const ana = await createStaffMember(t.db);
    const taken = await Promise.all(
      Array.from({ length: 30 }, () => claimAttempt(t.db, ana.id, AT_10)),
    );
    expect(taken.filter(Boolean)).toHaveLength(5);
  });

  it("during the lockout, no attempt can be taken", async () => {
    const ana = await createStaffMember(t.db);
    await fail(ana.id, 5);
    expect(await claimAttempt(t.db, ana.id, minutesLater(14))).toBe(false);
  });

  it("after the lockout, an attempt can be taken again", async () => {
    const ana = await createStaffMember(t.db);
    await fail(ana.id, 5);
    expect(await claimAttempt(t.db, ana.id, minutesLater(15))).toBe(true);
  });

  it("taking an attempt doesn't count as a change to the person", async () => {
    const ana = await createStaffMember(t.db);
    await claimAttempt(t.db, ana.id, AT_10);
    expect((await reload(ana.id)).updatedAt).toBeNull();
  });
});
