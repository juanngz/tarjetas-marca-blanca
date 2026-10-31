// Use cases: what the barista does on a card (Flujos B and C of the staff flows). Who did it always comes
// from the session (the register passes it), never from the form. Once recorded, the customer's open code
// screen is told right away (the sello en vivo).
import type { Cafe } from "../cafes/types";
import { readCardCode } from "../core/codes";
import type { CardChange, CardRepository, CardWatchers, Logger } from "./ports";
import { type Receipt, receiptFor } from "./receipt";
import { type RecordResult, recordEntry } from "./recordEntry";

/**
 * What an action at the register answers: if it was recorded, its confirmation too, made from what it
 * already read (receiptFor), so the register doesn't read the card again to show it. null if it can't be
 * made (an unknown card): then the register reads it (receiptOf).
 */
export type RegisterResult =
  | Exclude<RecordResult, { ok: true }>
  | (Extract<RecordResult, { ok: true }> & { receipt: Receipt | null });

function withReceipt(
  result: RecordResult,
  card: { type: string; customerName: string },
  cafe: Cafe,
): RegisterResult {
  if (!result.ok) return result;
  const { entryId: id, kind, balance } = result;
  const { type, customerName } = card;
  return { ...result, receipt: receiptFor({ id, kind, type, customerName, balance }, cafe) };
}

export interface RegisterEntryDeps {
  cards: CardRepository;
  watchers: CardWatchers;
  logger: Logger;
}

/** Tells the card's open screens. If it can't, the watchers log it: the entry still counts. */
async function tell(
  cardId: string,
  result: RecordResult,
  kind: (completesCard: boolean) => CardChange["kind"],
  deps: RegisterEntryDeps,
) {
  if (!result.ok) return;
  await deps.watchers.changed(cardId, {
    version: result.version,
    kind: kind(result.completesCard),
  });
}

/**
 * Sumar sello or Canjear premio on the card on screen, only if it's still at the version the barista saw:
 * tapping twice or retrying with a bad connection never records twice.
 */
export async function recordOnCard(
  input: {
    shortCode: string;
    type: "stamp" | "redeem";
    seenVersion: number;
    staffId: string;
    at: Date;
  },
  cafe: Cafe,
  deps: RegisterEntryDeps,
): Promise<RegisterResult> {
  // The card and its ledger at once: one trip to the EU instead of two.
  const lookup = { shortCode: input.shortCode };
  const [card, ledger] = await Promise.all([
    deps.cards.findForRegister(lookup),
    deps.cards.findLedger(lookup),
  ]);
  if (!card) return { ok: false, reason: "card-not-found" };
  const { type, seenVersion, staffId, at } = input;
  const result = await recordEntry(
    { type, cardId: card.id, seenVersion, staffId, at },
    cafe,
    deps,
    ledger,
  );
  await tell(
    card.id,
    result,
    (completes) => (type === "redeem" ? "redeem" : completes ? "completed" : "stamp"),
    deps,
  );
  return withReceipt(result, card, cafe);
}

export type ScanResult =
  /** receipt: null when it's a reading sent again, whose stamp was already added: the register reads it. */
  | { result: "stamped"; entryId: string; receipt: Receipt | null }
  | { result: "has-reward"; shortCode: string }
  | { result: "not-a-code" }
  | { result: "not-found" }
  /** Without the reading's id, or with one already used on another card: nothing is added. */
  | { result: "no-scan" }
  | { result: "busy" };

/** The id the register makes up for each reading of the camera: a random UUID. */
const SCAN_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * The camera read a card's QR: it adds the stamp by itself (decided on 08/10/2026). Each card has its own
 * QR, so there's no doubt which; a mistake is undone on the confirmation. If the card has a reward, nothing
 * is added: it's used in this purchase, and the card opens with its notice.
 * Each reading comes with its own id (scanId), which becomes the stamp's id: the same reading sent again
 * (twice at once, or again after its answer was lost on a bad connection) adds one stamp, and shows its
 * confirmation. Two coffees are two readings, each with its id.
 */
export async function stampScannedCard(
  input: { code: string; scanId: string; staffId: string; at: Date },
  cafe: Cafe,
  deps: RegisterEntryDeps,
): Promise<ScanResult> {
  const code = readCardCode(input.code);
  if (!code) return { result: "not-a-code" };
  const { scanId, staffId, at } = input;
  if (!SCAN_ID.test(scanId)) return { result: "no-scan" };
  // The card, its ledger and whether this reading was already added, at once: one trip to the EU.
  const [card, ledger, stampedBefore] = await Promise.all([
    deps.cards.findForRegister(code),
    deps.cards.findLedger(code),
    deps.cards.findCardOfEntry(scanId),
  ]);
  if (!card) {
    deps.logger.log("register-card-not-found", { memberId: staffId });
    return { result: "not-found" };
  }
  // Before the reward: the reading that completed the card, sent again, is its confirmation.
  if (stampedBefore === card.id) return { result: "stamped", entryId: scanId, receipt: null };
  if (stampedBefore) return { result: "no-scan" };
  if (card.rewards > 0) return { result: "has-reward", shortCode: card.shortCode };

  const result = await recordEntry(
    { type: "stamp", cardId: card.id, seenVersion: card.version, entryId: scanId, staffId, at },
    cafe,
    deps,
    ledger,
  );
  await tell(card.id, result, (completes) => (completes ? "completed" : "stamp"), deps);
  if (result.ok) {
    const recorded = withReceipt(result, card, cafe);
    return {
      result: "stamped",
      entryId: result.entryId,
      receipt: recorded.ok ? recorded.receipt : null,
    };
  }
  // The same reading sent at once (a double submit) got there first: its stamp, not a second one.
  if (result.reason === "card-changed" && (await deps.cards.findCardOfEntry(scanId)) === card.id) {
    return { result: "stamped", entryId: scanId, receipt: null };
  }
  return { result: "busy" };
}

/** Deshacer: a new entry that cancels that one. Also from an old confirmation (decided on 07/10/2026). */
export async function undoEntry(
  input: { entryId: string; staffId: string; at: Date },
  cafe: Cafe,
  deps: RegisterEntryDeps,
): Promise<RegisterResult> {
  const cardId = await deps.cards.findCardOfEntry(input.entryId);
  // The card and its ledger at once. A card that isn't at the register any more (its customer was deleted)
  // can't be touched.
  const [card, ledger] = cardId
    ? await Promise.all([deps.cards.findForRegister({ cardId }), deps.cards.findLedger({ cardId })])
    : [null, null];
  if (!card) return { ok: false, reason: "not-found" };
  const { entryId, staffId, at } = input;
  const result = await recordEntry(
    { type: "undo", undoesId: entryId, cardId: card.id, staffId, at },
    cafe,
    deps,
    ledger,
  );
  await tell(card.id, result, () => "undo", deps);
  return withReceipt(result, card, cafe);
}
