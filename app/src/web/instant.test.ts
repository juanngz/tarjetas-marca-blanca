import type { ShouldRevalidateFunctionArgs } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { isWaiting, keptFirst, revalidateOnlyWhenAsked, showing } from "./instant";

const request = (path: string) => new Request(`https://club.example.test${path}`);
const copy = { card: "kept" };
const fromServer = async () => ({ card: "fresh" });
const noConnection = () => Promise.reject(new TypeError("Load failed"));
const never = () => new Promise<never>(() => {});

afterEach(() => showing(null));

describe("going to a customer screen", () => {
  it("shows the phone's copy at once, and the screen asks the server", async () => {
    showing("/cards");
    const data = await keptFirst(request("/cards/take-away"), fromServer, () => copy);
    expect(data).toEqual({ card: "kept", waiting: true });
    expect(isWaiting(data)).toBe(true);
  });

  it("doesn't wait for the server to answer", async () => {
    showing("/cards");
    const data = await keptFirst(request("/cards/take-away"), never, () => copy);
    expect(data).toMatchObject({ card: "kept" });
  });

  it("from outside the customer screens too (after Salir, back to the wallet)", async () => {
    showing(null);
    expect(await keptFirst(request("/cards"), never, () => copy)).toMatchObject({ card: "kept" });
  });

  it("without a copy, waits for what the server says", async () => {
    showing("/cards");
    expect(await keptFirst(request("/cards/take-away"), fromServer, () => null)).toEqual({
      card: "fresh",
    });
  });

  // The screen asking right after the copy, the sello en vivo: what's shown never goes back to an older copy.
  it("when the screen that's shown asks again, waits for the server", async () => {
    showing("/cards/take-away");
    const data = await keptFirst(request("/cards/take-away"), fromServer, () => copy);
    expect(data).toEqual({ card: "fresh" });
    expect(isWaiting(data)).toBe(false);
  });

  it("asking again without a connection, shows the copy, no longer waiting", async () => {
    showing("/cards/take-away");
    const data = await keptFirst(request("/cards/take-away"), noConnection, () => copy);
    expect(data).toBe(copy);
    expect(isWaiting(data)).toBe(false);
  });
});

describe("the customer layout", () => {
  const args = (from: string, to: string, formMethod?: string) =>
    ({
      currentUrl: new URL(`https://club.example.test${from}`),
      nextUrl: new URL(`https://club.example.test${to}`),
      currentParams: {},
      nextParams: {},
      formMethod,
      defaultShouldRevalidate: true,
    }) as ShouldRevalidateFunctionArgs;

  it("isn't asked again when going from one screen to another", () => {
    expect(revalidateOnlyWhenAsked(args("/cards/take-away", "/cards?front=take-away"))).toBe(false);
  });

  it("is asked again when the screen asks again", () => {
    expect(revalidateOnlyWhenAsked(args("/cards", "/cards"))).toBe(true);
  });

  it("is asked again after a form", () => {
    expect(revalidateOnlyWhenAsked(args("/cards", "/sign-out", "POST"))).toBe(true);
  });
});
