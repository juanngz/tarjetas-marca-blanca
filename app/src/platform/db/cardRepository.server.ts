// CardRepository on D1 (application/ports.ts): a customer's cards with their balance, the card for the
// register, a card's ledger records, the register's history, and saving an entry together with the new balance.
// The database is in the EU: every trip counts (docs/implementacion/cloudflare.md), so what's read together goes
// in a single batch.
import { and, asc, desc, eq, inArray, ne, notExists, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import type { CardLookup, CardRepository } from "../../application/ports";
import type { Db } from "./cafeDb.server";
import { cards, customers, entries } from "./schema";

/** A card by any of its codes, or its id. */
const cardWhere = (lookup: CardLookup) =>
  "shortCode" in lookup
    ? eq(cards.shortCode, lookup.shortCode)
    : "qrCode" in lookup
      ? eq(cards.qrCode, lookup.qrCode)
      : eq(cards.id, lookup.cardId);

export function d1CardRepository(db: Db): CardRepository {
  return {
    findByCustomer(customerId) {
      return db
        .select({
          id: cards.id,
          type: cards.type,
          qrCode: cards.qrCode,
          shortCode: cards.shortCode,
          stamps: cards.stamps,
          rewards: cards.rewards,
          version: cards.version,
        })
        .from(cards)
        .where(eq(cards.customerId, customerId));
    },

    async findForRegister(lookup) {
      const where = cardWhere(lookup);
      // Inner join: a card without an owner (the customer was deleted) isn't found.
      const [card] = await db
        .select({
          id: cards.id,
          type: cards.type,
          shortCode: cards.shortCode,
          stamps: cards.stamps,
          rewards: cards.rewards,
          version: cards.version,
          customerName: customers.name,
        })
        .from(cards)
        .innerJoin(customers, eq(customers.id, cards.customerId))
        .where(where);
      return card ?? null;
    },

    async findCardOfEntry(entryId) {
      const [entry] = await db
        .select({ cardId: entries.cardId })
        .from(entries)
        .where(eq(entries.id, entryId));
      return entry?.cardId ?? null;
    },

    async findLedger(lookup) {
      const where = cardWhere(lookup);
      const cardId =
        "cardId" in lookup
          ? eq(entries.cardId, lookup.cardId)
          : inArray(entries.cardId, db.select({ id: cards.id }).from(cards).where(where));
      const [[card], records] = await db.batch([
        db.select({ type: cards.type, version: cards.version }).from(cards).where(where),
        db
          .select({
            id: entries.id,
            type: entries.type,
            undoesId: entries.undoesId,
            at: entries.at,
            staffId: entries.staffId,
          })
          .from(entries)
          .where(cardId)
          // In the order they were made: by time and, at the same instant, by when they were saved.
          .orderBy(asc(entries.at), sql`rowid`),
      ]);
      if (!card) return null;
      return { ...card, records };
    },

    async hasMovements(customerId, type) {
      // An undo is found by what it undoes: its unique index, one lookup per entry.
      const undo = alias(entries, "undo");
      const [found] = await db
        .select({ id: entries.id })
        .from(entries)
        .innerJoin(cards, eq(cards.id, entries.cardId))
        .where(
          and(
            eq(cards.customerId, customerId),
            eq(cards.type, type),
            ne(entries.type, "undo"),
            notExists(db.select({ id: undo.id }).from(undo).where(eq(undo.undoesId, entries.id))),
          ),
        )
        .limit(1);
      return Boolean(found);
    },

    async activity({ staffId, limit }) {
      // What an undo undid, and the undo of a stamp or redeem: each found by a unique index.
      const undoneEntry = alias(entries, "undone_entry");
      const undo = alias(entries, "undo");
      const rows = await db
        .select({
          id: entries.id,
          type: entries.type,
          at: entries.at,
          staffId: entries.staffId,
          cardType: cards.type,
          // Left join: a deleted customer's card keeps its history, without a name.
          customerName: customers.name,
          undoneType: undoneEntry.type,
          undoId: undo.id,
        })
        .from(entries)
        .innerJoin(cards, eq(cards.id, entries.cardId))
        .leftJoin(customers, eq(customers.id, cards.customerId))
        .leftJoin(undoneEntry, eq(undoneEntry.id, entries.undoesId))
        .leftJoin(undo, eq(undo.undoesId, entries.id))
        .where(staffId ? eq(entries.staffId, staffId) : undefined)
        // The newest first; at the same instant, the last saved first.
        .orderBy(desc(entries.at), sql`"entries"."rowid" desc`)
        .limit(limit);
      return rows.map(({ undoneType, undoId, ...row }) => ({
        ...row,
        undoneType: undoneType === "stamp" || undoneType === "redeem" ? undoneType : null,
        undone: undoId !== null,
      }));
    },

    async appendEntry({ cardId, versionRead, balance, entry, entryId }) {
      const id = entryId ?? crypto.randomUUID();
      // In SQL and with D1's batch: both statements run in a single transaction, one after the other.
      const d1 = db.$client;
      const [, inserted] = await d1.batch([
        d1
          .prepare(
            "UPDATE cards SET stamps = ?, rewards = ?, version = version + 1 WHERE id = ? AND version = ?",
          )
          .bind(balance.stamps, balance.rewards, cardId, versionRead),
        // changes(): the rows the previous statement changed. If the card wasn't updated, nothing is inserted.
        d1
          .prepare(
            `INSERT INTO entries (id, card_id, type, undoes_id, at, staff_id)
             SELECT ?, ?, ?, ?, ?, ? WHERE changes() = 1`,
          )
          .bind(id, cardId, entry.type, entry.undoesId, entry.at.getTime(), entry.staffId),
      ]);
      return inserted.meta.changes === 1 ? id : null;
    },
  };
}
