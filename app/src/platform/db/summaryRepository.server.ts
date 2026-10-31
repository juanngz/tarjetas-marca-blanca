// SummaryRepository on D1 (application/ports.ts): what Resumen counts (core/summary.ts). Only what counts
// comes: a stamp or redeem that was undone doesn't, and neither does the undo. The rest is counted in the core.
// All in a single batch: the database is in the EU, one trip instead of four.
import type { SummaryRepository } from "../../application/ports";
import type { EntryType } from "../../core/card";
import type { Db } from "./cafeDb.server";

/** An entry counts if no undo cancels it: found by the unique index on undoes_id. */
const COUNTS = "NOT EXISTS (SELECT 1 FROM entries u WHERE u.undoes_id = e.id)";

export function d1SummaryRepository(db: Db): SummaryRepository {
  return {
    async read(since) {
      const d1 = db.$client;
      // Dates are stored in milliseconds.
      const from = since.getTime();
      const [signUps, counted, before, pending] = await d1.batch([
        d1
          .prepare("SELECT created_at FROM customers WHERE created_at >= ? ORDER BY created_at")
          .bind(from),
        d1
          .prepare(
            // A deleted customer's card counts as its own customer.
            `SELECT e.card_id, coalesce(c.customer_id, c.id) AS customer_id, c.type AS card_type, e.type, e.at
             FROM entries e
             JOIN cards c ON c.id = e.card_id
             WHERE e.type IN ('stamp', 'redeem') AND e.at >= ? AND ${COUNTS}
             ORDER BY e.at, e.rowid`,
          )
          .bind(from),
        // Only the cards used since then: the others don't earn rewards in the period.
        d1
          .prepare(
            `SELECT e.card_id, count(*) AS stamps FROM entries e
             WHERE e.type = 'stamp' AND e.at < ? AND ${COUNTS}
               AND e.card_id IN (SELECT card_id FROM entries WHERE at >= ?)
             GROUP BY e.card_id`,
          )
          .bind(from, from),
        // A deleted customer's card isn't at the register any more: its rewards can't be used.
        d1.prepare(
          `SELECT type, sum(rewards) AS rewards FROM cards
           WHERE customer_id IS NOT NULL AND rewards > 0 GROUP BY type`,
        ),
      ]);
      const rows = <T>(result: D1Result) => result.results as T[];
      return {
        signUps: rows<{ created_at: number }>(signUps).map((r) => new Date(r.created_at)),
        entries: rows<{
          card_id: string;
          customer_id: string;
          card_type: string;
          type: EntryType;
          at: number;
        }>(counted).map((r) => ({
          cardId: r.card_id,
          customerId: r.customer_id,
          cardType: r.card_type,
          type: r.type,
          at: new Date(r.at),
        })),
        stampsBefore: new Map(
          rows<{ card_id: string; stamps: number }>(before).map((r) => [r.card_id, r.stamps]),
        ),
        pendingRewards: new Map(
          rows<{ type: string; rewards: number }>(pending).map((r) => [r.type, r.rewards]),
        ),
      };
    },
  };
}
