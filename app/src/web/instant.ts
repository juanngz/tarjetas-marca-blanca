// Changing screens without waiting for the server (10/10/2026): the database is in the EU, and from Buenos Aires
// each trip takes a while. When the phone kept the screen (web/offlineCopy.ts), going to it shows the copy at
// once, and the screen asks the server again right away (useFresh): what it says comes as any loaderData, so
// React Router handles it as always (a session that ended, an error, meta). Only when going to a screen: when
// the screen that's shown asks the server again (the sello en vivo, the connection coming back, useFresh), it
// waits for it, so what's shown never goes back to an older copy.
import { useEffect, useLayoutEffect, useRef } from "react";
import { type ShouldRevalidateFunctionArgs, useLocation, useRevalidator } from "react-router";
import { orWhatIsKept } from "./offline";

/** The copy, shown while the screen asks the server (useFresh). */
export type Waiting<K> = K & { waiting: true };

/** The address of the screen that's shown (the customer layout says it: useShownScreen). */
let shown: string | null = null;

const address = (url: { pathname: string; search: string }) => url.pathname + url.search;

/**
 * In the customer layout: which screen is shown, so a loader knows if it's going to it or asking again.
 * Before the screen's effects (a layout effect, in the same commit), so its first ask is already "again";
 * outside the customer screens, none.
 */
export function useShownScreen() {
  const location = useLocation();
  useLayoutEffect(() => {
    shown = address(location);
  }, [location]);
  useLayoutEffect(
    () => () => {
      shown = null;
    },
    [],
  );
}

/** Only for the tests. */
export function showing(url: string | null) {
  shown = url;
}

/**
 * A customer screen's clientLoader. Going to it: the phone's copy at once, and the screen asks the server
 * (useFresh). Without a copy, or asking again: what the server says, or the copy if it can't be reached.
 */
export async function keptFirst<T, K extends object>(
  request: Request,
  serverLoader: () => Promise<T>,
  kept: () => K | null,
): Promise<T | K | Waiting<K>> {
  const again = address(new URL(request.url)) === shown;
  const copy = again ? null : kept();
  if (!copy) return orWhatIsKept(serverLoader, kept);
  return { ...copy, waiting: true as const };
}

export function isWaiting<K>(data: unknown): data is Waiting<K> {
  return typeof data === "object" && data !== null && "waiting" in data;
}

/**
 * On a screen with keptFirst: while it shows the copy it went to, it asks the server again. Also if that was
 * interrupted (bringing another card to the front meanwhile doesn't ask it). `waiting` until it answers.
 */
export function useFresh(loaderData: unknown): { waiting: boolean } {
  const { revalidate, state } = useRevalidator();
  const askAgain = useRef(revalidate);
  askAgain.current = revalidate;
  const waiting = isWaiting(loaderData);

  useEffect(() => {
    if (waiting && state === "idle") void askAgain.current();
  }, [waiting, state]);

  return { waiting };
}

/**
 * The customer layout's shouldRevalidate: going from one screen to another doesn't ask it again (it only
 * checks the cookie, and the screen would wait for it). After a form, or when a screen asks again (which
 * renews the session), as always.
 */
export function revalidateOnlyWhenAsked({
  currentUrl,
  nextUrl,
  formMethod,
  defaultShouldRevalidate,
}: ShouldRevalidateFunctionArgs): boolean {
  if (formMethod || address(currentUrl) === address(nextUrl)) return defaultShouldRevalidate;
  return false;
}
