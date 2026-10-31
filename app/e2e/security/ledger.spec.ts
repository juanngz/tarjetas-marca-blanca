// Security: the stamps and rewards (what costs the café money). Many taps at once, from one phone or two,
// record once: the register only saves if the card is still as the barista saw it (flujos-equipo.md,
// "Tocar dos veces o reintentar con mala señal suma un solo sello"). A reward can't be redeemed twice, nor
// without having one, and nothing the screens never send (a changed version) records anything.
import { expect, test } from "@playwright/test";
import {
  addStampNow,
  codesOf,
  customerPhone,
  newBarista,
  post,
  record,
  redirectedTo,
  staffPhone,
  versionOf,
} from "../support/http";
import { BRUNO } from "../support/register";

const AT_ONCE = 10;

/** A new customer's card and Ana at the register. */
async function cardAtRegister(type = "take-away") {
  const marta = await customerPhone();
  const { shortCode, qrCode } = await codesOf(marta.phone, type);
  return { marta, shortCode, qrCode, ana: await staffPhone() };
}

test("ten taps on Sumar sello at once add one stamp", async () => {
  const { shortCode, ana } = await cardAtRegister();
  const sent = await Promise.all(
    Array.from({ length: AT_ONCE }, () => record(ana, shortCode, "stamp", 0)),
  );
  expect(sent.every((r) => r.status() < 500)).toBe(true);
  expect(await versionOf(ana, shortCode)).toBe(1);
});

test("ten taps on Sumar sello from the search at once add one stamp", async () => {
  const { shortCode, ana } = await cardAtRegister();
  await Promise.all(
    Array.from({ length: AT_ONCE }, () =>
      post(ana, "/register?index", { intent: "stamp", shortCode, version: "0" }),
    ),
  );
  expect(await versionOf(ana, shortCode)).toBe(1);
});

test("two baristas tapping Sumar sello at once add one stamp", async () => {
  const { shortCode, ana } = await cardAtRegister();
  const other = await staffPhone(await newBarista(await staffPhone(BRUNO)));
  const [fromAna, fromOther] = await Promise.all([
    record(ana, shortCode, "stamp", 0),
    record(other, shortCode, "stamp", 0),
  ]);
  expect(await versionOf(ana, shortCode)).toBe(1);
  // The one who lost sees the card as it is now, to look at it before going on.
  const places = [redirectedTo(fromAna), redirectedTo(fromOther)];
  expect(places).toContain(`/register/card/${shortCode}?changed`);
});

/** What the camera sends: the QR's code and the id of that reading. */
const scan = (register: Awaited<ReturnType<typeof staffPhone>>, qrCode: string, reading: string) =>
  post(register, "/register?index", { from: "camera", code: qrCode, scan: reading });

test("the same reading of a QR sent five times at once adds one stamp", async () => {
  const { shortCode, qrCode, ana } = await cardAtRegister();
  const reading = crypto.randomUUID();
  await Promise.all(Array.from({ length: 5 }, () => scan(ana, qrCode, reading)));
  expect(await versionOf(ana, shortCode)).toBe(1);
});

test("the same reading sent again after its answer was lost adds one stamp", async () => {
  const { shortCode, qrCode, ana } = await cardAtRegister();
  const reading = crypto.randomUUID();
  await scan(ana, qrCode, reading);
  await scan(ana, qrCode, reading);
  expect(await versionOf(ana, shortCode)).toBe(1);
});

test("two readings of the same QR are two stamps: two coffees", async () => {
  const { shortCode, qrCode, ana } = await cardAtRegister();
  await scan(ana, qrCode, crypto.randomUUID());
  await scan(ana, qrCode, crypto.randomUUID());
  expect(await versionOf(ana, shortCode)).toBe(2);
});

test("a reading without its id adds nothing", async () => {
  const { shortCode, qrCode, ana } = await cardAtRegister();
  const sent = await post(ana, "/register?index", { from: "camera", code: qrCode });
  expect(sent.status()).toBe(400);
  expect(await versionOf(ana, shortCode)).toBe(0);
});

test("ten taps on Canjear premio at once redeem one reward", async () => {
  // ¼ kg: 4 stamps per reward. Ten stamps, two rewards: a second redeem would still have one to take.
  const { shortCode, ana } = await cardAtRegister("beans-quarter");
  for (let i = 0; i < 10; i++) await addStampNow(ana, shortCode);
  const version = await versionOf(ana, shortCode);

  await Promise.all(
    Array.from({ length: AT_ONCE }, () => record(ana, shortCode, "redeem", version)),
  );
  expect(await versionOf(ana, shortCode)).toBe(version + 1);
  await expect(async () => {
    const html = await (await ana.get(`/register/card/${shortCode}`)).text();
    expect(html).toContain('value="redeem"');
  }).toPass();
});

test("a card without a reward can't be redeemed by sending the form", async () => {
  const { shortCode, ana } = await cardAtRegister();
  await addStampNow(ana, shortCode);
  const sent = await record(ana, shortCode, "redeem", 1);
  expect(sent.status()).toBe(409);
  expect(await versionOf(ana, shortCode)).toBe(1);
});

test("ten taps on Deshacer at once undo the stamp once", async () => {
  const { shortCode, ana } = await cardAtRegister();
  await addStampNow(ana, shortCode);
  const entry = await addStampNow(ana, shortCode);

  await Promise.all(
    Array.from({ length: AT_ONCE }, () => post(ana, `/register/done/${entry}`, { intent: "undo" })),
  );
  // Two stamps and one undo: three entries, one stamp left.
  expect(await versionOf(ana, shortCode)).toBe(3);
});

test("an undo can't be undone, to bring the stamp back twice", async () => {
  const { shortCode, ana } = await cardAtRegister();
  const stamp = await addStampNow(ana, shortCode);
  const undone = redirectedTo(await post(ana, `/register/done/${stamp}`, { intent: "undo" }));
  const undoId = /\/register\/done\/([0-9a-f-]{36})$/.exec(undone ?? "")?.[1];
  expect(undoId).toBeTruthy();

  const again = await post(ana, `/register/done/${undoId}`, { intent: "undo" });
  expect(again.status()).toBeGreaterThanOrEqual(400);
  expect(again.status()).toBeLessThan(500);
  expect(await versionOf(ana, shortCode)).toBe(2);
});

test("the stamp that completed a card can't be undone once its reward was redeemed", async () => {
  const { shortCode, ana } = await cardAtRegister("beans-quarter");
  for (let i = 0; i < 3; i++) await addStampNow(ana, shortCode);
  const completing = await addStampNow(ana, shortCode);
  await record(ana, shortCode, "redeem", 4);

  const undo = await post(ana, `/register/done/${completing}`, { intent: "undo" });
  expect(undo.status()).toBe(409);
  expect(await versionOf(ana, shortCode)).toBe(5);
});

test("a version the screens never send records nothing, and never breaks the server", async () => {
  const { shortCode, ana } = await cardAtRegister();
  for (const version of ["-1", "1.5", "1e3", "", " 0", "0x0", "99999999999999999999999", "NaN"]) {
    const sent = await record(ana, shortCode, "stamp", version);
    expect(sent.status(), `version "${version}"`).toBeLessThan(500);
  }
  for (const intent of ["undo", "STAMP", "", "stamp\u0000"]) {
    const sent = await post(ana, `/register/card/${shortCode}`, { intent, version: "0" });
    expect(sent.status(), `intent "${intent}"`).toBe(400);
  }
  expect(await versionOf(ana, shortCode)).toBe(0);
});
