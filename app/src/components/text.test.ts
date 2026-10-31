import { describe, expect, it } from "vitest";
import { keepTogether, rewardsLabel } from "./text";

describe("amounts that never split in two lines", () => {
  it("the bag size and its unit", () => {
    expect(keepTogether("Café en grano ¼ kg")).toBe("Café en grano ¼ kg");
    expect(keepTogether("Café en grano 1 kg")).toBe("Café en grano 1 kg");
  });

  it("the discount", () => {
    expect(keepTogether("Tu próxima bolsa tiene 30% OFF.")).toBe("Tu próxima bolsa tiene 30% OFF.");
  });

  it("other words stay as they are", () => {
    expect(keepTogether("Café take-away")).toBe("Café take-away");
  });
});

describe("the rewards label on a card in the wallet", () => {
  it("one reward", () => {
    expect(rewardsLabel(1)).toBe("1 premio");
  });

  it("more than one", () => {
    expect(rewardsLabel(3)).toBe("3 premios");
  });
});
