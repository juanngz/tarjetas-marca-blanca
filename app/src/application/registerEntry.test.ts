import { describe, expect, it } from "vitest";
import { MARTAS_QR, NOON, registerWithMarta } from "../../test/register";
import { receiptOf } from "./receipt";
import { recordOnCard, stampScannedCard, undoEntry } from "./registerEntry";
import { viewEntry } from "./viewEntry";

async function atTheRegister() {
  const setup = await registerWithMarta();
  const { cafe, deps } = setup;
  const tap = (type: "stamp" | "redeem", seenVersion: number, shortCode = "K7M2QX") =>
    recordOnCard({ shortCode, type, seenVersion, staffId: "ana", at: NOON }, cafe, deps);
  const undo = (entryId: string, staffId = "ana") =>
    undoEntry({ entryId, staffId, at: NOON }, cafe, deps);
  return { ...setup, tap, undo };
}

describe("add a stamp or redeem from the card at the register", () => {
  it("adds the stamp to the card on screen, in the name of who's at the register", async () => {
    const { db, tap, cardId } = await atTheRegister();
    await tap("stamp", 0);
    expect(db.stored.entries).toEqual([
      expect.objectContaining({ cardId: cardId("K7M2QX"), type: "stamp", staffId: "ana" }),
    ]);
  });

  it("only if the card is still as the barista saw it", async () => {
    const { tap } = await atTheRegister();
    await tap("stamp", 0);
    expect(await tap("stamp", 0)).toMatchObject({ ok: false, reason: "card-changed" });
  });

  it("a card that isn't at the register any more records nothing", async () => {
    const { db, tap } = await atTheRegister();
    db.stored.customers.delete("marta");
    expect(await tap("stamp", 0)).toEqual({ ok: false, reason: "card-not-found" });
    expect(db.stored.entries).toEqual([]);
  });
});

describe("undo at the register", () => {
  it("is a new entry, in the name of who undid it", async () => {
    const { db, tap, undo } = await atTheRegister();
    const stamp = await tap("stamp", 0);
    if (!stamp.ok) throw new Error("The stamp wasn't added.");
    await undo(stamp.entryId, "juan");
    expect(db.stored.entries.at(-1)).toMatchObject({
      type: "undo",
      undoesId: stamp.entryId,
      staffId: "juan",
    });
  });

  it("an entry that doesn't exist isn't undone", async () => {
    const { undo } = await atTheRegister();
    expect(await undo("nope")).toEqual({ ok: false, reason: "not-found" });
  });

  it("an undo can't be undone", async () => {
    const { tap, undo } = await atTheRegister();
    const stamp = await tap("stamp", 0);
    if (!stamp.ok) throw new Error("The stamp wasn't added.");
    const undone = await undo(stamp.entryId);
    if (!undone.ok) throw new Error("It wasn't undone.");
    expect(await undo(undone.entryId)).toEqual({ ok: false, reason: "not-found" });
  });

  it("an entry on a card that isn't at the register any more isn't undone", async () => {
    const { db, tap, undo } = await atTheRegister();
    const stamp = await tap("stamp", 0);
    if (!stamp.ok) throw new Error("The stamp wasn't added.");
    db.stored.customers.delete("marta");
    expect(await undo(stamp.entryId)).toEqual({ ok: false, reason: "not-found" });
  });
});

// The database is in the EU: what an action reads is asked at once, one trip instead of one after another.
describe("each action reads at once", () => {
  /** The card repository, recording what's asked, and answering only when told. */
  async function holdingAnswers() {
    const setup = await atTheRegister();
    const asked: string[] = [];
    let answer: () => void = () => {};
    const answered = new Promise<void>((resolve) => {
      answer = resolve;
    });
    const held = Object.fromEntries(
      Object.entries(setup.db.cards).map(([name, step]) => [
        name,
        async (...args: unknown[]) => {
          asked.push(name);
          await answered;
          return (step as (...a: unknown[]) => unknown)(...args);
        },
      ]),
    ) as unknown as typeof setup.db.cards;
    const deps = { ...setup.deps, cards: held };
    const askedBeforeAnyAnswer = async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
      const first = [...asked].sort();
      answer();
      return first;
    };
    return { ...setup, deps, askedBeforeAnyAnswer };
  }

  it("Sumar sello: the card and its ledger", async () => {
    const { cafe, deps, askedBeforeAnyAnswer } = await holdingAnswers();
    const tapping = recordOnCard(
      { shortCode: "K7M2QX", type: "stamp", seenVersion: 0, staffId: "ana", at: NOON },
      cafe,
      deps,
    );
    expect(await askedBeforeAnyAnswer()).toEqual(["findForRegister", "findLedger"]);
    expect(await tapping).toMatchObject({ ok: true });
  });

  it("a scan: the card, its ledger and whether the reading was already added", async () => {
    const { cafe, deps, askedBeforeAnyAnswer } = await holdingAnswers();
    const scanning = stampScannedCard(
      { code: MARTAS_QR, scanId: "0b7c6d2e-4f1a-4c3b-9d8e-7f6a5b4c3d2e", staffId: "ana", at: NOON },
      cafe,
      deps,
    );
    expect(await askedBeforeAnyAnswer()).toEqual([
      "findCardOfEntry",
      "findForRegister",
      "findLedger",
    ]);
    expect(await scanning).toMatchObject({ result: "stamped" });
  });
});

// Each action comes back with its confirmation, made from what it already read: the register doesn't read the
// card again to show it (two trips less to the EU). It's the same as its own screen shows.
describe("each action comes back with its confirmation", () => {
  async function asItsScreenShowsIt() {
    const setup = await atTheRegister();
    const { db, cafe } = setup;
    const onItsScreen = (entryId: string) =>
      receiptOf((id) => viewEntry({ entryId: id }, cafe, { cards: db.cards }), entryId);
    return { ...setup, onItsScreen };
  }

  it("a stamp", async () => {
    const { tap, onItsScreen } = await asItsScreenShowsIt();
    const stamp = await tap("stamp", 0);
    if (!stamp.ok) throw new Error("Not recorded.");
    expect(stamp.receipt).toEqual(await onItsScreen(stamp.entryId));
    expect(stamp.receipt).toMatchObject({ kind: "stamp", customerName: "Marta García" });
  });

  it("the stamp that completes the card, and the redeem", async () => {
    const { tap, onItsScreen, cafe } = await asItsScreenShowsIt();
    const perRound = cafe.cards.find((c) => c.type === "beans-quarter")?.stamps ?? 0;
    let completing: Awaited<ReturnType<typeof tap>> | undefined;
    for (let seen = 0; seen < perRound; seen++) completing = await tap("stamp", seen, "BBBBBB");
    if (!completing?.ok) throw new Error("Not recorded.");
    expect(completing.receipt).toMatchObject({ kind: "completed" });
    expect(completing.receipt).toEqual(await onItsScreen(completing.entryId));

    const redeem = await tap("redeem", perRound, "BBBBBB");
    if (!redeem.ok) throw new Error("Not redeemed.");
    expect(redeem.receipt).toMatchObject({ kind: "redeem" });
    expect(redeem.receipt).toEqual(await onItsScreen(redeem.entryId));
  });

  it("an undone stamp", async () => {
    const { tap, undo, onItsScreen } = await asItsScreenShowsIt();
    const stamp = await tap("stamp", 0);
    if (!stamp.ok) throw new Error("Not recorded.");
    const undone = await undo(stamp.entryId);
    if (!undone.ok) throw new Error("Not undone.");
    expect(undone.receipt).toMatchObject({ kind: "undo-stamp", canUndo: false });
    expect(undone.receipt).toEqual(await onItsScreen(undone.entryId));
  });

  it("a scanned stamp", async () => {
    const { cafe, deps, onItsScreen } = await asItsScreenShowsIt();
    const scanned = await stampScannedCard(
      { code: MARTAS_QR, scanId: "0b7c6d2e-4f1a-4c3b-9d8e-7f6a5b4c3d2e", staffId: "ana", at: NOON },
      cafe,
      deps,
    );
    if (scanned.result !== "stamped") throw new Error("Not stamped.");
    expect(scanned.receipt).toMatchObject({ kind: "stamp" });
    expect(scanned.receipt).toEqual(await onItsScreen(scanned.entryId));
  });
});

// The sello en vivo: the customer's code screen is told what happened, right away (decided on 07/10/2026).
describe("the customer's open screen is told", () => {
  it("a stamp, with the card's new version", async () => {
    const { tap, watchers, cardId } = await atTheRegister();
    await tap("stamp", 0);
    expect(watchers.told).toEqual([
      { cardId: cardId("K7M2QX"), change: { version: 1, kind: "stamp" } },
    ]);
  });

  it("the stamp that completes the card, to celebrate", async () => {
    const { tap, watchers } = await atTheRegister();
    for (let i = 0; i < 4; i++) await tap("stamp", i, "BBBBBB");
    expect(watchers.told.at(-1)?.change).toEqual({ version: 4, kind: "completed" });
  });

  it("a redeem", async () => {
    const { tap, watchers } = await atTheRegister();
    for (let i = 0; i < 4; i++) await tap("stamp", i, "BBBBBB");
    await tap("redeem", 4, "BBBBBB");
    expect(watchers.told.at(-1)?.change).toEqual({ version: 5, kind: "redeem" });
  });

  it("an undo", async () => {
    const { tap, undo, watchers } = await atTheRegister();
    const stamp = await tap("stamp", 0);
    if (!stamp.ok) throw new Error("The stamp wasn't added.");
    await undo(stamp.entryId);
    expect(watchers.told.at(-1)?.change).toEqual({ version: 2, kind: "undo" });
  });

  it("a tap that records nothing tells nothing", async () => {
    const { tap, watchers } = await atTheRegister();
    await tap("stamp", 0);
    await tap("stamp", 0);
    expect(watchers.told).toHaveLength(1);
  });
});

// Scanning adds the stamp by itself (decided on 08/10/2026): each card has its own QR, so it's clear which.
/** Which stamp a reading went to: a reading sent again goes to the same one (its confirmation is read again). */
const stampOf = (scan: Awaited<ReturnType<typeof stampScannedCard>>) =>
  scan.result === "stamped" ? scan.entryId : scan.result;

describe("scan a card's QR at the register", () => {
  /** The id of one reading of the camera: the register makes up a new one after each answer. */
  const READING = "0b7c6d2e-4f1a-4c3b-9d8e-7f6a5b4c3d2e";
  const ANOTHER_READING = "5e4d3c2b-1a0f-4e9d-8c7b-6a5f4e3d2c1b";

  async function scan(code = MARTAS_QR) {
    const setup = await atTheRegister();
    const scanned = (scanId = READING, qr = code) =>
      stampScannedCard({ code: qr, scanId, staffId: "ana", at: NOON }, setup.cafe, setup.deps);
    return { ...setup, scanned };
  }

  it("adds a stamp to that card, in the name of who's at the register", async () => {
    const { db, scanned, cardId } = await scan();
    const result = await scanned();
    expect(result).toMatchObject({ result: "stamped" });
    expect(db.stored.entries).toEqual([
      expect.objectContaining({ cardId: cardId("K7M2QX"), type: "stamp", staffId: "ana" }),
    ]);
  });

  it("goes to that stamp's confirmation, which has the reading's id", async () => {
    const { db, scanned } = await scan();
    expect(await scanned()).toMatchObject({ result: "stamped", entryId: READING });
    expect(db.stored.entries[0]?.id).toBe(READING);
  });

  it("the customer's open screen is told", async () => {
    const { scanned, watchers, cardId } = await scan();
    await scanned();
    expect(watchers.told).toEqual([
      { cardId: cardId("K7M2QX"), change: { version: 1, kind: "stamp" } },
    ]);
  });

  it("with a reward, adds nothing: the card opens, to redeem it in this purchase", async () => {
    const { db, scanned, tap } = await scan();
    for (let version = 0; version < 8; version++) await tap("stamp", version);
    const before = db.stored.entries.length;
    expect(await scanned()).toEqual({ result: "has-reward", shortCode: "K7M2QX" });
    expect(db.stored.entries).toHaveLength(before);
  });

  it("the same reading sent again adds one stamp, and goes to its confirmation", async () => {
    // Its answer was lost on a bad connection, and the register sent it again (flujos-equipo.md).
    const { db, scanned } = await scan();
    const first = await scanned();
    expect(stampOf(await scanned())).toEqual(stampOf(first));
    expect(db.stored.entries).toHaveLength(1);
  });

  it("the same reading sent twice at once adds one stamp", async () => {
    const { db, scanned } = await scan();
    const [one, two] = await Promise.all([scanned(), scanned()]);
    expect(stampOf(two)).toEqual(stampOf(one));
    expect(db.stored.entries).toHaveLength(1);
  });

  it("the reading that completed the card, sent again, goes to its confirmation, not to the reward", async () => {
    const { db, scanned, tap } = await scan();
    for (let version = 0; version < 6; version++) await tap("stamp", version);
    const completing = await scanned();
    expect(completing).toMatchObject({ result: "stamped" });
    expect(stampOf(await scanned())).toEqual(stampOf(completing));
    expect(db.stored.entries).toHaveLength(7);
  });

  it("two readings of the same card are two stamps: two coffees", async () => {
    const { db, scanned } = await scan();
    await scanned(READING);
    await scanned(ANOTHER_READING);
    expect(db.stored.entries).toHaveLength(2);
  });

  it("without its reading's id, adds nothing", async () => {
    const { db, scanned } = await scan();
    for (const scanId of ["", "not-a-reading", "K7M2QX"]) {
      expect(await scanned(scanId), scanId).toEqual({ result: "no-scan" });
    }
    expect(db.stored.entries).toEqual([]);
  });

  it("a reading's id already used on another card adds nothing there", async () => {
    const { db, scanned } = await scan();
    await scanned(READING);
    expect(await scanned(READING, "QRQUARTER23456789ABCDEFG")).toEqual({ result: "no-scan" });
    expect(db.stored.entries).toHaveLength(1);
  });

  it("a QR that isn't a Club card adds nothing", async () => {
    const { db, scanned } = await scan("https://example.com");
    expect(await scanned()).toEqual({ result: "not-a-code" });
    expect(db.stored.entries).toEqual([]);
  });

  it("a QR no card has isn't found, and is logged with who scanned it", async () => {
    const { scanned, logger } = await scan("ZZZZZZZZZZZZZZZZZZZZZZZZ");
    expect(await scanned()).toEqual({ result: "not-found" });
    expect(logger.events).toEqual([
      { event: "register-card-not-found", data: { memberId: "ana" } },
    ]);
  });
});
