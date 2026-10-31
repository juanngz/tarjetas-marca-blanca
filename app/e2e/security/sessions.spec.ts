// Security: the sessions (arquitectura.md, "Las sesiones"). A signed cookie is the only key: a made-up,
// changed or borrowed one never opens anything. A staff member taken off the team, or given a new PIN, is out
// on their next tap. What's decided not to be checked (a copy of a cookie still works after Salir) isn't here.
import { expect, test } from "@playwright/test";
import {
  codesOf,
  cookieOf,
  customerPhone,
  newBarista,
  phoneWithCookie,
  post,
  record,
  redirectedTo,
  staffPhone,
  versionOf,
} from "../support/http";
import { BRUNO } from "../support/register";

const toBase64Url = (text: string) =>
  Buffer.from(text).toString("base64").replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");

test("a made-up customer cookie doesn't open any cards", async () => {
  const payload = toBase64Url(JSON.stringify({ sub: crypto.randomUUID(), exp: Date.now() + 1e10 }));
  const phone = await phoneWithCookie("session", `${payload}.${"a".repeat(64)}`);
  expect(redirectedTo(await phone.get("/cards"))).toBe("/");
});

test("a customer cookie with someone else's id in it doesn't open their cards", async () => {
  const marta = await customerPhone();
  const other = await customerPhone("Rosa Quiroga");
  const [, signature] = ((await cookieOf(marta.phone, "session")) ?? "").split(".");
  const [otherPayload] = ((await cookieOf(other.phone, "session")) ?? "").split(".");
  const forged = await phoneWithCookie("session", `${otherPayload}.${signature}`);
  expect(redirectedTo(await forged.get("/cards"))).toBe("/");
});

test("a customer cookie that says it lasts forever doesn't work", async () => {
  const marta = await customerPhone();
  const [payload, signature] = ((await cookieOf(marta.phone, "session")) ?? "").split(".");
  const read = JSON.parse(Buffer.from(payload, "base64url").toString()) as { sub: string };
  const forever = toBase64Url(JSON.stringify({ sub: read.sub, exp: 8.64e15 }));
  const forged = await phoneWithCookie("session", `${forever}.${signature}`);
  expect(redirectedTo(await forged.get("/cards"))).toBe("/");
});

test("a customer's cookie doesn't open the register, not even under the staff name", async () => {
  const marta = await customerPhone();
  const value = (await cookieOf(marta.phone, "session")) ?? "";
  const asStaff = await phoneWithCookie("staff-session", value);
  expect(redirectedTo(await asStaff.get("/register"))).toBe("/register/sign-in");
  expect(redirectedTo(await marta.phone.get("/register"))).toBe("/register/sign-in");
});

test("a customer can't add a stamp by sending the register's form", async () => {
  const marta = await customerPhone();
  const { shortCode } = await codesOf(marta.phone, "take-away");
  const ana = await staffPhone();
  const before = await versionOf(ana, shortCode);

  const sent = await record(marta.phone, shortCode, "stamp", before);
  expect(redirectedTo(sent)).toBe("/register/sign-in");
  expect(await versionOf(ana, shortCode)).toBe(before);
});

test("a staff cookie doesn't open a customer's cards", async () => {
  const ana = await staffPhone();
  const value = (await cookieOf(ana, "staff-session")) ?? "";
  const asCustomer = await phoneWithCookie("session", value);
  expect(redirectedTo(await asCustomer.get("/cards"))).toBe("/");
});

const BROKEN_COOKIES = [
  "",
  ".",
  "..",
  "a.b.c",
  "not-base64!.zz",
  `${"A".repeat(4000)}.${"0".repeat(64)}`,
  `${toBase64Url("not json")}.${"0".repeat(64)}`,
  `${toBase64Url('{"sub":1}')}.${"g".repeat(64)}`,
  "%00%ff.%00",
];

for (const [name, path, out] of [
  ["session", "/cards", "/"],
  ["staff-session", "/register", "/register/sign-in"],
] as const) {
  test(`a broken ${name} cookie is like having none, never a server error`, async () => {
    for (const value of BROKEN_COOKIES) {
      const phone = await phoneWithCookie(name, value);
      const response = await phone.get(path);
      expect(response.status(), `cookie "${value.slice(0, 20)}"`).toBeLessThan(500);
      expect(redirectedTo(response), `cookie "${value.slice(0, 20)}"`).toBe(out);
    }
  });
}

test("a barista taken off the team is out on their next tap", async () => {
  const bruno = await staffPhone(BRUNO);
  const barista = await newBarista(bruno);
  const theirPhone = await staffPhone(barista);
  expect((await theirPhone.get("/register")).status()).toBe(200);

  await post(bruno, `/register/team/${barista.id}`, { intent: "deactivate", confirmed: "yes" });

  expect(redirectedTo(await theirPhone.get("/register"))).toBe("/register/sign-in");
  const marta = await customerPhone();
  const { shortCode } = await codesOf(marta.phone, "take-away");
  const sent = await record(theirPhone, shortCode, "stamp", 0);
  expect(redirectedTo(sent)).toBe("/register/sign-in");
  // And they can't sign in again.
  const again = await post(theirPhone, "/register/sign-in", barista);
  expect(redirectedTo(again)).toBeNull();
});

test("a new PIN ends the barista's open sessions", async () => {
  const bruno = await staffPhone(BRUNO);
  const barista = await newBarista(bruno);
  const theirPhone = await staffPhone(barista);

  await post(bruno, `/register/team/${barista.id}`, { intent: "new-pin", confirmed: "yes" });

  expect(redirectedTo(await theirPhone.get("/register"))).toBe("/register/sign-in");
  const withOldPin = await post(theirPhone, "/register/sign-in", barista);
  expect(redirectedTo(withOldPin)).toBeNull();
});
