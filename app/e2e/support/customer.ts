// What a customer does on the screens, the way a person does it: by what they see (labels and buttons),
// never by CSS classes. Made-up data only (pruebas skill).
import { expect, type Page } from "@playwright/test";

/**
 * A made-up DNI, different for each test: they all share the same database, and the same document
 * would sign in instead of signing up.
 */
export function madeUpDni(): string {
  return String(10_000_000 + Math.floor(Math.random() * 89_999_999));
}

/**
 * Turnstile (with the test key, which always lets through) puts its token in the form when it's ready.
 * Sending before that would be "Algo no salió bien": like a person, the test waits for it.
 */
async function waitForTurnstile(page: Page) {
  await expect(page.locator('input[name="cf-turnstile-response"]')).not.toHaveValue("", {
    timeout: 15_000,
  });
}

/**
 * Each made-up customer signs up from their own made-up connection, like real customers do. The attempt
 * cap is 30 per minute per connection (SIGN_IN_LIMIT): with every test coming from this computer, a run of
 * the whole suite went over it. Locally the Workers runtime takes this header as it comes; in production
 * Cloudflare sets it to the real address, so nobody can make one up there. Only on requests to the app.
 */
export async function ownConnection(page: Page) {
  const part = () => Math.floor(Math.random() * 254) + 1;
  const connection = `10.${part()}.${part()}.${part()}`;
  // Only to the app: a header too many on Turnstile's own requests (another site) would block it.
  await page.context().route(
    (url) => url.hostname === "localhost",
    (route) =>
      route.continue({ headers: { ...route.request().headers(), "CF-Connecting-IP": connection } }),
  );
}

/** From the welcome screen to the confirmation sheet with the number. */
export async function typeDocument(page: Page, dni: string) {
  await ownConnection(page);
  await page.goto("/");
  await page.getByLabel("Tu número de documento").fill(dni);
  await waitForTurnstile(page);
  await page.getByRole("button", { name: "Seguir" }).click();
}

/** Signs up a new customer and leaves them on their cards. */
export async function signUp(page: Page, { dni = madeUpDni(), name = "Marta García" } = {}) {
  await typeDocument(page, dni);
  await page.getByRole("button", { name: "Sí, es correcto" }).click();
  await page.getByLabel("Tu nombre").fill(name);
  await page.getByLabel("Estoy de acuerdo").check();
  await waitForTurnstile(page);
  await page.getByRole("button", { name: "Anotarme" }).click();
  await expect(page).toHaveURL("/cards");
  return { dni, name };
}
