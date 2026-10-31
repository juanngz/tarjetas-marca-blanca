// Use case: the card the barista found (Flujo B): the customer's name, the card as she sees it, how many
// stamps are left and the version on screen, so what the barista taps applies to what they saw.
import type { Cafe } from "../cafes/types";
import { normalizeShortCode } from "../core/codes";
import { firstName } from "../core/customerName";
import { type DisplayCard, displayCards } from "../core/displayCard";
import { leftForReward } from "../core/progress";
import { cardConfig } from "./cardConfig";
import type { CardRepository } from "./ports";

export type ViewRegisterCardResult =
  | {
      result: "found";
      customerName: string;
      /** To ask before redeeming: "¿Canjear el premio de Marta?" */
      firstName: string;
      card: DisplayCard;
      leftForReward: string;
      /** What the reward is, to ask before redeeming it: "un café take-away gratis". */
      reward: string;
      version: number;
    }
  | { result: "not-found" };

export async function viewRegisterCard(
  input: { shortCode: string },
  cafe: Cafe,
  deps: { cards: CardRepository },
): Promise<ViewRegisterCardResult> {
  const shortCode = normalizeShortCode(input.shortCode);
  const stored = shortCode ? await deps.cards.findForRegister({ shortCode }) : null;
  const [card] = stored ? displayCards(cafe, [stored]) : [];
  if (!stored || !card) return { result: "not-found" };
  const config = cardConfig(cafe, card.type);
  return {
    result: "found",
    customerName: stored.customerName,
    firstName: firstName(stored.customerName),
    card,
    leftForReward: leftForReward({ ...card, goal: config.texts.goal }),
    reward: config.reward,
    version: stored.version,
  };
}
