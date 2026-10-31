import { describe, expect, it } from "vitest";
import { cachePlan } from "./cachePlan";

const APP = "https://club.example.test";
const FILES = new Set(["/assets/entry.client-abc.js", "/fonts/Sans-Regular.woff2"]);

const open = (path: string) => ({ method: "GET", mode: "navigate", url: `${APP}${path}` });
const fetchOf = (path: string, method = "GET") => ({ method, mode: "cors", url: `${APP}${path}` });
const plan = (request: { method: string; mode: string; url: string }) =>
  cachePlan(request, FILES, APP);

describe("what the phone keeps for when there's no connection", () => {
  it("keeps the wallet", () => {
    expect(plan(open("/cards"))).toBe("page");
    expect(plan(open("/cards?front=beans-half"))).toBe("page");
  });

  it("keeps each card's code", () => {
    expect(plan(open("/cards/take-away"))).toBe("page");
  });

  it("keeps the app's files", () => {
    expect(plan(fetchOf("/assets/entry.client-abc.js"))).toBe("file");
    expect(plan(fetchOf("/fonts/Sans-Regular.woff2"))).toBe("file");
  });

  // Flujo E: at the register nothing is saved for later, and nothing of a customer stays on its phone.
  it("never keeps the register", () => {
    expect(plan(open("/register"))).toBe("network");
    expect(plan(open("/register/card/K7M2QX"))).toBe("network");
    expect(plan(open("/register/team"))).toBe("network");
  });

  it("doesn't keep a card's stamps and rewards", () => {
    expect(plan(open("/cards/take-away/history"))).toBe("network");
  });

  it("doesn't keep the welcome or the sign-up", () => {
    expect(plan(open("/"))).toBe("network");
    expect(plan(open("/sign-up"))).toBe("network");
  });

  // What a screen asks for while it's open (the card's data) is resolved by the screen itself.
  it("leaves a screen's data to the network", () => {
    expect(plan(fetchOf("/cards/take-away.data"))).toBe("network");
    expect(plan(fetchOf("/cards.data"))).toBe("network");
  });

  it("never keeps what's sent", () => {
    expect(plan(fetchOf("/sign-out", "POST"))).toBe("network");
    expect(plan({ ...fetchOf("/cards", "POST"), mode: "navigate" })).toBe("network");
  });

  it("leaves a file that isn't the app's to the network", () => {
    expect(plan(fetchOf("/assets/zxing_reader-abc.wasm"))).toBe("network");
    expect(
      plan({ ...fetchOf(""), url: "https://challenges.cloudflare.com/turnstile/v0/api.js" }),
    ).toBe("network");
  });

  it("leaves another site's file to the network, even with the same name", () => {
    expect(plan({ ...fetchOf(""), url: "https://other.test/fonts/Sans-Regular.woff2" })).toBe(
      "network",
    );
  });
});
