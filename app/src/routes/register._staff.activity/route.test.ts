import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { testDb } from "../../../test/db";
import { createCustomer, createEntry } from "../../../test/factories";
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

interface Activity {
  lines: { kind: string; byName: string; customerName: string | null; cardName: string }[];
  memberId: string | null;
}

/** Marta's take-away card, with a stamp by Ana and a redeem by Bruno. */
async function aDayAtTheRegister() {
  const team = await teamOnD1(t);
  const { cards } = await createCustomer(t.db);
  const card = cards.find((c) => c.type === "take-away");
  if (!card) throw new Error("Missing the take-away card.");
  await createEntry(t.db, { card, by: team.ana, at: new Date("2026-10-08T15:00:00Z") });
  await createEntry(t.db, {
    card,
    by: team.bruno,
    type: "redeem",
    at: new Date("2026-10-08T15:05:00Z"),
  });
  return team;
}

describe("Movimientos", () => {
  it("the manager sees everybody's, the newest first", async () => {
    const { asManager } = await aDayAtTheRegister();
    const view = dataOf<Activity>(await loader(args(get("/register/activity", asManager), t.d1)));
    expect(view.lines.map((l) => [l.kind, l.byName, l.customerName, l.cardName])).toEqual([
      ["redeem", "Bruno", "Marta García", "Café take-away"],
      ["stamp", "Ana", "Marta García", "Café take-away"],
    ]);
  });

  it("only one person's, with ?member", async () => {
    const { ana, asManager } = await aDayAtTheRegister();
    const view = dataOf<Activity>(
      await loader(args(get(`/register/activity?member=${ana.id}`, asManager), t.d1)),
    );
    expect(view.lines.map((l) => l.byName)).toEqual(["Ana"]);
    expect(view.memberId).toBe(ana.id);
  });

  it("never sends the PIN's hash or the team's emails", async () => {
    const { ana, bruno, asManager } = await aDayAtTheRegister();
    const sent = JSON.stringify(
      dataOf(await loader(args(get("/register/activity", asManager), t.d1))),
    );
    for (const secret of [ana.pinHmac, bruno.pinHmac, ana.email, bruno.email]) {
      expect(sent).not.toContain(secret);
    }
  });

  it("a barista doesn't see it", async () => {
    const { asBarista } = await aDayAtTheRegister();
    const response = await redirectOf(loader(args(get("/register/activity", asBarista), t.d1)));
    expect(response.headers.get("Location")).toBe("/register");
  });

  it("without a session, to sign in", async () => {
    const response = await redirectOf(loader(args(get("/register/activity"), t.d1)));
    expect(response.headers.get("Location")).toBe("/register/sign-in");
  });
});
