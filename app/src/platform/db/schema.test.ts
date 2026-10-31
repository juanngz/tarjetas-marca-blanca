import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { errorCause, testDb } from "../../../test/db";
import { createCustomer, createEntry, createStaffMember, ledgerOf } from "../../../test/factories";
import { cardBalance } from "../../core/card";
import { cards, customers, entries, staff } from "./schema";

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

describe("end to end", () => {
  it("someone signs up and gets a stamp", async () => {
    const { db } = t;
    const { cards: theirs } = await createCustomer(db);
    const ana = await createStaffMember(db);
    await createEntry(db, { card: theirs[0], by: ana });

    const ledger = await ledgerOf(db, theirs[0].id);
    expect(cardBalance(ledger, 7)).toEqual({ stamps: 1, rewards: 0 });
  });
});

describe("customers and cards", () => {
  it("the same document isn't signed up twice", async () => {
    await createCustomer(t.db, { dniHmac: "the-same" });
    expect(await errorCause(createCustomer(t.db, { dniHmac: "the-same" }))).toMatch(
      "UNIQUE constraint failed: customers.dni_hmac",
    );
  });

  it("each customer has a single card of each type", async () => {
    const { customer, cards: theirs } = await createCustomer(t.db);
    const anotherSame = t.db.insert(cards).values({
      customerId: customer.id,
      type: theirs[0].type,
      qrCode: "other-qr",
      shortCode: "ZZZZZZ",
    });
    expect(await errorCause(anotherSame)).toMatch(
      "UNIQUE constraint failed: cards.customer_id, cards.type",
    );
  });

  it("the QR code doesn't repeat across cards", async () => {
    const { cards: martas } = await createCustomer(t.db);
    const { customer: other } = await createCustomer(t.db);
    const repeated = t.db.insert(cards).values({
      customerId: other.id,
      type: "other",
      qrCode: martas[0].qrCode,
      shortCode: "ZZZZZZ",
    });
    expect(await errorCause(repeated)).toMatch("UNIQUE constraint failed: cards.qr_code");
  });

  it("the short code doesn't repeat across cards", async () => {
    const { cards: martas } = await createCustomer(t.db);
    const { customer: other } = await createCustomer(t.db);
    const repeated = t.db.insert(cards).values({
      customerId: other.id,
      type: "other",
      qrCode: "other-qr",
      shortCode: martas[0].shortCode,
    });
    expect(await errorCause(repeated)).toMatch("UNIQUE constraint failed: cards.short_code");
  });
});

describe("entries", () => {
  /** A stamp from Ana on Marta's first card. */
  async function oneStamp() {
    const { cards: theirs } = await createCustomer(t.db);
    const ana = await createStaffMember(t.db);
    const stamp = await createEntry(t.db, { card: theirs[0], by: ana });
    return { card: theirs[0], ana, stamp };
  }

  it("an entry is a stamp, a redeem or an undo", async () => {
    const { card, ana } = await oneStamp();
    const gift = t.d1
      .prepare(
        "INSERT INTO entries (id, card_id, type, at, staff_id) VALUES ('e', ?, 'gift', 0, ?)",
      )
      .bind(card.id, ana.id)
      .run();
    expect(await errorCause(gift)).toMatch("CHECK constraint failed: entries_type");
  });

  it("always belongs to a card", async () => {
    const { ana } = await oneStamp();
    const noCard = t.d1
      .prepare(
        "INSERT INTO entries (id, card_id, type, at, staff_id) VALUES ('e', NULL, 'stamp', 0, ?)",
      )
      .bind(ana.id)
      .run();
    expect(await errorCause(noCard)).toMatch("NOT NULL constraint failed: entries.card_id");
  });

  it("was always made by someone on the staff", async () => {
    const { card } = await oneStamp();
    const byNobody = t.db.insert(entries).values({
      cardId: card.id,
      type: "stamp",
      at: new Date(),
      staffId: "nobody",
    });
    expect(await errorCause(byNobody)).toMatch("FOREIGN KEY constraint failed");
  });

  it("an undo says which entry it cancels", async () => {
    const { card, ana } = await oneStamp();
    const withoutWhich = t.db
      .insert(entries)
      .values({ cardId: card.id, type: "undo", at: new Date(), staffId: ana.id });
    expect(await errorCause(withoutWhich)).toMatch("CHECK constraint failed: entries_undo");
  });

  it("a stamp or a redeem cancels nothing", async () => {
    const { card, ana, stamp } = await oneStamp();
    const stampThatCancels = createEntry(t.db, { card, by: ana, undoesId: stamp.id });
    expect(await errorCause(stampThatCancels)).toMatch("CHECK constraint failed: entries_undo");
  });

  it("the same thing isn't undone twice", async () => {
    const { card, ana, stamp } = await oneStamp();
    await createEntry(t.db, { card, by: ana, type: "undo", undoesId: stamp.id });
    const again = createEntry(t.db, { card, by: ana, type: "undo", undoesId: stamp.id });
    expect(await errorCause(again)).toMatch("UNIQUE constraint failed: entries.undoes_id");
  });

  it("an entry that doesn't exist isn't undone", async () => {
    const { card, ana } = await oneStamp();
    const ofNothing = createEntry(t.db, {
      card,
      by: ana,
      type: "undo",
      undoesId: "does-not-exist",
    });
    expect(await errorCause(ofNothing)).toMatch("FOREIGN KEY constraint failed");
  });

  it("an undone entry reaches the ledger undone", async () => {
    const { card, ana, stamp } = await oneStamp();
    await createEntry(t.db, { card, by: ana, type: "undo", undoesId: stamp.id });

    const [fromLedger] = await ledgerOf(t.db, card.id);
    expect(fromLedger).toMatchObject({ id: stamp.id, undone: true });
  });

  it("the undo doesn't show up in the ledger as one more entry", async () => {
    const { card, ana, stamp } = await oneStamp();
    await createEntry(t.db, { card, by: ana, type: "undo", undoesId: stamp.id });
    expect(await ledgerOf(t.db, card.id)).toHaveLength(1);
  });

  it("a stamp that wasn't undone reaches the ledger in force", async () => {
    const { card } = await oneStamp();
    const [fromLedger] = await ledgerOf(t.db, card.id);
    expect(fromLedger.undone).toBe(false);
  });

  it("a card's ledger only has its own entries", async () => {
    const { cards: theirs } = await createCustomer(t.db);
    const ana = await createStaffMember(t.db);
    await createEntry(t.db, { card: theirs[0], by: ana });
    await createEntry(t.db, { card: theirs[1], by: ana });

    expect(await ledgerOf(t.db, theirs[0].id)).toHaveLength(1);
  });

  it("a staff member with entries can't be deleted", async () => {
    const { ana } = await oneStamp();
    expect(await errorCause(t.db.delete(staff).where(eq(staff.id, ana.id)))).toMatch(
      "FOREIGN KEY constraint failed",
    );
  });

  it("a card with entries can't be deleted", async () => {
    const { card } = await oneStamp();
    expect(await errorCause(t.db.delete(cards).where(eq(cards.id, card.id)))).toMatch(
      "FOREIGN KEY constraint failed",
    );
  });
});

describe("staff", () => {
  it("the role is barista or manager", async () => {
    const cashier = createStaffMember(t.db, { role: "cashier" as "barista" });
    expect(await errorCause(cashier)).toMatch("CHECK constraint failed: staff_role");
  });

  it("two staff members don't have the same email", async () => {
    await createStaffMember(t.db, { email: "ana@example.com" });
    expect(await errorCause(createStaffMember(t.db, { email: "ana@example.com" }))).toMatch(
      "UNIQUE constraint failed: staff.email",
    );
  });

  it("a new staff member is active", async () => {
    const ana = await createStaffMember(t.db);
    expect(ana.deactivatedAt).toBeNull();
  });

  it("deactivating a person keeps their entries", async () => {
    const { cards: theirs } = await createCustomer(t.db);
    const ana = await createStaffMember(t.db);
    await createEntry(t.db, { card: theirs[0], by: ana });
    await t.db.update(staff).set({ deactivatedAt: new Date() }).where(eq(staff.id, ana.id));

    const [entry] = await t.db.select().from(entries);
    expect(entry.staffId).toBe(ana.id);
  });

  it("two staff members can have the same name", async () => {
    await createStaffMember(t.db, { name: "Ana" });
    await createStaffMember(t.db, { name: "Ana" });
    expect(await t.db.select().from(staff)).toHaveLength(2);
  });
});

describe("delete a customer (Flujo G)", () => {
  /** Marta, with one stamp, deleted. */
  async function deleteMarta() {
    const { customer, cards: theirs } = await createCustomer(t.db);
    const ana = await createStaffMember(t.db);
    await createEntry(t.db, { card: theirs[0], by: ana });
    await t.db.delete(customers).where(eq(customers.id, customer.id));
    return { customer, ana };
  }

  it("their name and document are deleted", async () => {
    await deleteMarta();
    expect(await t.db.select().from(customers)).toHaveLength(0);
  });

  it("their cards are left without an owner", async () => {
    await deleteMarta();
    const left = await t.db.select().from(cards);
    expect(left.map((c) => c.customerId)).toEqual([null, null, null, null]);
  });

  it("their history stays, with the card type and who made it", async () => {
    const { ana } = await deleteMarta();
    const [row] = await t.db
      .select({ type: cards.type, staffId: entries.staffId })
      .from(entries)
      .innerJoin(cards, eq(entries.cardId, cards.id));
    expect(row).toEqual({ type: "take-away", staffId: ana.id });
  });
});

describe("audit dates", () => {
  const LATER = new Date("2026-11-01T15:00:00Z");

  it("a new customer was never updated", async () => {
    const { customer } = await createCustomer(t.db);
    expect(customer.updatedAt).toBeNull();
  });

  it("correcting a customer's name updates updated_at", async () => {
    const { customer } = await createCustomer(t.db);
    await t.db
      .update(customers)
      .set({ name: "Marta Gómez", updatedAt: LATER })
      .where(eq(customers.id, customer.id));
    const [row] = await t.db.select().from(customers).where(eq(customers.id, customer.id));
    expect(row.updatedAt).toEqual(LATER);
  });

  it("a change without an explicit date still updates updated_at", async () => {
    const { customer } = await createCustomer(t.db);
    await t.db.update(customers).set({ name: "Marta Gómez" }).where(eq(customers.id, customer.id));
    const [row] = await t.db.select().from(customers).where(eq(customers.id, customer.id));
    expect(row.updatedAt?.getTime()).toBeGreaterThan(customer.createdAt.getTime());
  });

  it("a card has the date it was created", async () => {
    const { cards: theirs } = await createCustomer(t.db);
    expect(theirs[0].createdAt).toBeInstanceOf(Date);
  });

  it("a new staff member has the date they were added", async () => {
    const ana = await createStaffMember(t.db);
    expect(ana.createdAt).toBeInstanceOf(Date);
  });

  it("a new staff member was never updated", async () => {
    const ana = await createStaffMember(t.db);
    expect(ana.updatedAt).toBeNull();
  });

  it("deactivating a staff member updates updated_at", async () => {
    const ana = await createStaffMember(t.db);
    await t.db.update(staff).set({ deactivatedAt: LATER }).where(eq(staff.id, ana.id));
    const [row] = await t.db.select().from(staff).where(eq(staff.id, ana.id));
    expect(row.updatedAt?.getTime()).toBeGreaterThanOrEqual(ana.createdAt.getTime());
  });
});
