// In-memory implementations of the ports (src/application/ports.ts), to test the use cases without a database.
// They behave like the real ones where it matters: unique document and codes, atomic writes, card versions.
// What has to be stored for real is still tested against D1 (test/db.ts).

import type {
  BotGate,
  CardChange,
  CardLedger,
  CardLookup,
  CardRepository,
  CardWatchers,
  CardWithBalance,
  Clock,
  CodeGenerator,
  Customer,
  CustomerRepository,
  DocumentHasher,
  GateResult,
  Logger,
  NewEntry,
  PinIssuer,
  PinVerifier,
  SessionIssuer,
  StaffCredentials,
  StaffRepository,
} from "../src/application/ports";
import { nameForSearch } from "../src/core/search";
import type { StaffChange } from "../src/core/staff";

export interface StoredCard extends CardWithBalance {
  customerId: string | null;
  version: number;
}

export interface StoredEntry extends NewEntry {
  id: string;
  cardId: string;
}

/** A whole café in memory: its customers, cards and ledger, shared by the repositories. */
export function inMemoryDb() {
  const customers = new Map<string, Customer & { dniHmac: string }>();
  const cards = new Map<string, StoredCard>();
  const entries: StoredEntry[] = [];
  let nextId = 0;
  const newId = () => `id-${++nextId}`;

  /** A card by any of its codes, or its id. */
  const cardBy = (lookup: CardLookup) =>
    [...cards.values()].find((c) =>
      "shortCode" in lookup
        ? c.shortCode === lookup.shortCode
        : "qrCode" in lookup
          ? c.qrCode === lookup.qrCode
          : c.id === lookup.cardId,
    );

  const customerRepository: CustomerRepository = {
    async findByDniHmac(dniHmac) {
      const found = [...customers.values()].find((c) => c.dniHmac === dniHmac);
      return found ? { id: found.id, name: found.name, createdAt: found.createdAt } : null;
    },
    async findById(id) {
      const found = customers.get(id);
      return found ? { id: found.id, name: found.name, createdAt: found.createdAt } : null;
    },
    async searchByName(words, limit) {
      return [...customers.values()]
        .map(({ id, name, createdAt }) => ({ id, name, createdAt }))
        .filter(({ name }) => {
          const stored = ` ${nameForSearch(name)}`;
          return words.every((word) => stored.includes(` ${word}`));
        })
        .sort((a, b) => nameForSearch(a.name).localeCompare(nameForSearch(b.name)))
        .slice(0, limit);
    },
    async createWithCards(customer, newCards) {
      const taken = (code: string) =>
        [...cards.values()].some((c) => c.qrCode === code || c.shortCode === code);
      if ([...customers.values()].some((c) => c.dniHmac === customer.dniHmac)) {
        throw new Error("UNIQUE constraint failed: customers.dni_hmac");
      }
      if (newCards.some((c) => taken(c.qrCode) || taken(c.shortCode))) {
        throw new Error("UNIQUE constraint failed: cards code");
      }
      customers.set(customer.id, { ...customer });
      for (const card of newCards) {
        const id = newId();
        cards.set(id, { ...card, id, customerId: customer.id, stamps: 0, rewards: 0, version: 0 });
      }
    },
  };

  const cardRepository: CardRepository = {
    async findByCustomer(customerId) {
      return [...cards.values()]
        .filter((c) => c.customerId === customerId)
        .map(({ customerId: _, ...card }) => card);
    },
    async findForRegister(lookup) {
      const card = cardBy(lookup);
      const owner = card?.customerId ? customers.get(card.customerId) : undefined;
      if (!card || !owner) return null;
      const { id, type, shortCode, stamps, rewards, version } = card;
      return { id, type, shortCode, stamps, rewards, version, customerName: owner.name };
    },

    async findCardOfEntry(entryId) {
      return entries.find((e) => e.id === entryId)?.cardId ?? null;
    },

    async findLedger(lookup): Promise<CardLedger | null> {
      const card = cardBy(lookup);
      if (!card) return null;
      const records = entries
        .filter((e) => e.cardId === card.id)
        .map(({ id, type, undoesId, at, staffId }) => ({ id, type, undoesId, at, staffId }));
      return { type: card.type, version: card.version, records };
    },

    async hasMovements(customerId, type) {
      const card = [...cards.values()].find((c) => c.customerId === customerId && c.type === type);
      const theirs = entries.filter((e) => e.cardId === card?.id);
      const undone = new Set(theirs.map((e) => e.undoesId));
      return theirs.some((e) => e.type !== "undo" && !undone.has(e.id));
    },

    async activity({ staffId, limit }) {
      return (
        entries
          .filter((e) => !staffId || e.staffId === staffId)
          .map((e, saved) => ({ e, saved }))
          // The newest first; at the same instant, the last saved first.
          .sort((a, b) => b.e.at.getTime() - a.e.at.getTime() || b.saved - a.saved)
          .slice(0, limit)
          .map(({ e }) => {
            const card = cards.get(e.cardId);
            const owner = card?.customerId ? customers.get(card.customerId) : undefined;
            const undoneType = entries.find((u) => u.id === e.undoesId)?.type;
            return {
              id: e.id,
              type: e.type,
              at: e.at,
              staffId: e.staffId,
              cardType: card?.type ?? "",
              customerName: owner?.name ?? null,
              undoneType: undoneType === "stamp" || undoneType === "redeem" ? undoneType : null,
              undone: entries.some((u) => u.undoesId === e.id),
            };
          })
      );
    },

    async appendEntry({ cardId, versionRead, balance, entry, entryId }) {
      const card = cards.get(cardId);
      if (!card || card.version !== versionRead) return null;
      const id = entryId ?? newId();
      // Like the database: an id is unique.
      if (entries.some((e) => e.id === id)) throw new Error(`UNIQUE constraint failed: entries.id`);
      entries.push({ ...entry, id, cardId });
      cards.set(cardId, { ...card, ...balance, version: card.version + 1 });
      return id;
    },
  };

  return {
    customers: customerRepository,
    cards: cardRepository,
    /** Direct access, to set up and check the tests. */
    stored: { customers, cards, entries },
  };
}

export const fixedClock = (at = new Date("2026-10-06T15:00:00Z")): Clock => ({ now: () => at });

/** Not an HMAC: readable, so tests can see what was hashed. Never contains the number as is. */
export const fakeHasher: DocumentHasher = {
  hmac: async (type, number) => `hmac(${type}:${[...number].reverse().join("")})`,
};

/** Codes in sequence, always different. */
export function sequentialCodes(): CodeGenerator {
  let n = 0;
  return {
    shortCode: () => `S${String(++n).padStart(5, "0")}`,
    qrCode: () => `Q${String(++n).padStart(23, "0")}`,
  };
}

export const fakeSessions: SessionIssuer = {
  startCustomerSession: async (customerId) => `session-of-${customerId}`,
  startStaffSession: async (member) => `staff-session-of-${member.id}`,
};

/** Not an HMAC: readable, so tests can see whose PIN it is. */
export const fakePinHmac = (memberId: string, pin: string) => `pin(${memberId}:${pin})`;

export const fakePins: PinVerifier = {
  matches: async (memberId, pin, pinHmac) => pinHmac === fakePinHmac(memberId, pin),
};

/** The register staff in memory, locked out like the real one: 5 failed PINs in a row, 15 minutes. */
export function inMemoryStaff() {
  type Stored = StaffCredentials & { email: string; createdAt: Date };
  const members = new Map<string, Stored>();
  const audit: { staffId: string; byId: string | null; change: StaffChange; at: Date }[] = [];
  const credentials = ({ email: _, createdAt: __, ...member }: Stored) => ({ ...member });
  const profile = ({ id, name, role, email, deactivatedAt, createdAt }: Stored) => ({
    id,
    name,
    role,
    email,
    deactivatedAt,
    createdAt,
  });
  const emailTaken = (email: string, except?: string) =>
    [...members.values()].some((m) => m.email === email && m.id !== except);

  const repository: StaffRepository = {
    async findByEmail(email) {
      const found = [...members.values()].find((m) => m.email === email);
      return found ? credentials(found) : null;
    },
    async findById(id) {
      const found = members.get(id);
      return found ? credentials(found) : null;
    },
    async claimAttempt(memberId, now) {
      const member = members.get(memberId);
      const locked = member?.lockedUntil && member.lockedUntil > now;
      if (!member || locked || member.failedAttempts >= 5) return false;
      members.set(memberId, { ...member, failedAttempts: member.failedAttempts + 1 });
      return true;
    },
    async recordFailedAttempt(memberId, now) {
      const member = members.get(memberId);
      if (!member) return null;
      const reachedLimit = member.failedAttempts >= 5;
      const lockedUntil = reachedLimit ? new Date(now.getTime() + 15 * 60_000) : member.lockedUntil;
      members.set(memberId, {
        ...member,
        failedAttempts: reachedLimit ? 0 : member.failedAttempts,
        lockedUntil,
      });
      return lockedUntil && lockedUntil > now ? lockedUntil : null;
    },
    async clearAttempts(memberId) {
      const member = members.get(memberId);
      if (member) members.set(memberId, { ...member, failedAttempts: 0, lockedUntil: null });
    },
    async list() {
      return [...members.values()].map(profile);
    },
    async findProfile(id) {
      const found = members.get(id);
      return found ? profile(found) : null;
    },
    async history(id) {
      return audit
        .filter((a) => a.staffId === id)
        .reverse()
        .map(({ change, at, byId }) => ({
          change,
          at,
          byName: byId ? (members.get(byId)?.name ?? null) : null,
        }));
    },
    async add(member, by) {
      if (emailTaken(member.email)) return "email-taken";
      members.set(member.id, { ...member, failedAttempts: 0, lockedUntil: null });
      audit.push({ staffId: member.id, byId: by, change: "added", at: member.createdAt });
      return "added";
    },
    async change(id, changes, { by, at, changes: what }) {
      const member = members.get(id);
      if (!member) return "changed";
      if (changes.email && emailTaken(changes.email, id)) return "email-taken";
      const newPin = changes.pinHmac ? { failedAttempts: 0, lockedUntil: null } : {};
      members.set(id, { ...member, ...changes, ...newPin });
      for (const change of what) audit.push({ staffId: id, byId: by, change, at });
      return "changed";
    },
  };

  /** Ana, barista, with her PIN 428613. */
  function add(changes: Partial<Stored & { pin: string }> = {}) {
    const { pin = "428613", ...rest } = changes;
    const id = rest.id ?? `member-${members.size + 1}`;
    const member: Stored = {
      id,
      email: "ana@example.com",
      name: "Ana",
      role: "barista" as const,
      failedAttempts: 0,
      lockedUntil: null,
      deactivatedAt: null,
      createdAt: new Date("2026-10-01T12:00:00Z"),
      ...rest,
      pinHmac: rest.pinHmac ?? fakePinHmac(id, pin),
    };
    members.set(id, member);
    return member;
  }

  return { staff: repository, add, stored: members, audit };
}

/** New PINs in sequence, never easy ones; hashed like fakePinHmac. Records the PINs it gave. */
export function sequentialPins(): PinIssuer & { given: string[] } {
  const given: string[] = [];
  let next = 482915;
  return {
    given,
    generate: () => {
      const pin = String(next++);
      given.push(pin);
      return pin;
    },
    hash: async (memberId, pin) => fakePinHmac(memberId, pin),
  };
}

/** A gate that always answers the same; "open" by default. Records the tokens it got. */
export function fakeGate(result: GateResult = "open"): BotGate & { tokens: (string | null)[] } {
  const tokens: (string | null)[] = [];
  return {
    tokens,
    check: async (token) => {
      tokens.push(token);
      return result;
    },
  };
}

export function memoryLogger(): Logger & { events: { event: string; data?: object }[] } {
  const events: { event: string; data?: object }[] = [];
  return { events, log: (event, data) => events.push({ event, data }) };
}

/** Marta García signed up with the example café's 4 cards (stored out of order), in a café in memory. */
export async function inMemoryDbWithMarta() {
  const db = inMemoryDb();
  await db.customers.createWithCards(
    {
      id: "marta",
      name: "Marta García",
      createdAt: new Date("2026-10-06T15:00:00Z"),
      dniHmac: "h",
    },
    [
      { type: "beans-half", qrCode: "q3", shortCode: "K7M2QX" },
      { type: "take-away", qrCode: "q1", shortCode: "AAAAAA" },
      { type: "beans-quarter", qrCode: "q2", shortCode: "BBBBBB" },
      { type: "beans-kilo", qrCode: "q4", shortCode: "CCCCCC" },
    ],
  );
  return db;
}

/** The customers' open screens, in memory: records what each card's screens were told. */
export function memoryWatchers(): CardWatchers & {
  told: { cardId: string; change: CardChange }[];
} {
  const told: { cardId: string; change: CardChange }[] = [];
  return { told, changed: async (cardId, change) => void told.push({ cardId, change }) };
}

/**
 * Repositories that write down what's asked and answer only when told: to check that a use case asks
 * everything at once (the database is in the EU, so each trip one after another adds up).
 * `askedBeforeAnyAnswer` says what was asked before the first answer, sorted, and then lets them answer.
 */
export function holdingAnswers<T extends Record<string, object>>(repositories: T) {
  const asked: string[] = [];
  let answer: () => void = () => {};
  const answered = new Promise<void>((resolve) => {
    answer = resolve;
  });
  const held = Object.fromEntries(
    Object.entries(repositories).map(([repository, steps]) => [
      repository,
      Object.fromEntries(
        Object.entries(steps).map(([name, step]) => [
          name,
          async (...args: unknown[]) => {
            asked.push(`${repository}.${name}`);
            await answered;
            return (step as (...a: unknown[]) => unknown)(...args);
          },
        ]),
      ),
    ]),
  ) as T;
  const askedBeforeAnyAnswer = async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
    const first = [...asked].sort();
    answer();
    return first;
  };
  return { held, askedBeforeAnyAnswer };
}
