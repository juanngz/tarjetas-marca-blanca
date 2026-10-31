// A café's database tables. See ../../../../docs/implementacion/arquitectura.md, "La base de datos".
// When something changes: npm run db:generate -- --name=what-changes, and the migration goes in the same pull request.
// Rule: each migration works with the previous version of the app (add before removing).
import { sql } from "drizzle-orm";
import {
  type AnySQLiteColumn,
  check,
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { now } from "../clock";

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

/** Date and time, stored in milliseconds. */
const timestamp = (name: string) => integer(name, { mode: "timestamp_ms" });

/** When the row was created. The app sets it; a script that inserts with SQL has to set it too. */
const createdAt = () => timestamp("created_at").notNull().$defaultFn(now);

/**
 * When the row last changed. Empty: it never changed since created_at. Drizzle sets it on every update;
 * an update written in raw SQL has to set it by hand. Who changed it goes in the audit log.
 */
const updatedAt = () =>
  timestamp("updated_at")
    // Without a default, Drizzle would also call $onUpdateFn on insert.
    .$defaultFn(() => sql`null`)
    .$onUpdateFn(now);

export const customers = sqliteTable("customers", {
  id: id(),
  /** HMAC of the document with the secret key. Never the number. */
  dniHmac: text("dni_hmac").notNull().unique(),
  name: text("name").notNull(),
  /**
   * The name in lowercase and without accents, to find it at the register (core/search.ts). Empty only for a
   * customer the previous version of the app signed up while 0006 was being published.
   */
  nameSearch: text("name_search"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const cards = sqliteTable(
  "cards",
  {
    id: id(),
    /**
     * Empty if the customer was deleted (Flujo G): the card is left without an owner, with its history.
     * A card without an owner doesn't show up at the register.
     */
    customerId: text("customer_id").references(() => customers.id, { onDelete: "set null" }),
    /** The type from the café's config: "take-away", "beans-quarter"… */
    type: text("type").notNull(),
    /** What the QR carries. Fixed forever. */
    qrCode: text("qr_code").notNull().unique(),
    /** The one read out if the QR can't be read. Fixed forever. */
    shortCode: text("short_code").notNull().unique(),
    /**
     * The balance: a copy of what the ledger says, to read the card without going through its entries.
     * It's updated along with each entry (platform/db/cardRepository.server.ts). If they disagree, the ledger wins.
     */
    stamps: integer("stamps").notNull().default(0),
    rewards: integer("rewards").notNull().default(0),
    /** Goes up with each entry. An entry is only saved if the card didn't change since it was read. */
    version: integer("version").notNull().default(0),
    /** No updated_at: a card only changes with its entries, and the ledger says when. */
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("cards_customer_type").on(t.customerId, t.type)],
);

export const staff = sqliteTable(
  "staff",
  {
    id: id(),
    /** What they sign in to the register with. The manager registers it. */
    email: text("email").notNull().unique(),
    name: text("name").notNull(),
    role: text("role", { enum: ["barista", "manager"] }).notNull(),
    /** HMAC of the person's id and their PIN, with the secret key. */
    pinHmac: text("pin_hmac").notNull(),
    failedAttempts: integer("failed_attempts").notNull().default(0),
    lockedUntil: timestamp("locked_until"),
    /** When they stopped working. Empty: active. Not deleted, so their entries say who made them. */
    deactivatedAt: timestamp("deactivated_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [check("staff_role", sql`${t.role} in ('barista', 'manager')`)],
);

/**
 * The ledger: every stamp, every redeem and every undo. It only grows: no row is changed or deleted.
 * An undo is a new row that says which entry it cancels. at and staffId are the audit trail:
 * on an undo, they say who undid it and when.
 */
export const entries = sqliteTable(
  "entries",
  {
    id: id(),
    cardId: text("card_id")
      .notNull()
      .references(() => cards.id),
    type: text("type", { enum: ["stamp", "redeem", "undo"] }).notNull(),
    /** Only on an undo: the stamp or redeem it cancels. Each one is undone only once. */
    undoesId: text("undoes_id")
      .unique()
      .references((): AnySQLiteColumn => entries.id),
    at: timestamp("at").notNull(),
    staffId: text("staff_id")
      .notNull()
      .references(() => staff.id),
  },
  (t) => [
    index("entries_card").on(t.cardId),
    index("entries_at").on(t.at),
    check("entries_type", sql`${t.type} in ('stamp', 'redeem', 'undo')`),
    check("entries_undo", sql`(${t.type} = 'undo') = (${t.undoesId} is not null)`),
  ],
);

/**
 * Who changed each staff member, what and when (decided on 08/10/2026): added, name or email changed,
 * a new PIN, deactivated or reactivated. Never the PIN or the values. It only grows, like the ledger.
 * Saved together with the change, in the same batch (platform/db/staffRepository.server.ts).
 */
export const staffAudit = sqliteTable(
  "staff_audit",
  {
    id: id(),
    /** Who was changed. */
    staffId: text("staff_id")
      .notNull()
      .references(() => staff.id),
    /** Who changed it: a manager, from the Equipo screen. Empty: the developers, with the script. */
    byId: text("by_id").references(() => staff.id),
    change: text("change", {
      enum: ["added", "name-changed", "email-changed", "pin-reset", "deactivated", "reactivated"],
    }).notNull(),
    at: timestamp("at").notNull(),
  },
  (t) => [
    index("staff_audit_staff").on(t.staffId),
    check(
      "staff_audit_change",
      sql`${t.change} in ('added', 'name-changed', 'email-changed', 'pin-reset', 'deactivated', 'reactivated')`,
    ),
  ],
);
