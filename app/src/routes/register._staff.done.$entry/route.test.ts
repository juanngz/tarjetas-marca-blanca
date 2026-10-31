import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { testDb } from "../../../test/db";
import { addStamps } from "../../../test/factories";
import { registerOnD1 } from "../../../test/register-routes";
import { args, dataOf, get, post, redirectOf, statusOf } from "../../../test/routes";
import { entries } from "../../platform/db/schema";
import { action as tapCard } from "../register._staff.card.$code/route";
import { action, loader } from "./route";

let t: Awaited<ReturnType<typeof testDb>>;
beforeAll(async () => {
  t = await testDb();
});
beforeEach(async () => {
  await t.clear();
});
afterAll(async () => {
  await t.close();
});

/** Taps a button on the card at the register and returns the entry's id. */
async function tap(code: string, intent: string, version: number, cookie: string) {
  // The card's screen answers with its confirmation in a sheet (11/10/2026): the entry is its id.
  const result = await tapCard(
    args(post(`/register/card/${code}`, { intent, version: String(version) }, cookie), t.d1, {
      code,
    }),
  );
  return dataOf<{ done: { id: string } }>(result).done.id;
}

const view = (entry: string, cookie?: string) =>
  loader(args(get(`/register/done/${entry}`, cookie), t.d1, { entry }));

const undo = (entry: string, cookie?: string) =>
  action(args(post(`/register/done/${entry}`, { intent: "undo" }, cookie), t.d1, { entry }));

describe("the confirmation", () => {
  it("of a stamp: Marta's card as it was left", async () => {
    const { card, cookie } = await registerOnD1(t);
    const entry = await tap(card("take-away").shortCode, "stamp", 0, cookie);
    expect(dataOf(await view(entry, cookie))).toMatchObject({
      kind: "stamp",
      customerName: "Marta García",
      card: { stamps: 1 },
      leftForReward: "Le faltan 6 para el café gratis.",
      canUndo: true,
    });
  });

  it("of an entry that was undone, shows its undo", async () => {
    const { card, cookie } = await registerOnD1(t);
    const entry = await tap(card("take-away").shortCode, "stamp", 0, cookie);
    const undone = await redirectOf(undo(entry, cookie));
    const response = await redirectOf(view(entry, cookie));
    expect(response.headers.get("Location")).toBe(undone.headers.get("Location"));
  });

  it("of an entry that doesn't exist isn't found", async () => {
    const { cookie } = await registerOnD1(t);
    let thrown: unknown;
    try {
      await view("nope", cookie);
    } catch (error) {
      thrown = error;
    }
    expect(statusOf(thrown)).toBe(404);
  });

  it("without a session, asks to sign in", async () => {
    const response = await redirectOf(view("anything"));
    expect(response.headers.get("Location")).toBe("/register/sign-in");
  });
});

describe("Deshacer", () => {
  it("undoes the stamp, in the name of who's signed in, and shows its confirmation", async () => {
    const { card, ana, cookie } = await registerOnD1(t);
    const entry = await tap(card("take-away").shortCode, "stamp", 0, cookie);
    const response = await redirectOf(undo(entry, cookie));
    const undone = (await t.db.select().from(entries)).find((e) => e.type === "undo");
    expect(undone).toMatchObject({ undoesId: entry, staffId: ana.id });
    expect(response.headers.get("Location")).toBe(`/register/done/${undone?.id}`);
  });

  it("from the sheet over the register, its confirmation comes back to show there, without changing screens", async () => {
    const { card, cookie } = await registerOnD1(t);
    const entry = await tap(card("take-away").shortCode, "stamp", 0, cookie);
    const result = await action(
      args(post(`/register/done/${entry}`, { intent: "undo", in: "sheet" }, cookie), t.d1, {
        entry,
      }),
    );
    const undone = (await t.db.select().from(entries)).find((e) => e.type === "undo");
    expect(dataOf(result)).toMatchObject({ done: { id: undone?.id, kind: "undo-stamp" } });
  });

  it("tapping it twice undoes once", async () => {
    const { card, cookie } = await registerOnD1(t);
    const entry = await tap(card("take-away").shortCode, "stamp", 0, cookie);
    const first = await redirectOf(undo(entry, cookie));
    const second = await redirectOf(undo(entry, cookie));
    expect((await t.db.select().from(entries)).filter((e) => e.type === "undo")).toHaveLength(1);
    expect(second.headers.get("Location")).toBe(first.headers.get("Location"));
  });

  it("from an old confirmation, also undoes", async () => {
    const { card, cookie } = await registerOnD1(t);
    const code = card("take-away").shortCode;
    const first = await tap(code, "stamp", 0, cookie);
    await tap(code, "stamp", 1, cookie);
    await redirectOf(undo(first, cookie));
    expect((await t.db.select().from(entries)).filter((e) => e.type === "undo")).toHaveLength(1);
  });

  it("a stamp whose reward was already redeemed says to undo the redeem first", async () => {
    const { card, ana, cookie } = await registerOnD1(t);
    const code = card("beans-quarter").shortCode;
    await addStamps(t.db, { card: card("beans-quarter"), by: ana, amount: 3 });
    const completing = await tap(code, "stamp", 3, cookie);
    await tap(code, "redeem", 4, cookie);
    const result = await undo(completing, cookie);
    expect(statusOf(result)).toBe(409);
    expect(dataOf<{ error: string }>(result).error).toBe(
      "Este sello completó la tarjeta y su premio ya se canjeó. Para deshacerlo, primero deshacé el canje.",
    );
  });

  it("without a session, nothing is undone", async () => {
    const { card, cookie } = await registerOnD1(t);
    const entry = await tap(card("take-away").shortCode, "stamp", 0, cookie);
    const response = await redirectOf(undo(entry));
    expect(response.headers.get("Location")).toBe("/register/sign-in");
    expect(await t.db.select().from(entries)).toHaveLength(1);
  });
});
