// Use case: one card's code (Flujo 3): the card with its QR code and its short code. Also what the
// screen needs for the sello en vivo: the card's version, and the texts to celebrate and to say the
// reward was redeemed (Flujo 4 of the customer flows). And whether it has movements, to link them; the
// movements themselves only for their own screen (withHistory): the ledger grows forever.
import type { Cafe } from "../cafes/types";
import { firstName } from "../core/customerName";
import { type DisplayCard, displayCards } from "../core/displayCard";
import { customerHistory, type HistoryItem } from "../core/history";
import { cardConfig } from "./cardConfig";
import type { CardRepository, CustomerRepository } from "./ports";

export interface ViewCardDeps {
  customers: CustomerRepository;
  cards: CardRepository;
}

export type ViewCardResult =
  | {
      result: "found";
      card: DisplayCard & { qrCode: string; shortCode: string };
      /** Goes up with each entry: the screen knows it's up to date by it. */
      version: number;
      /** "¡Completaste la tarjeta! …" */
      celebration: string;
      /** "Este café va por cuenta de la casa. Que lo disfrutes, Marta." */
      rewardRedeemed: string;
      /** Whether a stamp or a redeem counts: Ver mis sellos y premios only shows then. */
      hasMovements: boolean;
      /** With withHistory: the last stamps and redeems that count, the newest first. */
      history?: HistoryItem[];
    }
  | { result: "not-found" }
  /** The customer no longer exists (they were deleted, but their cookie is still around). */
  | { result: "signed-out" };

/** How many movements the code screen shows. */
const HISTORY_LIMIT = 20;

export async function viewCard(
  input: { customerId: string; type: string | undefined; withHistory?: boolean },
  cafe: Cafe,
  deps: ViewCardDeps,
): Promise<ViewCardResult> {
  // At once: the database is in the EU, and one after another each would be one more trip.
  const [customer, theirs, hasMovements] = await Promise.all([
    deps.customers.findById(input.customerId),
    deps.cards.findByCustomer(input.customerId),
    input.withHistory ? null : deps.cards.hasMovements(input.customerId, input.type ?? ""),
  ]);
  if (!customer) return { result: "signed-out" };

  const stored = theirs.find((c) => c.type === input.type);
  const [card] = stored ? displayCards(cafe, [stored]) : [];
  if (!stored || !card) return { result: "not-found" };

  const { texts } = cardConfig(cafe, card.type);
  const history = input.withHistory
    ? {
        history: customerHistory(
          (await deps.cards.findLedger({ cardId: stored.id }))?.records ?? [],
          HISTORY_LIMIT,
        ),
      }
    : {};
  return {
    result: "found",
    card: { ...card, qrCode: stored.qrCode, shortCode: stored.shortCode },
    version: stored.version,
    celebration: texts.celebration,
    rewardRedeemed: texts.rewardRedeemed.replace("{name}", firstName(customer.name)),
    hasMovements: history.history ? history.history.length > 0 : Boolean(hasMovements),
    ...history,
  };
}
