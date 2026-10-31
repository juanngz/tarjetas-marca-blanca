// What the register's confirmation says (Flujos B and C): what happened, with the data and a small Deshacer.
// The same on its own screen and in the sheet over the register (08/10/2026). Like a receipt: the card as
// that entry left it. No animation: the barista sees it dozens of times a day (movimiento.md).
import type { ReactNode } from "react";
import { type DisplayCard, shownGoal, shownStamps } from "../core/displayCard";
import { rewardsText } from "./Card";
import { CheckIcon, GiftIcon, UndoIcon } from "./icons";
import { keepTogether } from "./text";

export const RECEIPT_TITLES = {
  stamp: "Sello sumado",
  // The 7th (or 4th) stamp: the card isn't complete yet, its reward's slot is the next purchase (18/10/2026).
  completed: "Sello sumado",
  redeem: "Premio canjeado",
  "undo-stamp": "Sello deshecho",
  "undo-redeem": "Canje deshecho",
} as const;

/** What the confirmation shows: an entry and the card as it left it. */
export interface ShownReceipt {
  kind: keyof typeof RECEIPT_TITLES;
  customerName: string;
  firstName: string;
  card: DisplayCard;
  leftForReward: string;
  won: string;
  reward: string;
  canUndo: boolean;
}

export function ReceiptBody({
  receipt,
  titleId,
  undo,
  Heading = "h1",
}: {
  receipt: ShownReceipt;
  titleId?: string;
  /** The Deshacer form, when it can be undone. */
  undo?: ReactNode;
  Heading?: "h1" | "h2";
}) {
  const { kind, customerName, firstName, card, leftForReward, won, reward } = receipt;
  const capitalized = (text: string) => `${text[0].toUpperCase()}${text.slice(1)}`;
  const counter = kind === "stamp" || kind === "completed" || kind === "undo-stamp";
  const undone = kind === "undo-stamp" || kind === "undo-redeem";
  return (
    <>
      {/* Every confirmation with its icon, next to the word: done, or undone. */}
      <span
        className={`done__mark${
          undone
            ? " done__mark--undo"
            : kind === "redeem" || kind === "completed"
              ? " done__mark--reward"
              : ""
        }`}
        aria-hidden="true"
      >
        {undone ? <UndoIcon /> : kind === "redeem" ? <GiftIcon /> : <CheckIcon />}
      </span>
      <Heading id={titleId} className="title title--xl">
        {RECEIPT_TITLES[kind]}
      </Heading>
      {kind === "completed" && (
        <p className="done__news">
          {firstName} ganó {keepTogether(won)}. Decíselo.
        </p>
      )}
      {kind === "redeem" && <p className="done__news">{capitalized(reward)}.</p>}

      <div className="done__detail">
        <p className="done__who">
          {customerName} · <span className="unit">{keepTogether(card.name)}</span>
        </p>
        {counter && (
          <p className="counter">
            <span className="counter__number">
              {shownStamps(card)} <span className="counter__of">de</span> {shownGoal(card)}
            </span>{" "}
            <span className="label">sellos</span>
          </p>
        )}
        {/* Like the paper card (18/10/2026): the 7th (4th) stamp leaves the reward's slot as the next purchase,
            and redeeming it, the last slot, completes the card. */}
        <p className="secondary">
          {kind === "completed"
            ? "La próxima compra es la del premio."
            : kind === "redeem"
              ? card.rewards > 0
                ? `La tarjeta vuelve a empezar. Tiene ${rewardsText(card.rewards)}.`
                : "La tarjeta vuelve a empezar."
              : kind === "undo-redeem"
                ? card.rewards > 0
                  ? `Tiene ${rewardsText(card.rewards)}.`
                  : "No le quedan premios para canjear."
                : leftForReward}
        </p>
        {/* Small and away from the thumb (08/10/2026): undoing is rare, and a big button got tapped by
            mistake. It's still in sight, as the brand asks: everything can be undone. */}
        {receipt.canUndo && undo}
      </div>
    </>
  );
}
