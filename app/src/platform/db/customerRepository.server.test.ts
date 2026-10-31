import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { testDb } from "../../../test/db";
import { addStamps, createCustomer, createStaffMember, NOON } from "../../../test/factories";
import { d1CardRepository } from "./cardRepository.server";
import { d1CustomerRepository } from "./customerRepository.server";
import { cards, customers } from "./schema";

let t: Awaited<ReturnType<typeof testDb>>;
beforeAll(async () => {
  t = await testDb();
});
beforeEach(async () => {
  await t.clear();
});
afterAll(async () => {
  await t.close();
});

describe("find a customer by their document", () => {
  it("finds them by the hash", async () => {
    const { customer } = await createCustomer(t.db, { dniHmac: "martas-hmac" });
    expect(await d1CustomerRepository(t.db).findByDniHmac("martas-hmac")).toEqual({
      id: customer.id,
      name: "Marta García",
      createdAt: customer.createdAt,
    });
  });

  it("if they're not signed up, there's no customer", async () => {
    expect(await d1CustomerRepository(t.db).findByDniHmac("nobodys-hmac")).toBeNull();
  });
});

describe("sign up a customer with their cards", () => {
  const MARTA = { id: "marta", name: "Marta García", createdAt: new Date("2026-10-06T15:00:00Z") };
  const card = (n: number) => ({ type: `type-${n}`, qrCode: `qr-${n}`, shortCode: `CODE${n}` });

  it("saves the customer and their cards, with the same date", async () => {
    await d1CustomerRepository(t.db).createWithCards({ ...MARTA, dniHmac: "h" }, [
      card(1),
      card(2),
    ]);
    const theirs = await t.db.select().from(cards).where(eq(cards.customerId, "marta"));
    expect(theirs.map((c) => [c.type, c.createdAt])).toEqual([
      ["type-1", MARTA.createdAt],
      ["type-2", MARTA.createdAt],
    ]);
  });

  it("saves the name to search it, in lowercase and without accents", async () => {
    await d1CustomerRepository(t.db).createWithCards({ ...MARTA, dniHmac: "h" }, [card(1)]);
    const [saved] = await t.db.select().from(customers);
    expect(saved?.nameSearch).toBe("marta garcia");
  });

  it("if a code is already taken, nothing is saved", async () => {
    const { cards: martas } = await createCustomer(t.db);
    const taken = { ...card(1), shortCode: martas[0].shortCode };
    await expect(
      d1CustomerRepository(t.db).createWithCards({ ...MARTA, id: "other", dniHmac: "other" }, [
        taken,
      ]),
    ).rejects.toThrow();
    expect(await d1CustomerRepository(t.db).findById("other")).toBeNull();
  });
});

describe("a customer's cards", () => {
  it("returns their four cards", async () => {
    const { customer } = await createCustomer(t.db);
    const theirs = await d1CardRepository(t.db).findByCustomer(customer.id);
    expect(theirs.map((c) => c.type).sort()).toEqual([
      "beans-half",
      "beans-kilo",
      "beans-quarter",
      "take-away",
    ]);
  });

  it("each one comes with its balance", async () => {
    const { customer, cards } = await createCustomer(t.db);
    const ana = await createStaffMember(t.db);
    await addStamps(t.db, { card: cards[0], by: ana, amount: 2 });

    const theirs = await d1CardRepository(t.db).findByCustomer(customer.id);
    const withStamps = theirs.find((c) => c.type === cards[0].type);
    expect(withStamps).toMatchObject({ stamps: 2, rewards: 0 });
  });

  it("doesn't return another customer's cards", async () => {
    const { customer } = await createCustomer(t.db);
    await createCustomer(t.db);
    expect(await d1CardRepository(t.db).findByCustomer(customer.id)).toHaveLength(4);
  });
});

describe("find customers by their name, at the register", () => {
  const search = (words: string[], limit = 10) =>
    d1CustomerRepository(t.db).searchByName(words, limit);
  const names = async (words: string[], limit?: number) =>
    (await search(words, limit)).map((c) => c.name);

  beforeEach(async () => {
    await createCustomer(t.db, { name: "Marta García" });
    await createCustomer(t.db, { name: "Martín Ríos" });
    await createCustomer(t.db, { name: "Ana Martínez" });
  });

  it("by the start of any word of the name", async () => {
    expect(await names(["mart"])).toEqual(["Ana Martínez", "Marta García", "Martín Ríos"]);
  });

  it("every word typed has to be in the name", async () => {
    expect(await names(["mar", "gar"])).toEqual(["Marta García"]);
  });

  it("without accents, it finds a name with them", async () => {
    expect(await names(["rios"])).toEqual(["Martín Ríos"]);
  });

  it("not by the middle of a word", async () => {
    expect(await names(["arta"])).toEqual([]);
  });

  it("at most as many as asked, in alphabetical order", async () => {
    expect(await names(["mart"], 2)).toEqual(["Ana Martínez", "Marta García"]);
  });

  it("a very long word finds nobody, without breaking", async () => {
    // D1 caps a LIKE pattern at 50 bytes: a word of 48 letters broke the search.
    expect(await names(["a".repeat(3000)])).toEqual([]);
  });

  it("a long name in another alphabet is found by its full word", async () => {
    // 26 letters of 2 bytes each: past the cap of a LIKE pattern.
    const word = "καλημερακαλημερακαλημερακα";
    await createCustomer(t.db, { name: `Ελένη ${word}` });
    expect(await names([word])).toEqual([`Ελένη ${word}`]);
  });

  it("% and _ are letters to look for, not wildcards", async () => {
    expect(await names(["%"])).toEqual([]);
    expect(await names(["_"])).toEqual([]);
  });

  it("with their sign-up date, to tell two with the same name apart", async () => {
    const [marta] = await search(["marta"]);
    expect(marta).toEqual({ id: expect.any(String), name: "Marta García", createdAt: NOON });
  });
});
