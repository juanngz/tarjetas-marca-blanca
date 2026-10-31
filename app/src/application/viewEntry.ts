// Use case: the register's confirmation of an entry (Flujos B and C): Sello sumado, Tarjeta completa,
// Premio canjeado, Sello deshecho or Canje deshecho. It's like a receipt: it shows the card as that entry
// left it, so reloading it or coming back to it later shows the same.
import type { Cafe } from "../cafes/types";
import { balanceAfter, rewardWonBy } from "../core/card";
import { cardConfig } from "./cardConfig";
import type { CardRepository } from "./ports";
import { type EntryKind, type Receipt, receiptFor } from "./receipt";

export type { EntryKind } from "./receipt";

export type ViewEntryResult =
  | ({ result: "found" } & Omit<Receipt, "id">)
  /** It was undone: its confirmation is the undo's. */
  | { result: "undone"; undoId: string }
  | { result: "not-found" };

export async function viewEntry(
  input: { entryId: string },
  cafe: Cafe,
  deps: { cards: CardRepository },
): Promise<ViewEntryResult> {
  const cardId = await deps.cards.findCardOfEntry(input.entryId);
  const [card, ledger] = cardId
    ? await Promise.all([deps.cards.findForRegister({ cardId }), deps.cards.findLedger({ cardId })])
    : [null, null];
  if (!card || !ledger) return { result: "not-found" };

  const { records } = ledger;
  const entry = records.find((r) => r.id === input.entryId);
  const undoneBy = records.find((r) => r.undoesId === input.entryId);
  if (undoneBy) return { result: "undone", undoId: undoneBy.id };

  const stampsPerRound = cardConfig(cafe, card.type).stamps;
  const balance = balanceAfter(records, input.entryId, stampsPerRound);
  if (!entry || !balance) return { result: "not-found" };

  const undone = records.find((r) => r.id === entry.undoesId);
  const kind: EntryKind =
    entry.type === "undo"
      ? undone?.type === "redeem"
        ? "undo-redeem"
        : "undo-stamp"
      : entry.type === "redeem"
        ? "redeem"
        : rewardWonBy(records, input.entryId, stampsPerRound)
          ? "completed"
          : "stamp";

  const receipt = receiptFor(
    { id: input.entryId, kind, type: card.type, customerName: card.customerName, balance },
    cafe,
  );
  if (!receipt) return { result: "not-found" };
  const { id: _, ...shown } = receipt;
  return { result: "found", ...shown };
}
