import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { testDb } from "../../../test/db";
import { args, dataOf, post, redirectOf, statusOf } from "../../../test/routes";
import { teamOnD1 } from "../../../test/team-routes";
import { staff, staffAudit } from "../../platform/db/schema";
import { action as signIn } from "../register.sign-in/route";
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

interface Added {
  kind: "added";
  name: string;
  email: string;
  pin: string;
}

const add = (fields: Record<string, string>, cookie?: string) =>
  action(args(post("/register/team/new", fields, cookie), t.d1));

describe("Agregar barista", () => {
  it("shows the PIN the app made up, once", async () => {
    const { asManager } = await teamOnD1(t);
    const added = dataOf<Added>(await add({ email: "Juan@Example.com", name: "Juan" }, asManager));
    expect(added).toMatchObject({ kind: "added", name: "Juan", email: "juan@example.com" });
    expect(added.pin).toMatch(/^\d{6}$/);
  });

  it("the new barista signs in with that PIN", async () => {
    const { asManager } = await teamOnD1(t);
    const { pin } = dataOf<Added>(
      await add({ email: "juan@example.com", name: "Juan" }, asManager),
    );
    const response = await redirectOf(
      signIn(args(post("/register/sign-in", { email: "juan@example.com", pin }), t.d1)),
    );
    expect(response.headers.get("Location")).toBe("/register");
  });

  it("is always a barista, whatever the form says", async () => {
    const { asManager } = await teamOnD1(t);
    await add({ email: "juan@example.com", name: "Juan", role: "manager" }, asManager);
    const rows = await t.db.select({ email: staff.email, role: staff.role }).from(staff);
    expect(rows.find((r) => r.email === "juan@example.com")?.role).toBe("barista");
  });

  it("the PIN isn't stored as is, and it's recorded who added them", async () => {
    const { bruno, asManager } = await teamOnD1(t);
    const { pin } = dataOf<Added>(
      await add({ email: "juan@example.com", name: "Juan" }, asManager),
    );
    const rows = await t.db.select().from(staff);
    expect(JSON.stringify(rows)).not.toContain(`"${pin}"`);
    expect(
      await t.db.select({ byId: staffAudit.byId, change: staffAudit.change }).from(staffAudit),
    ).toEqual([{ byId: bruno.id, change: "added" }]);
  });

  it("a barista can't add anyone, even sending the form by hand", async () => {
    const { asBarista } = await teamOnD1(t);
    let thrown: unknown;
    try {
      await add({ email: "juan@example.com", name: "Juan" }, asBarista);
    } catch (error) {
      thrown = error;
    }
    expect(statusOf(thrown)).toBe(403);
    expect(await t.db.select().from(staff)).toHaveLength(2);
  });

  it("an email someone already has says so and adds nobody", async () => {
    const { asManager } = await teamOnD1(t);
    const result = await add({ email: "ana@example.com", name: "Otra Ana" }, asManager);
    expect(statusOf(result)).toBe(400);
    expect(dataOf(result)).toMatchObject({
      field: "email",
      error: "Ya hay alguien del equipo con ese email.",
    });
  });
});
