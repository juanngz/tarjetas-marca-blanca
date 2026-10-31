import { describe, expect, it } from "vitest";
import { leftForReward } from "./progress";

const TAKE_AWAY = { stamps: 5, stampsPerRound: 7, goal: "el café gratis" };

describe("how many stamps are left for the reward", () => {
  it("says how many are missing", () => {
    expect(leftForReward(TAKE_AWAY)).toBe("Le faltan 2 para el café gratis.");
  });

  it("with one left, in singular", () => {
    expect(leftForReward({ ...TAKE_AWAY, stamps: 6 })).toBe("Le falta 1 para el café gratis.");
  });

  it("at the start of a round, all of them", () => {
    expect(leftForReward({ ...TAKE_AWAY, stamps: 0 })).toBe("Le faltan 7 para el café gratis.");
  });

  it("with the card's own goal", () => {
    expect(leftForReward({ stamps: 2, stampsPerRound: 4, goal: "el 30% OFF" })).toBe(
      "Le faltan 2 para el 30% OFF.",
    );
  });
});
