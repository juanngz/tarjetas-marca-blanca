import { describe, expect, it } from "vitest";
import { receiptOf } from "./receipt";
import type { ViewEntryResult } from "./viewEntry";

const found = {
  result: "found",
  kind: "stamp",
  customerName: "Marta García",
  firstName: "Marta",
  leftForReward: "Le faltan 6 para el premio.",
  won: "un café take-away gratis",
  reward: "café take-away gratis",
  canUndo: true,
} as unknown as ViewEntryResult;

describe("the receipt of an entry", () => {
  it("is its confirmation, with its id", async () => {
    expect(await receiptOf(async () => found, "e1")).toMatchObject({ id: "e1", kind: "stamp" });
  });

  it("of one that was undone, is its undo's", async () => {
    const views: Record<string, ViewEntryResult> = {
      e1: { result: "undone", undoId: "e2" },
      e2: { ...found, kind: "undo-stamp", canUndo: false } as ViewEntryResult,
    };
    const view = async (id: string) => views[id] ?? { result: "not-found" as const };
    expect(await receiptOf(view, "e1")).toMatchObject({ id: "e2", kind: "undo-stamp" });
  });

  it("of one that doesn't exist, is none", async () => {
    expect(await receiptOf(async () => ({ result: "not-found" }), "x")).toBeNull();
  });
});
