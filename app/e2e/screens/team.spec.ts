// Layer 4: Equipo, the manager's screens, with axe and the project's screen rules. Plus what can't fail:
// the barista the manager adds gets in with the PIN shown, and a barista never gets into Equipo.
import { type Browser, expect, type Page, test } from "@playwright/test";
import { signUp } from "../support/customer";
import {
  ANA,
  addStamp,
  BRUNO,
  madeUpName,
  openStaffMenu,
  shortCodeOf,
  signInAtRegister,
} from "../support/register";
import { expectScreenRules } from "../support/screenRules";

/** A made-up email, different for each test: they all share the same database. */
const madeUpEmail = () => `juan${Math.floor(Math.random() * 1e9)}@example.com`;

async function openTeam(page: Page) {
  await signInAtRegister(page, BRUNO);
  await openStaffMenu(page, "Bruno");
  await page.getByRole("link", { name: "Equipo" }).click();
  await expect(page.getByRole("heading", { name: "Equipo" })).toBeVisible();
}

/** Adds a barista and returns their email and the PIN shown. */
async function addBarista(page: Page, name = "Juan") {
  const email = madeUpEmail();
  await page.getByRole("link", { name: "Agregar barista" }).click();
  await page.getByLabel("Su email").fill(email);
  await page.getByLabel("Su nombre, como se va a ver en la caja").fill(name);
  await page.getByRole("button", { name: "Agregar barista" }).click();
  await expect(page.getByRole("heading", { name: `Listo: ${name} ya puede entrar` })).toBeVisible();
  const pin = (await page.getByText(/^\d{6}$/).textContent()) ?? "";
  return { email, pin };
}

async function onAnotherPhone(browser: Browser) {
  return (await browser.newContext()).newPage();
}

test("Equipo, the list", async ({ page }) => {
  await openTeam(page);
  await expect(page.getByText("Ana · barista")).toBeVisible();
  await expectScreenRules(page);

  // The logo goes back to the start of the register, from Equipo too.
  await page.getByRole("banner").getByRole("link", { name: "Ir al inicio" }).click();
  await expect(page).toHaveURL("/register");
});

test("the manager opens Equipo from the menu under their name, next to Salir", async ({ page }) => {
  await signInAtRegister(page, BRUNO);
  // Sumar sello is the whole screen: no tab bar under it.
  await expect(page.getByRole("navigation", { name: "Caja y equipo" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Equipo" })).toBeHidden();

  await openStaffMenu(page, "Bruno");
  await expectScreenRules(page);
  await page.getByRole("link", { name: "Equipo" }).click();
  await expect(page.getByRole("heading", { name: "Equipo" })).toBeVisible();
  await page.getByRole("link", { name: "Volver" }).click();
  await expect(page).toHaveURL("/register");
});

test("a barista's menu has Salir, but not Equipo", async ({ page }) => {
  await signInAtRegister(page, ANA);
  await openStaffMenu(page, "Ana");
  await expect(page.getByRole("link", { name: "Equipo" })).toHaveCount(0);
});

test("the menu closes tapping outside it", async ({ page }) => {
  await signInAtRegister(page, BRUNO);
  await openStaffMenu(page, "Bruno");
  await page.mouse.click(10, 400);
  await expect(page.getByRole("button", { name: "Salir" })).toBeHidden();
});

test("the manager's own page shows who they are, without a note about the developers", async ({
  page,
}) => {
  await openTeam(page);
  await page.getByRole("link", { name: /bruno@example\.com/ }).click();
  await expect(page.getByRole("heading", { name: "Bruno" })).toBeVisible();
  await expect(page.getByText(/desarrolladores/)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Generar PIN nuevo" })).toHaveCount(0);
});

test("add a barista: the PIN is shown once and they get in with it", async ({ page, browser }) => {
  await openTeam(page);
  await expect(page.getByText(/lo arma la app/)).toHaveCount(0);
  await page.getByRole("link", { name: "Agregar barista" }).click();
  await expect(page.getByText(/lo arma la app/)).toHaveCount(0);
  await expectScreenRules(page);
  await page.getByRole("link", { name: "Volver" }).click();
  const { email, pin } = await addBarista(page);
  await expectScreenRules(page);

  const theirPhone = await onAnotherPhone(browser);
  await signInAtRegister(theirPhone, { email, pin });
  await expect(theirPhone.getByRole("banner").getByText("Juan")).toBeVisible();
});

test("a barista's screen: a new PIN and deactivating, each confirmed first", async ({
  page,
  browser,
}) => {
  await openTeam(page);
  const { email } = await addBarista(page, "Lola");
  await page.getByRole("link", { name: "Listo" }).click();
  await page.getByRole("link", { name: new RegExp(email) }).click();
  await expect(page.getByRole("heading", { name: "Lola" })).toBeVisible();
  // Active is the usual: only De baja is said.
  await expect(page.getByText("Puede entrar")).toHaveCount(0);
  await expectScreenRules(page);

  await page.getByRole("button", { name: "Generar PIN nuevo" }).click();
  const sheet = page.getByRole("dialog", { name: "¿Generar un PIN nuevo para Lola?" });
  await expect(sheet).toBeVisible();
  await expectScreenRules(page);
  await sheet.getByRole("button", { name: "Generar PIN nuevo" }).click();
  await expect(page.getByRole("heading", { name: "PIN nuevo para Lola" })).toBeVisible();
  const pin = (await page.getByText(/^\d{6}$/).textContent()) ?? "";

  const herPhone = await onAnotherPhone(browser);
  await signInAtRegister(herPhone, { email, pin });

  await page.getByRole("link", { name: "Listo" }).click();
  await page.getByRole("link", { name: new RegExp(email) }).click();
  await page.getByRole("button", { name: "Dar de baja" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Dar de baja" }).click();
  await expect(page.getByText("Está de baja: no puede entrar a la caja.")).toBeVisible();
  await expectScreenRules(page);

  // Her open session ended.
  await herPhone.reload();
  await expect(herPhone).toHaveURL("/register/sign-in");

  // On Equipo, she's on the De baja tab, not with the active ones.
  await page.getByRole("link", { name: "Volver" }).click();
  await expect(page.getByRole("link", { name: new RegExp(email) })).toHaveCount(0);
  await page.getByRole("link", { name: /De baja/ }).click();
  await expect(page.getByRole("link", { name: new RegExp(email) })).toBeVisible();
  await expectScreenRules(page);
});

test("changing a barista's name is its own step, and back to her page once saved", async ({
  page,
}) => {
  await openTeam(page);
  const { email } = await addBarista(page, "Mora");
  await page.getByRole("link", { name: "Listo" }).click();
  await page.getByRole("link", { name: new RegExp(email) }).click();
  await page.getByRole("link", { name: "Cambiar nombre o email" }).click();
  await expect(page.getByRole("heading", { name: "Cambiar nombre o email" })).toBeVisible();
  await expectScreenRules(page);
  await page.getByLabel("Su nombre").fill("Mora Paz");
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByText("Cambios guardados.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Mora Paz" })).toBeVisible();
});

test("a barista doesn't see Equipo, and can't open it", async ({ page }) => {
  await signInAtRegister(page, ANA);
  await expect(page.getByRole("link", { name: "Equipo" })).toHaveCount(0);
  await page.goto("/register/team");
  await expect(page).toHaveURL("/register");
});

test("Movimientos: what everybody did at the register, from the manager's menu", async ({
  page,
  browser,
}) => {
  const phone = await onAnotherPhone(browser);
  const name = madeUpName("Marta");
  await signUp(phone, { name });
  const code = await shortCodeOf(phone, "take-away");
  await phone.close();
  // Ana adds a stamp; Bruno sees it.
  const ana = await onAnotherPhone(browser);
  await signInAtRegister(ana, ANA);
  await addStamp(ana, code);
  await ana.close();

  await signInAtRegister(page, BRUNO);
  await openStaffMenu(page, "Bruno");
  await page.getByRole("link", { name: "Movimientos" }).click();
  await expect(page.getByRole("heading", { name: "Movimientos" })).toBeVisible();
  await expect(page.getByText(`${name} · Café take-away`)).toBeVisible();
  await expectScreenRules(page);

  // Only Bruno's: not Ana's stamp.
  await page.getByRole("link", { name: "Bruno (vos)" }).click();
  await expect(page.getByText(`${name} · Café take-away`)).toHaveCount(0);
});

// Slow from Buenos Aires (11/10/2026): who's at the register doesn't change from one screen to another, so
// going back to Sumar sello doesn't wait for the server.
test("back to the register from Equipo, the screen shows without asking the server", async ({
  page,
}) => {
  await openTeam(page);
  const asked: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.endsWith(".data")) asked.push(request.url());
  });
  await page.getByRole("link", { name: "Volver" }).click();
  await expect(page).toHaveURL("/register");
  await expect(page.getByRole("banner").getByRole("button", { name: /Bruno/ })).toBeVisible();
  expect(asked).toEqual([]);
});

// "The bar arrives late" (11/10/2026): it slid in on every screen. It comes in once, when the register opens;
// changing screens, it's already there.
test("changing screens, the bar at the top is already there: it doesn't come in again", async ({
  page,
}) => {
  await openTeam(page);
  const bar = page.getByRole("banner");
  const moving = () => bar.evaluate((el) => el.getAnimations().length);
  expect(await moving()).toBe(0);
  await page.getByRole("link", { name: "Volver" }).click();
  await expect(page).toHaveURL("/register");
  expect(await moving()).toBe(0);
});

// Movimientos already has everybody's on screen: picking one person shows theirs right away, while the
// server brings the complete list.
test("Movimientos: picking a person shows theirs right away, without waiting for the server", async ({
  page,
  browser,
}) => {
  const phone = await onAnotherPhone(browser);
  const name = madeUpName("Marta");
  await signUp(phone, { name });
  const code = await shortCodeOf(phone, "take-away");
  await phone.close();
  const ana = await onAnotherPhone(browser);
  await signInAtRegister(ana, ANA);
  await addStamp(ana, code);
  await ana.close();

  await signInAtRegister(page, BRUNO);
  await openStaffMenu(page, "Bruno");
  await page.getByRole("link", { name: "Movimientos" }).click();
  await expect(page.getByText(`${name} · Café take-away`)).toBeVisible();

  let release = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(/\/register\/activity\.data/, async (route) => {
    await held;
    await route.continue();
  });

  await page.getByRole("link", { name: "Bruno (vos)" }).click();
  await expect(page.getByText("Lo que hizo Bruno en la caja.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Bruno (vos)" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(page.getByText(`${name} · Café take-away`)).toHaveCount(0);

  await page.getByRole("link", { name: "Ana" }).click();
  await expect(page.getByText("Lo que hizo Ana en la caja.")).toBeVisible();
  await expect(page.getByText(`${name} · Café take-away`)).toBeVisible();

  release();
  await expect(page).toHaveURL(/member=/);
  await expect(page.getByText(`${name} · Café take-away`)).toBeVisible();
});

test("a barista's menu doesn't have Movimientos, and its address goes back to the register", async ({
  page,
}) => {
  await signInAtRegister(page, ANA);
  await openStaffMenu(page, "Ana");
  await expect(page.getByRole("link", { name: "Movimientos" })).toHaveCount(0);
  await page.goto("/register/activity");
  await expect(page).toHaveURL("/register");
});

test("Resumen: the Club's numbers, from the manager's menu, between the dates they pick", async ({
  page,
  browser,
}) => {
  const phone = await onAnotherPhone(browser);
  await signUp(phone, { name: madeUpName("Marta") });
  const code = await shortCodeOf(phone, "take-away");
  await phone.close();
  const ana = await onAnotherPhone(browser);
  await signInAtRegister(ana, ANA);
  await addStamp(ana, code);
  await ana.close();

  await signInAtRegister(page, BRUNO);
  await openStaffMenu(page, "Bruno");
  await page.getByRole("link", { name: "Resumen" }).click();
  await expect(page.getByRole("heading", { name: "Resumen", level: 1 })).toBeVisible();
  for (const title of ["Día por día", "Cuántas veces vinieron", "Por tarjeta", "Días y horarios"]) {
    await expect(page.getByRole("heading", { name: title, level: 2 })).toBeVisible();
  }
  // The last 7 days at first; each table a screen reader reads, a column per card.
  await expect(page.getByRole("link", { name: "7 días" })).toHaveAttribute("aria-current", "true");
  await expect(
    page.getByRole("table", { name: "Los números de cada tarjeta" }).getByRole("columnheader"),
  ).toHaveCount(4);
  await expectScreenRules(page);

  // Today's stamp, seen; then 30 days with a tap; then days before it, where it isn't.
  // Other tests share the database: some card added stamps, whichever has the most.
  await expect(page.getByText(/^Café .+ sumó \d+ de los \d+ sellos\.$/)).toBeVisible();
  await page.getByRole("link", { name: "30 días" }).click();
  await expect(page.getByRole("heading", { name: "Semana por semana", level: 2 })).toBeVisible();
  await page.getByText("Otras").click();
  // The panel fades in: axe measures its contrast once it's there.
  await expect.poll(() => page.evaluate(() => document.getAnimations().length)).toBe(0);
  await expectScreenRules(page);
  await page.getByLabel("Desde").fill("2026-09-01");
  await page.getByLabel("Hasta").fill("2026-09-30");
  await page.getByRole("button", { name: "Ver esas fechas" }).click();
  await expect(page).toHaveURL(/from=2026-09-01&to=2026-09-30/);
  await expect(page.getByText("Del 1 al 30 de septiembre.")).toBeVisible();
  await expect(
    page.getByText("Todavía no vino nadie con su tarjeta en este período."),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Semana por semana", level: 2 })).toBeVisible();
  await expectScreenRules(page);
});

test("a barista's menu doesn't have Resumen, and its address goes back to the register", async ({
  page,
}) => {
  await signInAtRegister(page, ANA);
  await openStaffMenu(page, "Ana");
  await expect(page.getByRole("link", { name: "Resumen" })).toHaveCount(0);
  await page.goto("/register/summary");
  await expect(page).toHaveURL("/register");
});
