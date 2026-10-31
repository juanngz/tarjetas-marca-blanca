import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { testDb } from "../../../test/db";
import { createStaffMember } from "../../../test/factories";
import { args, dataOf, get, redirectOf } from "../../../test/routes";
import { teamOnD1 } from "../../../test/team-routes";
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

interface List {
  active: { name: string; you: boolean }[];
  inactive: { name: string; you: boolean }[];
}

describe("the list of the team", () => {
  it("the active ones by name, and the ones who no longer work there apart", async () => {
    const { asManager } = await teamOnD1(t);
    await createStaffMember(t.db, { name: "Dani", deactivatedAt: new Date() });
    const list = dataOf<List>(await loader(args(get("/register/team", asManager), t.d1)));
    expect(list.active.map((m) => m.name)).toEqual(["Ana", "Bruno"]);
    expect(list.inactive.map((m) => m.name)).toEqual(["Dani"]);
  });

  it("marks the manager who's looking, so they find themselves", async () => {
    const { asManager } = await teamOnD1(t);
    const list = dataOf<List>(await loader(args(get("/register/team", asManager), t.d1)));
    expect(list.active.filter((m) => m.you).map((m) => m.name)).toEqual(["Bruno"]);
  });

  it("never sends the PIN's hash to the phone", async () => {
    const { ana, asManager } = await teamOnD1(t);
    const sent = JSON.stringify(dataOf(await loader(args(get("/register/team", asManager), t.d1))));
    expect(sent).not.toContain(ana.pinHmac);
  });

  it("a barista doesn't see it", async () => {
    const { asBarista } = await teamOnD1(t);
    const response = await redirectOf(loader(args(get("/register/team", asBarista), t.d1)));
    expect(response.headers.get("Location")).toBe("/register");
  });
});
