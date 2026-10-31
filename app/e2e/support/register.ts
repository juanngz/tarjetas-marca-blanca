// What the team does at the register, the way a person does it: by what they see.
// Ana is the made-up barista that scripts/seed.mjs leaves in the end-to-end tests' database.
import { expect, type Page } from "@playwright/test";

export const ANA = { email: "ana@example.com", pin: "428613" };
/** The made-up manager, also from scripts/seed.mjs. */
export const BRUNO = { email: "bruno@example.com", pin: "517284" };

/** Signs in at the register and leaves them on Sumar sello. */
export async function signInAtRegister(page: Page, { email, pin } = ANA) {
  await page.goto("/register/sign-in");
  await page.getByLabel("Tu email").fill(email);
  await page.getByLabel("Tu PIN").fill(pin);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL("/register");
}

/** Opens the menu under the name of who's at the register: Equipo (only the manager) and Salir. */
export async function openStaffMenu(page: Page, name: string) {
  await page.getByRole("banner").getByRole("button", { name }).click();
  await expect(page.getByRole("button", { name: "Salir" })).toBeVisible();
}

/** The code the customer reads out, from her card's screen: "K7M2QX". */
export async function shortCodeOf(customer: Page, type: string) {
  await customer.goto(`/cards/${type}`);
  return (await customer.getByText(/^[2-9A-Z]{6}$/).textContent()) ?? "";
}

/** Sumar sello, with Buscar tarjeta always under the camera. */
export async function openManual(page: Page) {
  await page.goto("/register");
  await expect(page.getByLabel("O buscá por nombre, DNI o código")).toBeVisible();
}

/** The barista types the code the customer reads out and sees her card. */
export async function findCard(page: Page, code: string) {
  await openManual(page);
  await page.getByLabel("O buscá por nombre, DNI o código").fill(code);
  await page.getByRole("button", { name: "Buscar tarjeta" }).click();
  await expect(page).toHaveURL(/\/register\/card\//);
}

/** Finds the card and taps Sumar sello: its confirmation, in a sheet over the card (11/10/2026). */
export async function addStamp(page: Page, code: string) {
  await findCard(page, code);
  await page.getByRole("button", { name: "Sumar sello" }).click();
  await expect(
    page.getByRole("dialog", { name: /^(Sello sumado|Tarjeta completa)$/ }),
  ).toBeVisible();
}

/** A made-up name nobody else has in the shared database: "Rosa Quiroga Bvtk". */
export function madeUpName(first = "Rosa"): string {
  const letters = Array.from(
    { length: 4 },
    () => "bcdfghjkmnpqrstvwxz"[Math.floor(Math.random() * 19)],
  );
  return `${first} Quiroga ${letters.join("").replace(/^./, (c) => c.toUpperCase())}`;
}

/** The barista types a document or a name and sees who it is, with their cards. */
export async function search(page: Page, text: string) {
  await openManual(page);
  await page.getByLabel("O buscá por nombre, DNI o código").fill(text);
  await page.getByRole("button", { name: "Buscar tarjeta" }).click();
}
