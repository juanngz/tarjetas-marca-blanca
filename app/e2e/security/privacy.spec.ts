// Security: the DNI is never shown at the register (CLAUDE.md, "Reglas que no cambian"). Not in a search's
// results, not in the field after searching, not in the data the page carries for React, however the barista
// typed it: with dots, spaces, dashes or "DNI" in front.
import { expect, test } from "@playwright/test";
import { addStampNow, codesOf, customerPhone, post, staffPhone } from "../support/http";

/** 30123456 → 30.123.456, like core/document.ts (the e2e tests don't import the app). */
const formatDni = (dni: string) => dni.replace(/\B(?=(\d{3})+(?!\d))/g, ".");

/** Every way the number could show: as stored, with dots, with spaces and with dashes. */
const shapesOf = (dni: string) => [
  dni,
  formatDni(dni),
  formatDni(dni).replaceAll(".", " "),
  formatDni(dni).replaceAll(".", "-"),
];

function expectNoDocument(body: string, dni: string, where: string) {
  for (const shape of shapesOf(dni)) expect(body, `${where}: "${shape}"`).not.toContain(shape);
}

test("searching by DNI shows the customer, never the number", async () => {
  const marta = await customerPhone();
  const ana = await staffPhone();
  for (const typed of [marta.dni, formatDni(marta.dni)]) {
    const found = await post(ana, "/register?index", { code: typed });
    const body = await found.text();
    expect(body).toContain(marta.name);
    expectNoDocument(body, marta.dni, `search "${typed}"`);
  }
});

test("a DNI typed with spaces, dashes or DNI in front never comes back at the register", async () => {
  const marta = await customerPhone();
  const ana = await staffPhone();
  const [, , spaced, dashed] = shapesOf(marta.dni);
  for (const typed of [spaced, dashed, `DNI ${marta.dni}`, `dni: ${formatDni(marta.dni)}`]) {
    const answer = await post(ana, "/register?index", { code: typed });
    expectNoDocument(await answer.text(), marta.dni, `search "${typed}"`);
  }
});

test("a DNI nobody has never comes back at the register", async () => {
  const ana = await staffPhone();
  const nobody = "41234567";
  const answer = await post(ana, "/register?index", { code: nobody });
  expect(answer.status()).toBe(404);
  expectNoDocument(await answer.text(), nobody, "not found");
});

test("the card and its confirmation at the register never carry the DNI", async () => {
  const marta = await customerPhone();
  const { shortCode } = await codesOf(marta.phone, "take-away");
  const ana = await staffPhone();
  const entry = await addStampNow(ana, shortCode);
  for (const path of [`/register/card/${shortCode}`, `/register/done/${entry}`, "/register"]) {
    expectNoDocument(await (await ana.get(path)).text(), marta.dni, path);
  }
});

test("the customer's own screens don't carry the DNI either", async () => {
  // It's only needed to get in: once inside, nothing shows it (and a shoulder can't read it).
  const marta = await customerPhone();
  for (const path of ["/cards", "/cards/take-away", "/cards/take-away/history"]) {
    expectNoDocument(await (await marta.phone.get(path)).text(), marta.dni, path);
  }
});
