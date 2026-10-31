import { describe, expect, it } from "vitest";
import { fakeHasher } from "../../test/fakes";
import { MARTAS_QR, NOON, registerWithMarta } from "../../test/register";
import { searchCards } from "./searchCards";

async function search(
  text: string,
  prepare?: (setup: Awaited<ReturnType<typeof registerWithMarta>>) => Promise<void>,
) {
  const setup = await registerWithMarta();
  await prepare?.(setup);
  const { db, logger, cafe } = setup;
  const result = await searchCards({ text, memberId: "ana", at: NOON }, cafe, {
    customers: db.customers,
    cards: db.cards,
    hasher: fakeHasher,
    logger,
  });
  return { result, logger, db };
}

/** Another customer, signed up with a document and her 3 cards. */
async function signUp(
  db: Awaited<ReturnType<typeof registerWithMarta>>["db"],
  {
    id,
    name,
    dni,
    type = "dni" as const,
  }: { id: string; name: string; dni: string; type?: "dni" | "other" },
) {
  await db.customers.createWithCards(
    { id, name, createdAt: NOON, dniHmac: await fakeHasher.hmac(type, dni) },
    [
      {
        type: "take-away",
        qrCode: `QR${id}TAKEAWAY23456789ABC`.slice(0, 24),
        shortCode: `${id.slice(0, 4)}TA`,
      },
      {
        type: "beans-quarter",
        qrCode: `QR${id}QUARTER23456789ABCD`.slice(0, 24),
        shortCode: `${id.slice(0, 4)}QU`,
      },
      {
        type: "beans-half",
        qrCode: `QR${id}HALF23456789ABCDEFG`.slice(0, 24),
        shortCode: `${id.slice(0, 4)}HA`,
      },
    ],
  );
}

const names = (result: Awaited<ReturnType<typeof searchCards>>) =>
  result.result === "customers" ? result.customers.map((c) => c.name) : result;

describe("Buscar tarjeta, by a card's code", () => {
  it("the short code goes to that card", async () => {
    expect((await search("k7m 2qx")).result).toEqual({ result: "card", shortCode: "K7M2QX" });
  });

  it("the long code a QR carries goes to that card too", async () => {
    expect((await search(MARTAS_QR)).result).toEqual({ result: "card", shortCode: "K7M2QX" });
  });

  it("a code no card has isn't found, and is logged with who typed it, for the panel's alert", async () => {
    const { result, logger } = await search("ZZZZZZ");
    expect(result).toEqual({ result: "not-found", by: "code" });
    expect(logger.events).toEqual([
      { event: "register-card-not-found", data: { memberId: "ana" } },
    ]);
  });
});

describe("Buscar tarjeta, by document", () => {
  it("shows the customer with her 3 cards, in the café's order", async () => {
    const { result } = await search("30123456", (s) =>
      signUp(s.db, { id: "LUCIA", name: "Lucía Pérez", dni: "30123456" }),
    );
    expect(result).toMatchObject({
      result: "customers",
      customers: [
        {
          name: "Lucía Pérez",
          signedUp: "Se anotó el 7 de octubre",
          cards: [
            { card: { type: "take-away" }, shortCode: "LUCITA" },
            { card: { type: "beans-quarter" }, shortCode: "LUCIQU" },
            { card: { type: "beans-half" }, shortCode: "LUCIHA" },
          ],
        },
      ],
      more: false,
    });
  });

  it("with the dots of the DNI card", async () => {
    const { result } = await search("30.123.456", (s) =>
      signUp(s.db, { id: "LUCIA", name: "Lucía Pérez", dni: "30123456" }),
    );
    expect(names(result)).toEqual(["Lucía Pérez"]);
  });

  it("another document, with letters", async () => {
    const { result } = await search("aab123456", (s) =>
      signUp(s.db, { id: "PIERO", name: "Piero Rossi", dni: "AAB123456", type: "other" }),
    );
    expect(names(result)).toEqual(["Piero Rossi"]);
  });

  it("another document of 6 letters and numbers, that looks like a card's code", async () => {
    const { result } = await search("ab2345", (s) =>
      signUp(s.db, { id: "PIERO", name: "Piero Rossi", dni: "AB2345", type: "other" }),
    );
    expect(names(result)).toEqual(["Piero Rossi"]);
    // A document: the screen doesn't put it back in the field.
    expect(result).toMatchObject({ by: "document" });
  });

  it("says it was a document, so the screen doesn't put it back in the field", async () => {
    const { result } = await search("30123456", (s) =>
      signUp(s.db, { id: "LUCIA", name: "Lucía Pérez", dni: "30123456" }),
    );
    expect(result).toMatchObject({ result: "customers", by: "document" });
  });

  it("each card carries its version, so Sumar sello applies to what the barista saw", async () => {
    const { result } = await search("30123456", (s) =>
      signUp(s.db, { id: "LUCIA", name: "Lucía Pérez", dni: "30123456" }),
    );
    expect(result).toMatchObject({
      customers: [{ cards: [{ version: 0 }, { version: 0 }, { version: 0 }] }],
    });
  });

  it("a document nobody has isn't found", async () => {
    expect((await search("99999999")).result).toEqual({ result: "not-found", by: "document" });
  });

  it("the document never comes back in the result", async () => {
    const { result } = await search("30123456", (s) =>
      signUp(s.db, { id: "LUCIA", name: "Lucía Pérez", dni: "30123456" }),
    );
    expect(JSON.stringify(result)).not.toContain("30123456");
  });
});

describe("Buscar tarjeta, by name", () => {
  it("without accents and by the start of the words", async () => {
    expect(names((await search("marta garc")).result)).toEqual(["Marta García"]);
  });

  it("two with the same name: each one, to tell them apart by their sign-up date", async () => {
    const { result } = await search("marta", (s) =>
      signUp(s.db, { id: "MARTA2", name: "Marta García", dni: "27999888" }),
    );
    expect(names(result)).toEqual(["Marta García", "Marta García"]);
  });

  it("a 6-letter name that looks like a code, if no card has it", async () => {
    const { result } = await search("Andrea", (s) =>
      signUp(s.db, { id: "ANDREA", name: "Andrea Sosa", dni: "28111222" }),
    );
    expect(names(result)).toEqual(["Andrea Sosa"]);
  });

  it("at most 10, and it says there are more", async () => {
    const { result } = await search("sosa", async (s) => {
      for (let i = 0; i < 11; i++) {
        await signUp(s.db, {
          id: `${"ABCDEFGHJKM"[i]}SOS`,
          name: `Sosa ${i}`,
          dni: `2800000${i}`,
        });
      }
    });
    expect(result).toMatchObject({ result: "customers", more: true });
    expect(names(result)).toHaveLength(10);
  });

  it("a name nobody has isn't found", async () => {
    expect((await search("zoe")).result).toEqual({ result: "not-found", by: "name" });
  });
});

describe("Buscar tarjeta, with nothing to look up", () => {
  it("empty says what to write", async () => {
    expect((await search("  ")).result).toEqual({ result: "empty" });
  });

  it("a single letter is too short", async () => {
    expect((await search("m")).result).toEqual({ result: "too-short" });
  });
});
