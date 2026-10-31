// Layer 4: one pass per customer screen, with axe and the project's screen rules.
import { expect, type Locator, test } from "@playwright/test";
import { activeCafe } from "../../src/cafes";
import { madeUpDni, ownConnection, signUp, typeDocument } from "../support/customer";
import { addStamp, findCard, shortCodeOf, signInAtRegister } from "../support/register";
import { expectScreenRules } from "../support/screenRules";

test("welcome", async ({ page }) => {
  await page.goto("/");
  await expectScreenRules(page);
});

test("welcome, with another document", async ({ page }) => {
  await page.goto("/?document=other");
  await expect(page.getByLabel("El número de tu documento o pasaporte")).toBeVisible();
  await expectScreenRules(page);
});

test("confirm the document", async ({ page }) => {
  await typeDocument(page, madeUpDni());
  await expect(page.getByRole("dialog")).toBeVisible();
  await expectScreenRules(page);
});

test("name and consent", async ({ page }) => {
  await typeDocument(page, madeUpDni());
  await page.getByRole("button", { name: "Sí, es correcto" }).click();
  await expect(page.getByRole("heading", { name: "¿Cómo te llamás?" })).toBeVisible();
  await expectScreenRules(page);
});

// Each sign-up counts against the document attempts per minute (wrangler.jsonc): what can be
// checked on the same screen goes in the same test.
test("the cards fit the screen, and the logo stays at the top while scrolling", async ({
  page,
}) => {
  // A long first name: the greeting takes two lines at any hour (14/10/2026: with the 1 kg card, the fourth,
  // "Buenas tardes, Marta." in two lines didn't fit, and the test only failed in the afternoon).
  await signUp(page, { name: "Maximiliana García" });
  await expect(page.getByRole("heading", { name: /Maximiliana\.$/ })).toBeVisible();
  await expectScreenRules(page);
  // The cards say how they work themselves: no list repeating it under the wallet.
  await expect(page.getByText("Cómo funciona")).toHaveCount(0);

  // Without scrolling (10/10/2026): on the smallest phone, the wallet tightens until it fits, whichever card
  // is in front. Ver mi código can be seen whole.
  for (const name of [
    "Café en grano 1 kg",
    "Café en grano ½ kg",
    "Café en grano ¼ kg",
    "Café take-away",
  ]) {
    const card = page.getByRole("region", { name });
    if (!(await card.isVisible())) {
      await page.getByRole("link", { name: new RegExp(`^${name}:`) }).click();
    }
    await expect(card).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight), {
        message: `${name} adelante, sobra alto`,
      })
      .toBeLessThanOrEqual(0);
    await expect(card.getByRole("link", { name: "Ver mi código" })).toBeInViewport({ ratio: 1 });
  }

  // Big enough to read the name at a glance (it used to be 32px).
  const logo = page.getByRole("img", { name: activeCafe.name });
  expect((await logo.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(48);

  // At 200% (the phone zooms the page: 180px wide) it doesn't fit: there the page scrolls.
  await page.setViewportSize({ width: 180, height: 370 });
  await page.mouse.wheel(0, 600);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  await expect(logo).toBeInViewport();
  // Nothing on the page covers it: what's under its center is the logo itself.
  const box = await logo.boundingBox();
  if (!box) throw new Error("El logo no tiene caja");
  const onTop = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.tagName, {
    x: box.x + box.width / 2,
    y: box.y + box.height / 2,
  });
  expect(onTop).toBe("IMG");

  // At 200%, each card behind still shows its whole name: the next card doesn't cover it, even when it takes
  // two or three lines.
  // The logo isn't crushed by Salir: it still reads.
  const narrowLogo = await logo.boundingBox();
  expect(narrowLogo?.width ?? 0).toBeGreaterThanOrEqual(140);
  // (The cards slide to their new place: it waits for them.)
  await page.evaluate(() => window.scrollTo(0, 0));
  for (const name of ["Café en grano 1 kg", "Café en grano ½ kg", "Café en grano ¼ kg"]) {
    const covered = () =>
      page
        .locator(".wallet")
        .getByText(name, { exact: true })
        .evaluate((el) => {
          el.scrollIntoView({ block: "center" });
          const box = el.getBoundingClientRect();
          const under = document.elementFromPoint(box.left + 4, box.bottom - 4);
          return under?.closest("section") !== el.closest("section");
        });
    await expect.poll(covered, { message: `${name}, covered at 200%` }).toBe(false);
  }
});

test("a card at the counter: one screen, from the button or from the card", async ({ page }) => {
  await signUp(page);
  await page.getByRole("link", { name: "Ver mi código" }).click();
  await expect(page).toHaveURL("/cards/take-away");
  await expect(page.getByRole("heading", { name: "Café take-away" })).toBeVisible();
  await expect(page.getByText("Código", { exact: true })).toBeVisible();
  await expect(page.getByText("Si no lo lee, subí el brillo o dictale el código.")).toBeVisible();
  // Only what the barista needs: the movements have their own screen, and a new card has none yet.
  await expect(page.getByRole("region", { name: "Tus sellos y premios" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Ver mis sellos y premios" })).toHaveCount(0);
  await expectScreenRules(page);

  // The QR, square and centered in its white box: what the register's camera reads best.
  const qr = await page
    .getByRole("img", { name: "Código QR de la tarjeta Café take-away" })
    .boundingBox();
  const box = await page.locator(".qr").boundingBox();
  if (!qr || !box) throw new Error("Falta el QR");
  expect(Math.abs(qr.width - qr.height)).toBeLessThan(1);
  expect(Math.abs(qr.x + qr.width / 2 - (box.x + box.width / 2))).toBeLessThan(1);

  // The café's banner stays, like in the wallet, at the top while scrolling; without Salir here.
  const banner = page.getByRole("banner");
  await page.mouse.wheel(0, 600);
  await expect(banner.getByRole("img", { name: activeCafe.name })).toBeInViewport();
  await expect(banner.getByRole("link", { name: "Salir" })).toHaveCount(0);
  // Volver, fixed at the bottom, within the thumb's reach: always in view, below everything else.
  const back = page.getByRole("link", { name: "Volver a mis tarjetas" });
  await expect(back).toBeInViewport();
  const backBox = await back.boundingBox();
  const viewport = page.viewportSize();
  if (!backBox || !viewport) throw new Error("Falta Volver");
  expect(viewport.height - (backBox.y + backBox.height)).toBeLessThan(48);
  await back.click();
  await expect(page).toHaveURL("/cards?front=take-away");

  // Tapping anywhere else on the card in front opens the same screen: there's only one to show.
  // (By touch: for the keyboard and the screen reader, Ver mi código already says it.)
  await page.getByRole("region", { name: "Café take-away" }).click({ position: { x: 40, y: 20 } });
  await expect(page).toHaveURL("/cards/take-away");

  // Tapping the logo goes back to the start: the wallet.
  await page.getByRole("banner").getByRole("link", { name: "Ir al inicio" }).click();
  await expect(page).toHaveURL("/cards");
});

test("without a connection: the notice, and the code still shows", async ({ page, context }) => {
  await signUp(page);
  await page.getByRole("link", { name: "Ver mi código" }).click();
  await expect(page).toHaveURL("/cards/take-away");

  await context.setOffline(true);
  const notice = page.getByText("Sin conexión. Tus sellos se actualizan cuando vuelva.");
  await expect(notice).toBeVisible();
  await expect(
    page.getByRole("img", { name: "Código QR de la tarjeta Café take-away" }),
  ).toBeVisible();
  await expectScreenRules(page);

  await context.setOffline(false);
  await expect(notice).toHaveCount(0);
});

test("sign out", async ({ page }) => {
  await signUp(page);
  // At the top, in the bar with the logo: it stays in view while scrolling.
  const signOut = page.getByRole("banner").getByRole("link", { name: "Salir" });
  await page.mouse.wheel(0, 600);
  await expect(signOut).toBeInViewport();
  // On the phone there's no hover color: it would stay stuck after tapping.
  const background = () => signOut.evaluate((el) => getComputedStyle(el).backgroundColor);
  const before = await background();
  await signOut.hover();
  expect(await background()).toBe(before);
  // A sheet over the wallet, not another screen: closing it leaves the cards as they were.
  await signOut.click();
  const sheet = page.getByRole("dialog", { name: "¿Salir?" });
  await expect(sheet).toBeVisible();
  await expect(page).toHaveURL("/cards");
  await expectScreenRules(page);
  await sheet.getByRole("button", { name: "Seguir en mis tarjetas" }).click();
  await expect(sheet).toBeHidden();

  // Salir, from the sheet: back to the start, without a session.
  await signOut.click();
  await sheet.getByRole("button", { name: "Salir" }).click();
  await expect(page).toHaveURL("/");
  await page.goto("/cards");
  await expect(page).not.toHaveURL("/cards");
});

// Signing in again right after Salir (dev, 11/10/2026): Seguir was tapped before Turnstile had its token,
// and the form went without it. Now it waits for the token and goes by itself.
test("Seguir before the invisible check is ready waits for it: not an error", async ({ page }) => {
  await ownConnection(page);
  // A slow Turnstile: its script arrives 3 seconds late. It's asked once the screen is running.
  let asked: () => void = () => {};
  const running = new Promise<void>((resolve) => {
    asked = resolve;
  });
  await page.route(/challenges\.cloudflare\.com\/turnstile\/v0\/api\.js/, async (route) => {
    asked();
    await new Promise((resolve) => setTimeout(resolve, 3_000));
    await route.continue();
  });
  await page.goto("/");
  await running;

  await page.getByLabel("Tu número de documento").fill(madeUpDni());
  await page.getByRole("button", { name: "Seguir" }).click();

  await expect(page.getByRole("dialog", { name: "¿Es correcto este número?" })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText("Algo no salió bien. Probá de nuevo.")).toHaveCount(0);
});

test("a card that doesn't exist says so: not a generic page", async ({ page }) => {
  await signUp(page);
  await page.goto("/cards/other");
  await expect(page.getByRole("heading", { name: "Esta tarjeta no existe." })).toBeVisible();
});

test("Salir's own screen, for a phone without JavaScript", async ({ page }) => {
  await signUp(page);
  await page.goto("/sign-out");
  await expect(page.getByRole("heading", { name: "¿Salir?", level: 1 })).toBeVisible();
  // Like every screen with a session: the café's banner on top.
  await expect(page.getByRole("banner").getByRole("img", { name: activeCafe.name })).toBeVisible();
  await expectScreenRules(page);
});

test("the festejo and the redeemed reward, live", async ({ page, browser }) => {
  await signUp(page);
  const code = await shortCodeOf(page, "beans-half");
  const register = await (await browser.newContext()).newPage();
  await signInAtRegister(register);
  for (let i = 0; i < 4; i++) await addStamp(register, code);
  // The 4th stamp lights the reward's slot, the 5th: no festejo until it's stamped (18/10/2026).
  await expect(page.getByText("4 de 5 sellos", { exact: true })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // In the wallet: 4 de 5, and the reward under the stamps, lit with its aura: there's one to redeem.
  await page.goto("/cards?front=beans-half");
  const card = page.getByRole("region", { name: "Café en grano ½ kg" });
  await expect(card.locator(".counter")).toHaveText("4 de 5 sellos");
  // The card's rule, short (19/10/2026), in one piece with the reward's drawing.
  const reward = card.locator(".reward-tile");
  await expect(reward).toContainText("En la 5ª compra, 30% OFF");
  const rewardStyle = () =>
    reward.evaluate((el) => {
      const style = getComputedStyle(el);
      return { border: style.borderStyle, halo: style.boxShadow !== "none" };
    });
  await expect.poll(rewardStyle).toEqual({ border: "solid", halo: true });
  await expect(reward.locator("img")).toHaveAttribute("src", "/stamps/seal-ready.svg");
  // 5 slots, like the paper card: 4 stamps and the reward's, last, lit (it's the next purchase), with what it
  // gives under it.
  await expect(card.locator(".stamp")).toHaveCount(5);
  const rewardSlot = card.locator(".stamp").last();
  await expect(rewardSlot).toHaveClass(/stamp--ready/);
  await expect(rewardSlot.locator("img")).toHaveAttribute("src", "/stamps/seal-ready.svg");
  await expect(rewardSlot).toHaveText("30%");
  // In the corner, how many rewards it has; the cards with none don't say anything.
  await expect(card.getByText("1 premio", { exact: true })).toBeVisible();
  await expect(page.getByText(/^\d+ premios?$/)).toHaveCount(1);
  await expectScreenRules(page);
  // Behind, it still says it: on the tab, for the eye and for the screen reader.
  await page.goto("/cards?front=take-away");
  await expect(page.getByText("1 premio", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("link", { name: /^Café en grano ½ kg: 4 de 5 sellos, 1 premio para canjear\./ }),
  ).toBeVisible();
  // At the counter, neither: on the card, nothing says "premio" (the link to its movements isn't the card).
  await page.goto("/cards/beans-half");
  await expect(page.getByText("4 de 5 sellos", { exact: true })).toBeVisible();
  await expect(page.locator(".code-card").getByText(/premio/)).toHaveCount(0);

  await findCard(register, code);
  await register.getByRole("dialog").getByRole("button", { name: "Canjear premio" }).click();
  // Stamping the reward's slot completes the card: the festejo, by itself.
  const celebration = page.getByRole("dialog", { name: "¡Completaste la tarjeta!" });
  await expect(celebration).toBeVisible();
  await expect(celebration).toContainText("30% OFF en tu bolsa de ½ kg.");
  // It opened by itself: the focus goes to the sheet, not to Seguir with its keyboard ring.
  await expect(celebration).toBeFocused();
  await expectScreenRules(page);
  // Once redeemed, the new round starts empty.
  await expect(page.getByText("0 de 5 sellos", { exact: true })).toBeVisible();

  // The card's movements, on their own screen: the newest first, all of them (up to 20).
  await page.getByRole("dialog").getByRole("button", { name: "Seguir" }).click();
  await page.getByRole("link", { name: "Ver mis sellos y premios" }).click();
  await expect(page).toHaveURL("/cards/beans-half/history");
  const movements = page
    .getByRole("region", { name: "Tus sellos y premios" })
    .getByRole("listitem");
  // 4 stamps and the reward redeemed.
  await expect(movements).toHaveCount(5);
  await expect(movements.first()).toContainText("Canjeaste un premio");
  await expect(movements.first()).toContainText("Hoy");
  await expect(movements.nth(1)).toContainText("Sumaste un sello");
  await expectScreenRules(page);
  // Back to the card, at the bottom like on every screen with a card.
  await page.getByRole("link", { name: "Volver a la tarjeta" }).click();
  await expect(page).toHaveURL("/cards/beans-half");
});

test.describe("with a mouse", () => {
  test.use({ hasTouch: false, isMobile: false });

  /** Passing over it changes its background and its border: it shows it's a button. */
  async function expectHoverColor(button: Locator) {
    const colors = () =>
      button.evaluate((el) => {
        const style = getComputedStyle(el);
        return [style.backgroundColor, style.borderColor];
      });
    const before = await colors();
    await button.hover();
    await expect.poll(colors).not.toEqual(before);
  }

  test("Salir and Volver change color when passing over them", async ({ page }) => {
    await signUp(page);
    await expectHoverColor(page.getByRole("banner").getByRole("link", { name: "Salir" }));
    await page.goto("/cards/take-away");
    await expectHoverColor(page.getByRole("link", { name: "Volver a mis tarjetas" }));
  });
});

test("5 taps on the logo open the register, which asks to sign in", async ({ page }) => {
  await page.goto("/");
  const logo = page.getByAltText(activeCafe.name);
  for (let i = 0; i < 4; i++) await logo.click();
  await expect(page).toHaveURL("/");
  await logo.click();
  await expect(page).toHaveURL("/register/sign-in");
});

test("a customer's cards have no door to the register: a customer isn't a barista", async ({
  page,
}) => {
  await signUp(page);
  const logo = page.getByAltText(activeCafe.name);
  for (let i = 0; i < 5; i++) await logo.click();
  await expect(page).toHaveURL("/cards");
});
