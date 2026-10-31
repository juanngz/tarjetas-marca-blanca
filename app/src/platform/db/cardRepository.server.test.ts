import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { testDb } from "../../../test/db";
import { createCustomer, createEntry, createStaffMember, ledgerOf } from "../../../test/factories";
import { recordEntry } from "../../application/recordEntry";
import { exampleCafe } from "../../cafes/example";
import { cardBalance } from "../../core/card";
import { d1CardRepository } from "./cardRepository.server";
import { cards, customers, entries } from "./schema";

// The CardRepository on a real D1, through the recordEntry use case: what has to be stored for real
// (the balance, the ledger, two actions at the same time). The use case's own rules: application/.

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

const NOON = new Date("2026-10-06T15:00:00Z");

/** Marta's take-away card (7 stamps per round) and Ana at the register. */
async function atTheRegister() {
  const { cards: theirs } = await createCustomer(t.db);
  const takeAway = theirs.find((c) => c.type === "take-away");
  if (!takeAway) throw new Error("Missing the take-away card.");
  const ana = await createStaffMember(t.db);
  const record = (
    entry: { type: "stamp" } | { type: "redeem" } | { type: "undo"; undoesId: string },
  ) =>
    recordEntry({ ...entry, cardId: takeAway.id, staffId: ana.id, at: NOON }, exampleCafe, {
      cards: d1CardRepository(t.db),
    });
  const stamp = async (amount: number) => {
    for (let i = 0; i < amount; i++) await record({ type: "stamp" });
  };
  const balance = async () => {
    const [row] = await t.db
      .select({ stamps: cards.stamps, rewards: cards.rewards })
      .from(cards)
      .where(eq(cards.id, takeAway.id));
    return row;
  };
  const fromLedger = async () => cardBalance(await ledgerOf(t.db, takeAway.id), 7);
  return { takeAway, ana, record, stamp, balance, fromLedger };
}

describe("a card's balance", () => {
  it("a new card starts at zero", async () => {
    const { balance } = await atTheRegister();
    expect(await balance()).toEqual({ stamps: 0, rewards: 0 });
  });

  it("adding a stamp updates it", async () => {
    const { stamp, balance } = await atTheRegister();
    await stamp(1);
    expect(await balance()).toEqual({ stamps: 1, rewards: 0 });
  });

  it("when the card is completed, it earns a reward and stamps go back to zero", async () => {
    const { stamp, balance } = await atTheRegister();
    await stamp(7);
    expect(await balance()).toEqual({ stamps: 0, rewards: 1 });
  });

  it("the stamp that completes the card says so", async () => {
    const { stamp, record } = await atTheRegister();
    await stamp(6);
    expect(await record({ type: "stamp" })).toMatchObject({ ok: true, completesCard: true });
  });

  it("redeeming takes away the reward and doesn't add a stamp", async () => {
    const { stamp, record, balance } = await atTheRegister();
    await stamp(8);
    await record({ type: "redeem" });
    expect(await balance()).toEqual({ stamps: 1, rewards: 0 });
  });

  it("undoing a stamp gives it back", async () => {
    const { stamp, record, balance } = await atTheRegister();
    await stamp(2);
    const third = await record({ type: "stamp" });
    if (!third.ok) throw new Error("The stamp wasn't added.");
    await record({ type: "undo", undoesId: third.entryId });
    expect(await balance()).toEqual({ stamps: 2, rewards: 0 });
  });

  it("undoing a redeem gives the reward back", async () => {
    const { stamp, record, balance } = await atTheRegister();
    await stamp(7);
    const redeem = await record({ type: "redeem" });
    if (!redeem.ok) throw new Error("It wasn't redeemed.");
    await record({ type: "undo", undoesId: redeem.entryId });
    expect(await balance()).toEqual({ stamps: 0, rewards: 1 });
  });

  it("always matches the ledger", async () => {
    const { stamp, record, balance, fromLedger } = await atTheRegister();
    await stamp(8);
    const redeem = await record({ type: "redeem" });
    await stamp(3);
    if (redeem.ok) await record({ type: "undo", undoesId: redeem.entryId });
    expect(await balance()).toEqual(await fromLedger());
  });
});

// By the customer and the card's type: the code screen asks it at the same time as the customer and her cards.
describe("whether a card has movements that count", () => {
  const hasMovements = (customerId: string, type = "take-away") =>
    d1CardRepository(t.db).hasMovements(customerId, type);

  it("a new card has none", async () => {
    const { takeAway } = await atTheRegister();
    expect(await hasMovements(takeAway.customerId ?? "")).toBe(false);
  });

  it("a stamp counts", async () => {
    const { takeAway, stamp } = await atTheRegister();
    await stamp(1);
    expect(await hasMovements(takeAway.customerId ?? "")).toBe(true);
  });

  it("a stamp that was undone doesn't, nor its undo", async () => {
    const { takeAway, record } = await atTheRegister();
    const stamped = await record({ type: "stamp" });
    if (!stamped.ok) throw new Error("Not recorded.");
    await record({ type: "undo", undoesId: stamped.entryId });
    expect(await hasMovements(takeAway.customerId ?? "")).toBe(false);
  });

  it("another card's movements don't count", async () => {
    const { takeAway } = await atTheRegister();
    const { cards: hers } = await createCustomer(t.db, { name: "Rosa Paz" });
    const other = hers[0];
    if (!other) throw new Error("Missing her card.");
    await recordEntry(
      { type: "stamp", cardId: other.id, staffId: (await createStaffMember(t.db)).id, at: NOON },
      exampleCafe,
      { cards: d1CardRepository(t.db) },
    );
    expect(await hasMovements(takeAway.customerId ?? "")).toBe(false);
  });
});

describe("what isn't allowed", () => {
  it("redeeming without rewards saves nothing", async () => {
    const { record, takeAway } = await atTheRegister();
    expect(await record({ type: "redeem" })).toEqual({ ok: false, reason: "no-rewards" });
    expect(await ledgerOf(t.db, takeAway.id)).toHaveLength(0);
  });

  it("a stamp whose reward was already redeemed isn't undone", async () => {
    const { stamp, record } = await atTheRegister();
    await stamp(6);
    const seventh = await record({ type: "stamp" });
    await record({ type: "redeem" });
    if (!seventh.ok) throw new Error("The stamp wasn't added.");
    expect(await record({ type: "undo", undoesId: seventh.entryId })).toEqual({
      ok: false,
      reason: "reward-redeemed",
    });
  });

  it("what was undone isn't undone again", async () => {
    const { record } = await atTheRegister();
    const stamp = await record({ type: "stamp" });
    if (!stamp.ok) throw new Error("The stamp wasn't added.");
    await record({ type: "undo", undoesId: stamp.entryId });
    expect(await record({ type: "undo", undoesId: stamp.entryId })).toEqual({
      ok: false,
      reason: "already-undone",
    });
  });

  it("an entry from another card isn't undone", async () => {
    const { record } = await atTheRegister();
    const other = await atTheRegister();
    const foreign = await other.record({ type: "stamp" });
    if (!foreign.ok) throw new Error("The stamp wasn't added.");
    expect(await record({ type: "undo", undoesId: foreign.entryId })).toEqual({
      ok: false,
      reason: "not-found",
    });
  });

  it("nothing is recorded on a card that doesn't exist", async () => {
    const { ana } = await atTheRegister();
    const onNone = recordEntry(
      { type: "stamp", cardId: "does-not-exist", staffId: ana.id, at: NOON },
      exampleCafe,
      { cards: d1CardRepository(t.db) },
    );
    expect(await onNone).toEqual({ ok: false, reason: "card-not-found" });
  });
});

describe("two actions at the same time", () => {
  it("if the card changed since it was read, nothing is saved", async () => {
    const { takeAway, ana, stamp } = await atTheRegister();
    const read = (await t.db.select().from(cards).where(eq(cards.id, takeAway.id)))[0];
    await stamp(1);
    const saved = await d1CardRepository(t.db).appendEntry({
      cardId: takeAway.id,
      versionRead: read.version,
      balance: { stamps: 5, rewards: 0 },
      entry: { type: "stamp", undoesId: null, staffId: ana.id, at: NOON },
    });
    expect(saved).toBeNull();
    expect(await t.db.select().from(entries)).toHaveLength(1);
  });

  it("two stamps at once both get in", async () => {
    const { record, balance } = await atTheRegister();
    await Promise.all([record({ type: "stamp" }), record({ type: "stamp" })]);
    expect(await balance()).toEqual({ stamps: 2, rewards: 0 });
  });

  it("with many at once, none is lost silently and the balance matches the ledger", async () => {
    const { record, balance, fromLedger } = await atTheRegister();
    const results = await Promise.all(Array.from({ length: 6 }, () => record({ type: "stamp" })));
    const gotIn = results.filter((r) => r.ok).length;
    expect(results.every((r) => r.ok || r.reason === "busy")).toBe(true);
    expect(await balance()).toEqual({ stamps: gotIn, rewards: 0 });
    expect(await balance()).toEqual(await fromLedger());
  });
});

describe("the card for the register", () => {
  it("is found by its short code, with its balance, version and owner's name", async () => {
    const { takeAway, stamp } = await atTheRegister();
    await stamp(2);
    expect(await d1CardRepository(t.db).findForRegister({ shortCode: takeAway.shortCode })).toEqual(
      {
        id: takeAway.id,
        type: "take-away",
        shortCode: takeAway.shortCode,
        stamps: 2,
        rewards: 0,
        version: 2,
        customerName: "Marta García",
      },
    );
  });

  it("is found by the code its QR carries", async () => {
    const { takeAway } = await atTheRegister();
    const found = await d1CardRepository(t.db).findForRegister({ qrCode: takeAway.qrCode });
    expect(found?.id).toBe(takeAway.id);
  });

  it("is found by its id", async () => {
    const { takeAway } = await atTheRegister();
    const found = await d1CardRepository(t.db).findForRegister({ cardId: takeAway.id });
    expect(found?.shortCode).toBe(takeAway.shortCode);
  });

  it("a card whose customer was deleted doesn't show up at the register", async () => {
    const { takeAway } = await atTheRegister();
    await t.db.delete(customers).where(eq(customers.id, takeAway.customerId ?? ""));
    expect(await d1CardRepository(t.db).findForRegister({ cardId: takeAway.id })).toBeNull();
  });

  it("a code that doesn't exist finds nothing", async () => {
    await atTheRegister();
    expect(await d1CardRepository(t.db).findForRegister({ shortCode: "ZZZZZZ" })).toBeNull();
  });

  it("an entry says which card it's from", async () => {
    const { takeAway, record } = await atTheRegister();
    const stamp = await record({ type: "stamp" });
    if (!stamp.ok) throw new Error("The stamp wasn't added.");
    expect(await d1CardRepository(t.db).findCardOfEntry(stamp.entryId)).toBe(takeAway.id);
  });

  it("the ledger comes in the order the entries were made, with who made them", async () => {
    const { takeAway, ana, record } = await atTheRegister();
    const first = await record({ type: "stamp" });
    const second = await record({ type: "stamp" });
    if (!first.ok || !second.ok) throw new Error("The stamps weren't added.");
    const ledger = await d1CardRepository(t.db).findLedger({ cardId: takeAway.id });
    expect(ledger?.records.map((r) => [r.id, r.staffId])).toEqual([
      [first.entryId, ana.id],
      [second.entryId, ana.id],
    ]);
  });

  it("the ledger by the card's short code or its QR is the same as by its id, and only its own", async () => {
    // So the register reads it together with the card, by the code it has.
    const { takeAway, stamp } = await atTheRegister();
    await stamp(2);
    const { cards: hers } = await createCustomer(t.db, { name: "Rosa Paz" });
    const other = hers.find((c) => c.type === "take-away");
    if (!other) throw new Error("Missing her card.");
    await recordEntry(
      { type: "stamp", cardId: other.id, staffId: (await createStaffMember(t.db)).id, at: NOON },
      exampleCafe,
      { cards: d1CardRepository(t.db) },
    );
    const cards = d1CardRepository(t.db);
    const byId = await cards.findLedger({ cardId: takeAway.id });
    expect(byId?.records).toHaveLength(2);
    expect(await cards.findLedger({ shortCode: takeAway.shortCode })).toEqual(byId);
    expect(await cards.findLedger({ qrCode: takeAway.qrCode })).toEqual(byId);
    expect(await cards.findLedger({ shortCode: "ZZZZZZ" })).toBeNull();
  });
});

describe("the register's history", () => {
  const at = (minute: number) => new Date(NOON.getTime() + minute * 60_000);

  it("every card's entries, of everybody, the newest first", async () => {
    const { takeAway, ana } = await atTheRegister();
    const bruno = await createStaffMember(t.db, { name: "Bruno", role: "manager" });
    await createEntry(t.db, { card: takeAway, by: ana, at: at(1) });
    await createEntry(t.db, { card: takeAway, by: bruno, at: at(2) });
    const history = await d1CardRepository(t.db).activity({ limit: 10 });
    expect(history.map((h) => [h.staffId, h.cardType, h.customerName])).toEqual([
      [bruno.id, "take-away", "Marta García"],
      [ana.id, "take-away", "Marta García"],
    ]);
  });

  it("an undo says what it undid, and what was undone is marked", async () => {
    const { takeAway, ana } = await atTheRegister();
    const redeem = await createEntry(t.db, { card: takeAway, by: ana, type: "redeem", at: at(1) });
    await createEntry(t.db, {
      card: takeAway,
      by: ana,
      type: "undo",
      undoesId: redeem.id,
      at: at(2),
    });
    const history = await d1CardRepository(t.db).activity({ limit: 10 });
    expect(history.map((h) => [h.type, h.undoneType, h.undone])).toEqual([
      ["undo", "redeem", false],
      ["redeem", null, true],
    ]);
  });

  it("only one person's, when asked", async () => {
    const { takeAway, ana } = await atTheRegister();
    const bruno = await createStaffMember(t.db, { name: "Bruno", role: "manager" });
    await createEntry(t.db, { card: takeAway, by: ana, at: at(1) });
    await createEntry(t.db, { card: takeAway, by: bruno, at: at(2) });
    const history = await d1CardRepository(t.db).activity({ staffId: ana.id, limit: 10 });
    expect(history.map((h) => h.staffId)).toEqual([ana.id]);
  });

  it("at most `limit`", async () => {
    const { takeAway, ana } = await atTheRegister();
    for (let i = 0; i < 3; i++) await createEntry(t.db, { card: takeAway, by: ana, at: at(i) });
    expect(await d1CardRepository(t.db).activity({ limit: 2 })).toHaveLength(2);
  });

  it("a deleted customer's card keeps its history, without a name", async () => {
    const { takeAway, ana } = await atTheRegister();
    await createEntry(t.db, { card: takeAway, by: ana });
    await t.db.update(cards).set({ customerId: null }).where(eq(cards.id, takeAway.id));
    const [line] = await d1CardRepository(t.db).activity({ limit: 10 });
    expect(line.customerName).toBeNull();
  });
});
