import { describe, expect, it } from "vitest";
import { holdingAnswers, inMemoryDb, inMemoryStaff, sequentialCodes } from "../../test/fakes";
import { exampleCafe } from "../cafes/example";
import { ACTIVITY_PAGE, viewActivity } from "./activity";
import type { StaffMember } from "./ports";

const NOW = new Date("2026-10-08T23:00:00Z");
const at = (minute: number) => new Date(Date.UTC(2026, 9, 8, 15, minute));

/** Marta's take-away card, Ana (barista) and Bruno (manager) at the register. */
async function theRegister() {
  const db = inMemoryDb();
  const team = inMemoryStaff();
  team.add({ id: "ana", email: "ana@example.com", name: "Ana" });
  team.add({ id: "bruno", email: "bruno@example.com", name: "Bruno", role: "manager" });
  const codes = sequentialCodes();
  await db.customers.createWithCards(
    { id: "marta", name: "Marta García", dniHmac: "hmac", createdAt: at(0) },
    exampleCafe.cards.map((card) => ({
      type: card.type,
      qrCode: codes.qrCode(),
      shortCode: codes.shortCode(),
    })),
  );
  const card = [...db.stored.cards.values()].find((c) => c.type === "take-away");
  if (!card) throw new Error("Missing the take-away card.");
  let n = 0;
  /** A loose row in the ledger, like the register leaves it. */
  const entry = (
    staffId: string,
    minute: number,
    type: "stamp" | "redeem" | "undo" = "stamp",
    undoesId: string | null = null,
  ) => {
    const id = `entry-${++n}`;
    db.stored.entries.push({ id, cardId: card.id, type, undoesId, at: at(minute), staffId });
    return id;
  };
  const deps = { cards: db.cards, staff: team.staff };
  const manager: StaffMember = { id: "bruno", name: "Bruno", role: "manager" };
  const barista: StaffMember = { id: "ana", name: "Ana", role: "barista" };
  const view = (input: { actor?: StaffMember; memberId?: string; pages?: number } = {}) =>
    viewActivity({ actor: manager, now: NOW, ...input }, exampleCafe, deps);
  return { db, card, entry, view, manager, barista, deps };
}

async function ok(outcome: ReturnType<typeof viewActivity>) {
  const view = await outcome;
  if (view.result !== "ok") throw new Error("It should show the register's history.");
  return view;
}

describe("the register's history", () => {
  it("is only for the manager", async () => {
    const { view, barista } = await theRegister();
    expect(await view({ actor: barista })).toEqual({ result: "forbidden" });
  });

  it("shows what everybody did, baristas and managers, the newest first", async () => {
    const { entry, view } = await theRegister();
    entry("ana", 1);
    entry("bruno", 2, "redeem");
    const { lines } = await ok(view());
    expect(lines.map((l) => [l.kind, l.byName, l.byRole])).toEqual([
      ["redeem", "Bruno", "manager"],
      ["stamp", "Ana", "barista"],
    ]);
  });

  it("says on which card, whose, and when in the café's voice", async () => {
    const { entry, view } = await theRegister();
    entry("ana", 5);
    const [line] = (await ok(view())).lines;
    expect(line).toMatchObject({
      cardName: "Café take-away",
      customerName: "Marta García",
      when: "8 de octubre, 12:05",
    });
  });

  it("an undo says what it undid, and what was undone is marked", async () => {
    const { entry, view } = await theRegister();
    const stamp = entry("ana", 1);
    const redeem = entry("ana", 2, "redeem");
    entry("bruno", 3, "undo", stamp);
    entry("bruno", 4, "undo", redeem);
    const { lines } = await ok(view());
    expect(lines.map((l) => [l.kind, l.undone])).toEqual([
      ["undo-redeem", false],
      ["undo-stamp", false],
      ["redeem", true],
      ["stamp", true],
    ]);
  });

  it("a deleted customer's card shows without a name", async () => {
    const { db, card, entry, view } = await theRegister();
    entry("ana", 1);
    db.stored.cards.set(card.id, { ...card, customerId: null });
    const [line] = (await ok(view())).lines;
    expect(line.customerName).toBeNull();
  });

  it("shows only one person's, when asked", async () => {
    const { entry, view } = await theRegister();
    entry("ana", 1);
    entry("bruno", 2);
    const { lines, memberId } = await ok(view({ memberId: "ana" }));
    expect(lines.map((l) => l.byName)).toEqual(["Ana"]);
    expect(memberId).toBe("ana");
  });

  it("says who did each one, so the phone can show one person's right away", async () => {
    const { entry, view } = await theRegister();
    entry("ana", 1);
    entry("bruno", 2);
    const { lines } = await ok(view());
    expect(lines.map((l) => l.byId)).toEqual(["bruno", "ana"]);
  });

  // The database is in the EU: the team and the movements are asked at once, one trip instead of two.
  it("asks the team and the movements at once", async () => {
    const { deps, manager } = await theRegister();
    const { held, askedBeforeAnyAnswer } = holdingAnswers(deps);
    const viewing = viewActivity({ actor: manager, now: NOW, memberId: "ana" }, exampleCafe, held);
    expect(await askedBeforeAnyAnswer()).toEqual(["cards.activity", "staff.list"]);
    expect((await viewing).result).toBe("ok");
  });

  it("someone who isn't on the team shows everybody's", async () => {
    const { entry, view } = await theRegister();
    entry("ana", 1);
    entry("bruno", 2);
    const { lines, memberId } = await ok(view({ memberId: "nobody" }));
    expect(lines).toHaveLength(2);
    expect(memberId).toBeNull();
  });

  it("lists the whole team to choose whose, by name", async () => {
    const { view } = await theRegister();
    const { people } = await ok(view());
    expect(people.map((p) => p.name)).toEqual(["Ana", "Bruno"]);
  });

  it("shows a page at a time, and says if there's more", async () => {
    const { entry, view } = await theRegister();
    for (let i = 0; i <= ACTIVITY_PAGE; i++) entry("ana", i);
    const first = await ok(view());
    expect(first.lines).toHaveLength(ACTIVITY_PAGE);
    expect(first.more).toBe(true);
    const both = await ok(view({ pages: 2 }));
    expect(both.lines).toHaveLength(ACTIVITY_PAGE + 1);
    expect(both.more).toBe(false);
  });
});
