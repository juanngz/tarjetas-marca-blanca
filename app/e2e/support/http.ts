// The security tests (e2e/security) talk to the app the way a phone's browser does, but by HTTP: plain
// form posts, cookies and headers, without a page. That way they can send what the screens never would
// (a changed hidden field, ten taps at once, a made-up cookie) and check what the server does with it.
// Made-up data only (pruebas skill). Only ever against the local test server.
import { type APIRequestContext, type APIResponse, expect, request, test } from "@playwright/test";
import { madeUpDni } from "./customer";
import { ANA, BRUNO } from "./register";

/** Turnstile's dummy token: the test secret key in .dev.vars always lets it through. */
export const TURNSTILE_TOKEN = "XXXX.DUMMY.TOKEN.XXXX";

/** The app's address, from playwright.config.ts. */
export function appUrl(): string {
  const url = test.info().project.use.baseURL;
  if (!url) throw new Error("Sin baseURL en playwright.config.ts");
  return url;
}

/** A made-up connection, like the one Cloudflare puts in CF-Connecting-IP. */
export function madeUpConnection(): string {
  const part = () => Math.floor(Math.random() * 254) + 1;
  return `10.${part()}.${part()}.${part()}`;
}

/** A phone of its own: its own cookies and its own connection. Redirects aren't followed. */
export function newPhone(connection = madeUpConnection()): Promise<APIRequestContext> {
  return request.newContext({
    baseURL: appUrl(),
    extraHTTPHeaders: { "CF-Connecting-IP": connection },
    maxRedirects: 0,
  });
}

/** Sends a form like a browser without JavaScript does. */
export function post(phone: APIRequestContext, path: string, form: Record<string, string>) {
  return phone.post(path, { form, maxRedirects: 0 });
}

/** Where a redirect goes, or null if it isn't one. */
export function redirectedTo(response: APIResponse): string | null {
  const status = response.status();
  return status >= 300 && status < 400 ? (response.headers().location ?? null) : null;
}

/** The value of one of this phone's cookies, or null. */
export async function cookieOf(phone: APIRequestContext, name: string): Promise<string | null> {
  const { cookies } = await phone.storageState();
  return cookies.find((c) => c.name === name)?.value ?? null;
}

/** A phone with only this cookie (a copied one, or a made-up one). */
export function phoneWithCookie(name: string, value: string): Promise<APIRequestContext> {
  return request.newContext({
    baseURL: appUrl(),
    extraHTTPHeaders: { "CF-Connecting-IP": madeUpConnection(), cookie: `${name}=${value}` },
    maxRedirects: 0,
  });
}

/** A new customer, signed up from their own phone. */
export async function customerPhone(name = "Marta García") {
  const phone = await newPhone();
  const dni = madeUpDni();
  const response = await post(phone, "/sign-up", {
    step: "sign-up",
    type: "dni",
    number: dni,
    name,
    consent: "yes",
    "cf-turnstile-response": TURNSTILE_TOKEN,
  });
  expect(redirectedTo(response), "the sign-up goes to the cards").toBe("/cards");
  return { phone, dni, name };
}

/** A card's two codes, from the customer's own code screen. */
export async function codesOf(customer: APIRequestContext, type: string) {
  const html = await (await customer.get(`/cards/${type}`)).text();
  const shortCode = /<[^>]+>([2-9A-HJ-NP-Z]{6})<\//.exec(html)?.[1];
  const qrCode = /[2-9A-HJ-NP-Z]{24}/.exec(html)?.[0];
  if (!shortCode || !qrCode) throw new Error(`Sin códigos en /cards/${type}`);
  return { shortCode, qrCode };
}

/** A phone signed in at the register. */
export async function staffPhone(member: { email: string; pin: string } = ANA) {
  const phone = await newPhone();
  const response = await post(phone, "/register/sign-in", member);
  expect(redirectedTo(response), `${member.email} gets into the register`).toBe("/register");
  return phone;
}

/** The card's version as the register sees it: it goes up by one with each entry. */
export async function versionOf(register: APIRequestContext, shortCode: string): Promise<number> {
  const html = await (await register.get(`/register/card/${shortCode}`)).text();
  const version = /name="version" value="(\d+)"/.exec(html)?.[1];
  if (version === undefined) throw new Error(`Sin versión en /register/card/${shortCode}`);
  return Number(version);
}

/** Sumar sello or Canjear premio, as the card's form sends it. */
export function record(
  register: APIRequestContext,
  shortCode: string,
  intent: "stamp" | "redeem",
  version: number | string,
) {
  return post(register, `/register/card/${shortCode}`, { intent, version: String(version) });
}

/** Adds a stamp at the version it has now; returns the entry's id. */
export async function addStampNow(register: APIRequestContext, shortCode: string) {
  const response = await record(register, shortCode, "stamp", await versionOf(register, shortCode));
  // Its confirmation comes in a sheet over the card (11/10/2026): the entry is in its Deshacer.
  const html = await response.text();
  const entry = /action="\/register\/done\/([0-9a-f-]{36})"/.exec(html)?.[1];
  if (!entry) throw new Error(`Sumar sello no llegó a su confirmación: ${response.status()}`);
  return entry;
}

/** A made-up email nobody else has in the shared database. */
export function madeUpEmail(): string {
  return `prueba-${crypto.randomUUID().slice(0, 8)}@example.com`;
}

/**
 * Bruno adds a barista of their own for this test, so Ana is never locked out or changed: the other tests
 * use her. Returns their id, email and PIN.
 */
export async function newBarista(manager?: APIRequestContext) {
  const bruno = manager ?? (await staffPhone(BRUNO));
  const email = madeUpEmail();
  const added = await post(bruno, "/register/team/new", { email, name: "Barista Prueba" });
  const pin = /class="shown-pin">(\d{6})</.exec(await added.text())?.[1];
  if (!pin) throw new Error(`No se pudo agregar a ${email}: ${added.status()}`);
  const team = await (await bruno.get("/register/team")).text();
  const id = team
    .split('href="/register/team/')
    .find((row) => row.includes(email))
    ?.slice(0, 36);
  if (!id) throw new Error(`No aparece ${email} en Equipo`);
  return { id, email, pin };
}
