// CardWatchers (application/ports.ts) on Durable Objects: one CardWatch per card, by its id.
// Created close to the café, in South America (it only matters the first time).
// The register doesn't wait for it: its answer goes first, and the telling goes on after (waitUntil).
import type { CardWatchers } from "../../application/ports";
import { logError } from "../log.server";
import type { CardWatch } from "./cardWatch.server";

type Watches = DurableObjectNamespace<CardWatch>;

const near = { locationHint: "sam" } as const;

const watchOf = (watches: Watches, cardId: string) => watches.get(watches.idFromName(cardId), near);

const logFailed = (error: unknown, cardId: string) =>
  logError(error, `card-watch-failed ${cardId}`);

/**
 * It never fails (CardWatchers): a telling that fails is logged here, with why, and the entry still
 * counts. The code screen catches up when it comes back.
 * @param later Keeps the Worker running for what's left after answering (ctx.waitUntil). Without it (the
 *   server tests), the telling is waited for.
 */
export function durableCardWatchers(
  watches: Watches | undefined,
  later?: (task: Promise<unknown>) => void,
  report: (error: unknown, cardId: string) => void = logFailed,
): CardWatchers {
  return {
    async changed(cardId, change) {
      // Without the binding (the server tests), nobody is listening.
      if (!watches) return;
      const telling = (async () => {
        try {
          await watchOf(watches, cardId).notify(change);
        } catch (error) {
          report(error, cardId);
        }
      })();
      if (later) later(telling);
      else await telling;
    },
  };
}

/** Hands a code screen's WebSocket to its card's CardWatch. */
export function listenTo(watches: Watches, cardId: string, request: Request): Promise<Response> {
  return watchOf(watches, cardId).fetch(request);
}
