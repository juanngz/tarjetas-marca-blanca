// The register's confirmation of an entry, ready to show (Flujos B and C): on its own screen or in the sheet
// over the register (08/10/2026). Made in one place (receiptFor): from the ledger on its screen (viewEntry),
// or from what the action already read, so the register doesn't read the card again to show it.
import type { Cafe } from "../cafes/types";
import type { CardBalance } from "../core/card";
import { firstName } from "../core/customerName";
import { type DisplayCard, displayCards } from "../core/displayCard";
import { leftForReward } from "../core/progress";
import { cardConfig } from "./cardConfig";
import type { ViewEntryResult } from "./viewEntry";

export type EntryKind = "stamp" | "completed" | "redeem" | "undo-stamp" | "undo-redeem";

export interface Receipt {
  /** The entry, to undo it from the sheet. */
  id: string;
  kind: EntryKind;
  customerName: string;
  firstName: string;
  /** The card as the entry left it. */
  card: DisplayCard;
  leftForReward: string;
  /** "un café take-away gratis", to say what she won. */
  won: string;
  /** "30% OFF en ¼ kg", to say what was redeemed. */
  reward: string;
  /** A stamp or a redeem can be undone; an undo can't. */
  canUndo: boolean;
}

/** The confirmation of an entry: what it was, whose card, and the card as it left it. null: an unknown card. */
export function receiptFor(
  entry: { id: string; kind: EntryKind; type: string; customerName: string; balance: CardBalance },
  cafe: Cafe,
): Receipt | null {
  const [shown] = displayCards(cafe, [{ type: entry.type, ...entry.balance }]);
  if (!shown) return null;
  const config = cardConfig(cafe, entry.type);
  return {
    id: entry.id,
    kind: entry.kind,
    customerName: entry.customerName,
    firstName: firstName(entry.customerName),
    card: shown,
    leftForReward: leftForReward({ ...shown, goal: config.texts.goal }),
    won: config.texts.won,
    reward: config.reward,
    canUndo: !entry.kind.startsWith("undo"),
  };
}

/** The confirmation of that entry, read from its card's ledger, or null if there isn't one. */
export async function receiptOf(
  viewEntry: (entryId: string) => Promise<ViewEntryResult>,
  entryId: string,
): Promise<Receipt | null> {
  const view = await viewEntry(entryId);
  if (view.result === "undone") return receiptOf(viewEntry, view.undoId);
  if (view.result !== "found") return null;
  const { result: _, ...entry } = view;
  return { id: entryId, ...entry };
}
