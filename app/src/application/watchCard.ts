// Use case: which card a customer's open code screen listens to, for the sello en vivo. Only her own:
// the customer comes from the session cookie and the card type from the screen, never a card's id.
import type { CardRepository } from "./ports";

export async function cardToWatch(
  input: { customerId: string; type: string },
  deps: { cards: CardRepository },
): Promise<string | null> {
  const card = (await deps.cards.findByCustomer(input.customerId)).find(
    (c) => c.type === input.type,
  );
  return card?.id ?? null;
}
