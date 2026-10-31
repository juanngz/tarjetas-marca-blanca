import { describe, expect, it } from "vitest";
import { NOON, registerWithMarta } from "../../test/register";
import { recordOnCard, undoEntry } from "./registerEntry";
import { viewEntry } from "./viewEntry";

async function atTheRegister() {
  const setup = await registerWithMarta();
  const { db, cafe, deps } = setup;
  let version: Record<string, number> = {};
  const tap = async (type: "stamp" | "redeem", shortCode = "K7M2QX") => {
    const seen = version[shortCode] ?? 0;
    const result = await recordOnCard(
      { shortCode, type, seenVersion: seen, staffId: "ana", at: NOON },
      cafe,
      deps,
    );
    if (!result.ok) throw new Error(`Not recorded: ${result.reason}.`);
    version = { ...version, [shortCode]: seen + 1 };
    return result.entryId;
  };
  const undo = async (entryId: string, shortCode = "K7M2QX") => {
    const result = await undoEntry({ entryId, staffId: "ana", at: NOON }, cafe, deps);
    if (!result.ok) throw new Error(`Not undone: ${result.reason}.`);
    version = { ...version, [shortCode]: (version[shortCode] ?? 0) + 1 };
    return result.entryId;
  };
  const view = (entryId: string) => viewEntry({ entryId }, cafe, { cards: db.cards });
  return { ...setup, tap, undo, view };
}

describe("the confirmation at the register", () => {
  it("a stamp: who, which card and how it was left", async () => {
    const { tap, view } = await atTheRegister();
    expect(await view(await tap("stamp"))).toMatchObject({
      result: "found",
      kind: "stamp",
      customerName: "Marta García",
      card: { name: "Café take-away", stamps: 1, stampsPerRound: 7 },
      leftForReward: "Le faltan 6 para el café gratis.",
      canUndo: true,
    });
  });

  it("the stamp that completes the card says what she won, by her first name", async () => {
    const { tap, view } = await atTheRegister();
    for (let i = 0; i < 3; i++) await tap("stamp", "BBBBBB");
    expect(await view(await tap("stamp", "BBBBBB"))).toMatchObject({
      kind: "completed",
      firstName: "Marta",
      won: "30% OFF en su próxima bolsa de ¼ kg",
      card: { stamps: 0, rewards: 1 },
    });
  });

  it("the stamp that pays back a reward redeemed under the rule before isn't Tarjeta completa", async () => {
    // 3 stamps and a redeem without a reward to take, like the ones migration 0008 left owed: the card owes
    // that reward, and the 4th stamp pays it back.
    const { db, cardId, tap, view } = await atTheRegister();
    for (let i = 0; i < 3; i++) await tap("stamp", "BBBBBB");
    db.stored.entries.push({
      id: "redeemed-before",
      cardId: cardId("BBBBBB"),
      type: "redeem",
      undoesId: null,
      at: NOON,
      staffId: "ana",
    });
    expect(await view(await tap("stamp", "BBBBBB"))).toMatchObject({
      kind: "stamp",
      card: { stamps: 0, rewards: 0 },
    });
  });

  it("a redeem says which reward, so the barista charges right", async () => {
    const { tap, view } = await atTheRegister();
    for (let i = 0; i < 4; i++) await tap("stamp", "BBBBBB");
    expect(await view(await tap("redeem", "BBBBBB"))).toMatchObject({
      kind: "redeem",
      reward: "30% OFF en ¼ kg",
      card: { rewards: 0 },
      canUndo: true,
    });
  });

  it("an undone stamp: how the card was left, and it can't be undone again", async () => {
    const { tap, undo, view } = await atTheRegister();
    await tap("stamp");
    const undone = await undo(await tap("stamp"));
    expect(await view(undone)).toMatchObject({
      kind: "undo-stamp",
      card: { stamps: 1 },
      canUndo: false,
    });
  });

  it("an undone redeem", async () => {
    const { tap, undo, view } = await atTheRegister();
    for (let i = 0; i < 5; i++) await tap("stamp", "BBBBBB");
    const undone = await undo(await tap("redeem", "BBBBBB"), "BBBBBB");
    expect(await view(undone)).toMatchObject({ kind: "undo-redeem", card: { rewards: 1 } });
  });

  it("is like a receipt: what came later doesn't change it", async () => {
    const { tap, view } = await atTheRegister();
    const first = await tap("stamp");
    await tap("stamp");
    expect(await view(first)).toMatchObject({ card: { stamps: 1 } });
  });

  it("an entry that was undone points to its undo", async () => {
    const { tap, undo, view } = await atTheRegister();
    const stamp = await tap("stamp");
    const undone = await undo(stamp);
    expect(await view(stamp)).toEqual({ result: "undone", undoId: undone });
  });

  it("an entry that doesn't exist isn't found", async () => {
    const { view } = await atTheRegister();
    expect(await view("nope")).toEqual({ result: "not-found" });
  });

  it("a card whose customer was deleted isn't shown", async () => {
    const { db, tap, view } = await atTheRegister();
    const stamp = await tap("stamp");
    db.stored.customers.delete("marta");
    expect(await view(stamp)).toEqual({ result: "not-found" });
  });
});
