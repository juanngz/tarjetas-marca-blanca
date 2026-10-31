// Security: the doors. A customer gets in only through Turnstile and the attempt cap per connection
// (spec, "Probar DNIs en masa"). A staff member is locked out for 15 minutes after 5 wrong PINs in a row
// (flujos-equipo.md, Flujo A), however they're sent; and the answers never confirm which emails exist
// (arquitectura.md, staffSignIn). Each lockout test uses its own made-up barista, never Ana.
import { expect, test } from "@playwright/test";
import { madeUpDni } from "../support/customer";
import {
  cookieOf,
  madeUpEmail,
  newBarista,
  newPhone,
  post,
  redirectedTo,
  TURNSTILE_TOKEN,
} from "../support/http";

/** The cap per connection (wrangler.jsonc, SIGN_IN_LIMIT). */
const SIGN_IN_LIMIT = 30;

test("without Turnstile there's no sign-up", async () => {
  const phone = await newPhone();
  const dni = madeUpDni();
  const sent = await post(phone, "/sign-up", {
    step: "sign-up",
    type: "dni",
    number: dni,
    name: "Marta García",
    consent: "yes",
  });
  expect(sent.status()).toBe(400);
  expect(await cookieOf(phone, "session")).toBeNull();
  // Nobody was signed up with that number: it's still new.
  const asked = await post(phone, "/?index", {
    type: "dni",
    document: dni,
    "cf-turnstile-response": TURNSTILE_TOKEN,
  });
  expect(redirectedTo(asked)).toBeNull();
  expect(await cookieOf(phone, "session")).toBeNull();
});

test("without Turnstile there's no sign-in, not even with a DNI in the Club", async () => {
  const phone = await newPhone();
  const sent = await post(phone, "/?index", { type: "dni", document: "30123456" });
  expect(sent.status()).toBe(400);
  expect(await cookieOf(phone, "session")).toBeNull();
});

// The limiter counts in windows of a minute, fixed on the clock: one by one, a slow run (the CI, 14/10/2026)
// could cross into the next window and start counting again. All at once and twice the cap and one: in one
// window or split in two, one of them gets more than the cap.
test(`more than ${SIGN_IN_LIMIT} documents from one connection in a minute: the rest wait`, async () => {
  const phone = await newPhone();
  const sent = await Promise.all(
    Array.from({ length: 2 * SIGN_IN_LIMIT + 1 }, () =>
      post(phone, "/?index", { type: "dni", document: madeUpDni() }),
    ),
  );
  const statuses = sent.map((answer) => answer.status());
  expect(statuses).toContain(429);
  // The others got through to the gate and stopped at Turnstile: none of them got in.
  expect(statuses.filter((status) => status !== 429).every((status) => status === 400)).toBe(true);
});

test("a name with code in it can't be signed up", async () => {
  const phone = await newPhone();
  for (const name of [
    "<script>alert(1)</script>",
    '"><img src=x onerror=alert(1)>',
    "Robert'); DROP TABLE customers;--",
    "Marta‮aícrag",
    "M".repeat(5000),
  ]) {
    const sent = await post(phone, "/sign-up", {
      step: "sign-up",
      type: "dni",
      number: madeUpDni(),
      name,
      consent: "yes",
      "cf-turnstile-response": TURNSTILE_TOKEN,
    });
    expect(sent.status(), name.slice(0, 20)).toBe(400);
    expect(await cookieOf(phone, "session")).toBeNull();
  }
});

/** A PIN that isn't theirs. */
const wrongPin = (pin: string) => (pin === "246802" ? "135792" : "246802");

// Locked out, the answer is the same as a wrong PIN (401, the same message): it never tells which emails
// are on the team.
test("after 5 wrong PINs, not even the right one gets in", async () => {
  const barista = await newBarista();
  const phone = await newPhone();
  for (let i = 0; i < 5; i++) {
    await post(phone, "/register/sign-in", { email: barista.email, pin: wrongPin(barista.pin) });
  }
  const right = await post(phone, "/register/sign-in", barista);
  expect(redirectedTo(right)).toBeNull();
  expect(right.status()).toBe(401);
});

// Which PINs of a burst get checked depends on the order they arrive in, which can't be seen from here: that
// only 5 of 30 at once get checked is proven against D1 (pinAttempts.server.test.ts). Here, the lockout.
test("thirty wrong PINs sent at once lock them out, like five in a row", async () => {
  const barista = await newBarista();
  const phone = await newPhone();
  await Promise.all(
    Array.from({ length: 30 }, () =>
      post(phone, "/register/sign-in", { email: barista.email, pin: wrongPin(barista.pin) }),
    ),
  );
  const right = await post(phone, "/register/sign-in", barista);
  expect(redirectedTo(right)).toBeNull();
  expect(right.status()).toBe(401);
});

test("after 5 wrong PINs, an email nobody has answers like one that exists", async () => {
  const barista = await newBarista();
  const nobody = madeUpEmail();
  const answers: Record<string, { status: number; locked: boolean }> = {};
  for (const email of [barista.email, nobody]) {
    const phone = await newPhone();
    let last = await post(phone, "/register/sign-in", { email, pin: wrongPin(barista.pin) });
    for (let i = 0; i < 5; i++) {
      last = await post(phone, "/register/sign-in", { email, pin: wrongPin(barista.pin) });
    }
    answers[email] = {
      status: last.status(),
      locked: (await last.text()).includes("esperá 15 minutos"),
    };
  }
  expect(answers[nobody]).toEqual(answers[barista.email]);
});
