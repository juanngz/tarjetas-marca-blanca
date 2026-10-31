import { describe, expect, it } from "vitest";
import { registerWithMarta } from "../../test/register";
import { viewRegisterCard } from "./viewRegisterCard";

describe("the card at the register", () => {
  it("shows the customer's name and the card as she sees it", async () => {
    const { db, cafe } = await registerWithMarta();
    const view = await viewRegisterCard({ shortCode: "K7M2QX" }, cafe, { cards: db.cards });
    expect(view).toMatchObject({
      result: "found",
      customerName: "Marta García",
      card: { type: "take-away", name: "Café take-away", stamps: 0, stampsPerRound: 7 },
    });
  });

  it("says how many stamps are left for the reward", async () => {
    const { db, cafe } = await registerWithMarta();
    const view = await viewRegisterCard({ shortCode: "BBBBBB" }, cafe, { cards: db.cards });
    expect(view).toMatchObject({ leftForReward: "Le faltan 4 para el 30% OFF." });
  });

  it("brings the version the barista is looking at", async () => {
    const { db, cafe, cardId } = await registerWithMarta();
    const card = db.stored.cards.get(cardId("K7M2QX"));
    if (card) db.stored.cards.set(card.id, { ...card, version: 3, stamps: 3 });
    const view = await viewRegisterCard({ shortCode: "K7M2QX" }, cafe, { cards: db.cards });
    expect(view).toMatchObject({ version: 3, card: { stamps: 3 } });
  });

  it("says what the reward is, to redeem it", async () => {
    const { db, cafe } = await registerWithMarta();
    const view = await viewRegisterCard({ shortCode: "CCCCCC" }, cafe, { cards: db.cards });
    expect(view).toMatchObject({ reward: "30% OFF en ½ kg" });
  });

  it("a code that isn't a short code isn't found", async () => {
    const { db, cafe } = await registerWithMarta();
    expect(await viewRegisterCard({ shortCode: "nope" }, cafe, { cards: db.cards })).toEqual({
      result: "not-found",
    });
  });
});
