import { describe, expect, it } from "vitest";
import { fixedClock, inMemoryDbWithMarta } from "../../test/fakes";
import { exampleCafe } from "../cafes/example";
import { viewWallet } from "./viewWallet";

async function deps() {
  const db = await inMemoryDbWithMarta();
  // 10:00 in Buenos Aires.
  return {
    customers: db.customers,
    cards: db.cards,
    clock: fixedClock(new Date("2026-10-06T13:00:00Z")),
  };
}

describe("the wallet", () => {
  // By the first name, like the barista (voz.md, "El saludo").
  it("greets the customer by first name, by the café's local time", async () => {
    const wallet = await viewWallet({ customerId: "marta" }, exampleCafe, await deps());
    expect(wallet?.greeting).toBe("Buenos días, Marta.");
  });

  it("shows the cards in the fixed order", async () => {
    const wallet = await viewWallet({ customerId: "marta" }, exampleCafe, await deps());
    expect(wallet?.cards.map((c) => c.type)).toEqual([
      "take-away",
      "beans-quarter",
      "beans-half",
      "beans-kilo",
    ]);
  });

  // Flujo 5, "Sin conexión": the phone keeps them, so each card's code shows without a connection,
  // even the ones that were never opened.
  it("brings each card's codes", async () => {
    const d = await deps();
    const wallet = await viewWallet({ customerId: "marta" }, exampleCafe, d);
    const stored = await d.cards.findByCustomer("marta");
    for (const card of wallet?.cards ?? []) {
      const same = stored.find((c) => c.type === card.type);
      expect(card).toMatchObject({ qrCode: same?.qrCode, shortCode: same?.shortCode });
    }
  });

  it("if the customer no longer exists, there's no wallet", async () => {
    expect(await viewWallet({ customerId: "deleted" }, exampleCafe, await deps())).toBeNull();
  });
});
