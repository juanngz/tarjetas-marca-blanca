// Use case: the customer's wallet (Flujo 3): the greeting by the café's local time and the first name
// (Buenos días, Marta.), and their cards in the fixed order. Reads only the stored balance, not the ledger.
// Each card brings its codes: the phone keeps them, so the code shows without a connection (Flujo 5).
import type { Cafe } from "../cafes/types";
import { firstName } from "../core/customerName";
import { type DisplayCard, displayCards } from "../core/displayCard";
import { greeting } from "../core/greeting";
import type { CardRepository, Clock, CustomerRepository } from "./ports";

export type WalletCard = DisplayCard & { qrCode: string; shortCode: string };

export interface ViewWalletDeps {
  customers: CustomerRepository;
  cards: CardRepository;
  clock: Clock;
}

/** null if the customer no longer exists (they were deleted, but their cookie is still around). */
export async function viewWallet(
  input: { customerId: string },
  cafe: Cafe,
  deps: ViewWalletDeps,
): Promise<{ greeting: string; name: string; cards: WalletCard[] } | null> {
  // At once: the database is in the EU, and one after another each would be one more trip.
  const [customer, stored] = await Promise.all([
    deps.customers.findById(input.customerId),
    deps.cards.findByCustomer(input.customerId),
  ]);
  if (!customer) return null;
  const cards = displayCards(cafe, stored).map((card) => {
    const { qrCode, shortCode } = stored.find((c) => c.type === card.type) ?? {};
    return { ...card, qrCode: qrCode ?? "", shortCode: shortCode ?? "" };
  });
  const name = firstName(customer.name);
  // The name too: the phone says the greeting again from its copy, by the time it is then.
  return { greeting: greeting(name, deps.clock.now(), cafe.timeZone), name, cards };
}
