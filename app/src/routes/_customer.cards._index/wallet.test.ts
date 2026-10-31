import { describe, expect, it } from "vitest";
import { chooseFront, walletOrder } from "./wallet";

const ALL_THREE = [{ type: "take-away" }, { type: "beans-quarter" }, { type: "beans-half" }];

describe("the front card", () => {
  it("is the chosen one", () => {
    expect(chooseFront(ALL_THREE, "beans-half")).toBe("beans-half");
  });

  it("if none was chosen, it's the first", () => {
    expect(chooseFront(ALL_THREE, null)).toBe("take-away");
  });

  it("if the chosen one doesn't exist, it's the first", () => {
    expect(chooseFront(ALL_THREE, "something-else")).toBe("take-away");
  });
});

describe("the wallet order, from back to front", () => {
  it("the chosen one goes in front and the last in the fixed order, furthest back", () => {
    expect(walletOrder(ALL_THREE, "take-away")).toEqual([
      "beans-half",
      "beans-quarter",
      "take-away",
    ]);
  });

  it("when another comes to the front, the ones behind keep the fixed order", () => {
    expect(walletOrder(ALL_THREE, "beans-quarter")).toEqual([
      "beans-half",
      "take-away",
      "beans-quarter",
    ]);
  });
});
