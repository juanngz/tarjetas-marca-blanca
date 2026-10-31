import { describe, expect, it } from "vitest";
import { inMemoryDb } from "../../test/fakes";
import { exampleCafe } from "../cafes/example";
import type { CardRepository } from "./ports";
import { type EntryRequest, recordEntry } from "./recordEntry";

const NOON = new Date("2026-10-06T15:00:00Z");

/** Marta's take-away card. `wrap` replaces the card repository, to simulate other actions at the same time. */
async function atTheRegister(wrap: (cards: CardRepository) => CardRepository = (cards) => cards) {
  const db = inMemoryDb();
  await db.customers.createWithCards(
    { id: "marta", name: "Marta García", createdAt: NOON, dniHmac: "h" },
    [{ type: "take-away", qrCode: "q1", shortCode: "S1" }],
  );
  const [card] = [...db.stored.cards.values()];
  const record = (
    entry: { type: "stamp" } | { type: "redeem" } | { type: "undo"; undoesId: string },
    more: { staffId?: string; seenVersion?: number } = {},
  ) =>
    recordEntry(
      { ...entry, cardId: card.id, staffId: "ana", at: NOON, ...more } as EntryRequest,
      exampleCafe,
      { cards: wrap(db.cards) },
    );
  const balance = () => {
    const { stamps, rewards } = db.stored.cards.get(card.id) ?? { stamps: -1, rewards: -1 };
    return { stamps, rewards };
  };
  return { db, card, record, balance };
}

describe("record an entry", () => {
  it("a stamp updates the balance", async () => {
    const { record, balance } = await atTheRegister();
    await record({ type: "stamp" });
    expect(balance()).toEqual({ stamps: 1, rewards: 0 });
  });

  it("the stamp that completes the card says so", async () => {
    const { record } = await atTheRegister();
    for (let i = 0; i < 6; i++) await record({ type: "stamp" });
    expect(await record({ type: "stamp" })).toMatchObject({ ok: true, completesCard: true });
  });

  it("redeeming without rewards saves nothing", async () => {
    const { db, record } = await atTheRegister();
    expect(await record({ type: "redeem" })).toEqual({ ok: false, reason: "no-rewards" });
    expect(db.stored.entries).toEqual([]);
  });

  it("an undo is a new entry that says what it cancels", async () => {
    const { db, record, balance } = await atTheRegister();
    const stamp = await record({ type: "stamp" });
    if (!stamp.ok) throw new Error("The stamp wasn't added.");
    await record({ type: "undo", undoesId: stamp.entryId });
    expect(db.stored.entries.at(-1)).toMatchObject({ type: "undo", undoesId: stamp.entryId });
    expect(balance()).toEqual({ stamps: 0, rewards: 0 });
  });

  it("the entry says who made it and when", async () => {
    const { db, record } = await atTheRegister();
    await record({ type: "stamp" });
    expect(db.stored.entries[0]).toMatchObject({ staffId: "ana", at: NOON });
  });

  it("nothing is recorded on a card that doesn't exist", async () => {
    const db = inMemoryDb();
    const result = await recordEntry(
      { type: "stamp", cardId: "none", staffId: "ana", at: NOON },
      exampleCafe,
      { cards: db.cards },
    );
    expect(result).toEqual({ ok: false, reason: "card-not-found" });
  });

  it("if another action changed the card, it reads again and retries", async () => {
    let collisions = 1;
    const { record, balance } = await atTheRegister((cards) => ({
      ...cards,
      appendEntry: async (data) => (collisions-- > 0 ? null : cards.appendEntry(data)),
    }));
    expect(await record({ type: "stamp" })).toMatchObject({ ok: true });
    expect(balance()).toEqual({ stamps: 1, rewards: 0 });
  });

  it("if the card keeps changing, gives up without saving and says it's busy", async () => {
    const { db, record } = await atTheRegister((cards) => ({
      ...cards,
      appendEntry: async () => null,
    }));
    expect(await record({ type: "stamp" })).toEqual({ ok: false, reason: "busy" });
    expect(db.stored.entries).toEqual([]);
  });
});

// Tocar dos veces o reintentar con mala señal nunca suma dos sellos: the register sends the version of the
// card the barista saw, and the entry is recorded only if the card is still at that version.
describe("record on the card the barista saw", () => {
  it("if the card is as they saw it, it's recorded", async () => {
    const { record, balance } = await atTheRegister();
    expect(await record({ type: "stamp" }, { seenVersion: 0 })).toMatchObject({ ok: true });
    expect(balance()).toEqual({ stamps: 1, rewards: 0 });
  });

  it("a second tap with the same version doesn't add another stamp", async () => {
    const { db, record } = await atTheRegister();
    await record({ type: "stamp" }, { seenVersion: 0 });
    await record({ type: "stamp" }, { seenVersion: 0 });
    expect(db.stored.entries).toHaveLength(1);
  });

  it("the second tap points to the entry the first one made", async () => {
    const { record } = await atTheRegister();
    const first = await record({ type: "stamp" }, { seenVersion: 0 });
    if (!first.ok) throw new Error("The stamp wasn't added.");
    expect(await record({ type: "stamp" }, { seenVersion: 0 })).toEqual({
      ok: false,
      reason: "card-changed",
      ownEntryId: first.entryId,
    });
  });

  it("if someone else changed the card, it doesn't point to their entry", async () => {
    const { record } = await atTheRegister();
    await record({ type: "stamp" }, { staffId: "juan", seenVersion: 0 });
    expect(await record({ type: "stamp" }, { seenVersion: 0 })).toEqual({
      ok: false,
      reason: "card-changed",
      ownEntryId: null,
    });
  });

  it("if the card changed more than once since, it doesn't point to any entry", async () => {
    const { record } = await atTheRegister();
    await record({ type: "stamp" });
    await record({ type: "stamp" });
    expect(await record({ type: "stamp" }, { seenVersion: 0 })).toMatchObject({
      reason: "card-changed",
      ownEntryId: null,
    });
  });

  it("a redeem tapped twice redeems only one reward", async () => {
    const { record, balance } = await atTheRegister();
    for (let i = 0; i < 14; i++) await record({ type: "stamp" });
    await record({ type: "redeem" }, { seenVersion: 14 });
    await record({ type: "redeem" }, { seenVersion: 14 });
    expect(balance()).toEqual({ stamps: 0, rewards: 1 });
  });
});
