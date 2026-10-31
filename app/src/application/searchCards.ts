// Use case: Buscar tarjeta at the register (Flujo D of the staff flows), by a card's code, a document or a
// name. A code goes to that card; a document or a name, to each customer found with their 3 cards, each with
// its version, so Sumar sello applies to what the barista saw. The document is looked up only by its hash
// and never comes back: the register never shows it.
import type { Cafe } from "../cafes/types";
import { type DisplayCard, displayCards } from "../core/displayCard";
import type { DocumentType } from "../core/document";
import { readSearch } from "../core/search";
import { signedUpOn } from "../core/signedUp";
import type { CardRepository, Customer, CustomerRepository, DocumentHasher, Logger } from "./ports";

/** More than this, and the barista adds the surname. */
export const MAX_CUSTOMERS = 10;

export interface FoundCard {
  card: DisplayCard;
  shortCode: string;
  version: number;
}

export interface FoundCustomer {
  name: string;
  /** "Se anotó el 1 de octubre": tells two with the same name apart. Never the document. */
  signedUp: string;
  cards: FoundCard[];
}

/** What was typed: a document is never shown again, not even in the field. */
export type SearchedBy = "code" | "document" | "name";

export type SearchCardsResult =
  | { result: "card"; shortCode: string }
  | { result: "customers"; customers: FoundCustomer[]; more: boolean; by: SearchedBy }
  | { result: "empty" }
  | { result: "too-short" }
  | { result: "not-found"; by: SearchedBy };

export interface SearchCardsDeps {
  customers: CustomerRepository;
  cards: CardRepository;
  hasher: DocumentHasher;
  logger: Logger;
}

async function withCards(
  found: Customer[],
  now: Date,
  cafe: Cafe,
  deps: SearchCardsDeps,
): Promise<FoundCustomer[]> {
  return Promise.all(
    found.map(async (customer) => {
      const theirs = await deps.cards.findByCustomer(customer.id);
      const cards = displayCards(cafe, theirs).flatMap((card) => {
        const stored = theirs.find((c) => c.type === card.type);
        return stored ? [{ card, shortCode: stored.shortCode, version: stored.version }] : [];
      });
      const signedUp = signedUpOn(customer.createdAt, now, cafe.timeZone);
      return { name: customer.name, signedUp, cards };
    }),
  );
}

/** The document can be a DNI or another one: both are tried, each with its own hash. */
async function findByDocument(number: string, deps: SearchCardsDeps): Promise<Customer | null> {
  const types: DocumentType[] = /^\d{7,8}$/.test(number) ? ["dni", "other"] : ["other"];
  for (const type of types) {
    const customer = await deps.customers.findByDniHmac(await deps.hasher.hmac(type, number));
    if (customer) return customer;
  }
  return null;
}

export async function searchCards(
  input: { text: string; memberId: string; at: Date },
  cafe: Cafe,
  deps: SearchCardsDeps,
): Promise<SearchCardsResult> {
  const search = readSearch(input.text);
  const found = (by: SearchedBy, customers: FoundCustomer[], more = false): SearchCardsResult =>
    customers.length > 0
      ? { result: "customers", customers, more, by }
      : { result: "not-found", by };
  const byName = async (words: string[]) => {
    const customers = await deps.customers.searchByName(words, MAX_CUSTOMERS + 1);
    return found(
      "name",
      await withCards(customers.slice(0, MAX_CUSTOMERS), input.at, cafe, deps),
      customers.length > MAX_CUSTOMERS,
    );
  };

  switch (search.kind) {
    case "code": {
      const card = await deps.cards.findForRegister(search.code);
      if (card) return { result: "card", shortCode: card.shortCode };
      if (search.orDocument) {
        const customer = await findByDocument(search.orDocument, deps);
        if (customer) return found("document", await withCards([customer], input.at, cafe, deps));
      }
      if (search.orName) {
        const named = await byName(search.orName);
        if (named.result === "customers") return named;
      }
      // Codes that don't exist don't lock the register: they're logged for the panel's alert (phase 2).
      deps.logger.log("register-card-not-found", { memberId: input.memberId });
      return { result: "not-found", by: "code" };
    }
    case "document": {
      const customer = await findByDocument(search.number, deps);
      return found("document", customer ? await withCards([customer], input.at, cafe, deps) : []);
    }
    case "name":
      return byName(search.words);
    default:
      return { result: search.kind };
  }
}
