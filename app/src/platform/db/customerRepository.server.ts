// CustomerRepository on D1 (application/ports.ts). By document, a customer is looked up only with the hash:
// the number never reaches the database.
import { and, asc, eq, sql } from "drizzle-orm";
import type { CustomerRepository } from "../../application/ports";
import { nameForSearch } from "../../core/search";
import type { Db } from "./cafeDb.server";
import { cards, customers } from "./schema";

const columns = { id: customers.id, name: customers.name, createdAt: customers.createdAt };

export function d1CustomerRepository(db: Db): CustomerRepository {
  return {
    async findByDniHmac(dniHmac) {
      const [customer] = await db
        .select(columns)
        .from(customers)
        .where(eq(customers.dniHmac, dniHmac));
      return customer ?? null;
    },

    async findById(id) {
      const [customer] = await db.select(columns).from(customers).where(eq(customers.id, id));
      return customer ?? null;
    },

    // With instr and not LIKE: D1 caps a LIKE pattern at 50 bytes (a long word broke the search), and
    // the words are looked for as they are, % and _ included. name_search is already in lowercase.
    async searchByName(words, limit) {
      const startOfAWord = (word: string) =>
        sql`instr(' ' || ${customers.nameSearch}, ${` ${word}`}) > 0`;
      return db
        .select(columns)
        .from(customers)
        .where(and(...words.map(startOfAWord)))
        .orderBy(asc(customers.nameSearch), asc(customers.createdAt))
        .limit(limit);
    },

    // D1's batch runs both inserts in a single transaction.
    async createWithCards(customer, newCards) {
      await db.batch([
        db.insert(customers).values({ ...customer, nameSearch: nameForSearch(customer.name) }),
        db.insert(cards).values(
          newCards.map((card) => ({
            ...card,
            customerId: customer.id,
            createdAt: customer.createdAt,
          })),
        ),
      ]);
    },
  };
}
