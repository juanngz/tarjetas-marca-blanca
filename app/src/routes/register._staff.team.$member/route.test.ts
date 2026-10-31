import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { testDb } from "../../../test/db";
import { createStaffMember } from "../../../test/factories";
import { args, dataOf, get, post, redirectOf, statusOf } from "../../../test/routes";
import { ANAS_PIN, teamOnD1 } from "../../../test/team-routes";
import { loader as atTheRegister } from "../register._staff/route";
import { action as signIn } from "../register.sign-in/route";
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

const view = (member: string, cookie?: string) =>
  loader(args(get(`/register/team/${member}`, cookie), t.d1, { member }));

const act = (member: string, fields: Record<string, string>, cookie?: string) =>
  action(args(post(`/register/team/${member}`, fields, cookie), t.d1, { member }));

/** Whether that person gets in with that PIN. */
async function getsIn(email: string, pin: string) {
  try {
    const result = await signIn(args(post("/register/sign-in", { email, pin }), t.d1));
    return result instanceof Response && result.headers.get("Location") === "/register";
  } catch (thrown) {
    return thrown instanceof Response && thrown.headers.get("Location") === "/register";
  }
}

/** Whether a session cookie still opens the register. */
async function sessionWorks(cookie: string) {
  try {
    await atTheRegister(args(get("/register", cookie), t.d1));
    return true;
  } catch {
    return false;
  }
}

describe("a person of the team", () => {
  it("shows them, whether the manager can change them, and their history", async () => {
    const { ana, asManager } = await teamOnD1(t);
    await act(ana.id, { intent: "deactivate", confirmed: "yes" }, asManager);
    expect(dataOf(await view(ana.id, asManager))).toMatchObject({
      member: { name: "Ana", email: "ana@example.com", role: "barista", active: false },
      canChange: true,
      history: [{ change: "deactivated", byName: "Bruno" }],
    });
  });

  it("someone who doesn't exist isn't found", async () => {
    const { asManager } = await teamOnD1(t);
    let thrown: unknown;
    try {
      await view("nadie", asManager);
    } catch (error) {
      thrown = error;
    }
    expect(statusOf(thrown)).toBe(404);
  });

  it("the manager opens their own only to see it: the developers change it", async () => {
    const { bruno, asManager } = await teamOnD1(t);
    expect(dataOf(await view(bruno.id, asManager))).toMatchObject({
      member: { name: "Bruno", role: "manager" },
      canChange: false,
    });
  });

  it("a barista doesn't see it", async () => {
    const { ana, asBarista } = await teamOnD1(t);
    const response = await redirectOf(view(ana.id, asBarista));
    expect(response.headers.get("Location")).toBe("/register");
  });
});

describe("changing a barista", () => {
  it("saves the name and the email", async () => {
    const { ana, asManager } = await teamOnD1(t);
    const result = await act(
      ana.id,
      { intent: "save", name: "Ana María", email: "anam@example.com" },
      asManager,
    );
    expect(dataOf(result)).toEqual({ kind: "saved" });
    expect(dataOf(await view(ana.id, asManager))).toMatchObject({
      member: { name: "Ana María", email: "anam@example.com" },
    });
  });

  it("with the new email, she gets in", async () => {
    const { ana, asManager } = await teamOnD1(t);
    await act(ana.id, { intent: "save", name: "Ana", email: "anam@example.com" }, asManager);
    expect(await getsIn("anam@example.com", ANAS_PIN)).toBe(true);
  });

  it("a new PIN asks first, and doesn't change anything until confirmed", async () => {
    const { ana, asManager } = await teamOnD1(t);
    expect(dataOf(await act(ana.id, { intent: "new-pin" }, asManager))).toEqual({
      kind: "confirm",
      confirm: "new-pin",
    });
    expect(await getsIn("ana@example.com", ANAS_PIN)).toBe(true);
  });

  it("the new PIN works, the old one doesn't, and her open session ends", async () => {
    const { ana, asManager, asBarista } = await teamOnD1(t);
    const result = dataOf<{ pin: string }>(
      await act(ana.id, { intent: "new-pin", confirmed: "yes" }, asManager),
    );
    expect(await getsIn("ana@example.com", result.pin)).toBe(true);
    expect(await getsIn("ana@example.com", ANAS_PIN)).toBe(false);
    expect(await sessionWorks(asBarista)).toBe(false);
  });

  it("deactivated, her open session ends and she can't get in", async () => {
    const { ana, asManager, asBarista } = await teamOnD1(t);
    await act(ana.id, { intent: "deactivate", confirmed: "yes" }, asManager);
    expect(await sessionWorks(asBarista)).toBe(false);
    expect(await getsIn("ana@example.com", ANAS_PIN)).toBe(false);
  });

  it("reactivated, she gets in again with her PIN", async () => {
    const { ana, asManager } = await teamOnD1(t);
    await act(ana.id, { intent: "deactivate", confirmed: "yes" }, asManager);
    await act(ana.id, { intent: "reactivate" }, asManager);
    expect(await getsIn("ana@example.com", ANAS_PIN)).toBe(true);
  });
});

describe("what can't be done", () => {
  const forbidden = async (run: Promise<unknown>) => {
    try {
      await run;
    } catch (error) {
      return statusOf(error);
    }
    return 200;
  };

  it("deactivating or reactivating someone who doesn't exist isn't found: it never says it's done", async () => {
    const { asManager } = await teamOnD1(t);
    const both: Record<string, string>[] = [
      { intent: "deactivate", confirmed: "yes" },
      { intent: "reactivate" },
    ];
    for (const fields of both) {
      const thrown = await act("nadie", fields, asManager).catch((error: unknown) => error);
      expect(statusOf(thrown), fields.intent).toBe(404);
    }
  });

  it("a barista changes nobody, even sending the form by hand", async () => {
    const { bruno, asBarista } = await teamOnD1(t);
    const other = await createStaffMember(t.db, { name: "Beto" });
    expect(
      await forbidden(act(other.id, { intent: "deactivate", confirmed: "yes" }, asBarista)),
    ).toBe(403);
    expect(await forbidden(act(bruno.id, { intent: "new-pin", confirmed: "yes" }, asBarista))).toBe(
      403,
    );
  });

  it("the manager doesn't change another manager", async () => {
    const { asManager } = await teamOnD1(t);
    const carla = await createStaffMember(t.db, { name: "Carla", role: "manager" });
    expect(await forbidden(act(carla.id, { intent: "new-pin", confirmed: "yes" }, asManager))).toBe(
      403,
    );
  });

  it("the manager doesn't make themselves a PIN or deactivate themselves", async () => {
    const { bruno, asManager } = await teamOnD1(t);
    expect(await forbidden(act(bruno.id, { intent: "new-pin", confirmed: "yes" }, asManager))).toBe(
      403,
    );
    expect(
      await forbidden(act(bruno.id, { intent: "deactivate", confirmed: "yes" }, asManager)),
    ).toBe(403);
  });
});
