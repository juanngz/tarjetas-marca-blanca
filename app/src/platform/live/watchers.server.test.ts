import { describe, expect, it } from "vitest";
import { durableCardWatchers } from "./watchers.server";

const CHANGE = { version: 1, kind: "stamp" } as const;

/** A namespace whose CardWatch answers when told: its notify waits on `answer`. */
function watchesThatWait() {
  let answer: (failed?: boolean) => void = () => {};
  const notified = new Promise<void>((resolve, reject) => {
    answer = (failed) => (failed ? reject(new Error("CardWatch down")) : resolve());
  });
  const watches = {
    idFromName: (name: string) => name,
    get: () => ({ notify: () => notified }),
  } as unknown as Parameters<typeof durableCardWatchers>[0];
  return { watches, answer };
}

describe("telling a card's open screens", () => {
  it("doesn't wait for them: the register gets its answer first, and the telling goes on after", async () => {
    const { watches, answer } = watchesThatWait();
    const later: Promise<unknown>[] = [];
    const watchers = durableCardWatchers(watches, (task) => later.push(task));
    // It would never end if it waited for the CardWatch.
    await watchers.changed("card-1", CHANGE);
    expect(later).toHaveLength(1);
    answer();
    await expect(later[0]).resolves.toBeUndefined();
  });

  it("if the CardWatch fails afterwards, nothing breaks: it's logged with why", async () => {
    const { watches, answer } = watchesThatWait();
    const later: Promise<unknown>[] = [];
    const logged: { error: unknown; cardId: string }[] = [];
    const watchers = durableCardWatchers(
      watches,
      (task) => later.push(task),
      (error, cardId) => logged.push({ error, cardId }),
    );
    await watchers.changed("card-1", CHANGE);
    answer(true);
    await later[0];
    expect(logged).toEqual([{ error: new Error("CardWatch down"), cardId: "card-1" }]);
  });

  it("without waitUntil it waits, and a failure doesn't reach the register either", async () => {
    const { watches, answer } = watchesThatWait();
    const logged: string[] = [];
    const watchers = durableCardWatchers(watches, undefined, (_, cardId) => logged.push(cardId));
    answer(true);
    await expect(watchers.changed("card-1", CHANGE)).resolves.toBeUndefined();
    expect(logged).toEqual(["card-1"]);
  });
});
