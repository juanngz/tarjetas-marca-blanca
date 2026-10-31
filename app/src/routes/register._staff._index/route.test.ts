import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { testDb } from "../../../test/db";
import { addStamps, createCustomer, signedInCookie } from "../../../test/factories";
import { registerOnD1 } from "../../../test/register-routes";
import { args, dataOf, post, redirectOf, statusOf, TEST_SECRETS } from "../../../test/routes";
import { entries } from "../../platform/db/schema";
import { hmacDocumentHasher } from "../../platform/security/documentHasher.server";
import { action } from "./route";

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

type Found = {
  found: { customers: { name: string; signedUp: string; cards: { version: number }[] }[] };
  code: string;
};

/** A confirmation to show in the sheet over the register. */
type Done = { done: { id: string; kind: string; canUndo: boolean } };

const search = (code: string, cookie?: string) =>
  action(args(post("/register", { code }, cookie), t.d1));

/**
 * What the camera sends when it reads a QR: the same form, marked as read by the camera, with the id of
 * that reading (a new one after each answer).
 */
const scan = (code: string, cookie?: string, scanId: string = crypto.randomUUID()) =>
  action(args(post("/register", { code, from: "camera", scan: scanId }, cookie), t.d1));

describe("Buscar tarjeta", () => {
  it("with the short code, goes to that card", async () => {
    const { card, cookie } = await registerOnD1(t);
    const { shortCode } = card("take-away");
    const response = await redirectOf(search(shortCode, cookie));
    expect(response.headers.get("Location")).toBe(`/register/card/${shortCode}`);
  });

  it("the code can be typed in lowercase and with a space, as it's read out", async () => {
    const { card, cookie } = await registerOnD1(t);
    const { shortCode } = card("take-away");
    const typed = `${shortCode.slice(0, 3)} ${shortCode.slice(3)}`.toLowerCase();
    const response = await redirectOf(search(typed, cookie));
    expect(response.headers.get("Location")).toBe(`/register/card/${shortCode}`);
  });

  it("with the code the QR carries, goes to the card by its short code: the long one never goes in the URL", async () => {
    const { card, cookie } = await registerOnD1(t);
    const response = await redirectOf(search(card("beans-half").qrCode, cookie));
    expect(response.headers.get("Location")).toBe(`/register/card/${card("beans-half").shortCode}`);
  });

  it("by name, shows each customer with her cards, each with its version", async () => {
    const { cookie } = await registerOnD1(t);
    const result = dataOf<Found>(await search("marta garcia", cookie));
    expect(result.found.customers).toMatchObject([
      {
        name: "Marta García",
        signedUp: expect.stringMatching(/^Se anotó el /),
        cards: [{ version: 0 }, { version: 0 }, { version: 0 }, { version: 0 }],
      },
    ]);
    expect(result.code).toBe("marta garcia");
  });

  it("by DNI, shows that customer, and the number never comes back, not even in the field", async () => {
    const dniHmac = await hmacDocumentHasher(TEST_SECRETS.DNI_HMAC_KEY).hmac("dni", "30123456");
    await createCustomer(t.db, { name: "Lucía Pérez", dniHmac });
    const { cookie } = await registerOnD1(t);
    const result = await search("30.123.456", cookie);
    expect(dataOf<Found>(result).found.customers.map((c) => c.name)).toEqual(["Lucía Pérez"]);
    expect(JSON.stringify(dataOf(result))).not.toMatch(/30\.?123\.?456/);
  });

  it("by DNI typed with spaces, dashes or DNI in front, shows that customer, never the number", async () => {
    const dniHmac = await hmacDocumentHasher(TEST_SECRETS.DNI_HMAC_KEY).hmac("dni", "30123456");
    await createCustomer(t.db, { name: "Lucía Pérez", dniHmac });
    const { cookie } = await registerOnD1(t);
    for (const typed of ["30 123 456", "30-123-456", "DNI 30123456"]) {
      const result = await search(typed, cookie);
      expect(
        dataOf<Found>(result).found.customers.map((c) => c.name),
        typed,
      ).toEqual(["Lucía Pérez"]);
      expect(JSON.stringify(dataOf(result)), typed).not.toMatch(/30\D?123\D?456/);
    }
  });

  it("a document's digits never come back in the field, even in something that can't be looked up", async () => {
    const { cookie } = await registerOnD1(t);
    const result = await search("Lucía 30123456", cookie);
    expect(statusOf(result)).toBe(400);
    expect(dataOf<{ code: string }>(result).code).toBe("");
  });

  it("Sumar sello on a result adds the stamp to that card, at the version the barista saw", async () => {
    const { card, cookie, ana } = await registerOnD1(t);
    const { shortCode } = card("beans-quarter");
    const tap = () =>
      action(args(post("/register", { intent: "stamp", shortCode, version: "0" }, cookie), t.d1));
    // Its confirmation comes back to show over the register (a sheet), without changing screens.
    const first = dataOf<Done>(await tap());
    const [entry] = await t.db.select().from(entries);
    expect(entry).toMatchObject({ cardId: card("beans-quarter").id, staffId: ana.id });
    expect(first.done).toMatchObject({ id: entry?.id, kind: "stamp", canUndo: true });
    // Tapped twice: the first one's confirmation, not a second stamp.
    expect(dataOf<Done>(await tap()).done.id).toBe(entry?.id);
    expect(await t.db.select().from(entries)).toHaveLength(1);
  });

  it("nothing found says so, calmly", async () => {
    const { cookie } = await registerOnD1(t);
    for (const text of ["ZZZZZZ", "zoe", "99999999"]) {
      const result = await search(text, cookie);
      expect(statusOf(result)).toBe(404);
      expect(dataOf<{ error: string }>(result).error).toBe(
        "No encontramos nada con eso. Probá con otro dato.",
      );
    }
  });

  it("empty says what to write", async () => {
    const { cookie } = await registerOnD1(t);
    const result = await search("  ", cookie);
    expect(statusOf(result)).toBe(400);
    expect(dataOf<{ error: string }>(result).error).toBe(
      "Escribí el código de la tarjeta, el documento o el nombre.",
    );
  });

  it("a single letter asks for more of the name", async () => {
    const { cookie } = await registerOnD1(t);
    const result = await search("m", cookie);
    expect(statusOf(result)).toBe(400);
    expect(dataOf<{ error: string }>(result).error).toBe("Escribí al menos 2 letras del nombre.");
  });

  it("without a session at the register, nothing is looked up", async () => {
    const { card } = await registerOnD1(t);
    const response = await redirectOf(search(card("take-away").shortCode));
    expect(response.headers.get("Location")).toBe("/register/sign-in");
  });

  it("a customer's session doesn't look up cards", async () => {
    const { customer } = await createCustomer(t.db);
    const response = await redirectOf(search("ZZZZZZ", await signedInCookie(customer.id)));
    expect(response.headers.get("Location")).toBe("/register/sign-in");
  });
});

describe("the camera reads a QR", () => {
  it("adds a stamp, in the name of who's at the register, and shows its confirmation over the register", async () => {
    const { card, cookie, ana } = await registerOnD1(t);
    const result = dataOf<Done>(await scan(card("take-away").qrCode, cookie));
    const [entry] = await t.db.select().from(entries);
    expect(entry).toMatchObject({ type: "stamp", staffId: ana.id });
    expect(result.done).toMatchObject({ id: entry?.id, kind: "stamp" });
  });

  it("with a reward, adds nothing and opens the card, where its notice pops up", async () => {
    const { card, cookie, ana } = await registerOnD1(t);
    await addStamps(t.db, { card: card("beans-half"), by: ana, amount: 5 });
    const before = (await t.db.select().from(entries)).length;
    const response = await redirectOf(scan(card("beans-half").qrCode, cookie));
    expect(response.headers.get("Location")).toBe(`/register/card/${card("beans-half").shortCode}`);
    expect(await t.db.select().from(entries)).toHaveLength(before);
  });

  it("the same reading sent again, or twice at once, adds one stamp", async () => {
    const { card, cookie } = await registerOnD1(t);
    const reading = crypto.randomUUID();
    const qr = card("take-away").qrCode;
    const [one, two] = await Promise.all([scan(qr, cookie, reading), scan(qr, cookie, reading)]);
    const three = await scan(qr, cookie, reading);
    const shown = [one, two, three].map((r) => dataOf<Done>(r).done.id);
    expect(shown).toEqual([reading, reading, reading]);
    expect(await t.db.select().from(entries)).toHaveLength(1);
  });

  it("two readings of the same card are two stamps", async () => {
    const { card, cookie } = await registerOnD1(t);
    await scan(card("take-away").qrCode, cookie);
    await scan(card("take-away").qrCode, cookie);
    expect(await t.db.select().from(entries)).toHaveLength(2);
  });

  it("without its reading's id, adds nothing and says to try again", async () => {
    const { card, cookie } = await registerOnD1(t);
    const result = await action(
      args(post("/register", { code: card("take-away").qrCode, from: "camera" }, cookie), t.d1),
    );
    expect(statusOf(result)).toBe(400);
    expect(dataOf(result)).toEqual({ error: "Algo no salió bien. Probá de nuevo.", code: "" });
    expect(await t.db.select().from(entries)).toEqual([]);
  });

  it("a QR no card has says so, and its long code isn't put in the field", async () => {
    const { cookie } = await registerOnD1(t);
    const result = await scan("ZZZZZZZZZZZZZZZZZZZZZZZZ", cookie);
    expect(statusOf(result)).toBe(404);
    expect(dataOf(result)).toEqual({
      error: "No encontramos esa tarjeta. Pedile al cliente el código de su tarjeta y escribilo.",
      code: "",
    });
  });
});
