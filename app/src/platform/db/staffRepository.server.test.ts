import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { testDb } from "../../../test/db";
import { createStaffMember } from "../../../test/factories";
import { staffAudit } from "./schema";
import { d1StaffRepository } from "./staffRepository.server";

const AT_10 = new Date("2026-10-07T13:00:00Z");

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

describe("the register staff in D1", () => {
  it("finds a person by their email", async () => {
    const ana = await createStaffMember(t.db, { email: "ana@example.com", role: "manager" });
    expect(await d1StaffRepository(t.db).findByEmail("ana@example.com")).toEqual({
      id: ana.id,
      name: "Ana",
      role: "manager",
      pinHmac: ana.pinHmac,
      failedAttempts: 0,
      lockedUntil: null,
      deactivatedAt: null,
    });
  });

  it("with an email nobody has, finds no one", async () => {
    await createStaffMember(t.db, { email: "ana@example.com" });
    expect(await d1StaffRepository(t.db).findByEmail("otra@example.com")).toBeNull();
  });

  it("finds a person by their id", async () => {
    const ana = await createStaffMember(t.db);
    expect((await d1StaffRepository(t.db).findById(ana.id))?.name).toBe("Ana");
  });

  it("the fifth failed PIN in a row locks them out for 15 minutes", async () => {
    const ana = await createStaffMember(t.db);
    const staff = d1StaffRepository(t.db);
    for (let i = 0; i < 4; i++) {
      await staff.claimAttempt(ana.id, AT_10);
      await staff.recordFailedAttempt(ana.id, AT_10);
    }
    await staff.claimAttempt(ana.id, AT_10);
    expect(await staff.recordFailedAttempt(ana.id, AT_10)).toEqual(
      new Date(AT_10.getTime() + 15 * 60_000),
    );
  });

  it("no more than five attempts can be taken in a row", async () => {
    const ana = await createStaffMember(t.db);
    const staff = d1StaffRepository(t.db);
    for (let i = 0; i < 5; i++) expect(await staff.claimAttempt(ana.id, AT_10)).toBe(true);
    expect(await staff.claimAttempt(ana.id, AT_10)).toBe(false);
  });

  it("after a correct PIN, the failed attempts go back to zero", async () => {
    const ana = await createStaffMember(t.db);
    const staff = d1StaffRepository(t.db);
    await staff.claimAttempt(ana.id, AT_10);
    await staff.recordFailedAttempt(ana.id, AT_10);
    await staff.clearAttempts(ana.id);
    expect((await staff.findById(ana.id))?.failedAttempts).toBe(0);
  });
});

describe("managing the team in D1", () => {
  const AT = new Date("2026-10-08T15:00:00Z");
  const newBarista = (changes: Partial<{ id: string; email: string }> = {}) => ({
    id: crypto.randomUUID(),
    email: "juan@example.com",
    name: "Juan",
    role: "barista" as const,
    deactivatedAt: null,
    createdAt: AT,
    pinHmac: "test-pin-hmac",
    ...changes,
  });

  it("adds a barista and records who added them, together", async () => {
    const bruno = await createStaffMember(t.db, { name: "Bruno", role: "manager" });
    const staff = d1StaffRepository(t.db);
    const juan = newBarista();
    expect(await staff.add(juan, bruno.id)).toBe("added");
    expect(await staff.findProfile(juan.id)).toEqual({
      id: juan.id,
      name: "Juan",
      email: "juan@example.com",
      role: "barista",
      deactivatedAt: null,
      createdAt: AT,
    });
    expect(await staff.history(juan.id)).toEqual([{ change: "added", at: AT, byName: "Bruno" }]);
  });

  it("an email someone already has adds nobody and records nothing", async () => {
    const bruno = await createStaffMember(t.db, { role: "manager", email: "bruno@example.com" });
    const staff = d1StaffRepository(t.db);
    expect(await staff.add(newBarista({ email: "bruno@example.com" }), bruno.id)).toBe(
      "email-taken",
    );
    expect(await t.db.select().from(staffAudit)).toEqual([]);
  });

  it("lists everybody, active or not", async () => {
    await createStaffMember(t.db, { name: "Ana" });
    await createStaffMember(t.db, { name: "Dani", deactivatedAt: AT });
    expect((await d1StaffRepository(t.db).list()).map((m) => m.name).sort()).toEqual([
      "Ana",
      "Dani",
    ]);
  });

  it("changes a person and records each change, together", async () => {
    const bruno = await createStaffMember(t.db, { name: "Bruno", role: "manager" });
    const ana = await createStaffMember(t.db, { name: "Ana" });
    const staff = d1StaffRepository(t.db);
    await staff.change(
      ana.id,
      { name: "Ana María", email: "anam@example.com" },
      { by: bruno.id, at: AT, changes: ["name-changed", "email-changed"] },
    );
    expect(await staff.findProfile(ana.id)).toMatchObject({
      name: "Ana María",
      email: "anam@example.com",
    });
    expect((await staff.history(ana.id)).map((h) => h.change).sort()).toEqual([
      "email-changed",
      "name-changed",
    ]);
  });

  it("another person's email isn't taken, and nothing is saved", async () => {
    const bruno = await createStaffMember(t.db, { role: "manager", email: "bruno@example.com" });
    const ana = await createStaffMember(t.db, { email: "ana@example.com" });
    const staff = d1StaffRepository(t.db);
    expect(
      await staff.change(
        ana.id,
        { email: "bruno@example.com" },
        { by: bruno.id, at: AT, changes: ["email-changed"] },
      ),
    ).toBe("email-taken");
    expect((await staff.findProfile(ana.id))?.email).toBe("ana@example.com");
    expect(await staff.history(ana.id)).toEqual([]);
  });

  it("a new PIN also clears the failed attempts and the lockout", async () => {
    const bruno = await createStaffMember(t.db, { role: "manager" });
    const ana = await createStaffMember(t.db, { failedAttempts: 3, lockedUntil: AT });
    const staff = d1StaffRepository(t.db);
    await staff.change(
      ana.id,
      { pinHmac: "new-pin-hmac" },
      { by: bruno.id, at: AT, changes: ["pin-reset"] },
    );
    expect(await staff.findById(ana.id)).toMatchObject({
      pinHmac: "new-pin-hmac",
      failedAttempts: 0,
      lockedUntil: null,
    });
  });

  it("deactivating keeps the person, and their date", async () => {
    const bruno = await createStaffMember(t.db, { role: "manager" });
    const ana = await createStaffMember(t.db);
    const staff = d1StaffRepository(t.db);
    await staff.change(
      ana.id,
      { deactivatedAt: AT },
      { by: bruno.id, at: AT, changes: ["deactivated"] },
    );
    expect((await staff.findProfile(ana.id))?.deactivatedAt).toEqual(AT);
  });

  it("what the developers did with the script has no name", async () => {
    const ana = await createStaffMember(t.db);
    await t.db.insert(staffAudit).values({ staffId: ana.id, byId: null, change: "added", at: AT });
    expect(await d1StaffRepository(t.db).history(ana.id)).toEqual([
      { change: "added", at: AT, byName: null },
    ]);
  });
});
