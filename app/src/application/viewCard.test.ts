import { describe, expect, it } from "vitest";
import { inMemoryDbWithMarta } from "../../test/fakes";
import { exampleCafe } from "../cafes/example";
import { viewCard } from "./viewCard";

const view = async (customerId: string, type: string) =>
  viewCard({ customerId, type }, exampleCafe, await inMemoryDbWithMarta());

describe("a card's code", () => {
  it("brings the card with its QR code and its short code", async () => {
    expect(await view("marta", "beans-half")).toMatchObject({
      result: "found",
      card: { name: "Café en grano ½ kg", qrCode: "q3", shortCode: "K7M2QX" },
    });
  });

  it("a card the customer doesn't have isn't found", async () => {
    expect(await view("marta", "other")).toEqual({ result: "not-found" });
  });

  it("if the customer no longer exists, they're signed out", async () => {
    expect(await view("deleted", "take-away")).toEqual({ result: "signed-out" });
  });

  // The festejo is when the reward's slot is stamped, the 8th: that purchase goes free (18/10/2026).
  it("brings the festejo for when the reward's slot is stamped and the card is complete", async () => {
    expect(await view("marta", "take-away")).toMatchObject({
      version: 0,
      celebration: "¡Completaste la tarjeta!",
      rewardRedeemed: "Este café va por cuenta de la casa. Que lo disfrutes, Marta.",
    });
  });

  it("brings the history: what counted, newest first, without who did it", async () => {
    const db = await inMemoryDbWithMarta();
    const [card] = [...db.stored.cards.values()].filter((c) => c.type === "take-away");
    if (!card) throw new Error("Missing the card.");
    const add = (
      id: string,
      type: "stamp" | "redeem" | "undo",
      day: number,
      undoesId: string | null = null,
    ) =>
      db.stored.entries.push({
        id,
        cardId: card.id,
        type,
        undoesId,
        at: new Date(`2026-10-0${day}T12:00:00Z`),
        staffId: "ana",
      });
    add("a", "stamp", 1);
    add("b", "stamp", 2);
    add("u", "undo", 3, "b");
    add("c", "stamp", 4);

    const viewed = await viewCard(
      { customerId: "marta", type: "take-away", withHistory: true },
      exampleCafe,
      db,
    );
    if (viewed.result !== "found") throw new Error("Not found.");
    expect(viewed.history).toEqual([
      { id: "c", type: "stamp", at: new Date("2026-10-04T12:00:00Z") },
      { id: "a", type: "stamp", at: new Date("2026-10-01T12:00:00Z") },
    ]);
  });

  it("the code screen doesn't read the whole history: only whether something counted", async () => {
    // The ledger grows forever: the code screen opens often and only needs to know whether to link it.
    const db = await inMemoryDbWithMarta();
    const [card] = [...db.stored.cards.values()].filter((c) => c.type === "take-away");
    if (!card) throw new Error("Missing the card.");
    db.stored.entries.push({
      id: "a",
      cardId: card.id,
      type: "stamp",
      undoesId: null,
      at: new Date("2026-10-01T12:00:00Z"),
      staffId: "ana",
    });
    const cards = {
      ...db.cards,
      findLedger: () => {
        throw new Error("The code screen read the whole ledger.");
      },
    };
    const viewed = await viewCard({ customerId: "marta", type: "take-away" }, exampleCafe, {
      ...db,
      cards,
    });
    expect(viewed).toMatchObject({ result: "found", hasMovements: true });
    expect(viewed).not.toHaveProperty("history");
  });

  it("the code screen asks for the customer, her cards and her movements at once: one trip", async () => {
    // The database is in the EU: one after another, each one would be one more trip.
    const db = await inMemoryDbWithMarta();
    const asked: string[] = [];
    let answer: () => void = () => {};
    const answered = new Promise<void>((resolve) => {
      answer = resolve;
    });
    const waitFor =
      <A extends unknown[], R>(name: string, step: (...args: A) => Promise<R>) =>
      async (...args: A) => {
        asked.push(name);
        await answered;
        return step(...args);
      };
    const viewing = viewCard({ customerId: "marta", type: "take-away" }, exampleCafe, {
      customers: { ...db.customers, findById: waitFor("customer", db.customers.findById) },
      cards: {
        ...db.cards,
        findByCustomer: waitFor("cards", db.cards.findByCustomer),
        hasMovements: waitFor("movements", db.cards.hasMovements),
      },
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(asked.sort()).toEqual(["cards", "customer", "movements"]);
    answer();
    expect(await viewing).toMatchObject({ result: "found", hasMovements: false });
  });

  it("a card with nothing that counted has no movements", async () => {
    expect(await view("marta", "take-away")).toMatchObject({ hasMovements: false });
  });
});
