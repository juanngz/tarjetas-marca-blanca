import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { testDb } from "../../../test/db";
import {
  addStamps,
  createCustomer,
  createStaffMember,
  signedInCookie,
} from "../../../test/factories";
import { args, dataOf, get, redirectOf, refetches } from "../../../test/routes";
import { customers } from "../../platform/db/schema";
import { loader, shouldRevalidate } from "./route";

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

interface Wallet {
  greeting: string;
  cards: { type: string; name: string; stamps: number; rewards: number }[];
}

async function martasWallet(path = "/cards") {
  const { customer, cards } = await createCustomer(t.db, { dniHmac: "martas-hmac" });
  const cookie = await signedInCookie(customer.id);
  const viewWallet = async () => dataOf<Wallet>(await loader(args(get(path, cookie), t.d1)));
  return { cards, viewWallet };
}

describe("the customer's cards", () => {
  it("are the four, in the fixed order", async () => {
    const { viewWallet } = await martasWallet();
    expect((await viewWallet()).cards.map((c) => c.name)).toEqual([
      "Café take-away",
      "Café en grano ¼ kg",
      "Café en grano ½ kg",
      "Café en grano 1 kg",
    ]);
  });

  it("each with its stamps and rewards", async () => {
    const { cards, viewWallet } = await martasWallet();
    const ana = await createStaffMember(t.db);
    const takeAway = cards.find((c) => c.type === "take-away");
    if (!takeAway) throw new Error("Missing the take-away card.");
    await addStamps(t.db, { card: takeAway, by: ana, amount: 9 });

    const [takeAwayCard] = (await viewWallet()).cards;
    expect(takeAwayCard).toMatchObject({ stamps: 2, rewards: 1 });
  });

  it("greets her by her first name", async () => {
    const { viewWallet } = await martasWallet();
    expect((await viewWallet()).greeting).toMatch(/, Marta\.$/);
  });

  it("bringing another card to the front doesn't ask the server for anything", () => {
    expect(refetches(shouldRevalidate, "/cards", "/cards?front=beans-half")).toBe(false);
  });

  it("coming back to the screen from another one does fetch the cards", () => {
    expect(refetches(shouldRevalidate, "/cards/take-away", "/cards?front=take-away")).toBe(true);
  });

  it("never sends the document or its hash", async () => {
    const { viewWallet } = await martasWallet();
    expect(JSON.stringify(await viewWallet())).not.toContain("martas-hmac");
  });

  it("without a session, goes back to the welcome screen", async () => {
    const response = await redirectOf(loader(args(get("/cards"), t.d1)));
    expect(response.headers.get("Location")).toBe("/");
  });

  it("if the customer was deleted, their cookie no longer lets them in", async () => {
    const { customer } = await createCustomer(t.db);
    const cookie = await signedInCookie(customer.id);
    await t.db.delete(customers).where(eq(customers.id, customer.id));
    const response = await redirectOf(loader(args(get("/cards", cookie), t.d1)));
    expect(response.headers.get("Location")).toBe("/");
  });
});
