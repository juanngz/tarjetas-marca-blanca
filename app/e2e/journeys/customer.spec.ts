// Layer 3: the customer's journeys that can't fail (pruebas skill, journeys 1, 2 and 6).
// The register's (3 to 5) are in register.spec.ts.
import { expect, type Page, test } from "@playwright/test";
import { signUp, typeDocument } from "../support/customer";
import { addStamp, shortCodeOf, signInAtRegister } from "../support/register";

const CARDS = ["Café take-away", "Café en grano ¼ kg", "Café en grano ½ kg", "Café en grano 1 kg"];

test("sign up with the DNI and the name, and see the four cards", async ({ page }) => {
  await signUp(page, { name: "Marta García" });

  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/, Marta\.$/);
  for (const name of CARDS) await expect(page.getByText(name).first()).toBeVisible();
});

test("sign in again with the same DNI, on another phone", async ({ page, browser }) => {
  const { dni } = await signUp(page);

  const otherPhone = await browser.newPage();
  await typeDocument(otherPhone, dni);
  await expect(otherPhone).toHaveURL("/cards");
  await expect(otherPhone.getByRole("heading", { level: 1 })).toHaveText(/, Marta\.$/);
  await otherPhone.close();
});

/** The phone is ready to go without a connection: the service worker started and the wallet is kept. */
async function keptOnThePhone(page: Page) {
  await page.evaluate(() => navigator.serviceWorker.ready);
  await expect
    .poll(() => page.evaluate(async () => !!(await caches.match("/cards"))), { timeout: 15_000 })
    .toBe(true);
}

const codeOf = (page: Page, card: string) =>
  page.getByRole("img", { name: `Código QR de la tarjeta ${card}` });

// Journey 6 (Flujo 5, "Sin conexión"): in airplane mode, the code of each card still shows.
test("without a connection, each card's code still shows, also opening the app again", async ({
  page,
  context,
}) => {
  await signUp(page);
  await keptOnThePhone(page);
  await context.setOffline(true);

  // A card that was never opened.
  await page.getByRole("link", { name: "Ver mi código" }).click();
  await expect(page).toHaveURL("/cards/take-away");
  await expect(codeOf(page, "Café take-away")).toBeVisible();
  await expect(
    page.getByText("Sin conexión. Tus sellos se actualizan cuando vuelva."),
  ).toBeVisible();

  // Back to the cards, and another one.
  await page.getByRole("link", { name: "Volver a mis tarjetas" }).click();
  await page.getByRole("link", { name: /^Café en grano ½ kg: .* Pasarla adelante\.$/ }).click();
  await page
    .getByRole("region", { name: "Café en grano ½ kg" })
    .getByRole("link", { name: "Ver mi código" })
    .click();
  await expect(page).toHaveURL("/cards/beans-half");
  await expect(codeOf(page, "Café en grano ½ kg")).toBeVisible();

  // Opening the app from its icon, still without a connection.
  await page.goto("/cards");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/, Marta\.$/);
  await page.getByRole("link", { name: "Ver mi código" }).click();
  await expect(codeOf(page, "Café take-away")).toBeVisible();

  // When it's back, the card is asked again by itself.
  await context.setOffline(false);
  await expect(page.getByText("Sin conexión. Tus sellos se actualizan cuando vuelva.")).toHaveCount(
    0,
  );
  await expect(page.getByRole("link", { name: "Ver mis sellos y premios" })).toHaveCount(0);
});

// Publishing the reward's slot (18/10/2026): a phone keeps the copy the previous version made, without what
// the slot says (Gratis, 30%). Without a connection, the wallet and the code still show from it.
test("without a connection, a copy kept by the previous version still shows the code", async ({
  page,
  context,
}) => {
  await signUp(page);
  await keptOnThePhone(page);
  await page.evaluate(() => {
    const kept = JSON.parse(localStorage.getItem("club:wallet") ?? "{}");
    for (const card of kept.wallet.cards) delete card.slot;
    localStorage.setItem("club:wallet", JSON.stringify(kept));
  });
  await context.setOffline(true);

  await page.goto("/cards");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/, Marta\.$/);
  // The reward's slot is there, without its word until the copy is renewed.
  const card = page.getByRole("region", { name: "Café take-away" });
  await expect(card.locator(".stamp")).toHaveCount(8);
  await card.getByRole("link", { name: "Ver mi código" }).click();
  await expect(codeOf(page, "Café take-away")).toBeVisible();
});

// "Tus sellos se actualizan cuando vuelva": a stamp added while the phone had no connection shows by itself.
test("a stamp added while offline shows when the connection is back", async ({
  page,
  context,
  browser,
}) => {
  await signUp(page);
  await keptOnThePhone(page);
  await context.setOffline(true);
  await page.getByRole("link", { name: "Ver mi código" }).click();
  await expect(page.getByText("0 de 8 sellos")).toBeVisible();
  const code = (await page.getByText(/^[2-9A-Z]{6}$/).textContent()) ?? "";

  const register = await (await browser.newContext()).newPage();
  await signInAtRegister(register);
  await addStamp(register, code);

  await context.setOffline(false);
  await expect(page.getByText("1 de 8 sellos")).toBeVisible();
});

test("after Salir, nothing of the customer stays on the phone", async ({ page, context }) => {
  await signUp(page, { name: "Marta García" });
  await keptOnThePhone(page);

  await page.getByRole("banner").getByRole("link", { name: "Salir" }).click();
  await page
    .getByRole("dialog", { name: "¿Salir?" })
    .getByRole("button", { name: "Salir" })
    .click();
  await expect(page).toHaveURL("/");
  await expect.poll(() => page.evaluate(async () => !!(await caches.match("/cards")))).toBe(false);
  expect(await page.evaluate(() => Object.keys(localStorage))).not.toContain("club:wallet");

  // Opening the app without a connection: there's nothing of Marta to show.
  await context.setOffline(true);
  await page.goto("/cards").catch(() => {
    // With nothing kept, the phone can't open it: that's what's expected.
  });
  await expect(page.getByText("Marta")).toHaveCount(0);
});

// Changing screens without waiting for the server (10/10/2026, web/instant.ts): the database is in the EU. The
// server is held back here until the test lets it answer: the screen changes before that, with the phone's copy,
// and shows what the server says when it arrives.
test("opening a card and coming back don't wait for the server", async ({ page, browser }) => {
  await signUp(page);
  const code = await shortCodeOf(page, "take-away");
  await page.goto("/cards");
  // A stamp while the customer is on the wallet: the phone's copy still has 0.
  const register = await (await browser.newContext()).newPage();
  await signInAtRegister(register);
  await addStamp(register, code);

  let release = () => {};
  let held = Promise.resolve();
  const holdServer = () => {
    held = new Promise((resolve) => {
      release = resolve;
    });
  };
  await page.route(/\.data(\?|$)/, async (route) => {
    await held;
    await route.continue();
  });

  holdServer();
  await page.getByRole("link", { name: "Ver mi código" }).click();
  await expect(page).toHaveURL("/cards/take-away");
  await expect(page.getByText("Código", { exact: true })).toBeVisible();
  await expect(page.locator(".counter")).toHaveText("0 de 8 sellos");
  release();
  await expect(page.locator(".counter")).toHaveText("1 de 8 sellos");
  await expect(page.getByRole("link", { name: "Ver mis sellos y premios" })).toBeVisible();

  holdServer();
  await page.getByRole("link", { name: "Volver a mis tarjetas" }).click();
  await expect(page).toHaveURL("/cards?front=take-away");
  // The copy was brought up to date by the card's screen.
  await expect(page.getByRole("region", { name: "Café take-away" }).locator(".counter")).toHaveText(
    "1 de 8 sellos",
  );
  release();
});
