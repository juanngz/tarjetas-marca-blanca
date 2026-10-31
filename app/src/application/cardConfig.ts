// A card type's config in the café. It always exists for a stored card: a type never disappears from the
// config once customers have it (cafes/exampleCafe.ts).
import type { Cafe, CardConfig } from "../cafes/types";

export function cardConfig(cafe: Cafe, type: string): CardConfig {
  const config = cafe.cards.find((card) => card.type === type);
  if (!config) throw new Error(`Café ${cafe.id} has no ${type} card.`);
  return config;
}
