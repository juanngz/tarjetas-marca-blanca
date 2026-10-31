import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testDb } from "../../../test/db";
import { normalizeShortCode, readCardCode } from "../../core/codes";

// Migrations that change existing rows: tested with rows inserted before applying them.

describe("migration 0005: audit dates on existing rows", () => {
  let t: Awaited<ReturnType<typeof testDb>>;
  const all = async (query: string) => (await t.d1.prepare(query).all()).results;

  beforeAll(async () => {
    t = await testDb({ before: "0005" });
    await t.d1.batch(
      [
        "INSERT INTO customers VALUES ('c1', 'h1', 'Marta García', 1000)",
        "INSERT INTO staff (id, email, name, role, pin_hmac) VALUES ('s1', 'ana@example.com', 'Ana', 'barista', 'p')",
        "INSERT INTO staff (id, email, name, role, pin_hmac) VALUES ('s2', 'juan@example.com', 'Juan', 'barista', 'p')",
        "INSERT INTO cards (id, customer_id, type, qr_code, short_code) VALUES ('k1', 'c1', 'take-away', 'q1', 'A1')",
        "INSERT INTO cards (id, customer_id, type, qr_code, short_code) VALUES ('k2', NULL, 'take-away', 'q2', 'A2')",
        "INSERT INTO cards (id, customer_id, type, qr_code, short_code) VALUES ('k3', NULL, 'take-away', 'q3', 'A3')",
        "INSERT INTO entries (id, card_id, type, at, staff_id) VALUES ('e1', 'k2', 'stamp', 3000, 's1')",
        "INSERT INTO entries (id, card_id, type, at, staff_id) VALUES ('e2', 'k2', 'stamp', 2000, 's1')",
      ].map((query) => t.d1.prepare(query)),
    );
    await t.migrate();
  });
  afterAll(async () => {
    await t.close();
  });

  it("a customer keeps the date they signed up and was never updated", async () => {
    expect(await all("SELECT created_at, updated_at FROM customers")).toEqual([
      { created_at: 1000, updated_at: null },
    ]);
  });

  it("a card with an owner takes the date its customer signed up", async () => {
    expect(await all("SELECT created_at FROM cards WHERE id = 'k1'")).toEqual([
      { created_at: 1000 },
    ]);
  });

  it("a card without an owner takes the date of its first entry", async () => {
    expect(await all("SELECT created_at FROM cards WHERE id = 'k2'")).toEqual([
      { created_at: 2000 },
    ]);
  });

  it("a card without an owner or entries takes the date of the migration", async () => {
    const [{ created_at }] = (await all("SELECT created_at FROM cards WHERE id = 'k3'")) as {
      created_at: number;
    }[];
    expect(created_at).toBeGreaterThan(Date.now() - 60_000);
  });

  it("a staff member takes the date of their first entry", async () => {
    expect(await all("SELECT created_at, updated_at FROM staff WHERE id = 's1'")).toEqual([
      { created_at: 2000, updated_at: null },
    ]);
  });

  it("an entry still points to its card and its staff member", async () => {
    expect(await all("PRAGMA foreign_key_check")).toEqual([]);
  });

  it("a staff member without entries takes the date of the migration", async () => {
    const [{ created_at }] = (await all("SELECT created_at FROM staff WHERE id = 's2'")) as {
      created_at: number;
    }[];
    expect(created_at).toBeGreaterThan(Date.now() - 60_000);
  });
});

describe("migration 0006: the name to search it, for existing customers", () => {
  let t: Awaited<ReturnType<typeof testDb>>;
  const all = async (query: string) => (await t.d1.prepare(query).all()).results;

  beforeAll(async () => {
    t = await testDb({ before: "0006" });
    await t.d1.batch(
      [
        "INSERT INTO customers (id, dni_hmac, name, created_at) VALUES ('c1', 'h1', 'Marta García', 1000)",
        "INSERT INTO customers (id, dni_hmac, name, created_at) VALUES ('c2', 'h2', ' ÁNGEL Núñez Güemes ', 1000)",
      ].map((query) => t.d1.prepare(query)),
    );
    await t.migrate();
  });
  afterAll(async () => {
    await t.close();
  });

  it("is the name in lowercase and without accents, as core/search.ts writes it", async () => {
    expect(await all("SELECT id, name_search FROM customers ORDER BY id")).toEqual([
      { id: "c1", name_search: "marta garcia" },
      { id: "c2", name_search: "angel nunez guemes" },
    ]);
  });
});

describe("migration 0008: the reward with the 8th and the 5th stamp, for existing cards", () => {
  let t: Awaited<ReturnType<typeof testDb>>;
  const all = async (query: string) => (await t.d1.prepare(query).all()).results;
  const entry = (id: string, card: string, type: string, undoes: string | null = null) =>
    `INSERT INTO entries (id, card_id, type, undoes_id, at, staff_id) VALUES ('${id}', '${card}', '${type}', ${undoes ? `'${undoes}'` : "NULL"}, 1000, 's1')`;

  beforeAll(async () => {
    t = await testDb({ before: "0008" });
    // The balances as the previous rule left them: 7 stamps for take-away, 4 for coffee beans.
    const card = (id: string, type: string, stamps: number, rewards: number, version: number) =>
      `INSERT INTO cards (id, type, qr_code, short_code, stamps, rewards, version, created_at) VALUES ('${id}', '${type}', 'q${id}', 'S${id}', ${stamps}, ${rewards}, ${version}, 1000)`;
    await t.d1.batch(
      [
        "INSERT INTO staff (id, email, name, role, pin_hmac, created_at) VALUES ('s1', 'ana@example.com', 'Ana', 'barista', 'p', 1000)",
        // 7 stamps: a reward before, 7 de 8 now.
        card("k1", "take-away", 0, 1, 7),
        ...Array.from({ length: 7 }, (_, i) => entry(`a${i}`, "k1", "stamp")),
        // 4 stamps, one of them undone: 3 de 5 either way.
        card("k2", "beans-quarter", 3, 0, 5),
        ...Array.from({ length: 4 }, (_, i) => entry(`b${i}`, "k2", "stamp")),
        entry("b-undo", "k2", "undo", "b0"),
        // 6 stamps: a reward and 2 before, a reward and 1 now.
        card("k3", "beans-half", 2, 1, 6),
        ...Array.from({ length: 6 }, (_, i) => entry(`c${i}`, "k3", "stamp")),
        // 4 stamps and the reward already redeemed: 4 de 5, without a reward to give back.
        card("k4", "beans-quarter", 0, 0, 5),
        ...Array.from({ length: 4 }, (_, i) => entry(`d${i}`, "k4", "stamp")),
        entry("d-redeem", "k4", "redeem"),
        // Without entries: nothing changes.
        card("k5", "take-away", 0, 0, 0),
      ].map((query) => t.d1.prepare(query)),
    );
    // Only 0008: 0011 changed the rule again.
    await t.migrate("0011");
  });
  afterAll(async () => {
    await t.close();
  });

  it("recounts each card's balance from its ledger, with the new rule", async () => {
    expect(await all("SELECT id, stamps, rewards FROM cards ORDER BY id")).toEqual([
      { id: "k1", stamps: 7, rewards: 0 },
      { id: "k2", stamps: 3, rewards: 0 },
      { id: "k3", stamps: 1, rewards: 1 },
      { id: "k4", stamps: 4, rewards: 0 },
      { id: "k5", stamps: 0, rewards: 0 },
    ]);
  });

  it("doesn't change the versions: no entry was added", async () => {
    expect(await all("SELECT id, version FROM cards ORDER BY id")).toEqual([
      { id: "k1", version: 7 },
      { id: "k2", version: 5 },
      { id: "k3", version: 6 },
      { id: "k4", version: 5 },
      { id: "k5", version: 0 },
    ]);
  });
});

describe("migration 0011: the reward with the 7th and the 4th stamp, for existing cards", () => {
  let t: Awaited<ReturnType<typeof testDb>>;
  const all = async (query: string) => (await t.d1.prepare(query).all()).results;
  const entry = (id: string, card: string, type: string, undoes: string | null = null) =>
    `INSERT INTO entries (id, card_id, type, undoes_id, at, staff_id) VALUES ('${id}', '${card}', '${type}', ${undoes ? `'${undoes}'` : "NULL"}, 1000, 's1')`;

  beforeAll(async () => {
    t = await testDb({ before: "0011" });
    // The balances as the previous rule left them: 8 stamps for take-away, 5 for coffee beans.
    const card = (id: string, type: string, stamps: number, rewards: number, version: number) =>
      `INSERT INTO cards (id, type, qr_code, short_code, stamps, rewards, version, created_at) VALUES ('${id}', '${type}', 'q${id}', 'S${id}', ${stamps}, ${rewards}, ${version}, 1000)`;
    await t.d1.batch(
      [
        "INSERT INTO staff (id, email, name, role, pin_hmac, created_at) VALUES ('s1', 'ana@example.com', 'Ana', 'barista', 'p', 1000)",
        // 7 stamps: 7 de 8 before, a reward now.
        card("k1", "take-away", 7, 0, 7),
        ...Array.from({ length: 7 }, (_, i) => entry(`a${i}`, "k1", "stamp")),
        // 4 stamps, one of them undone: 3 de 5 before, 3 de 4 now.
        card("k2", "beans-quarter", 3, 0, 5),
        ...Array.from({ length: 4 }, (_, i) => entry(`b${i}`, "k2", "stamp")),
        entry("b-undo", "k2", "undo", "b0"),
        // 6 stamps: a reward and 1 before, a reward and 2 now.
        card("k3", "beans-half", 1, 1, 6),
        ...Array.from({ length: 6 }, (_, i) => entry(`c${i}`, "k3", "stamp")),
        // 5 stamps and the reward redeemed: nothing left before, 1 stamp now.
        card("k4", "beans-quarter", 0, 0, 6),
        ...Array.from({ length: 5 }, (_, i) => entry(`d${i}`, "k4", "stamp")),
        entry("d-redeem", "k4", "redeem"),
        // 15 stamps: a reward and 7 before, two rewards and 1 now.
        card("k5", "take-away", 7, 1, 15),
        ...Array.from({ length: 15 }, (_, i) => entry(`e${i}`, "k5", "stamp")),
        // Without entries: nothing changes.
        card("k6", "take-away", 0, 0, 0),
      ].map((query) => t.d1.prepare(query)),
    );
    await t.migrate();
  });
  afterAll(async () => {
    await t.close();
  });

  it("recounts each card's balance from its ledger, with the new rule", async () => {
    expect(await all("SELECT id, stamps, rewards FROM cards ORDER BY id")).toEqual([
      { id: "k1", stamps: 0, rewards: 1 },
      { id: "k2", stamps: 3, rewards: 0 },
      { id: "k3", stamps: 2, rewards: 1 },
      { id: "k4", stamps: 1, rewards: 0 },
      { id: "k5", stamps: 1, rewards: 2 },
      { id: "k6", stamps: 0, rewards: 0 },
    ]);
  });

  it("doesn't change the versions: no entry was added", async () => {
    expect(await all("SELECT id, version FROM cards ORDER BY id")).toEqual([
      { id: "k1", version: 7 },
      { id: "k2", version: 5 },
      { id: "k3", version: 6 },
      { id: "k4", version: 6 },
      { id: "k5", version: 15 },
      { id: "k6", version: 0 },
    ]);
  });
});

describe("migration 0012: the 1 kg card for the customers who already have the others", () => {
  let t: Awaited<ReturnType<typeof testDb>>;
  const all = async (query: string) => (await t.d1.prepare(query).all()).results;
  const kilo = async () =>
    (await all(
      "SELECT customer_id, qr_code, short_code, stamps, rewards, version FROM cards WHERE type = 'beans-kilo' ORDER BY customer_id",
    )) as { customer_id: string; qr_code: string; short_code: string }[];

  beforeAll(async () => {
    t = await testDb({ before: "0012" });
    const card = (id: string, customer: string | null, type: string) =>
      `INSERT INTO cards (id, customer_id, type, qr_code, short_code, created_at) VALUES ('${id}', ${customer ? `'${customer}'` : "NULL"}, '${type}', 'q${id}', 'S${id}', 1000)`;
    await t.d1.batch(
      [
        "INSERT INTO customers (id, dni_hmac, name, created_at) VALUES ('c1', 'h1', 'Marta García', 1000)",
        "INSERT INTO customers (id, dni_hmac, name, created_at) VALUES ('c2', 'h2', 'Juan Pérez', 1000)",
        card("k1", "c1", "take-away"),
        card("k2", "c1", "beans-quarter"),
        card("k3", "c1", "beans-half"),
        // Already has it: it isn't given a second one.
        card("k4", "c2", "take-away"),
        card("k5", "c2", "beans-kilo"),
        // A deleted customer's card: no owner, nothing to add.
        card("k6", null, "take-away"),
      ].map((query) => t.d1.prepare(query)),
    );
    await t.migrate();
  });
  afterAll(async () => {
    await t.close();
  });

  it("every customer has one, empty", async () => {
    expect(await kilo()).toEqual([
      expect.objectContaining({ customer_id: "c1", stamps: 0, rewards: 0, version: 0 }),
      expect.objectContaining({ customer_id: "c2", short_code: "Sk5" }),
    ]);
  });

  it("with codes the register can read", async () => {
    const [{ qr_code, short_code }] = await kilo();
    expect(normalizeShortCode(short_code)).toBe(short_code);
    expect(readCardCode(qr_code)).toEqual({ qrCode: qr_code });
  });

  it("dated the day it was added", async () => {
    const [{ created_at }] = (await all(
      "SELECT created_at FROM cards WHERE type = 'beans-kilo' AND customer_id = 'c1'",
    )) as { created_at: number }[];
    expect(created_at).toBeGreaterThan(Date.now() - 60_000);
  });
});
