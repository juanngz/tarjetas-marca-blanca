// A customer's cards, ready to show: in the café's fixed order and with their balance (spec, "Reglas y alcance").
// Used by the wallet and by each card's code screen.
import type { Cafe, CardColor, StampDrawing } from "../cafes/types";

export interface DisplayCard {
  type: string;
  name: string;
  color: CardColor;
  stamp: StampDrawing;
  stampsPerRound: number;
  stamps: number;
  rewards: number;
  /** The reward band text, if the card has one. */
  band: string | null;
  /**
   * What goes under the reward's slot, the last one: "Gratis". None on coffee beans: their 30% is drawn inside
   * the bag (19/10/2026). Also missing in a copy a phone kept before 18/10/2026 (web/offlineCopy.ts).
   */
  slot?: string;
  /**
   * Just completed: it has a reward and the new round has no stamp yet. It's shown full, with the reward
   * earned, until the reward is redeemed or the first stamp of the new round is added.
   */
  complete: boolean;
}

/**
 * What the counter counts up to: every slot, the reward's too, like the paper card (18/10/2026). With the 7th
 * stamp, "7 de 8": the 8th slot is the next purchase, with the reward. Stamping it is redeeming it.
 */
export function shownGoal(card: DisplayCard): number {
  return card.stampsPerRound + 1;
}

/** The reward's slot is lit while the next purchase is the reward's: the card is complete. */
export function rewardSlotReady(card: DisplayCard): boolean {
  return card.complete;
}

/** The rewards kept for later: all of them, except the one waiting in the lit slot. */
export function savedRewards(card: DisplayCard): number {
  return card.complete ? card.rewards - 1 : card.rewards;
}

/**
 * The band under the stamps: the card's rule, short, always (19/10/2026): "En la 5ª compra, 30% OFF". A reward kept for later
 * shows in the card's corner, and at the register.
 */
export function bandText(card: DisplayCard): string {
  return card.band ?? card.name;
}

/**
 * The reward, under the stamps, is lit while there's one to redeem (10/10/2026): from the stamp that earns it
 * until it's redeemed, even with stamps of the new round. Off, otherwise.
 */
export function rewardReady(card: DisplayCard): boolean {
  return card.rewards > 0;
}

/** The stamps to draw: all of them while the card is complete. What's stored doesn't change. */
export function shownStamps(card: DisplayCard): number {
  return card.complete ? card.stampsPerRound : card.stamps;
}

export function displayCards(
  cafe: Cafe,
  customerCards: readonly { type: string; stamps: number; rewards: number }[],
): DisplayCard[] {
  return cafe.cards.flatMap((config) => {
    const theirs = customerCards.find((card) => card.type === config.type);
    if (!theirs) return [];
    return [
      {
        type: config.type,
        name: config.name,
        color: config.color,
        stamp: config.stamp,
        stampsPerRound: config.stamps,
        stamps: theirs.stamps,
        rewards: theirs.rewards,
        band: config.texts.band ?? null,
        slot: config.texts.slot,
        complete: theirs.rewards > 0 && theirs.stamps === 0,
      },
    ];
  });
}
