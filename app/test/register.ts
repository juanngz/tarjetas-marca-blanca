// The register in memory, for the use case tests: Marta García with the example café's cards, and Ana at the register.
import { exampleCafe } from "../src/cafes/example";
import { inMemoryDb, memoryLogger, memoryWatchers } from "./fakes";

export const NOON = new Date("2026-10-07T15:00:00Z");
/** What the QR of Marta's take-away card carries: 24 characters of the Club's alphabet. */
export const MARTAS_QR = "QRTAKEAWAY23456789ABCDEF";

export async function registerWithMarta() {
  const db = inMemoryDb();
  await db.customers.createWithCards(
    { id: "marta", name: "Marta García", createdAt: NOON, dniHmac: "h" },
    [
      { type: "take-away", qrCode: MARTAS_QR, shortCode: "K7M2QX" },
      { type: "beans-quarter", qrCode: "QRQUARTER23456789ABCDEFG", shortCode: "BBBBBB" },
      { type: "beans-half", qrCode: "QRHXXF23456789ABCDEFGHJK", shortCode: "CCCCCC" },
    ],
  );
  const cardId = (shortCode: string) =>
    [...db.stored.cards.values()].find((c) => c.shortCode === shortCode)?.id ?? "";
  const logger = memoryLogger();
  const watchers = memoryWatchers();
  /** What the register's use cases get: the cards, the customers' open screens and the log. */
  const deps = { cards: db.cards, watchers, logger };
  return { db, logger, watchers, deps, cafe: exampleCafe, cardId };
}
