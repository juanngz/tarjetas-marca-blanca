// A card's balance is computed from its entries (the ledger).
// See ../../../docs/implementacion/arquitectura.md, "La base de datos".

export type EntryType = "stamp" | "redeem";

export interface Entry {
  id: string;
  type: EntryType;
  at: Date;
  undone: boolean;
}

/** A row as it's stored: an undo is one more record, that says which entry it cancels. */
export interface EntryRecord {
  id: string;
  type: EntryType | "undo";
  undoesId: string | null;
  at: Date;
}

/**
 * The ledger from its stored records: stamps and redeems, marked as undone if an undo cancels them.
 * Undos aren't entries of the ledger: nothing is crossed out, an undo is one more record.
 */
export function ledgerFrom(records: readonly EntryRecord[]): Entry[] {
  const cancelled = new Set(records.map((r) => r.undoesId).filter((id) => id !== null));
  return records.flatMap((r) =>
    r.type === "undo" ? [] : [{ id: r.id, type: r.type, at: r.at, undone: cancelled.has(r.id) }],
  );
}

export interface CardBalance {
  /** Stamps in the current round: from 0 to stampsPerRound − 1. */
  stamps: number;
  /** Rewards earned and not yet redeemed. Never fewer than zero. */
  rewards: number;
}

export type RedeemResult = { ok: true; balance: CardBalance } | { ok: false; reason: "no-rewards" };

export type UndoResult =
  | { ok: true; balance: CardBalance }
  | { ok: false; reason: "not-found" | "already-undone" | "reward-redeemed" };

function count(entries: readonly Entry[]) {
  let stamps = 0;
  let redeems = 0;
  for (const e of entries) {
    if (e.undone) continue;
    if (e.type === "stamp") stamps += 1;
    else redeems += 1;
  }
  return { stamps, redeems };
}

/**
 * The balance right after an entry, as it was then: what came later (even an undo of an earlier entry)
 * doesn't count. The records go in the ledger's order. For the register's confirmation, which is like a
 * receipt: reloading it or coming back to it later shows the same. null if the entry isn't from the card.
 */
export function balanceAfter(
  records: readonly EntryRecord[],
  entryId: string,
  stampsPerRound: number,
): CardBalance | null {
  const index = records.findIndex((r) => r.id === entryId);
  if (index === -1) return null;
  return cardBalance(ledgerFrom(records.slice(0, index + 1)), stampsPerRound);
}

/**
 * Whether that stamp won a reward, as it was then: it ended the round and the card got one more to redeem.
 * For the register's confirmation (Tarjeta completa). A redeem, an undo, or a stamp that paid back an owed
 * reward didn't.
 */
export function rewardWonBy(
  records: readonly EntryRecord[],
  entryId: string,
  stampsPerRound: number,
): boolean {
  const index = records.findIndex((r) => r.id === entryId);
  if (index === -1 || records[index].type !== "stamp") return false;
  return addStamp(ledgerFrom(records.slice(0, index)), stampsPerRound).completesCard;
}

/**
 * Rewards earned minus rewards redeemed. Below zero only on a card with a redeem that had no reward under
 * the rule that counts now, like the ones migration 0008 left owed (09/10/2026, one stamp more per round; 0011
 * went back to 7 and 4 the next day): the card owes it, and the next reward pays it back. It's never shown:
 * the balance says zero.
 */
function netRewards(entries: readonly Entry[], stampsPerRound: number): number {
  const { stamps, redeems } = count(entries);
  return Math.floor(stamps / stampsPerRound) - redeems;
}

/** Stamps and rewards never expire: the date of each entry doesn't matter. */
export function cardBalance(entries: readonly Entry[], stampsPerRound: number): CardBalance {
  return {
    stamps: count(entries).stamps % stampsPerRound,
    rewards: Math.max(0, netRewards(entries, stampsPerRound)),
  };
}

/**
 * A stamp can always be added, whether or not there are unredeemed rewards. It completes the card when it
 * ends the round and wins a reward: the one that pays back an owed reward doesn't.
 */
export function addStamp(entries: readonly Entry[], stampsPerRound: number) {
  const after = [...entries, { id: "", type: "stamp" as const, at: new Date(0), undone: false }];
  const won = netRewards(after, stampsPerRound) > netRewards(entries, stampsPerRound);
  const balance = cardBalance(after, stampsPerRound);
  return { completesCard: won && balance.rewards > 0, balance };
}

/** Redeeming takes away one reward and doesn't add a stamp. */
export function redeemReward(entries: readonly Entry[], stampsPerRound: number): RedeemResult {
  const balance = cardBalance(entries, stampsPerRound);
  if (balance.rewards < 1) return { ok: false, reason: "no-rewards" };
  return { ok: true, balance: { stamps: balance.stamps, rewards: balance.rewards - 1 } };
}

/**
 * The redeems that had a reward to take when they were made, in the ledger's order. An owed one (netRewards)
 * didn't.
 */
function coveredRedeems(entries: readonly Entry[], stampsPerRound: number): Set<string> {
  const covered = new Set<string>();
  let stamps = 0;
  let redeems = 0;
  for (const e of entries) {
    if (e.undone) continue;
    if (e.type === "stamp") {
      stamps += 1;
      continue;
    }
    if (Math.floor(stamps / stampsPerRound) - redeems >= 1) covered.add(e.id);
    redeems += 1;
  }
  return covered;
}

/**
 * Undo marks the entry; it deletes nothing. A stamp that completed the card
 * can't be undone if its reward was already redeemed: undo the redeem first.
 * That is, it can't leave a redeem that had its reward without it. An owed redeem (netRewards) never had
 * one, so the stamp that pays it back can be undone.
 */
export function undo(entries: readonly Entry[], id: string, stampsPerRound: number): UndoResult {
  const chosen = entries.find((e) => e.id === id);
  if (!chosen) return { ok: false, reason: "not-found" };
  if (chosen.undone) return { ok: false, reason: "already-undone" };

  const after = entries.map((e) => (e.id === id ? { ...e, undone: true } : e));
  const stillCovered = coveredRedeems(after, stampsPerRound);
  for (const redeem of coveredRedeems(entries, stampsPerRound)) {
    if (redeem !== id && !stillCovered.has(redeem)) return { ok: false, reason: "reward-redeemed" };
  }
  return { ok: true, balance: cardBalance(after, stampsPerRound) };
}
