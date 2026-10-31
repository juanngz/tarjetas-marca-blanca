import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { testDb } from "../../../test/db";
import { createCustomer, createEntry, createStaffMember } from "../../../test/factories";
import { cards, customers } from "./schema";
import { d1SummaryRepository } from "./summaryRepository.server";

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

const SINCE = new Date("2026-10-01T03:00:00Z");
const before = new Date("2026-09-20T15:00:00Z");
const later = (minutes: number) => new Date(SINCE.getTime() + minutes * 60_000);

/** Marta's take-away card, and Ana at the register. */
async function martasTakeAway(changes: Partial<typeof customers.$inferInsert> = {}) {
  const { customer, cards: theirs } = await createCustomer(t.db, changes);
  const card = theirs.find((c) => c.type === "take-away");
  if (!card) throw new Error("Missing the take-away card.");
  return { customer, card, ana: await createStaffMember(t.db) };
}

describe("what Resumen reads", () => {
  it("the stamps and redeems from then on, the oldest first, with their card's type and customer", async () => {
    const { customer, card, ana } = await martasTakeAway();
    await createEntry(t.db, { card, by: ana, type: "redeem", at: later(20) });
    await createEntry(t.db, { card, by: ana, at: later(10) });
    const { entries } = await d1SummaryRepository(t.db).read(SINCE);
    const marta = { cardId: card.id, customerId: customer.id, cardType: "take-away" };
    expect(entries).toEqual([
      { ...marta, type: "stamp", at: later(10) },
      { ...marta, type: "redeem", at: later(20) },
    ]);
  });

  it("an undone stamp doesn't count, and neither does its undo", async () => {
    const { card, ana } = await martasTakeAway();
    const stamp = await createEntry(t.db, { card, by: ana, at: later(10) });
    await createEntry(t.db, { card, by: ana, type: "undo", undoesId: stamp.id, at: later(11) });
    expect((await d1SummaryRepository(t.db).read(SINCE)).entries).toEqual([]);
  });

  it("the stamps from before only as a count, per card used since then", async () => {
    const { card, ana } = await martasTakeAway();
    const other = await martasTakeAway({ name: "Lucía Pérez" });
    await createEntry(t.db, { card, by: ana, at: before });
    await createEntry(t.db, { card, by: ana, at: before });
    const undone = await createEntry(t.db, { card, by: ana, at: before });
    await createEntry(t.db, { card, by: ana, type: "undo", undoesId: undone.id, at: before });
    await createEntry(t.db, { card, by: ana, at: later(10) });
    // Lucía's card wasn't used since then: it isn't needed.
    await createEntry(t.db, { card: other.card, by: ana, at: before });
    const read = await d1SummaryRepository(t.db).read(SINCE);
    expect(read.entries).toHaveLength(1);
    expect([...read.stampsBefore]).toEqual([[card.id, 2]]);
  });

  it("when each customer signed up, from then on", async () => {
    await martasTakeAway({ createdAt: before });
    await martasTakeAway({ name: "Lucía Pérez", createdAt: later(5) });
    expect((await d1SummaryRepository(t.db).read(SINCE)).signUps).toEqual([later(5)]);
  });

  it("the rewards waiting to be used, per card type", async () => {
    const { card } = await martasTakeAway();
    const other = await martasTakeAway({ name: "Lucía Pérez" });
    await t.db.update(cards).set({ rewards: 2 }).where(eq(cards.id, card.id));
    await t.db.update(cards).set({ rewards: 1 }).where(eq(cards.id, other.card.id));
    const { pendingRewards } = await d1SummaryRepository(t.db).read(SINCE);
    expect([...pendingRewards]).toEqual([["take-away", 3]]);
  });

  it("a deleted customer's history still counts, but her rewards can't be used any more", async () => {
    const { customer, card, ana } = await martasTakeAway();
    await createEntry(t.db, { card, by: ana, at: later(10) });
    await t.db.update(cards).set({ rewards: 1 }).where(eq(cards.id, card.id));
    await t.db.delete(customers).where(eq(customers.id, customer.id));
    const read = await d1SummaryRepository(t.db).read(SINCE);
    expect(read.entries).toHaveLength(1);
    // Without a customer, the card counts as its own.
    expect(read.entries[0].customerId).toBe(card.id);
    expect(read.pendingRewards.size).toBe(0);
  });
});
