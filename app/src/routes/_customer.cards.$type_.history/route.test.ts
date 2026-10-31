import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { testDb } from "../../../test/db";
import {
  addStamps,
  createCustomer,
  createStaffMember,
  signedInCookie,
} from "../../../test/factories";
import { args, dataOf, get, redirectOf, statusOf } from "../../../test/routes";
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

interface History {
  card: { name: string };
  history: { type: string }[];
}

describe("a card's stamps and rewards", () => {
  it("returns the card's name", async () => {
    const { customer } = await createCustomer(t.db);
    const cookie = await signedInCookie(customer.id);
    const data = dataOf<History>(
      await loader(args(get("/cards/take-away/history", cookie), t.d1, { type: "take-away" })),
    );
    expect(data.card.name).toBe("Café take-away");
  });

  it("returns the stamps the register added to that card", async () => {
    const { customer, cards } = await createCustomer(t.db);
    const barista = await createStaffMember(t.db);
    const takeAway = cards.find((c) => c.type === "take-away");
    if (!takeAway) throw new Error("Falta la tarjeta");
    await addStamps(t.db, { card: takeAway, by: barista, amount: 2 });
    const cookie = await signedInCookie(customer.id);
    const data = dataOf<History>(
      await loader(args(get("/cards/take-away/history", cookie), t.d1, { type: "take-away" })),
    );
    expect(data.history.map((item) => item.type)).toEqual(["stamp", "stamp"]);
  });

  it("a card that doesn't exist isn't found", async () => {
    const { customer } = await createCustomer(t.db);
    const cookie = await signedInCookie(customer.id);
    let thrown: unknown;
    try {
      await loader(args(get("/cards/other/history", cookie), t.d1, { type: "other" }));
    } catch (error) {
      thrown = error;
    }
    expect(statusOf(thrown)).toBe(404);
  });

  it("without a session, goes back to the welcome screen", async () => {
    const response = await redirectOf(
      loader(args(get("/cards/take-away/history"), t.d1, { type: "take-away" })),
    );
    expect(response.headers.get("Location")).toBe("/");
  });
});
