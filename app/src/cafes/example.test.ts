import { describe, expect, it } from "vitest";
import { exampleCafe } from "./example";

describe("The example café's cards", () => {
  it("are four, in the fixed order", () => {
    expect(exampleCafe.cards.map((c) => c.name)).toEqual([
      "Café take-away",
      "Café en grano ¼ kg",
      "Café en grano ½ kg",
      "Café en grano 1 kg",
    ]);
  });

  // The reward is earned with the stamp before the last slot, the 7th and the 4th; the last slot is the purchase
  // that uses it (10/10/2026, like the paper card).
  it("take-away earns the reward with 7 stamps", () => {
    expect(exampleCafe.cards[0].stamps).toBe(7);
  });

  it("coffee beans ¼ kg earns the reward with 4 stamps", () => {
    expect(exampleCafe.cards[1].stamps).toBe(4);
  });

  it("coffee beans ½ kg earns the reward with 4 stamps", () => {
    expect(exampleCafe.cards[2].stamps).toBe(4);
  });

  // Added on 14/10/2026, like the ¼ kg and ½ kg: 4 purchases and the next one with 30% OFF.
  it("coffee beans 1 kg earns the reward with 4 stamps", () => {
    expect(exampleCafe.cards[3].stamps).toBe(4);
  });

  // A card's rule only changes with a migration that recounts every balance from the ledger (0011, 10/10/2026:
  // the reward is earned with the 7th and the 4th stamp). Adding a card with a new type is allowed: this only
  // checks the existing ones are still there, with the rule their stored balance was counted with.
  it("keep the types and rules of the cards already created", () => {
    expect(exampleCafe.cards.map((c) => [c.type, c.stamps])).toEqual(
      expect.arrayContaining([
        ["take-away", 7],
        ["beans-quarter", 4],
        ["beans-half", 4],
        ["beans-kilo", 4],
      ]),
    );
  });

  it("each card has its own type", () => {
    const types = exampleCafe.cards.map((c) => c.type);
    expect(new Set(types).size).toBe(types.length);
  });

  it("each card says, for the register, what it's for and what the customer won", () => {
    expect(exampleCafe.cards.map((c) => [c.texts.goal, c.texts.won])).toEqual([
      ["el café gratis", "un café take-away gratis"],
      ["el 30% OFF", "30% OFF en su próxima bolsa de ¼ kg"],
      ["el 30% OFF", "30% OFF en su próxima bolsa de ½ kg"],
      ["el 30% OFF", "30% OFF en su próxima bolsa de 1 kg"],
    ]);
  });
});
