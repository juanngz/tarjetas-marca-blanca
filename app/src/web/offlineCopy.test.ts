import { describe, expect, it } from "vitest";
import { forgetWallet, keepCard, keepWallet, keptCard, keptWallet } from "./offlineCopy";

/** The phone's storage, in memory. */
function phone() {
  const items = new Map<string, string>();
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    removeItem: (key: string) => void items.delete(key),
    items,
  };
}

/** A phone that doesn't let the app keep anything (private mode, or full). */
const lockedPhone = {
  getItem: () => {
    throw new Error("SecurityError");
  },
  setItem: () => {
    throw new Error("QuotaExceededError");
  },
  removeItem: () => {
    throw new Error("SecurityError");
  },
};

const takeAway = { type: "take-away", stamps: 5, qrCode: "Q1", shortCode: "K7M2QX" };
const quarter = { type: "beans-quarter", stamps: 0, qrCode: "Q2", shortCode: "P3N8RT" };
const wallet = { greeting: "Buenos días, Marta.", cards: [takeAway, quarter] };

describe("the copy of the cards on the phone", () => {
  it("keeps the wallet as it was shown", () => {
    const store = phone();
    keepWallet(wallet, store);
    expect(keptWallet(store)).toEqual(wallet);
  });

  it("finds each card's code in it", () => {
    const store = phone();
    keepWallet(wallet, store);
    expect(keptCard("beans-quarter", store)).toEqual(quarter);
  });

  it("a card that isn't there isn't made up", () => {
    const store = phone();
    keepWallet(wallet, store);
    expect(keptCard("beans-half", store)).toBeNull();
  });

  it("before the wallet is shown once, there's nothing", () => {
    expect(keptWallet(phone())).toBeNull();
    expect(keptCard("take-away", phone())).toBeNull();
  });

  it("says when the wallet changed, and when it's the same", () => {
    const store = phone();
    expect(keepWallet(wallet, store)).toBe(true);
    expect(keepWallet({ ...wallet }, store)).toBe(false);
    expect(keepWallet({ ...wallet, cards: [{ ...takeAway, stamps: 6 }, quarter] }, store)).toBe(
      true,
    );
  });

  it("a card seen on its own screen updates the copy", () => {
    const store = phone();
    keepWallet(wallet, store);
    keepCard({ ...takeAway, stamps: 6 }, store);
    expect(keptCard<typeof takeAway>("take-away", store)?.stamps).toBe(6);
    expect(keptCard("beans-quarter", store)).toEqual(quarter);
  });

  it("Salir forgets it", () => {
    const store = phone();
    keepWallet(wallet, store);
    forgetWallet(store);
    expect(keptWallet(store)).toBeNull();
    expect(store.items.size).toBe(0);
  });

  // A copy written by an older version of the app could be missing what the screen needs now.
  it("a copy from another version of the app isn't used", () => {
    const store = phone();
    keepWallet(wallet, store);
    const [key] = store.items.keys();
    store.setItem(key ?? "", JSON.stringify({ shape: 0, wallet }));
    expect(keptWallet(store)).toBeNull();
  });

  it("a broken copy isn't used", () => {
    const store = phone();
    keepWallet(wallet, store);
    const [key] = store.items.keys();
    store.setItem(key ?? "", "{not json");
    expect(keptWallet(store)).toBeNull();
  });

  it("a phone that doesn't let it keep anything doesn't break the screen", () => {
    expect(() => keepWallet(wallet, lockedPhone)).not.toThrow();
    expect(() => keepCard(takeAway, lockedPhone)).not.toThrow();
    expect(() => forgetWallet(lockedPhone)).not.toThrow();
    expect(keptWallet(lockedPhone)).toBeNull();
  });

  it("outside the phone (on the server), there's nothing to keep", () => {
    expect(keepWallet(wallet)).toBe(false);
    expect(keptWallet()).toBeNull();
  });
});
