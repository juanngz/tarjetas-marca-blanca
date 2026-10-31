// Layer 4: one pass per register screen, with axe and the project's screen rules.
import { type Browser, expect, type Page, test } from "@playwright/test";
import {
  camerasOn,
  denyCamera,
  phoneCutsCamera,
  pointCameraAt,
  qrSvg,
  startCamera,
  timesCameraAsked,
} from "../support/camera";
import { signUp } from "../support/customer";
import {
  addStamp,
  findCard,
  madeUpName,
  openManual,
  openStaffMenu,
  search,
  shortCodeOf,
  signInAtRegister,
} from "../support/register";
import { expectScreenRules } from "../support/screenRules";

test("sign in at the register", async ({ page }) => {
  await page.goto("/register/sign-in");
  await expectScreenRules(page);
});

test("the eye shows the PIN typed, and hides it again", async ({ page }) => {
  await page.goto("/register/sign-in");
  const pin = page.getByLabel("Tu PIN");
  await pin.fill("428613");
  const hidden = () =>
    pin.evaluate((el) => getComputedStyle(el).getPropertyValue("-webkit-text-security"));
  expect(await hidden()).toBe("disc");
  await page.getByRole("button", { name: "Ver PIN" }).click();
  expect(await hidden()).toBe("none");
  await expectScreenRules(page);
  await page.getByRole("button", { name: "Ocultar PIN" }).click();
  expect(await hidden()).toBe("disc");
});

test("sign in at the register, with a mistake", async ({ page }) => {
  // An email nobody has: it doesn't lock Ana out for the other tests.
  await page.goto("/register/sign-in");
  await page.getByLabel("Tu email").fill("nadie@example.com");
  await page.getByLabel("Tu PIN").fill("428613");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("alert")).toHaveText(
    "Revisá tu email y tu PIN. Si ya probaste varias veces, esperá 15 minutos.",
  );
  await expectScreenRules(page);
});

test("the register, with who's signed in", async ({ page }) => {
  await signInAtRegister(page);
  await expect(page.getByRole("banner").getByText("Ana")).toBeVisible();
  await expectScreenRules(page);
});

test("the camera stays off until the barista taps it", async ({ page }) => {
  await pointCameraAt(page, qrSvg("nada"));
  await signInAtRegister(page);
  // Only what to do: nothing under it.
  await expect(page.getByRole("button", { name: "Tocá para escanear", exact: true })).toBeVisible();
  expect(await timesCameraAsked(page)).toBe(0);
  await expectScreenRules(page);
});

test("the register with its camera on", async ({ page }) => {
  await pointCameraAt(page, qrSvg("nada"));
  await signInAtRegister(page);
  await startCamera(page);
  expect(await timesCameraAsked(page)).toBe(1);
  await expect(page.getByText("Apuntá al código de la tarjeta")).toBeVisible();
  await expect(page.getByLabel("O buscá por nombre, DNI o código")).toBeVisible();
  await expectScreenRules(page);
});

test("a QR that isn't a Club card says so, and the camera keeps reading", async ({ page }) => {
  await pointCameraAt(page, qrSvg("https://example.com"));
  await signInAtRegister(page);
  await startCamera(page);
  await expect(page.getByRole("alert")).toHaveText(
    "Este código no es una tarjeta del Club. Apuntá al código de su tarjeta.",
  );
  await expect(page).toHaveURL("/register");
  await expectScreenRules(page);
});

test("if the phone cuts the camera, the box comes back, and tapping it opens it again", async ({
  page,
}) => {
  await pointCameraAt(page, qrSvg("nada"));
  await signInAtRegister(page);
  await startCamera(page);
  await expect(page.getByText("Apuntá al código de la tarjeta")).toBeVisible();
  await phoneCutsCamera(page);
  // Not a gray image: the box again, with what happened.
  await expect(page.getByRole("alert")).toHaveText(
    "Se cortó la cámara. Tocá para escanear de nuevo.",
  );
  await expectScreenRules(page);
  await startCamera(page);
  await expect(page.getByText("Apuntá al código de la tarjeta")).toBeVisible();
  await expect.poll(() => timesCameraAsked(page)).toBe(2);
});

test("opening the camera again and again leaves one on: the iPhone has only one", async ({
  page,
}) => {
  await pointCameraAt(page, qrSvg("nada"));
  await signInAtRegister(page);
  for (let i = 0; i < 3; i++) {
    await startCamera(page);
    await expect(page.getByText("Apuntá al código de la tarjeta")).toBeVisible();
    await phoneCutsCamera(page);
  }
  await startCamera(page);
  await expect.poll(() => timesCameraAsked(page)).toBe(4);
  await expect.poll(() => camerasOn(page)).toBe(1);
});

test("without permission for the camera, it says how to allow it, and the code can be typed", async ({
  page,
}) => {
  await denyCamera(page);
  await signInAtRegister(page);
  await startCamera(page);
  await expect(page.getByRole("alert")).toContainText("Para escanear, permití usar la cámara.");
  await expect(page.getByRole("button", { name: "Tocá para escanear" })).toBeVisible();
  await expect(page.getByLabel("O buscá por nombre, DNI o código")).toBeVisible();
  await expectScreenRules(page);
});

test("without permission, tapping again asks for the camera again", async ({ page }) => {
  await denyCamera(page);
  await signInAtRegister(page);
  await startCamera(page);
  await expect(page.getByRole("alert")).toBeVisible();
  await startCamera(page);
  await expect.poll(() => timesCameraAsked(page)).toBe(2);
});

test("Salir, in the menu under their name, goes back to sign in, for the next person", async ({
  page,
}) => {
  await signInAtRegister(page);
  await openStaffMenu(page, "Ana");
  await expectScreenRules(page);
  await page.getByRole("button", { name: "Salir" }).click();
  await expect(page).toHaveURL("/register/sign-in");
  await page.goto("/register");
  await expect(page).toHaveURL("/register/sign-in");
});

/**
 * A browser from before menus that open by themselves (popover, Chrome 114, 2023), like a TCL phone the
 * manager uses: it doesn't know the attribute, so it ignores it.
 */
async function withoutPopover(page: Page) {
  await page.addInitScript(() => {
    for (const name of ["popover", "showPopover", "hidePopover", "togglePopover"]) {
      delete (HTMLElement.prototype as unknown as Record<string, unknown>)[name];
    }
    const strip = (node: Node) => {
      if (!(node instanceof Element)) return;
      for (const el of [node, ...node.querySelectorAll("[popover], [popovertarget]")]) {
        el.removeAttribute("popover");
        el.removeAttribute("popovertarget");
      }
    };
    new MutationObserver((records) => {
      for (const record of records) {
        strip(record.target);
        for (const node of record.addedNodes) strip(node);
      }
    }).observe(document, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["popover", "popovertarget"],
    });
  });
}

test("on an older phone, the menu under their name starts closed, and opens and closes", async ({
  page,
}) => {
  await withoutPopover(page);
  await signInAtRegister(page);
  const name = page.getByRole("banner").getByRole("button", { name: "Ana" });
  const salir = page.getByRole("button", { name: "Salir" });
  await expect(salir).toBeHidden();

  await name.click();
  await expect(salir).toBeVisible();
  await name.click();
  await expect(salir).toBeHidden();

  // Tapping outside closes it, like on a newer phone.
  await name.click();
  await page.getByText(/^O buscá por nombre/).click();
  await expect(salir).toBeHidden();

  // And Salir, from it, still works.
  await name.click();
  await salir.click();
  await expect(page).toHaveURL("/register/sign-in");
});

/** A new customer's card code, signed up on another phone. */
async function customersCode(browser: Browser, type = "take-away") {
  const phone = await (await browser.newContext()).newPage();
  await signUp(phone, { name: "Marta García" });
  const code = await shortCodeOf(phone, type);
  await phone.close();
  return code;
}

test("Buscar tarjeta is on screen, under the camera, with no sheet to open", async ({ page }) => {
  await signInAtRegister(page);
  await openManual(page);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  // Empty, with no example name in it: the label above already says what goes there.
  await expect(page.getByLabel("O buscá por nombre, DNI o código")).not.toHaveAttribute(
    "placeholder",
  );
  await expectScreenRules(page);
});

test("Buscar tarjeta, with nothing found", async ({ page }) => {
  await signInAtRegister(page);
  await openManual(page);
  await page.getByLabel("O buscá por nombre, DNI o código").fill("Zoe Nadie Xqz");
  await page.getByRole("button", { name: "Buscar tarjeta" }).click();
  await expect(page.getByRole("alert")).toHaveText(
    "No encontramos nada con eso. Probá con otro dato.",
  );
  await expectScreenRules(page);
});

// The database is in the EU: an answer can take a moment. The register says at once that it's on its way, so
// the barista doesn't tap again or think it didn't work.
test("while the server answers, the tapped button says so, and a bar at the top shows it's on its way", async ({
  page,
  browser,
}) => {
  const name = madeUpName();
  const phone = await (await browser.newContext()).newPage();
  await signUp(phone, { name });
  await phone.close();
  await signInAtRegister(page);
  await search(page, name);
  const card = page.getByRole("article", { name: "Café en grano ¼ kg" });
  await expect(card.getByRole("button", { name: "Sumar sello" })).toBeVisible();

  let release = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(/\/register(\.data)?(\?|$)/, async (route) => {
    if (route.request().method() === "POST") await held;
    await route.continue();
  });

  await card.getByRole("button", { name: "Sumar sello" }).click();
  await expect(card.getByRole("button", { name: "Sumando…" })).toBeVisible();
  await expect(page.getByRole("progressbar", { name: "Cargando" })).toBeVisible();
  release();
  await expect(page.getByRole("dialog", { name: "Sello sumado" })).toBeVisible();
  await expect(page.getByRole("progressbar", { name: "Cargando" })).toHaveCount(0);
});

test("Buscar tarjeta by name: the customer with her 4 cards, and Sumar sello on one", async ({
  page,
  browser,
}) => {
  const name = madeUpName();
  const phone = await (await browser.newContext()).newPage();
  await signUp(phone, { name });
  await phone.close();

  await signInAtRegister(page);
  await search(page, name.toLowerCase().normalize("NFD").replace(/\p{M}/gu, ""));
  const customer = page.getByRole("article", { name });
  await expect(customer.getByRole("heading", { name, level: 2 })).toBeVisible();
  await expect(customer.getByText(/^Se anotó el /)).toBeVisible();
  await expect(customer.getByRole("button", { name: "Sumar sello" })).toHaveCount(4);
  await expectScreenRules(page);

  await customer
    .getByRole("article", { name: "Café en grano ¼ kg" })
    .getByRole("button", { name: "Sumar sello" })
    .click();
  // Its confirmation, in a sheet over the register: the screen doesn't change.
  const sheet = page.getByRole("dialog", { name: "Sello sumado" });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByText("1 de 5")).toBeVisible();
  // The same screen (React Router marks a form sent to the main screen with ?index).
  await expect(page).toHaveURL(/\/register(\?index)?$/);
  await expectScreenRules(page);

  // Deshacer, in the same sheet.
  await sheet.getByRole("button", { name: "Deshacer" }).click();
  await expect(page.getByRole("dialog", { name: "Sello deshecho" })).toBeVisible();
  await page.getByRole("link", { name: "Cerrar" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page).toHaveURL(/\/register(\?index)?$/);
});

test("Buscar tarjeta by a name two customers share: tap the one it is, and only her cards open", async ({
  page,
  browser,
}) => {
  const name = madeUpName();
  for (const _ of [1, 2]) {
    const phone = await (await browser.newContext()).newPage();
    await signUp(phone, { name });
    await phone.close();
  }

  await signInAtRegister(page);
  await search(page, name);
  await expect(page.getByText("Encontramos 2 clientes. Tocá el que es.")).toBeVisible();
  // Closed, so 6 cards don't fill the screen.
  await expect(page.getByRole("button", { name: "Sumar sello" })).toHaveCount(0);
  await expectScreenRules(page);

  const first = page.getByRole("article", { name }).first();
  await first.getByRole("button", { name: new RegExp(name) }).click();
  await expect(first.getByRole("button", { name: "Sumar sello" })).toHaveCount(4);
  await expect(page.getByRole("button", { name: "Sumar sello" })).toHaveCount(4);
  await expectScreenRules(page);
});

test("Buscar tarjeta by DNI: the customer, and the number nowhere on screen", async ({
  page,
  browser,
}) => {
  const name = madeUpName("Lucía");
  const phone = await (await browser.newContext()).newPage();
  const { dni } = await signUp(phone, { name });
  await phone.close();

  await signInAtRegister(page);
  await search(page, dni);
  await expect(page.getByRole("heading", { name, level: 2 })).toBeVisible();
  for (const shown of [dni, dni.replace(/\B(?=(\d{3})+$)/g, ".")]) {
    await expect(page.locator("body")).not.toContainText(shown);
  }
  await expectScreenRules(page);
  // The field stays above the results, without the number in it.
  await expect(page.getByLabel("O buscá por nombre, DNI o código")).toHaveValue("");
});

test("the card at the register, without rewards", async ({ page, browser }) => {
  const code = await customersCode(browser);
  await signInAtRegister(page);
  await findCard(page, code);
  await expect(page.getByText("Le faltan 7 para el café gratis.")).toBeVisible();
  await expectScreenRules(page);

  // Tapping the logo goes back to the start of the register: Sumar sello, to scan.
  await page.getByRole("banner").getByRole("link", { name: "Ir al inicio" }).click();
  await expect(page).toHaveURL("/register");
});

test("the card at the register, with a reward: the notice pops up by itself", async ({
  page,
  browser,
}) => {
  const code = await customersCode(browser, "beans-half");
  await signInAtRegister(page);
  for (let i = 0; i < 4; i++) await addStamp(page, code);
  await findCard(page, code);
  const notice = page.getByRole("dialog", { name: "Marta tiene un premio" });
  await expect(notice).toBeVisible();
  await expectScreenRules(page);

  // Closed: at 4 de 5 the card's main button is Canjear premio, the reward's slot (18/10/2026), and Sumar sello
  // y guardarlo keeps it for later.
  await page.keyboard.press("Escape");
  await expect(notice).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Canjear premio" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sumar sello y guardarlo" })).toBeVisible();
  await expectScreenRules(page);

  // If she doesn't use it now, Sumar sello y guardarlo from the notice: the reward stays for later.
  await findCard(page, code);
  await notice.getByRole("button", { name: "Sumar sello y guardarlo" }).click();
  await expect(page.getByRole("heading", { name: "Sello sumado" })).toBeVisible();
  await expect(page.getByText("1 de 5")).toBeVisible();
});

test("Sumar sello on the card: its confirmation over the card, and closing it shows the card up to date", async ({
  page,
  browser,
}) => {
  const code = await customersCode(browser, "beans-quarter");
  await signInAtRegister(page);
  await addStamp(page, code);
  // The same screen: no trip to another one to read it again.
  await expect(page).toHaveURL(/\/register\/card\//);
  await expect(
    page.getByRole("dialog", { name: "Sello sumado" }).getByText("1 de 5"),
  ).toBeVisible();
  await page.getByRole("link", { name: "Cerrar" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator("main").getByText("1 de 5")).toBeVisible();
});

test("the confirmations: sumado, completa, canjeado and deshecho", async ({ page, browser }) => {
  const code = await customersCode(browser, "beans-quarter");
  await signInAtRegister(page);
  await addStamp(page, code);
  await expect(page.getByRole("heading", { name: "Sello sumado" })).toBeVisible();
  await expectScreenRules(page);

  for (let i = 0; i < 3; i++) await addStamp(page, code);
  // The 4th: a stamp, and the news that the next purchase is the reward's slot (18/10/2026).
  await expect(page.getByRole("heading", { name: "Sello sumado" })).toBeVisible();
  await expect(
    page.getByText("Marta ganó 30% OFF en su próxima bolsa de ¼ kg. Decíselo."),
  ).toBeVisible();
  await expect(page.getByText("La próxima compra es la del premio.")).toBeVisible();
  await expectScreenRules(page);

  await findCard(page, code);
  await page.getByRole("dialog").getByRole("button", { name: "Canjear premio" }).click();
  await expect(page.getByRole("heading", { name: "Premio canjeado" })).toBeVisible();
  // The reward's slot was the last one: the card is complete, and starts again.
  await expect(page.getByText("La tarjeta vuelve a empezar.")).toBeVisible();
  await expectScreenRules(page);

  await page.getByRole("button", { name: "Deshacer" }).click();
  await expect(page.getByRole("heading", { name: "Canje deshecho" })).toBeVisible();
  await expectScreenRules(page);
});

// Like the paper card (18/10/2026): at 4 de 5 the next purchase is the reward's slot. On the card, Canjear premio
// is the main button; Sumar sello y guardarlo keeps it for later, and the new round starts.
test("4 de 5: Canjear premio on the card, and Sumar sello y guardarlo keeps the reward", async ({
  page,
  browser,
}) => {
  const code = await customersCode(browser, "beans-quarter");
  await signInAtRegister(page);
  for (let i = 0; i < 4; i++) await addStamp(page, code);

  await findCard(page, code);
  const notice = page.getByRole("dialog", { name: /tiene un premio$/ });
  await expect(notice.getByRole("button", { name: "Sumar sello y guardarlo" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(notice).toHaveCount(0);
  const card = page.getByRole("region", { name: "Café en grano ¼ kg" });
  await expect(card.getByText("4 de 5")).toBeVisible();
  await expect(card.getByRole("button", { name: "Canjear premio" })).toBeVisible();
  await expectScreenRules(page);

  await card.getByRole("button", { name: "Sumar sello y guardarlo" }).click();
  await expect(page.getByRole("dialog", { name: "Sello sumado" })).toBeVisible();
  await page.getByRole("link", { name: "Cerrar" }).click();
  // A new round, with the reward kept: the card says it has one, and it can still be redeemed in any purchase.
  await expect(card.getByText("1 de 5")).toBeVisible();
  await expect(card.getByText("1 premio para canjear")).toBeVisible();
  await expect(card.getByRole("button", { name: "Sumar sello", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Canjear premio" })).toBeVisible();
});

test("without a connection, nothing is added; tapping again with it adds a single stamp", async ({
  page,
  context,
  browser,
}) => {
  const code = await customersCode(browser);
  await signInAtRegister(page);
  await findCard(page, code);

  await context.setOffline(true);
  await page.getByRole("button", { name: "Sumar sello" }).click();
  await expect(
    page.getByText("Sin conexión. No se puede sumar ni canjear hasta que vuelva.").first(),
  ).toBeVisible();
  await expectScreenRules(page);

  await context.setOffline(false);
  await page.getByRole("button", { name: "Sumar sello" }).click();
  await expect(page.getByRole("heading", { name: "Sello sumado" })).toBeVisible();
  await expect(page.getByText("1 de 8")).toBeVisible();
});
