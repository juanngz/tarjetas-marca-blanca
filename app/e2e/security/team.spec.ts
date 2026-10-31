// Security: Equipo is the manager's (core/access.ts). A barista can't see it or change anyone by sending its
// forms by hand, and the manager changes only baristas: never another manager or themselves. Each test
// changes its own made-up baristas, never Ana or Bruno, which the other tests use.
import { expect, test } from "@playwright/test";
import { madeUpEmail, newBarista, newPhone, post, redirectedTo, staffPhone } from "../support/http";
import { BRUNO } from "../support/register";

/** Bruno's id, from scripts/seed.mjs. */
const BRUNO_ID = "00000000-0000-4000-8000-000000000102";

test("a barista can't see Equipo, nor anyone's page in it", async () => {
  const barista = await newBarista();
  const theirPhone = await staffPhone(barista);
  for (const path of ["/register/team", "/register/team/new", `/register/team/${BRUNO_ID}`]) {
    const response = await theirPhone.get(path);
    expect(redirectedTo(response), path).toBe("/register");
  }
});

test("a barista can't add someone to the team by sending the form", async () => {
  const barista = await newBarista();
  const theirPhone = await staffPhone(barista);
  const email = madeUpEmail();

  const sent = await post(theirPhone, "/register/team/new", { email, name: "Alguien Nuevo" });
  expect([403, 302]).toContain(sent.status());
  expect(await sent.text()).not.toMatch(/class="shown-pin"/);

  const bruno = await staffPhone(BRUNO);
  expect(await (await bruno.get("/register/team")).text()).not.toContain(email);
});

for (const form of <Record<string, string>[]>[
  { intent: "new-pin", confirmed: "yes" },
  { intent: "deactivate", confirmed: "yes" },
  { intent: "reactivate" },
  { intent: "save", name: "Otro Nombre", email: "otro@example.com" },
]) {
  test(`a barista can't ${form.intent} another barista by sending the form`, async () => {
    const bruno = await staffPhone(BRUNO);
    const target = await newBarista(bruno);
    const attacker = await staffPhone(await newBarista(bruno));

    const sent = await post(attacker, `/register/team/${target.id}`, form);
    expect(sent.status()).toBe(403);
    expect(await sent.text()).not.toMatch(/class="shown-pin"/);
    // The target still gets in with their PIN, under their email.
    await staffPhone(target);
  });
}

for (const form of <Record<string, string>[]>[
  { intent: "new-pin", confirmed: "yes" },
  { intent: "deactivate", confirmed: "yes" },
  { intent: "save", name: "Otro Nombre", email: "otro@example.com" },
]) {
  test(`the manager can't ${form.intent} themselves`, async () => {
    const bruno = await staffPhone(BRUNO);
    const sent = await post(bruno, `/register/team/${BRUNO_ID}`, form);
    expect(sent.status()).toBe(403);
    // Bruno is still in, with the same PIN.
    expect((await bruno.get("/register")).status()).toBe(200);
  });
}

test("Equipo's forms do nothing without a session", async () => {
  const stranger = await newPhone();
  const target = await newBarista();
  for (const [path, form] of [
    ["/register/team/new", { email: madeUpEmail(), name: "Alguien Nuevo" }],
    [`/register/team/${target.id}`, { intent: "deactivate", confirmed: "yes" }],
    [`/register/team/${target.id}`, { intent: "new-pin", confirmed: "yes" }],
  ] as const) {
    const sent = await post(stranger, path, form);
    expect(redirectedTo(sent), path).toBe("/register/sign-in");
  }
  await staffPhone(target);
});

test("the manager can't give a barista an email or a name that breaks the screens", async () => {
  const bruno = await staffPhone(BRUNO);
  const target = await newBarista(bruno);
  for (const [name, email] of [
    ["<script>alert(1)</script>", madeUpEmail()],
    // Never "Ana": if one of these got through, the team would have two Ana · barista.
    ["Barista Prueba", "ana@example.com"],
    ["Barista Prueba", "x'); DROP TABLE staff;--@example.com"],
    ["A".repeat(500), madeUpEmail()],
    ["Barista Prueba", `${"a".repeat(5000)}${madeUpEmail()}`],
  ]) {
    const sent = await post(bruno, `/register/team/${target.id}`, { intent: "save", name, email });
    expect(sent.status(), `${name.slice(0, 20)} / ${email.slice(0, 20)}`).toBe(400);
  }
  // Ana's email can't be taken: she still gets in.
  await staffPhone();
});
