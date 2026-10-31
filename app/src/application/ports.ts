// The ports: what the use cases need from the outside world, without saying how it's done.
// platform/ implements them (D1, HMAC, cookies, Turnstile); the tests use the in-memory ones in test/fakes.ts.
// Only types: this file imports nothing but core/ and cafes/. See ../../../docs/implementacion/arquitectura.md
import type { CardBalance, EntryRecord } from "../core/card";
import type { DocumentType } from "../core/document";
import type { StaffChange, StaffRole } from "../core/staff";
import type { SummaryData } from "../core/summary";

// Repositories. Each method that writes is atomic: all of it is saved or nothing is.

export interface Customer {
  id: string;
  name: string;
  createdAt: Date;
}

export interface NewCard {
  type: string;
  qrCode: string;
  shortCode: string;
}

export interface CustomerRepository {
  findByDniHmac(dniHmac: string): Promise<Customer | null>;
  findById(id: string): Promise<Customer | null>;
  /**
   * Customers whose name has each word at the start of one of its words (core/search.ts), in alphabetical
   * order, at most `limit`.
   */
  searchByName(words: readonly string[], limit: number): Promise<Customer[]>;
  /**
   * The customer and their cards, together: if something fails, nothing is left half done.
   * Fails if the document or a code is already taken (they're unique).
   */
  createWithCards(
    customer: Customer & { dniHmac: string },
    cards: readonly NewCard[],
  ): Promise<void>;
}

export interface CardWithBalance extends NewCard, CardBalance {
  id: string;
  /** Goes up with each entry: the code screen knows it's up to date by it. */
  version: number;
}

/** A ledger record as it's stored, with who made it. */
export interface LedgerRecord extends EntryRecord {
  staffId: string;
}

/**
 * What's needed to record an entry or show one: the card's type, the version that was read and its
 * records in the ledger's order (core/card.ts builds the ledger from them).
 */
export interface CardLedger {
  type: string;
  version: number;
  records: LedgerRecord[];
}

/** An entry of the register's history, with its card, whose it is, and what undid it. Never the document. */
export interface ActivityRecord {
  id: string;
  type: EntryRecord["type"];
  at: Date;
  staffId: string;
  cardType: string;
  /** null if the customer was deleted (Flujo G): the card has no owner, its history stays. */
  customerName: string | null;
  /** Only on an undo: what it undid. */
  undoneType: "stamp" | "redeem" | null;
  /** A stamp or a redeem that was undone afterwards. */
  undone: boolean;
}

/** A card as the register sees it: its balance, its version and its owner's name. Never the document. */
export interface RegisterCard extends CardBalance {
  id: string;
  type: string;
  shortCode: string;
  version: number;
  customerName: string;
}

/** How the register finds a card: by what it typed, by what it read in the QR, or by its id. */
export type CardLookup = { shortCode: string } | { qrCode: string } | { cardId: string };

/** An entry to append: a stamp, a redeem or the undo of one of them, and who made it. */
export interface NewEntry extends Omit<EntryRecord, "id"> {
  staffId: string;
}

export interface CardRepository {
  /** The cards of a customer, with their balance. */
  findByCustomer(customerId: string): Promise<CardWithBalance[]>;
  /**
   * The card for the register, or null if it doesn't exist or has no owner: a deleted customer's cards
   * don't show up at the register (Flujo G).
   */
  findForRegister(lookup: CardLookup): Promise<RegisterCard | null>;
  /** The card an entry belongs to, or null if there's no such entry. */
  findCardOfEntry(entryId: string): Promise<string | null>;
  /**
   * null if the card doesn't exist. By any of its codes too, so it can be asked together with the card
   * (findForRegister) instead of after it.
   */
  findLedger(lookup: CardLookup): Promise<CardLedger | null>;
  /**
   * Whether that customer's card of that type has a stamp or a redeem that counts (not undone), without
   * reading the whole ledger. By customer and type, so it can be asked together with the cards.
   */
  hasMovements(customerId: string, type: string): Promise<boolean>;
  /**
   * The register's history: the last `limit` entries of every card, the newest first; with `staffId`,
   * only that person's. For the manager's Movimientos screen.
   */
  activity(query: { staffId?: string; limit: number }): Promise<ActivityRecord[]>;
  /**
   * Saves the entry and the new balance together, only if the card is still at versionRead.
   * Returns the entry's id, or null if another action changed the card in the meantime (nothing is saved).
   */
  appendEntry(data: {
    cardId: string;
    versionRead: number;
    balance: CardBalance;
    entry: NewEntry;
    /** The entry's id, if it already has one (the camera's reading); if not, a new one. */
    entryId?: string;
  }): Promise<string | null>;
}

/** What Resumen reads (core/summary.ts), from a moment on: the start of the first day picked. */
export interface SummaryRepository {
  read(since: Date): Promise<SummaryData>;
}

/** A register staff member, as the screens see them: never their PIN or email. */
export interface StaffMember {
  id: string;
  name: string;
  role: StaffRole;
}

/** What signing in and the session need to know about a staff member. */
export interface StaffCredentials extends StaffMember {
  /** HMAC of the person's id and their PIN. Never leaves the server. */
  pinHmac: string;
  /** Failed PINs in a row. */
  failedAttempts: number;
  /** Until when they're locked out; null if they aren't. */
  lockedUntil: Date | null;
  /** When they stopped working; null if they're active. */
  deactivatedAt: Date | null;
}

export interface StaffRepository {
  /** null if nobody has that email (already normalized). */
  findByEmail(email: string): Promise<StaffCredentials | null>;
  findById(id: string): Promise<StaffCredentials | null>;
  /**
   * Takes one of the 5 attempts before the PIN is checked, in one write: PINs sent all at once can't all
   * be checked. false if they're locked out or the 5 are already taken.
   */
  claimAttempt(memberId: string, now: Date): Promise<boolean>;
  /**
   * The attempt taken was a wrong PIN: if it was the fifth in a row, locks them out for 15 minutes.
   * Returns until when they're locked out, or null.
   */
  recordFailedAttempt(memberId: string, now: Date): Promise<Date | null>;
  /** After a correct PIN: the attempts taken go back to zero. */
  clearAttempts(memberId: string): Promise<void>;
  /** Everybody on the team, active or not, for the Equipo screen. */
  list(): Promise<StaffProfile[]>;
  findProfile(id: string): Promise<StaffProfile | null>;
  /** Who changed this person, what and when, the most recent first. */
  history(id: string): Promise<StaffAuditEntry[]>;
  /** The new person and the audit row, together. "email-taken" if someone already has that email. */
  add(member: StaffProfile & { pinHmac: string }, by: string): Promise<"added" | "email-taken">;
  /**
   * The changes and their audit rows, together. A new PIN also clears the failed attempts and the lockout.
   * "email-taken" if someone else already has that email (nothing is saved).
   */
  change(
    id: string,
    changes: StaffChanges,
    audit: { by: string; at: Date; changes: readonly StaffChange[] },
  ): Promise<"changed" | "email-taken">;
}

/** A staff member as the Equipo screen sees them: never their PIN. */
export interface StaffProfile extends StaffMember {
  email: string;
  deactivatedAt: Date | null;
  createdAt: Date;
}

export interface StaffChanges {
  name?: string;
  email?: string;
  pinHmac?: string;
  /** A date: deactivated. null: active again. */
  deactivatedAt?: Date | null;
}

export interface StaffAuditEntry {
  change: StaffChange;
  at: Date;
  /** Who did it; null: the developers, with the script. */
  byName: string | null;
}

/** What happened on a card, to tell the customer's open code screen (the sello en vivo). */
export interface CardChange {
  /** The card's version after the change. */
  version: number;
  kind: "stamp" | "completed" | "redeem" | "undo";
}

/** The customers' code screens that are open, listening to their card. */
export interface CardWatchers {
  /**
   * Tells that card's open screens what happened. Nobody listening: nothing happens. It never fails: if
   * it can't tell them, it logs it, and the entry still counts.
   */
  changed(cardId: string, change: CardChange): Promise<void>;
}

// Services.

export interface Clock {
  now(): Date;
}

export interface DocumentHasher {
  /** The HMAC of an already validated document, with the secret key. */
  hmac(type: DocumentType, number: string): Promise<string>;
}

export interface CodeGenerator {
  shortCode(): string;
  qrCode(): string;
}

/** Checks a staff member's PIN against the stored hash, in constant time. */
export interface PinVerifier {
  matches(memberId: string, pin: string, pinHmac: string): Promise<boolean>;
}

/** New PINs for the team: drawn at random, never an easy one, and hashed with the environment's key. */
export interface PinIssuer {
  generate(): string;
  hash(memberId: string, pin: string): Promise<string>;
}

export interface SessionIssuer {
  /** Signs the customer in on this phone. Returns what has to be sent back (the Set-Cookie). */
  startCustomerSession(customerId: string): Promise<string>;
  /** Signs a staff member in at the register on this phone. Returns the Set-Cookie. */
  startStaffSession(member: { id: string; pinHmac: string }): Promise<string>;
}

/** The gate against bots for signing in and up: attempt cap per connection and Turnstile. */
export type GateResult = "open" | "too-many-attempts" | "no-turnstile";

export interface BotGate {
  check(turnstileToken: string | null): Promise<GateResult>;
}

export interface Logger {
  log(event: string, data?: Record<string, unknown>): void;
}
