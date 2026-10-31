import { describe, expect, it } from "vitest";
import {
  addStamp,
  balanceAfter,
  cardBalance,
  type Entry,
  type EntryRecord,
  ledgerFrom,
  redeemReward,
  rewardWonBy,
  undo,
} from "./card";

const TAKE_AWAY = 7;
const BEANS = 4;

let nextId = 0;
function entry(type: Entry["type"], changes: Partial<Entry> = {}): Entry {
  nextId += 1;
  return {
    id: `e${nextId}`,
    type,
    at: new Date("2026-10-06T12:00:00Z"),
    undone: false,
    ...changes,
  };
}
const stamps = (amount: number) => Array.from({ length: amount }, () => entry("stamp"));

describe("card balance", () => {
  it("with no entries, it's empty", () => {
    expect(cardBalance([], TAKE_AWAY)).toEqual({ stamps: 0, rewards: 0 });
  });

  it("counts the stamps of the round", () => {
    expect(cardBalance(stamps(5), TAKE_AWAY).stamps).toBe(5);
  });

  it("rewards add up", () => {
    expect(cardBalance(stamps(14), TAKE_AWAY).rewards).toBe(2);
  });

  it("keeps adding even with unredeemed rewards", () => {
    expect(cardBalance(stamps(9), TAKE_AWAY)).toEqual({ stamps: 2, rewards: 1 });
  });

  it("an undone entry doesn't count", () => {
    const entries = [...stamps(3), entry("stamp", { undone: true })];
    expect(cardBalance(entries, TAKE_AWAY).stamps).toBe(3);
  });

  it("stamps never expire", () => {
    const old = stamps(3).map((e) => ({ ...e, at: new Date("2020-01-01T12:00:00Z") }));
    expect(cardBalance(old, TAKE_AWAY).stamps).toBe(3);
  });

  it("rewards never expire", () => {
    const old = stamps(4).map((e) => ({ ...e, at: new Date("2020-01-01T12:00:00Z") }));
    expect(cardBalance(old, BEANS).rewards).toBe(1);
  });
});

describe("add a stamp", () => {
  it("adds one stamp", () => {
    expect(addStamp(stamps(5), TAKE_AWAY).balance.stamps).toBe(6);
  });

  it("take-away is completed with the seventh stamp", () => {
    expect(addStamp(stamps(6), TAKE_AWAY).completesCard).toBe(true);
  });

  it("coffee beans are completed with the fourth stamp", () => {
    expect(addStamp(stamps(3), BEANS).completesCard).toBe(true);
  });

  it("the stamp before the last doesn't complete the card", () => {
    expect(addStamp(stamps(5), TAKE_AWAY).completesCard).toBe(false);
  });

  it("when the card is completed, stamps go back to zero", () => {
    expect(addStamp(stamps(6), TAKE_AWAY).balance.stamps).toBe(0);
  });

  it("when the card is completed, it earns a reward", () => {
    expect(addStamp(stamps(6), TAKE_AWAY).balance.rewards).toBe(1);
  });
});

describe("redeem a reward", () => {
  it("takes away one reward", () => {
    expect(redeemReward(stamps(8), BEANS)).toEqual({
      ok: true,
      balance: { stamps: 0, rewards: 1 },
    });
  });

  it("doesn't add a stamp", () => {
    const result = redeemReward(stamps(9), BEANS);
    expect(result.ok && result.balance.stamps).toBe(1);
  });

  it("can't redeem without rewards", () => {
    expect(redeemReward(stamps(3), BEANS)).toEqual({ ok: false, reason: "no-rewards" });
  });

  it("can't redeem the same reward twice", () => {
    const entries = [...stamps(4), entry("redeem")];
    expect(redeemReward(entries, BEANS)).toEqual({ ok: false, reason: "no-rewards" });
  });
});

describe("undo", () => {
  it("undoing a stamp takes it away", () => {
    const last = entry("stamp");
    const result = undo([...stamps(4), last], last.id, TAKE_AWAY);
    expect(result).toEqual({ ok: true, balance: { stamps: 4, rewards: 0 } });
  });

  it("undoing the stamp that completed the card takes away the reward", () => {
    const last = entry("stamp");
    const result = undo([...stamps(3), last], last.id, BEANS);
    expect(result).toEqual({ ok: true, balance: { stamps: 3, rewards: 0 } });
  });

  it("undoing a redeem gives the reward back", () => {
    const redeem = entry("redeem");
    const result = undo([...stamps(4), redeem], redeem.id, BEANS);
    expect(result).toEqual({ ok: true, balance: { stamps: 0, rewards: 1 } });
  });

  it("a stamp that completed the card can't be undone if its reward was redeemed", () => {
    const completing = entry("stamp");
    const entries = [...stamps(3), completing, entry("redeem")];
    expect(undo(entries, completing.id, BEANS)).toEqual({
      ok: false,
      reason: "reward-redeemed",
    });
  });

  it("can't undo twice", () => {
    const undone = entry("stamp", { undone: true });
    expect(undo([...stamps(2), undone], undone.id, TAKE_AWAY)).toEqual({
      ok: false,
      reason: "already-undone",
    });
  });

  it("can't undo an entry that isn't from the card", () => {
    expect(undo(stamps(2), "other", TAKE_AWAY)).toEqual({ ok: false, reason: "not-found" });
  });
});

// A reward redeemed under the rule before 09/10/2026 (one stamp fewer per round): with the new rule the card
// owes it, and it's taken from the next reward (migration 0008). FIVE stamps a round, like coffee beans now.
describe("a reward redeemed under the rule before, owed by the card", () => {
  const FIVE = 5;
  const owing = () => [...stamps(4), entry("redeem")];

  it("never shows fewer than zero rewards", () => {
    expect(cardBalance(owing(), FIVE)).toEqual({ stamps: 4, rewards: 0 });
  });

  it("the stamp that ends the round pays it back: it doesn't win a reward", () => {
    expect(addStamp(owing(), FIVE)).toEqual({
      completesCard: false,
      balance: { stamps: 0, rewards: 0 },
    });
  });

  it("the round after that wins its reward as usual", () => {
    // One stamp pays it back, then a whole round.
    const entries = [...owing(), ...stamps(1 + 5)];
    expect(addStamp(entries.slice(0, -1), FIVE).completesCard).toBe(true);
    expect(cardBalance(entries, FIVE)).toEqual({ stamps: 0, rewards: 1 });
  });

  it("a stamp can still be undone", () => {
    const entries = owing();
    expect(undo(entries, entries[3].id, FIVE)).toEqual({
      ok: true,
      balance: { stamps: 3, rewards: 0 },
    });
  });

  it("the stamp that pays it back can be undone: it won nothing", () => {
    const payingBack = entry("stamp");
    expect(undo([...owing(), payingBack], payingBack.id, FIVE)).toEqual({
      ok: true,
      balance: { stamps: 4, rewards: 0 },
    });
  });

  it("a stamp of the round after, whose reward was redeemed, can't be undone", () => {
    // One stamp pays it back, a whole round wins a reward, and it's redeemed.
    const entries = [...owing(), ...stamps(1 + 5), entry("redeem")];
    expect(undo(entries, entries[10].id, FIVE)).toEqual({ ok: false, reason: "reward-redeemed" });
  });

  it("the redeem can be undone, and gives nothing back", () => {
    const entries = owing();
    expect(undo(entries, entries[4].id, FIVE)).toEqual({
      ok: true,
      balance: { stamps: 4, rewards: 0 },
    });
  });

  it("can't redeem: there's no reward", () => {
    expect(redeemReward(owing(), FIVE)).toEqual({ ok: false, reason: "no-rewards" });
  });
});

describe("whether a stamp won a reward", () => {
  const at = new Date("2026-10-06T12:00:00Z");
  const record = (id: string, type: EntryRecord["type"], undoesId: string | null = null) => ({
    id,
    type,
    undoesId,
    at,
  });
  const fiveStamps = ["a", "b", "c", "d", "e"].map((id) => record(id, "stamp"));

  it("the stamp that ends the round wins it", () => {
    expect(rewardWonBy(fiveStamps, "e", 5)).toBe(true);
  });

  it("a stamp in the middle of the round doesn't", () => {
    expect(rewardWonBy(fiveStamps, "d", 5)).toBe(false);
  });

  it("the stamp that pays back a reward redeemed under the rule before doesn't", () => {
    const records = [...fiveStamps.slice(0, 4), record("r", "redeem"), record("e", "stamp")];
    expect(rewardWonBy(records, "e", 5)).toBe(false);
  });

  it("a redeem never wins one", () => {
    expect(rewardWonBy([...fiveStamps, record("r", "redeem")], "r", 5)).toBe(false);
  });
});

describe("the ledger from its records", () => {
  const at = new Date("2026-10-06T12:00:00Z");

  it("a stamp and a redeem are entries", () => {
    const ledger = ledgerFrom([
      { id: "a", type: "stamp", undoesId: null, at },
      { id: "b", type: "redeem", undoesId: null, at },
    ]);
    expect(ledger.map((e) => [e.id, e.type, e.undone])).toEqual([
      ["a", "stamp", false],
      ["b", "redeem", false],
    ]);
  });

  it("an undo marks the entry it cancels as undone", () => {
    const ledger = ledgerFrom([
      { id: "a", type: "stamp", undoesId: null, at },
      { id: "u", type: "undo", undoesId: "a", at },
    ]);
    expect(ledger).toEqual([{ id: "a", type: "stamp", at, undone: true }]);
  });

  it("an undo isn't an entry of the ledger", () => {
    const ledger = ledgerFrom([
      { id: "a", type: "stamp", undoesId: null, at },
      { id: "u", type: "undo", undoesId: "a", at },
    ]);
    expect(ledger.map((e) => e.id)).toEqual(["a"]);
  });
});

describe("the balance right after an entry, as it was then", () => {
  const at = new Date("2026-10-06T12:00:00Z");
  const record = (id: string, type: EntryRecord["type"], undoesId: string | null = null) => ({
    id,
    type,
    undoesId,
    at,
  });

  it("counts the entries up to that one", () => {
    const records = [record("a", "stamp"), record("b", "stamp"), record("c", "stamp")];
    expect(balanceAfter(records, "b", TAKE_AWAY)).toEqual({ stamps: 2, rewards: 0 });
  });

  it("an undo that came later doesn't change it", () => {
    const records = [record("a", "stamp"), record("b", "stamp"), record("u", "undo", "a")];
    expect(balanceAfter(records, "b", TAKE_AWAY)).toEqual({ stamps: 2, rewards: 0 });
  });

  it("after an undo, the entry it cancels no longer counts", () => {
    const records = [record("a", "stamp"), record("b", "stamp"), record("u", "undo", "a")];
    expect(balanceAfter(records, "u", TAKE_AWAY)).toEqual({ stamps: 1, rewards: 0 });
  });

  it("after the stamp that completes the card, stamps are back to zero with a reward", () => {
    const records = ["a", "b", "c", "d"].map((id) => record(id, "stamp"));
    expect(balanceAfter(records, "d", BEANS)).toEqual({ stamps: 0, rewards: 1 });
  });

  it("after a redeem, one reward less", () => {
    const records = [
      ...["a", "b", "c", "d"].map((id) => record(id, "stamp")),
      record("r", "redeem"),
    ];
    expect(balanceAfter(records, "r", BEANS)).toEqual({ stamps: 0, rewards: 0 });
  });

  it("an entry that isn't from the card has no balance", () => {
    expect(balanceAfter([record("a", "stamp")], "other", TAKE_AWAY)).toBeNull();
  });
});
