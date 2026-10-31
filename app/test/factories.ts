// Factories: build customers, staff members and entries with made-up data.
// Never real data (pruebas-exampleCafe skill). The hashes are fake: HMAC is tested separately.

import { recordEntry } from "../src/application/recordEntry";
import { exampleCafe } from "../src/cafes/example";
import { ledgerFrom } from "../src/core/card";
import { QR_CODE_LENGTH, SHORT_CODE_ALPHABET, SHORT_CODE_LENGTH } from "../src/core/codes";
import { nameForSearch } from "../src/core/search";
import type { Db } from "../src/platform/db/cafeDb.server";
import { d1CardRepository } from "../src/platform/db/cardRepository.server";
import { cards, customers, entries, staff } from "../src/platform/db/schema";
import { readSecrets } from "../src/platform/secrets.server";
import { createSession } from "../src/platform/security/sessions.server";
import { pinHmac } from "../src/platform/security/staffPin.server";
import { TEST_SECRETS } from "./routes";

export const NOON = new Date("2026-10-06T15:00:00Z");

let counter = 0;
function next() {
  counter += 1;
  return counter;
}

/** A valid code of that length (the short one or the QR's), different on each call. */
function code(length: number): string {
  let n = next();
  let text = "";
  for (let i = 0; i < length; i++) {
    text = SHORT_CODE_ALPHABET[n % SHORT_CODE_ALPHABET.length] + text;
    n = Math.floor(n / SHORT_CODE_ALPHABET.length);
  }
  return text;
}

/** Marta García, signed up with her 3 empty cards. */
export async function createCustomer(db: Db, changes: Partial<typeof customers.$inferInsert> = {}) {
  const [customer] = await db
    .insert(customers)
    .values({
      dniHmac: `test-hmac-${next()}`,
      name: "Marta García",
      nameSearch: nameForSearch(changes.name ?? "Marta García"),
      createdAt: NOON,
      ...changes,
    })
    .returning();

  const theirs = await db
    .insert(cards)
    .values(
      exampleCafe.cards.map((config) => ({
        customerId: customer.id,
        type: config.type,
        qrCode: code(QR_CODE_LENGTH),
        shortCode: code(SHORT_CODE_LENGTH),
        createdAt: customer.createdAt,
      })),
    )
    .returning();

  return { customer, cards: theirs };
}

/**
 * Ana, barista. With `pin`, her PIN is hashed with the test key, like the app does, so she can sign in;
 * without it, the hash is fake.
 */
export async function createStaffMember(
  db: Db,
  { pin, ...changes }: Partial<typeof staff.$inferInsert> & { pin?: string } = {},
) {
  const id = changes.id ?? crypto.randomUUID();
  const [member] = await db
    .insert(staff)
    .values({
      email: `ana${next()}@example.com`,
      name: "Ana",
      role: "barista",
      pinHmac: pin ? await pinHmac(TEST_SECRETS.PIN_HMAC_KEY, id, pin) : "test-pin-hmac",
      ...changes,
      id,
    })
    .returning();
  return member;
}

/**
 * Adds stamps like the register does: with the rules and the balance up to date. For the database
 * constraint tests, which need loose rows, there's createEntry.
 */
export async function addStamps(
  db: Db,
  data: {
    card: typeof cards.$inferSelect;
    by: typeof staff.$inferSelect;
    amount?: number;
  },
) {
  for (let i = 0; i < (data.amount ?? 1); i++) {
    const result = await recordEntry(
      { type: "stamp", cardId: data.card.id, staffId: data.by.id, at: NOON },
      exampleCafe,
      { cards: d1CardRepository(db) },
    );
    if (!result.ok) throw new Error(`Couldn't add the stamp: ${result.reason}.`);
  }
}

/** A card's ledger as the core reads it (empty if the card doesn't exist). */
export async function ledgerOf(db: Db, cardId: string) {
  return ledgerFrom((await d1CardRepository(db).findLedger({ cardId }))?.records ?? []);
}

/** A loose row in the ledger, without rules or balance. */
export async function createEntry(
  db: Db,
  data: {
    card: typeof cards.$inferSelect;
    by: typeof staff.$inferSelect;
    type?: "stamp" | "redeem" | "undo";
    /** Only on an undo: the entry it cancels. */
    undoesId?: string;
    at?: Date;
  },
) {
  const [entry] = await db
    .insert(entries)
    .values({
      cardId: data.card.id,
      type: data.type ?? "stamp",
      undoesId: data.undoesId,
      at: data.at ?? NOON,
      staffId: data.by.id,
    })
    .returning();
  return entry;
}

/** Signs a customer in and returns the cookie their phone sends on the next request. */
export async function signedInCookie(customerId: string, at = new Date()): Promise<string> {
  const setCookie = await createSession(
    new Request("https://exampleCafe.test/"),
    readSecrets(TEST_SECRETS),
    { customerId },
    at,
  );
  return setCookie.split(";")[0];
}

/** Signs a staff member in at the register and returns the cookie the phone sends on the next request. */
export async function staffCookie(
  member: { id: string; pinHmac: string },
  at = new Date(),
): Promise<string> {
  const setCookie = await createSession(
    new Request("https://exampleCafe.test/register"),
    readSecrets(TEST_SECRETS),
    { member },
    at,
  );
  return setCookie.split(";")[0];
}
