import type { ShouldRevalidateFunctionArgs } from "react-router";
import { describe, expect, it } from "vitest";
import {
  keepScreenWhenOffline,
  OFFLINE,
  orWhatIsKept,
  registerBarAgain,
  unlessOffline,
} from "./offline";

const afterAction = (actionResult: unknown) =>
  ({
    currentUrl: new URL("https://club.example.test/register/card/K7M2QX"),
    nextUrl: new URL("https://club.example.test/register/card/K7M2QX"),
    currentParams: {},
    nextParams: {},
    formMethod: "POST",
    actionResult,
    defaultShouldRevalidate: true,
  }) as ShouldRevalidateFunctionArgs;

describe("a register action without a connection", () => {
  it("says it was offline instead of failing", async () => {
    const noConnection = () => Promise.reject(new TypeError("Failed to fetch"));
    expect(await unlessOffline(noConnection)).toEqual(OFFLINE);
  });

  it("what the server answered goes on as it is", async () => {
    expect(await unlessOffline(async () => ({ error: "x" }))).toEqual({ error: "x" });
  });

  it("anything else that isn't the connection, like a redirect, goes on", async () => {
    const redirect = new Response(null, { status: 302 });
    await expect(unlessOffline(() => Promise.reject(redirect))).rejects.toBe(redirect);
  });

  it("the screen doesn't ask the server again", () => {
    expect(keepScreenWhenOffline()(afterAction(OFFLINE))).toBe(false);
  });

  it("after an action that did reach it, the screen is asked again as usual", () => {
    expect(keepScreenWhenOffline()(afterAction({ error: "x" }))).toBe(true);
  });
});

describe("a customer screen without a connection", () => {
  const noConnection = () => Promise.reject(new TypeError("Load failed"));
  const copy = { card: "take-away" };

  it("shows what the phone kept", async () => {
    expect(await orWhatIsKept(noConnection, () => copy)).toBe(copy);
  });

  it("with a connection, shows what the server says", async () => {
    expect(
      await orWhatIsKept(
        async () => ({ card: "fresh" }),
        () => copy,
      ),
    ).toEqual({
      card: "fresh",
    });
  });

  it("if the phone didn't keep it, fails as before", async () => {
    await expect(orWhatIsKept(noConnection, () => null)).rejects.toBeInstanceOf(TypeError);
  });

  it("a redirect (the session ended) isn't covered up by the copy", async () => {
    const redirect = new Response(null, { status: 302 });
    await expect(
      orWhatIsKept(
        () => Promise.reject(redirect),
        () => copy,
      ),
    ).rejects.toBe(redirect);
  });
});

// The register's layout only says who's at the register: no form there changes it, so it isn't asked again
// after one (one trip less to the EU for each tap). Going to a screen, as always.
describe("the register's bar (who's at the register)", () => {
  const NOW = Date.UTC(2026, 9, 11, 15, 0);
  const MINUTE = 60_000;
  const goingTo = (path: string) =>
    ({
      ...afterAction(undefined),
      currentUrl: new URL("https://club.example.test/register/team"),
      nextUrl: new URL(`https://club.example.test${path}`),
      formMethod: undefined,
    }) as ShouldRevalidateFunctionArgs;

  it("isn't asked again after a form: Sumar sello doesn't change who's at the register", () => {
    expect(registerBarAgain(afterAction({ done: {} }), { loadedAt: NOW, now: NOW })).toBe(false);
  });

  it("is asked again after changing someone in Equipo: it may be whoever is at the register", () => {
    const changed = {
      ...afterAction({ saved: true }),
      formAction: "/register/team/00000000-0000-4000-8000-000000000102",
    };
    expect(registerBarAgain(changed, { loadedAt: NOW, now: NOW })).toBe(true);
  });

  it("isn't asked again going to another screen: the screen shows without waiting for it", () => {
    const later = NOW + 59 * MINUTE;
    expect(registerBarAgain(goingTo("/register"), { loadedAt: NOW, now: later })).toBe(false);
  });

  it("is asked again going to another screen after an hour, so the session is renewed with use", () => {
    const later = NOW + 60 * MINUTE;
    expect(registerBarAgain(goingTo("/register"), { loadedAt: NOW, now: later })).toBe(true);
  });

  it("nothing is asked again after an action without a connection", () => {
    const offline = { ...afterAction(OFFLINE), formAction: "/register/team/x" };
    expect(registerBarAgain(offline, { loadedAt: NOW, now: NOW })).toBe(false);
  });
});
