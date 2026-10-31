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

interface Summary {
  range: { from: string; to: string; says: string };
  totals: { visitors: number; stamps: number };
}

/** Marta signed up today, with a stamp by Ana on her take-away card. */
async function aCustomerToday() {
  const team = await teamOnD1(t);
  const { cards } = await createCustomer(t.db, { createdAt: new Date() });
  const card = cards.find((c) => c.type === "take-away");
  if (!card) throw new Error("Missing the take-away card.");
  await createEntry(t.db, { card, by: team.ana, at: new Date() });
  return team;
}

const view = (path: string, cookie?: string) => loader(args(get(path, cookie), t.d1));

describe("Resumen", () => {
  it("the manager sees the last 7 days' numbers", async () => {
    const { asManager } = await aCustomerToday();
    const summary = dataOf<Summary>(await view("/register/summary", asManager));
    // Without dates, the last 7 days: today and the 6 before.
    const days = (Date.parse(summary.range.to) - Date.parse(summary.range.from)) / 86_400_000;
    expect(days).toBe(6);
    expect(summary.totals).toMatchObject({ visitors: 1, stamps: 1 });
  });

  it("other days, with ?from and ?to", async () => {
    const { asManager } = await aCustomerToday();
    const summary = dataOf<Summary>(
      await view("/register/summary?from=2026-09-01&to=2026-09-07", asManager),
    );
    expect(summary.range).toMatchObject({ from: "2026-09-01", to: "2026-09-07" });
    // Marta's stamp is from today: not in those days.
    expect(summary.totals.visitors).toBe(0);
  });

  it("only counts: never a customer's name", async () => {
    const { asManager } = await aCustomerToday();
    const sent = JSON.stringify(dataOf(await view("/register/summary", asManager)));
    expect(sent).not.toContain("Marta");
  });

  it("a barista doesn't see it", async () => {
    const { asBarista } = await aCustomerToday();
    const response = await redirectOf(view("/register/summary", asBarista));
    expect(response.headers.get("Location")).toBe("/register");
  });

  it("without a session, to sign in", async () => {
    const response = await redirectOf(view("/register/summary"));
    expect(response.headers.get("Location")).toBe("/register/sign-in");
  });
});
