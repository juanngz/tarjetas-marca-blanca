import { describe, expect, it } from "vitest";
import { exampleCafe } from "../cafes/example";
import {
  bandText,
  displayCards,
  rewardReady,
  rewardSlotReady,
  savedRewards,
  shownGoal,
  shownStamps,
} from "./displayCard";

const customerCards = (takeAway = { stamps: 0, rewards: 0 }) => [
  { type: "beans-kilo", stamps: 0, rewards: 0 },
  { type: "beans-half", stamps: 0, rewards: 0 },
  { type: "take-away", ...takeAway },
  { type: "beans-quarter", stamps: 0, rewards: 0 },
];

describe("the cards to show", () => {
  it("come in the café's fixed order, however they're stored", () => {
    expect(displayCards(exampleCafe, customerCards()).map((c) => c.type)).toEqual([
      "take-away",
      "beans-quarter",
      "beans-half",
      "beans-kilo",
    ]);
  });

  it("each with its stamps and rewards", () => {
    const [takeAway] = displayCards(exampleCafe, customerCards({ stamps: 2, rewards: 1 }));
    expect(takeAway).toMatchObject({ stamps: 2, rewards: 1, stampsPerRound: 7 });
  });

  it("with its name, color and drawing from the config", () => {
    const [, quarter] = displayCards(exampleCafe, customerCards());
    expect(quarter).toMatchObject({ name: "Café en grano ¼ kg", color: 2, stamp: "seal" });
  });

  it("the fourth card has the theme's fourth color", () => {
    const [, , , kilo] = displayCards(exampleCafe, customerCards());
    expect(kilo).toMatchObject({ name: "Café en grano 1 kg", color: 4 });
  });

  it("a card the café no longer has isn't shown", () => {
    const withAnOldOne = [...customerCards(), { type: "old-card", stamps: 0, rewards: 0 }];
    expect(displayCards(exampleCafe, withAnOldOne)).toHaveLength(4);
  });

  describe("a completed card stays full until the reward is redeemed or a new stamp is added", () => {
    it("with a reward and no stamp of the new round: complete, all its stamps shown", () => {
      const [takeAway] = displayCards(exampleCafe, customerCards({ stamps: 0, rewards: 1 }));
      expect(takeAway?.complete).toBe(true);
      expect(takeAway && shownStamps(takeAway)).toBe(7);
    });

    it("the first stamp of the new round starts counting again", () => {
      const [takeAway] = displayCards(exampleCafe, customerCards({ stamps: 1, rewards: 1 }));
      expect(takeAway?.complete).toBe(false);
      expect(takeAway && shownStamps(takeAway)).toBe(1);
    });

    it("once the reward is redeemed, it starts empty", () => {
      const [takeAway] = displayCards(exampleCafe, customerCards({ stamps: 0, rewards: 0 }));
      expect(takeAway?.complete).toBe(false);
      expect(takeAway && shownStamps(takeAway)).toBe(0);
    });

    it("what's stored doesn't change: the register keeps counting the new round", () => {
      const [takeAway] = displayCards(exampleCafe, customerCards({ stamps: 0, rewards: 1 }));
      expect(takeAway?.stamps).toBe(0);
    });
  });

  // Like the paper card (18/10/2026): a slot more at the end, the reward's. Stamping it is redeeming it.
  describe("the last slot is the reward's, like on the paper card", () => {
    it("the counter counts the slots: 8 for take-away, 5 for coffee beans", () => {
      const [takeAway, quarter, half, kilo] = displayCards(exampleCafe, customerCards());
      expect(takeAway && shownGoal(takeAway)).toBe(8);
      expect([quarter, half, kilo].map((card) => card && shownGoal(card))).toEqual([5, 5, 5]);
    });

    it("with the 7th stamp, 7 de 8: the reward's slot lights up, it's the next purchase", () => {
      const [takeAway] = displayCards(exampleCafe, customerCards({ stamps: 0, rewards: 1 }));
      expect(takeAway && shownStamps(takeAway)).toBe(7);
      expect(takeAway && rewardSlotReady(takeAway)).toBe(true);
    });

    it("off before the 7th", () => {
      const [takeAway] = displayCards(exampleCafe, customerCards({ stamps: 6, rewards: 0 }));
      expect(takeAway && rewardSlotReady(takeAway)).toBe(false);
    });

    it("each says under it what it gives: Gratis, 30%", () => {
      const [takeAway, quarter, half, kilo] = displayCards(exampleCafe, customerCards());
      expect([takeAway?.slot, quarter?.slot, half?.slot, kilo?.slot]).toEqual([
        "Gratis",
        "30%",
        "30%",
        "30%",
      ]);
    });

    it("a reward kept for later doesn't light the slot of the new round", () => {
      const [takeAway] = displayCards(exampleCafe, customerCards({ stamps: 2, rewards: 1 }));
      expect(takeAway && rewardSlotReady(takeAway)).toBe(false);
    });
  });

  // Publishing the reward's slot (18/10/2026) changes how cards look, not what's stored: every balance
  // customers already have shows all its stamps and all its rewards.
  it("every balance already stored shows all its stamps and all its rewards", () => {
    for (const config of exampleCafe.cards) {
      for (let stamps = 0; stamps < config.stamps; stamps++) {
        for (let rewards = 0; rewards <= 3; rewards++) {
          const stored = [{ type: config.type, stamps, rewards }];
          const [card] = displayCards(exampleCafe, stored);
          if (!card) throw new Error(`Missing ${config.type}.`);
          const label = `${config.type}: ${stamps} sellos, ${rewards} premios`;
          // The stamps: the ones stored, or the whole round while its reward is the next purchase.
          expect(shownStamps(card), label).toBe(card.complete ? config.stamps : stamps);
          expect(shownStamps(card), label).toBeLessThan(shownGoal(card));
          // The rewards: the one in the lit slot plus the ones kept for later, none more and none less.
          expect((rewardSlotReady(card) ? 1 : 0) + savedRewards(card), label).toBe(rewards);
        }
      }
    }
  });

  // 19/10/2026: the band says the card's rule, short, always.
  describe("the band under the stamps says the card's rule, short", () => {
    it("take-away: the 8th coffee is free", () => {
      const [takeAway] = displayCards(exampleCafe, customerCards());
      expect(takeAway && bandText(takeAway)).toBe("El 8º café, gratis");
    });

    it("coffee beans: the 5th purchase has 30% OFF", () => {
      const [, quarter, half, kilo] = displayCards(exampleCafe, customerCards());
      expect([quarter, half, kilo].map((card) => card && bandText(card))).toEqual([
        "En la 5ª compra, 30% OFF",
        "En la 5ª compra, 30% OFF",
        "En la 5ª compra, 30% OFF",
      ]);
    });

    it("the same with the reward earned, or kept for later", () => {
      for (const balance of [
        { stamps: 0, rewards: 1 },
        { stamps: 2, rewards: 1 },
      ]) {
        const [takeAway] = displayCards(exampleCafe, customerCards(balance));
        expect(takeAway && bandText(takeAway)).toBe("El 8º café, gratis");
      }
    });
  });

  describe("the reward, under the stamps, is lit while there's one to redeem", () => {
    it("off without a reward, even with the card almost full", () => {
      const [takeAway] = displayCards(exampleCafe, customerCards({ stamps: 6, rewards: 0 }));
      expect(takeAway && rewardReady(takeAway)).toBe(false);
    });

    it("on once earned", () => {
      const [takeAway] = displayCards(exampleCafe, customerCards({ stamps: 0, rewards: 1 }));
      expect(takeAway && rewardReady(takeAway)).toBe(true);
    });

    it("still on with stamps of the new round, until it's redeemed", () => {
      const [takeAway] = displayCards(exampleCafe, customerCards({ stamps: 2, rewards: 1 }));
      expect(takeAway && rewardReady(takeAway)).toBe(true);
    });
  });
});
