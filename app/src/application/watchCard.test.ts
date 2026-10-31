import { describe, expect, it } from "vitest";
import { registerWithMarta } from "../../test/register";
import { cardToWatch } from "./watchCard";

describe("which card a customer's code screen listens to", () => {
  it("her own card of that type", async () => {
    const { db, cardId } = await registerWithMarta();
    expect(await cardToWatch({ customerId: "marta", type: "take-away" }, { cards: db.cards })).toBe(
      cardId("K7M2QX"),
    );
  });

  it("a type she doesn't have, none", async () => {
    const { db } = await registerWithMarta();
    expect(
      await cardToWatch({ customerId: "marta", type: "other" }, { cards: db.cards }),
    ).toBeNull();
  });

  it("someone else's session never listens to her cards", async () => {
    const { db } = await registerWithMarta();
    expect(
      await cardToWatch({ customerId: "beto", type: "take-away" }, { cards: db.cards }),
    ).toBeNull();
  });
});
