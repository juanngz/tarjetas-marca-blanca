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

interface Code {
  card: { name: string; qrCode: string; shortCode: string };
  hasMovements: boolean;
}

describe("a card's code", () => {
  it("returns that card's QR code", async () => {
    const { customer, cards } = await createCustomer(t.db);
    const cookie = await signedInCookie(customer.id);
    const takeAway = cards.find((c) => c.type === "take-away");
    const data = dataOf<Code>(
      await loader(args(get("/cards/take-away", cookie), t.d1, { type: "take-away" })),
    );
    expect(data.card).toMatchObject({ name: "Café take-away", qrCode: takeAway?.qrCode });
  });

  // All together, as the barista types it (09/10/2026): K7M2QX, not K7M 2QX.
  it("returns the short code all together, without spaces", async () => {
    const { customer, cards } = await createCustomer(t.db);
    const cookie = await signedInCookie(customer.id);
    const half = cards.find((c) => c.type === "beans-half");
    const data = dataOf<Code>(
      await loader(args(get("/cards/beans-half", cookie), t.d1, { type: "beans-half" })),
    );
    expect(data.card.shortCode).toBe(half?.shortCode);
  });

  // Ver mis sellos y premios only shows when there's something to see.
  it("a new card has no movements to see", async () => {
    const { customer } = await createCustomer(t.db);
    const cookie = await signedInCookie(customer.id);
    const data = dataOf<Code>(
      await loader(args(get("/cards/take-away", cookie), t.d1, { type: "take-away" })),
    );
    expect(data.hasMovements).toBe(false);
  });

  it("a stamped card has movements to see", async () => {
    const { customer, cards } = await createCustomer(t.db);
    const barista = await createStaffMember(t.db);
    const takeAway = cards.find((c) => c.type === "take-away");
    if (!takeAway) throw new Error("Falta la tarjeta");
    await addStamps(t.db, { card: takeAway, by: barista });
    const cookie = await signedInCookie(customer.id);
    const data = dataOf<Code>(
      await loader(args(get("/cards/take-away", cookie), t.d1, { type: "take-away" })),
    );
    expect(data.hasMovements).toBe(true);
  });

  it("a card that doesn't exist isn't found", async () => {
    const { customer } = await createCustomer(t.db);
    const cookie = await signedInCookie(customer.id);
    let thrown: unknown;
    try {
      await loader(args(get("/cards/other", cookie), t.d1, { type: "other" }));
    } catch (error) {
      thrown = error;
    }
    expect(statusOf(thrown)).toBe(404);
  });

  it("without a session, goes back to the welcome screen", async () => {
    const response = await redirectOf(
      loader(args(get("/cards/take-away"), t.d1, { type: "take-away" })),
    );
    expect(response.headers.get("Location")).toBe("/");
  });
});
