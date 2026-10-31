// Use case: record a stamp, a redeem or an undo (Flujos B and C of the staff flows).
// Validates with the core rules and saves the entry and the card's new balance together, only if the card
// didn't change since it was read; if it did, it reads again and retries.
// With seenVersion (the version of the card the barista saw), it never retries on a card that changed:
// tapping twice or retrying with a bad connection never adds two stamps.
import type { Cafe } from "../cafes/types";
import { addStamp, type CardBalance, ledgerFrom, redeemReward, undo } from "../core/card";
import { cardConfig } from "./cardConfig";
import type { CardLedger, CardRepository } from "./ports";
import type { EntryKind } from "./receipt";

export type EntryRequest = {
  cardId: string;
  staffId: string;
  at: Date;
  /** The card's version on the barista's screen. If the card is no longer at it, nothing is recorded. */
  seenVersion?: number;
  /** The entry's id, if it already has one: the camera's reading (registerEntry.ts). */
  entryId?: string;
} & ({ type: "stamp" } | { type: "redeem" } | { type: "undo"; undoesId: string });

export type RecordResult =
  | {
      ok: true;
      entryId: string;
      balance: CardBalance;
      completesCard: boolean;
      /** What it was, as its confirmation says it. */
      kind: EntryKind;
      /** The card's version with this entry. */
      version: number;
    }
  | {
      ok: false;
      reason:
        | "no-rewards"
        | "not-found"
        | "already-undone"
        | "reward-redeemed"
        | "card-not-found"
        | "busy";
    }
  | {
      ok: false;
      reason: "card-changed";
      /**
       * If the only entry since what the barista saw is theirs, it was their own earlier tap (a double tap,
       * or a response lost on a bad connection): that entry. Otherwise null.
       */
      ownEntryId: string | null;
    };

/** How many times to retry if another action changed the card in the meantime. */
const ATTEMPTS = 3;

function cardChanged(card: CardLedger, request: EntryRequest, seenVersion: number): RecordResult {
  const last = card.records.at(-1);
  const onlyOwnTapSince = card.version === seenVersion + 1 && last?.staffId === request.staffId;
  return { ok: false, reason: "card-changed", ownEntryId: onlyOwnTapSince ? last.id : null };
}

export async function recordEntry(
  request: EntryRequest,
  cafe: Cafe,
  deps: { cards: CardRepository },
  /** The card's ledger, if it was already read (together with the card): the first try doesn't read it. */
  read?: CardLedger | null,
): Promise<RecordResult> {
  let alreadyRead = read;
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    const card = alreadyRead ?? (await deps.cards.findLedger({ cardId: request.cardId }));
    alreadyRead = undefined;
    if (!card) return { ok: false, reason: "card-not-found" };
    const { seenVersion } = request;
    if (seenVersion !== undefined && card.version !== seenVersion) {
      return cardChanged(card, request, seenVersion);
    }

    const entries = ledgerFrom(card.records);
    const perRound = cardConfig(cafe, card.type).stamps;
    let balance: CardBalance;
    let completesCard = false;
    let kind: EntryKind = request.type === "redeem" ? "redeem" : "stamp";
    if (request.type === "stamp") {
      ({ balance, completesCard } = addStamp(entries, perRound));
      if (completesCard) kind = "completed";
    } else {
      if (request.type === "undo") {
        const undone = entries.find((e) => e.id === request.undoesId);
        kind = undone?.type === "redeem" ? "undo-redeem" : "undo-stamp";
      }
      const result =
        request.type === "redeem"
          ? redeemReward(entries, perRound)
          : undo(entries, request.undoesId, perRound);
      if (!result.ok) return result;
      balance = result.balance;
    }

    const entryId = await deps.cards.appendEntry({
      cardId: request.cardId,
      versionRead: card.version,
      entryId: request.entryId,
      balance,
      entry: {
        type: request.type,
        undoesId: request.type === "undo" ? request.undoesId : null,
        staffId: request.staffId,
        at: request.at,
      },
    });
    if (entryId) {
      return { ok: true, entryId, balance, completesCard, kind, version: card.version + 1 };
    }
  }
  return { ok: false, reason: "busy" };
}
