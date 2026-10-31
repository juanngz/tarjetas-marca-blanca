// Security: what comes from outside the screens. Odd addresses, odd fields and bodies that aren't forms get a
// plain "no" (4xx), never a server error. A form sent from another site doesn't act with the person's
// cookie. And the sello en vivo opens only for the card's owner, from the app's own pages (arquitectura.md,
// "El sello en vivo").
import { expect, test } from "@playwright/test";
import {
  appUrl,
  codesOf,
  cookieOf,
  customerPhone,
  phoneWithCookie,
  post,
  staffPhone,
  versionOf,
} from "../support/http";
import { BRUNO } from "../support/register";

const ODD = [
  "x",
  "%00",
  "..%2F..%2Fetc%2Fpasswd",
  "' OR '1'='1",
  "<svg onload=alert(1)>",
  "A".repeat(3000),
  "ñandú",
  "00000000-0000-4000-8000-000000000999",
];

test("odd card types on the customer's screens are a 404, never a server error", async () => {
  const marta = await customerPhone();
  for (const odd of ODD) {
    const type = encodeURIComponent(odd);
    for (const path of [`/cards/${type}`, `/cards/${type}/history`]) {
      const response = await marta.phone.get(path);
      expect(response.status(), path.slice(0, 40)).toBe(404);
    }
  }
});

test("odd codes and ids at the register are a 404, never a server error", async () => {
  const bruno = await staffPhone(BRUNO);
  for (const odd of ODD) {
    const id = encodeURIComponent(odd);
    for (const path of [`/register/card/${id}`, `/register/done/${id}`, `/register/team/${id}`]) {
      const response = await bruno.get(path);
      expect(response.status(), path.slice(0, 40)).toBe(404);
    }
  }
});

test("odd searches at the register get an answer, never a server error", async () => {
  const ana = await staffPhone();
  for (const code of [
    ...ODD,
    "",
    "   ",
    "%",
    "_",
    "\\",
    "'",
    "a%",
    "🙂☕",
    "é",
    "X".repeat(100_000),
  ]) {
    const response = await post(ana, "/register?index", { code });
    expect(response.status(), code.slice(0, 20)).toBeLessThan(500);
  }
});

test("a search by name with % or _ doesn't list every customer", async () => {
  const ana = await staffPhone();
  for (const code of ["%%", "__", "a%", "%a"]) {
    const body = await (await post(ana, "/register?index", { code })).text();
    expect(body, code).not.toContain("Se anotó");
  }
});

test("a body that isn't a form gets a 4xx, never a server error", async () => {
  const ana = await staffPhone();
  const marta = await customerPhone();
  const { shortCode } = await codesOf(marta.phone, "take-away");
  const bodies = [
    { headers: { "Content-Type": "application/json" }, data: '{"intent":"stamp"}' },
    { headers: { "Content-Type": "text/plain" }, data: "intent=stamp" },
    { headers: { "Content-Type": "application/x-www-form-urlencoded" }, data: "%" },
  ];
  for (const path of ["/register/sign-in", "/?index", "/sign-up", `/register/card/${shortCode}`]) {
    for (const body of bodies) {
      const response = await ana.post(path, { ...body, maxRedirects: 0 });
      expect(response.status(), `${path} ${body.headers["Content-Type"]}`).toBeLessThan(500);
    }
  }
});

test("a form sent from another site doesn't add a stamp with the barista's cookie", async () => {
  const marta = await customerPhone();
  const { shortCode } = await codesOf(marta.phone, "take-away");
  const ana = await staffPhone();
  const cookie = (await cookieOf(ana, "staff-session")) ?? "";
  const fromElsewhere = await phoneWithCookie("staff-session", cookie);

  await fromElsewhere.post(`/register/card/${shortCode}`, {
    form: { intent: "stamp", version: "0" },
    headers: { Origin: "https://evil.example" },
    maxRedirects: 0,
  });
  expect(await versionOf(ana, shortCode)).toBe(0);
});

test("a page on another site can't send the register's form with the barista's session", async ({
  browser,
}) => {
  const marta = await customerPhone();
  const { shortCode } = await codesOf(marta.phone, "take-away");
  const ana = await staffPhone();
  const context = await browser.newContext();
  const url = new URL(appUrl());
  await context.addCookies([
    {
      name: "staff-session",
      value: (await cookieOf(ana, "staff-session")) ?? "",
      domain: url.hostname,
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  const page = await context.newPage();
  // Another site, with a form that sends itself to the register as soon as it opens.
  await page.route("http://evil.test/**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<form method="post" action="${appUrl()}/register/card/${shortCode}">
        <input name="intent" value="stamp"><input name="version" value="0"></form>
        <script>document.forms[0].submit()</script>`,
    }),
  );
  await page.goto("http://evil.test/");
  await page.waitForURL((u) => u.origin === url.origin);
  expect(await versionOf(ana, shortCode)).toBe(0);
  await context.close();
});

/**
 * Tries to open the sello en vivo's WebSocket with these headers, like a phone would.
 * Node's WebSocket (undici) takes headers; a browser's can't set Origin or the cookie.
 */
function openLive(type: string, headers: Record<string, string>): Promise<"open" | "refused"> {
  const url = `${appUrl().replace(/^http/, "ws")}/live/cards/${type}`;
  const Socket = WebSocket as unknown as new (
    url: string,
    init: { headers: Record<string, string> },
  ) => WebSocket;
  return new Promise((resolve) => {
    const socket = new Socket(url, { headers });
    socket.onopen = () => {
      resolve("open");
      socket.close();
    };
    socket.onerror = () => resolve("refused");
  });
}

test("the sello en vivo opens for the customer's own card, from the app", async () => {
  // So the refusals below mean something: the same request, done right, opens.
  const marta = await customerPhone();
  const cookie = `session=${await cookieOf(marta.phone, "session")}`;
  expect(await openLive("take-away", { Origin: new URL(appUrl()).origin, cookie })).toBe("open");
});

test("the sello en vivo doesn't open from another site, even with the customer's cookie", async () => {
  const marta = await customerPhone();
  const cookie = `session=${await cookieOf(marta.phone, "session")}`;
  expect(await openLive("take-away", { Origin: "https://evil.example", cookie })).toBe("refused");
  expect(await openLive("take-away", { cookie })).toBe("refused");
});

test("the sello en vivo doesn't open without a session, or for a card that doesn't exist", async () => {
  const app = new URL(appUrl()).origin;
  expect(await openLive("take-away", { Origin: app })).toBe("refused");
  const marta = await customerPhone();
  const cookie = `session=${await cookieOf(marta.phone, "session")}`;
  expect(await openLive("gift-card", { Origin: app, cookie })).toBe("refused");
});
