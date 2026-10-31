// What the customer sees of a card's ledger, under its code: what counted, the newest first.
// What was undone and the undo itself aren't shown: for the customer, it never happened.
// Neither is who did it: that stays in the team's ficha (flujos-equipo.md).
import { type EntryRecord, type EntryType, ledgerFrom } from "./card";

export interface HistoryItem {
  id: string;
  type: EntryType;
  at: Date;
}

/** The last `limit` stamps and redeems that count, the newest first. */
export function customerHistory(records: readonly EntryRecord[], limit: number): HistoryItem[] {
  return ledgerFrom(records)
    .filter((entry) => !entry.undone)
    .reverse()
    .slice(0, limit)
    .map(({ id, type, at }) => ({ id, type, at }));
}
