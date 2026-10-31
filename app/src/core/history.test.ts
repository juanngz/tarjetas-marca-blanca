import { describe, expect, it } from "vitest";
import type { EntryRecord } from "./card";
import { customerHistory } from "./history";

const at = (day: number) => new Date(`2026-10-${String(day).padStart(2, "0")}T12:00:00Z`);
const record = (
  id: string,
  type: EntryRecord["type"],
  day: number,
  undoesId: string | null = null,
) => ({
  id,
  type,
  undoesId,
  at: at(day),
});

describe("the customer's history of a card", () => {
  it("with no entries, it's empty", () => {
    expect(customerHistory([], 10)).toEqual([]);
  });

  it("the stamps and the redeems, the newest first", () => {
    const records = [record("a", "stamp", 1), record("b", "stamp", 2), record("c", "redeem", 3)];
    expect(customerHistory(records, 10)).toEqual([
      { id: "c", type: "redeem", at: at(3) },
      { id: "b", type: "stamp", at: at(2) },
      { id: "a", type: "stamp", at: at(1) },
    ]);
  });

  it("what was undone isn't there, and neither is the undo: nothing to interpret", () => {
    const records = [record("a", "stamp", 1), record("b", "stamp", 2), record("u", "undo", 2, "b")];
    expect(customerHistory(records, 10)).toEqual([{ id: "a", type: "stamp", at: at(1) }]);
  });

  it("only the last ones", () => {
    const records = [1, 2, 3, 4, 5].map((day) => record(`e${day}`, "stamp", day));
    expect(customerHistory(records, 2).map((item) => item.id)).toEqual(["e5", "e4"]);
  });
});
