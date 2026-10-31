import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { testDb } from "../../../test/db";
import { addStamps, createStaffMember, staffCookie } from "../../../test/factories";
import { registerOnD1 } from "../../../test/register-routes";
import { args, dataOf, get, post, redirectOf, statusOf } from "../../../test/routes";
import { entries } from "../../platform/db/schema";
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

const view = (code: string, cookie?: string, query = "") =>
  loader(args(get(`/register/card/${code}${query}`, cookie), t.d1, { code }));

const tap = (code: string, fields: Record<string, string>, cookie?: string) =>
  action(args(post(`/register/card/${code}`, fields, cookie), t.d1, { code }));

describe("the card at the register", () => {
  it("shows whose it is and the card as she sees it", async () => {
    const { card, cookie } = await registerOnD1(t);
    const result = dataOf(await view(card("take-away").shortCode, cookie));
    expect(result).toMatchObject({
      customerName: "Marta García",
      card: { name: "Café take-away", stamps: 0, stampsPerRound: 7, rewards: 0 },
      leftForReward: "Le faltan 7 para el café gratis.",
      reward: "un café take-away gratis",
      version: 0,
    });
  });

  it("a card that doesn't exist isn't found", async () => {
    const { cookie } = await registerOnD1(t);
    let thrown: unknown;
    try {
      await view("ZZZZZZ", cookie);
    } catch (error) {
      thrown = error;
    }
    expect(statusOf(thrown)).toBe(404);
  });

  it("without a session, asks to sign in", async () => {
    const { card } = await registerOnD1(t);
    const response = await redirectOf(view(card("take-away").shortCode));
    expect(response.headers.get("Location")).toBe("/register/sign-in");
  });

  it("if it changed while the barista was looking, says so", async () => {
    const { card, cookie } = await registerOnD1(t);
    const result = dataOf(await view(card("take-away").shortCode, cookie, "?changed"));
    expect(result).toMatchObject({ changed: true });
  });
});

describe("Sumar sello", () => {
  it("adds the stamp and shows its confirmation in a sheet over the card, without changing screens", async () => {
    // Like the register's main screen (08/10/2026): no trip to another screen to read it again.
    const { card, cookie } = await registerOnD1(t);
    const result = await tap(
      card("take-away").shortCode,
      { intent: "stamp", version: "0" },
      cookie,
    );
    const [entry] = await t.db.select().from(entries);
    expect(dataOf(result)).toMatchObject({
      done: { id: entry.id, kind: "stamp", customerName: "Marta García", card: { stamps: 1 } },
    });
  });

  it("the stamp is in the name of who's signed in, whatever the form says", async () => {
    const { card, ana, cookie } = await registerOnD1(t);
    const juan = await createStaffMember(t.db, { name: "Juan" });
    await tap(
      card("take-away").shortCode,
      { intent: "stamp", version: "0", staffId: juan.id },
      cookie,
    );
    const [entry] = await t.db.select().from(entries);
    expect(entry.staffId).toBe(ana.id);
  });

  it("tapping twice adds a single stamp, and both show the same confirmation", async () => {
    const { card, cookie } = await registerOnD1(t);
    const code = card("take-away").shortCode;
    const doneOf = async (tapped: ReturnType<typeof tap>) =>
      dataOf<{ done: { id: string } }>(await tapped).done.id;
    const first = await doneOf(tap(code, { intent: "stamp", version: "0" }, cookie));
    const second = await doneOf(tap(code, { intent: "stamp", version: "0" }, cookie));
    expect(await t.db.select().from(entries)).toHaveLength(1);
    expect(second).toBe(first);
  });

  it("if someone else changed the card, records nothing and shows it again", async () => {
    const { card, cookie } = await registerOnD1(t);
    const juan = await createStaffMember(t.db, { name: "Juan" });
    const code = card("take-away").shortCode;
    await tap(code, { intent: "stamp", version: "0" }, await staffCookie(juan));
    const response = await redirectOf(tap(code, { intent: "stamp", version: "0" }, cookie));
    expect(response.headers.get("Location")).toBe(`/register/card/${code}?changed`);
    expect(await t.db.select().from(entries)).toHaveLength(1);
  });

  it("without a session, nothing is recorded", async () => {
    const { card } = await registerOnD1(t);
    const response = await redirectOf(
      tap(card("take-away").shortCode, { intent: "stamp", version: "0" }),
    );
    expect(response.headers.get("Location")).toBe("/register/sign-in");
    expect(await t.db.select().from(entries)).toHaveLength(0);
  });

  it("without the version the barista saw, nothing is recorded", async () => {
    const { card, cookie } = await registerOnD1(t);
    const result = await tap(card("take-away").shortCode, { intent: "stamp" }, cookie);
    expect(statusOf(result)).toBe(400);
    expect(await t.db.select().from(entries)).toHaveLength(0);
  });
});

describe("Canjear premio", () => {
  it("redeems a reward and shows its confirmation", async () => {
    const { card, ana, cookie } = await registerOnD1(t);
    await addStamps(t.db, { card: card("beans-quarter"), by: ana, amount: 5 });
    const result = await tap(
      card("beans-quarter").shortCode,
      { intent: "redeem", version: "5" },
      cookie,
    );
    const redeem = (await t.db.select().from(entries).where(eq(entries.type, "redeem")))[0];
    expect(dataOf(result)).toMatchObject({ done: { id: redeem.id, kind: "redeem" } });
  });

  it("without rewards, says so and redeems nothing", async () => {
    const { card, cookie } = await registerOnD1(t);
    const result = await tap(
      card("take-away").shortCode,
      { intent: "redeem", version: "0" },
      cookie,
    );
    expect(statusOf(result)).toBe(409);
    expect(dataOf<{ error: string }>(result).error).toBe(
      "Esta tarjeta no tiene premios para canjear.",
    );
    expect(await t.db.select().from(entries)).toHaveLength(0);
  });
});
