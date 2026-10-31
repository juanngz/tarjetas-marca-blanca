import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { testDb } from "../../../test/db";
import { args, get, redirectOf } from "../../../test/routes";
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

describe("getting into Equipo", () => {
  it("the manager gets in", async () => {
    const { asManager } = await teamOnD1(t);
    await expect(loader(args(get("/register/team", asManager), t.d1))).resolves.toBeNull();
  });

  it("a barista goes back to the register", async () => {
    const { asBarista } = await teamOnD1(t);
    const response = await redirectOf(loader(args(get("/register/team", asBarista), t.d1)));
    expect(response.headers.get("Location")).toBe("/register");
  });

  it("without a session, asks to sign in", async () => {
    const response = await redirectOf(loader(args(get("/register/team"), t.d1)));
    expect(response.headers.get("Location")).toBe("/register/sign-in");
  });
});
